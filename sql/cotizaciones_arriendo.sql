-- =====================================================================
-- CALCULADORA DE ARRIENDO · cotizaciones guardadas (2026-11-24)
-- Ejecutar en Supabase → SQL Editor → Run (se puede volver a ejecutar).
-- Módulo de PRUEBA: solo el Admin general puede ver, crear, modificar y eliminar.
-- Los parámetros (precio diésel, tipos de camión, peajes, etc.) se guardan en bd_config (clave 'calc_arriendo').
-- =====================================================================
create table if not exists public.bd_cotizaciones_arriendo (
  id             bigserial primary key,
  created_at     timestamptz not null default now(),
  tipo_calculo   text not null default 'CAMION',   -- CAMION | EQUIPO (más adelante)
  nombre         text not null,
  cliente        text,
  fecha          date not null default current_date,
  afi            text,
  tipo_vehiculo  text,
  modalidad      text,                             -- flete | dias | mes
  datos          jsonb not null default '{}'::jsonb, -- todo el formulario
  parametros     jsonb,                            -- precio diésel y tipo usados al cotizar
  costo_total    numeric,
  neto           numeric,
  total          numeric,
  usuario        text
);
create index if not exists bd_cotizaciones_arriendo_fecha_idx on public.bd_cotizaciones_arriendo (created_at desc);
grant select, insert, update, delete on public.bd_cotizaciones_arriendo to authenticated;
grant usage, select on sequence public.bd_cotizaciones_arriendo_id_seq to authenticated;
alter table public.bd_cotizaciones_arriendo enable row level security;
drop policy if exists frc_ver on public.bd_cotizaciones_arriendo;
create policy frc_ver on public.bd_cotizaciones_arriendo for select to authenticated using ((select public.frc_es_admin_general()));
drop policy if exists frc_agregar on public.bd_cotizaciones_arriendo;
create policy frc_agregar on public.bd_cotizaciones_arriendo for insert to authenticated with check ((select public.frc_es_admin_general()));
drop policy if exists frc_modificar on public.bd_cotizaciones_arriendo;
create policy frc_modificar on public.bd_cotizaciones_arriendo for update to authenticated
  using ((select public.frc_es_admin_general())) with check ((select public.frc_es_admin_general()));
drop policy if exists frc_eliminar on public.bd_cotizaciones_arriendo;
create policy frc_eliminar on public.bd_cotizaciones_arriendo for delete to authenticated using ((select public.frc_es_admin_general()));

notify pgrst, 'reload schema';
