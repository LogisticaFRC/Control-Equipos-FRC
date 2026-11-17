-- =====================================================================
-- CHOFER · Check list / Report Camión Pluma (FRC-RE-OPE-018) · 2026-11-17
-- Ejecutar UNA vez en Supabase → SQL Editor → Run.
--   · bd_checklist_chofer: cada check list enviado (datos completos en jsonb)
--   · frc_chofer_guardar(p_datos): guarda el check list, registra cada traslado con AFI
--     en BD_MOVIMIENTOS (camión + chofer) y actualiza el km del camión si es mayor.
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

  -- Traslados → BD_MOVIMIENTOS (solo informativo: no cambia la ubicación del equipo en el inventario)
  for a in select * from jsonb_array_elements(coalesce(p_datos->'actividades', '[]'::jsonb)) loop
    if coalesce(trim(a->>'afi'), '') <> '' then
      insert into public."BD_MOVIMIENTOS" (afi, fecha, tipo, ubicacion_anterior, ubicacion_actual, estado, camion_encargado, conductor_encargado)
      select r.afi, r.fecha, r.tipo, r.ubicacion_anterior, r.ubicacion_actual, r.estado, r.camion_encargado, r.conductor_encargado
      from jsonb_populate_record(null::public."BD_MOVIMIENTOS", jsonb_build_object(
        'afi', upper(trim(a->>'afi')),
        'fecha', coalesce(v_fecha, current_date)::text,
        'tipo', trim(both ' ·' from concat_ws(' · ', nullif(a->>'tipo_equipo', ''), nullif(a->>'traslado', ''), 'CHOFER')),
        'ubicacion_anterior', coalesce(a->>'desde', ''),
        'ubicacion_actual', coalesce(a->>'hasta', ''),
        'estado', '',
        'camion_encargado', v_patente,
        'conductor_encargado', upper(v_chofer)
      )) r;
    end if;
  end loop;

  -- Kilometraje del camión (BD_INVENTARIO.horometroactual = km para patentes): solo si sube
  begin
    v_km := nullif(regexp_replace(coalesce(p_datos->>'km_fin', ''), '[^0-9]', '', 'g'), '')::numeric;
  exception when others then v_km := null; end;
  if v_km is not null and v_km > 0 then
    update public."BD_INVENTARIO"
       set horometroactual = v_km, fecha_horometro_manual = coalesce(v_fecha, current_date)
     where upper(trim(afi::text)) = v_patente and coalesce(horometroactual, 0) < v_km;
  end if;

  return v_id;
end $$;

revoke all on function public.frc_chofer_guardar(jsonb) from public, anon;
grant execute on function public.frc_chofer_guardar(jsonb) to authenticated;

notify pgrst, 'reload schema';
