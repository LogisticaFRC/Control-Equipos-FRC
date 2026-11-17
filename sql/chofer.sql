-- =====================================================================
-- CHOFER · Check list / Report Camión Pluma (FRC-RE-OPE-018) · 2026-11-17
-- Ejecutar UNA vez en Supabase → SQL Editor → Run.
--   · bd_checklist_chofer: cada check list enviado (datos completos en jsonb)
--   · frc_chofer_guardar(p_datos): guarda el check list, registra cada traslado con AFI
--     en BD_MOVIMIENTOS (camión + chofer + fotos), deja el equipo en la nueva ubicación del
--     Inventario (ubicación / locación / empresa, igual que Movimientos) y actualiza el km del camión
--     si la fecha es igual o más reciente que la del último km (y lo anota en bd_vehiculos_km).
-- Se puede volver a ejecutar sin problema (2026-11-17: ubicación del equipo + fotos).
-- El chofer es un usuario con permisos { mecanicos: 'subadmin', mec_modo: 'chofer' }.
-- =====================================================================

create table if not exists public.bd_checklist_chofer (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  usuario     text not null,
  fecha       date,
  patente     text,
  datos       jsonb not null default '{}'::jsonb
);
-- Lugares nuevos escritos por choferes ("Otro lugar"): alerta en Áreas y Locaciones (2026-11-17)
create table if not exists public.bd_lugares_nuevos (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),
  lugar         text not null,
  afi           text,
  subarrendado  boolean not null default false,
  fecha         date,
  patente       text,
  chofer        text,
  checklist_id  bigint,
  estado        text not null default 'PENDIENTE',   -- PENDIENTE | ASIGNADO | DESCARTADO
  locacion_id   bigint,
  revisado_por  text,
  revisado_at   timestamptz
);
alter table public.bd_lugares_nuevos enable row level security;
drop policy if exists frc_ver on public.bd_lugares_nuevos;
create policy frc_ver on public.bd_lugares_nuevos for select to authenticated using ((select public.frc_es_miembro()));
drop policy if exists frc_modificar on public.bd_lugares_nuevos;
create policy frc_modificar on public.bd_lugares_nuevos for update to authenticated
  using ((select public.frc_puede(array['operaciones'], 'subadmin'))) with check ((select public.frc_puede(array['operaciones'], 'subadmin')));
-- Insertar: solo con frc_chofer_guardar.

-- Fotos del equipo en cada movimiento (2026-11-17)
alter table public."BD_MOVIMIENTOS" add column if not exists fotos jsonb;

create index if not exists bd_checklist_chofer_usuario on public.bd_checklist_chofer (usuario, id desc);

alter table public.bd_checklist_chofer enable row level security;
drop policy if exists frc_ver on public.bd_checklist_chofer;
create policy frc_ver on public.bd_checklist_chofer for select to authenticated
  using ((select public.frc_es_miembro()));
drop policy if exists frc_eliminar on public.bd_checklist_chofer;
create policy frc_eliminar on public.bd_checklist_chofer for delete to authenticated
  using ((select public.frc_puede(array['operaciones'], 'admin')));
-- Insertar: solo con la función de abajo.

create or replace function public.frc_chofer_guardar(p_datos jsonb)
returns bigint language plpgsql security definer
set search_path = public as $$
declare
  v_usuario text;
  v_id bigint;
  v_fecha date := nullif(p_datos->>'fecha', '')::date;
  v_patente text := upper(trim(coalesce(p_datos->>'patente', '')));
  v_chofer text := coalesce(nullif(p_datos->>'chofer', ''), '');
  v_km numeric;
  v_cols text;
  v_mov jsonb;
  v_inv jsonb;
  v_set text;
  a jsonb;
