-- =====================================================================
-- TERRENO CRTG + PEDIDA DE REPUESTOS (2026-11-17)
-- Ejecutar en Supabase → SQL Editor → Run (se puede volver a ejecutar).
--   · Técnico CRTG = usuario con permisos { mecanicos: 'subadmin', mec_modo: 'crtg' }
--   · frc_crtg_ubicacion: cambia la ubicación de un equipo de CRTG (queda como movimiento)
--   · Programa de mantención CRTG: el técnico reporta "realizado / no realizado" (columnas crtg_*)
--   · bd_pedidos_repuestos: pedidos de repuestos (CRTG y otros), con hasta 5 fotos
--   · bd_taller_problemas.repuesto_estado: estado del repuesto pedido desde el taller
-- =====================================================================

-- ---------- 1) Ubicación de un equipo de CRTG (desde la app) ----------
create or replace function public.frc_crtg_ubicacion(p_afi text, p_texto text, p_locacion_id text default null, p_empresa text default null)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_yo text; v_ant text; v_cols text; v_mov jsonb; v_inv jsonb; v_set text;
begin
  if not public.frc_puede(array['mecanicos', 'operaciones'], 'subadmin') then raise exception 'Sin permiso.'; end if;
  if coalesce(trim(p_texto), '') = '' then raise exception 'Falta la ubicación.'; end if;
  select usuario into v_yo from public.usuarios where auth_id = auth.uid();
  select ubicacion into v_ant from public."BD_INVENTARIO" where upper(trim(afi::text)) = upper(trim(p_afi));
  if not found then raise exception 'No existe el AFI %', p_afi; end if;

  -- Movimiento (para que quede el historial)
  select string_agg(quote_ident(column_name), ', ') into v_cols from information_schema.columns
   where table_schema = 'public' and table_name = 'BD_MOVIMIENTOS'
     and column_name = any (array['afi','fecha','tipo','ubicacion_anterior','ubicacion_actual','empresa_arriendo','estado','camion_encargado','conductor_encargado','locacion_id']);
  v_mov := jsonb_build_object('afi', upper(trim(p_afi)), 'fecha', current_date::text, 'tipo', 'CAMBIO UBICACIÓN · CRTG',
    'ubicacion_anterior', coalesce(v_ant, ''), 'ubicacion_actual', upper(trim(p_texto)), 'empresa_arriendo', upper(coalesce(nullif(p_empresa, ''), 'CRTG')),
    'estado', '', 'camion_encargado', '', 'conductor_encargado', upper(coalesce(v_yo, '')), 'locacion_id', nullif(p_locacion_id, ''));
  execute format('insert into public."BD_MOVIMIENTOS" (%1$s) select %1$s from jsonb_populate_record(null::public."BD_MOVIMIENTOS", $1)', v_cols) using v_mov;

  -- Inventario
  v_inv := jsonb_build_object('ubicacion', upper(trim(p_texto)));
  if nullif(p_locacion_id, '') is not null then v_inv := v_inv || jsonb_build_object('locacion_id', p_locacion_id); end if;
  select string_agg(format('%1$I = r.%1$I', column_name), ', ') into v_set from information_schema.columns
   where table_schema = 'public' and table_name = 'BD_INVENTARIO' and column_name in (select jsonb_object_keys(v_inv));
  execute format('update public."BD_INVENTARIO" i set %s from jsonb_populate_record(null::public."BD_INVENTARIO", $1) r where upper(trim(i.afi::text)) = $2', v_set)
    using v_inv, upper(trim(p_afi));
end $$;
revoke all on function public.frc_crtg_ubicacion(text, text, text, text) from public, anon;
grant execute on function public.frc_crtg_ubicacion(text, text, text, text) to authenticated;

-- ---------- 2) Programa de mantención CRTG: reporte del técnico ----------
alter table public.bd_programas_items add column if not exists crtg_estado text;        -- REALIZADO | NO_REALIZADO
alter table public.bd_programas_items add column if not exists crtg_obs text;
alter table public.bd_programas_items add column if not exists crtg_por text;
alter table public.bd_programas_items add column if not exists crtg_fecha timestamptz;

create or replace function public.frc_crtg_programa(p_item bigint, p_estado text, p_obs text default '')
returns void language plpgsql security definer
set search_path = public as $$
declare v_yo text;
begin
  if not public.frc_puede(array['mecanicos', 'operaciones'], 'subadmin') then raise exception 'Sin permiso.'; end if;
  if p_estado is not null and p_estado not in ('REALIZADO', 'NO_REALIZADO') then raise exception 'Estado inválido.'; end if;
  select coalesce(nullif(nombre, ''), usuario) into v_yo from public.usuarios where auth_id = auth.uid();
  update public.bd_programas_items
     set crtg_estado = p_estado, crtg_obs = nullif(trim(coalesce(p_obs, '')), ''),
         crtg_por = case when p_estado is null then null else upper(v_yo) end,
         crtg_fecha = case when p_estado is null then null else now() end
   where id = p_item;
  if not found then raise exception 'No existe el ítem %', p_item; end if;
end $$;
revoke all on function public.frc_crtg_programa(bigint, text, text) from public, anon;
grant execute on function public.frc_crtg_programa(bigint, text, text) to authenticated;

-- ---------- 3) Pedidos de repuestos ----------
create table if not exists public.bd_pedidos_repuestos (
  id             bigserial primary key,
  created_at     timestamptz not null default now(),
  origen         text not null default 'CRTG',      -- CRTG | TERRENO | OTRO
  afi            text not null,
  equipo         text,
  fecha          date not null default current_date,
  descripcion    text not null,
  fotos          jsonb not null default '[]'::jsonb, -- hasta 5 URL
  solicitante    text,
  usuario        text,
  estado         text not null default 'PENDIENTE', -- PENDIENTE | PEDIDO | RECIBIDO | RECHAZADO
  fecha_aprox    date,
  nota           text,
  actualizado_por text,
  updated_at     timestamptz
);
alter table public.bd_pedidos_repuestos enable row level security;
drop policy if exists frc_ver on public.bd_pedidos_repuestos;
create policy frc_ver on public.bd_pedidos_repuestos for select to authenticated using ((select public.frc_es_miembro()));
drop policy if exists frc_agregar on public.bd_pedidos_repuestos;
create policy frc_agregar on public.bd_pedidos_repuestos for insert to authenticated
  with check ((select public.frc_puede(array['mecanicos', 'operaciones'], 'subadmin')) and jsonb_array_length(fotos) <= 5);
drop policy if exists frc_modificar on public.bd_pedidos_repuestos;
create policy frc_modificar on public.bd_pedidos_repuestos for update to authenticated
  using ((select public.frc_puede(array['operaciones'], 'subadmin'))) with check ((select public.frc_puede(array['operaciones'], 'subadmin')));
drop policy if exists frc_eliminar on public.bd_pedidos_repuestos;
create policy frc_eliminar on public.bd_pedidos_repuestos for delete to authenticated using ((select public.frc_puede(array['operaciones'], 'admin')));

-- ---------- 4) Estado del repuesto pedido desde el taller ----------
alter table public.bd_taller_problemas add column if not exists repuesto_estado text default 'PENDIENTE';

notify pgrst, 'reload schema';