begin
  if not public.frc_puede(array['mecanicos', 'operaciones'], 'subadmin') then
    raise exception 'Sin permiso para registrar check list.';
  end if;
  select usuario into v_usuario from public.usuarios where auth_id = auth.uid();
  if v_patente = '' then raise exception 'Falta la patente del camión.'; end if;

  insert into public.bd_checklist_chofer (usuario, fecha, patente, datos)
  values (v_usuario, coalesce(v_fecha, current_date), v_patente, p_datos)
  returning id into v_id;

  -- Columnas de BD_MOVIMIENTOS que existen (locacion_id viene de sql/areas.sql; fotos se agrega arriba)
  select string_agg(quote_ident(column_name), ', ') into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'BD_MOVIMIENTOS'
     and column_name = any (array['afi','fecha','tipo','ubicacion_anterior','ubicacion_actual','empresa_arriendo','estado',
                                  'camion_encargado','conductor_encargado','locacion_id','fotos']);

  for a in select * from jsonb_array_elements(coalesce(p_datos->'actividades', '[]'::jsonb)) loop
    if coalesce(trim(a->>'afi'), '') = '' then continue; end if;

    -- 1) Movimiento (igual que "Registrar nuevo movimiento")
    v_mov := jsonb_build_object(
      'afi', upper(trim(a->>'afi')),
      'fecha', coalesce(v_fecha, current_date)::text,
      'tipo', trim(both ' ·' from concat_ws(' · ', nullif(a->>'tipo_equipo', ''), nullif(a->>'traslado', ''),
                case when coalesce((a->>'subarrendado')::boolean, false) then 'SUBARRENDADO' || coalesce(': ' || nullif(upper(a->>'equipo'), ''), '') end, 'CHOFER')),
      'ubicacion_anterior', coalesce(a->>'desde', ''),
      'ubicacion_actual', coalesce(a->>'hasta', ''),
      'empresa_arriendo', upper(coalesce(a->>'empresa', '')),
      'estado', '',
      'camion_encargado', v_patente,
      'conductor_encargado', upper(v_chofer),
      'locacion_id', nullif(a->>'locacion_id', ''),
      'fotos', coalesce(a->'fotos', '[]'::jsonb));
    execute format('insert into public."BD_MOVIMIENTOS" (%1$s) select %1$s from jsonb_populate_record(null::public."BD_MOVIMIENTOS", $1)', v_cols)
      using v_mov;

    -- Lugar escrito a mano ("Otro lugar") → aviso en Áreas y Locaciones
    if coalesce((a->>'lugar_nuevo')::boolean, false) and coalesce(trim(a->>'hasta'), '') <> '' then
      insert into public.bd_lugares_nuevos (lugar, afi, subarrendado, fecha, patente, chofer, checklist_id)
      values (upper(trim(a->>'hasta')), upper(trim(a->>'afi')), coalesce((a->>'subarrendado')::boolean, false),
              coalesce(v_fecha, current_date), v_patente, upper(v_chofer), v_id);
    end if;

    -- 2) Ubicación del equipo en el Inventario (si existe y se indicó destino)
    -- (subarrendado = solo información: no está en el inventario)
    if coalesce(trim(a->>'hasta'), '') <> '' and not coalesce((a->>'subarrendado')::boolean, false) then
      v_inv := jsonb_build_object('ubicacion', a->>'hasta');
      if nullif(a->>'locacion_id', '') is not null then v_inv := v_inv || jsonb_build_object('locacion_id', a->>'locacion_id'); end if;
      if coalesce(a->>'empresa', '') <> '' then v_inv := v_inv || jsonb_build_object('empresa_arriendo', upper(a->>'empresa')); end if;
      select string_agg(format('%1$I = r.%1$I', column_name), ', ') into v_set
        from information_schema.columns
       where table_schema = 'public' and table_name = 'BD_INVENTARIO' and column_name in (select jsonb_object_keys(v_inv));
      if v_set is not null then
        execute format('update public."BD_INVENTARIO" i set %s from jsonb_populate_record(null::public."BD_INVENTARIO", $1) r where upper(trim(i.afi::text)) = $2', v_set)
          using v_inv, upper(trim(a->>'afi'));
      end if;
    end if;
  end loop;

  -- Kilometraje del camión (BD_INVENTARIO.horometroactual = km para patentes), con la misma regla que
  -- Vehículos → "Registrar km": pasa a ser el km actual solo si la fecha del check list es IGUAL o MÁS
  -- RECIENTE que la del último km registrado (un check list atrasado no pisa uno más nuevo).
  -- Se usa el km de término (si no hay, el de inicio). La lectura queda además en la bitácora bd_vehiculos_km.
  begin
    v_km := nullif(regexp_replace(coalesce(nullif(p_datos->>'km_fin', ''), p_datos->>'km_ini', ''), '[^0-9]', '', 'g'), '')::numeric;
  exception when others then v_km := null; end;
  if v_km is not null and v_km > 0 then
    update public."BD_INVENTARIO"
       set horometroactual = v_km, fecha_horometro_manual = coalesce(v_fecha, current_date)
     where upper(trim(afi::text)) = v_patente
       and (fecha_horometro_manual is null or coalesce(v_fecha, current_date) >= fecha_horometro_manual::date);
    if to_regclass('public.bd_vehiculos_km') is not null then
      execute 'insert into public.bd_vehiculos_km (patente, fecha, km, tipo, observacion, creado_por) values ($1, $2, $3, $4, $5, $6)'
        using v_patente, coalesce(v_fecha, current_date), v_km, 'LECTURA', 'Check list chofer N° ' || v_id, v_usuario;
    end if;
  end if;

  return v_id;
end $$;

revoke all on function public.frc_chofer_guardar(jsonb) from public, anon;
grant execute on function public.frc_chofer_guardar(jsonb) to authenticated;

notify pgrst, 'reload schema';
