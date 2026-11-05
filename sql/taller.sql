-- =====================================================================
-- TALLER · Naves de reparación (Operaciones → Programas Reparación → Taller)
-- Ejecutar UNA vez en Supabase → SQL Editor → Run (se puede repetir sin perder datos).
-- Requiere haber ejecutado antes sql/seguridad_paso1_auth_rls.sql y sql/ot.sql.
-- ---------------------------------------------------------------------
-- bd_taller_reparaciones = cada equipo que entra al taller a reparar:
--   · del programa de reparación (programa_id + programa_item_id)  o
--   · "sin programa" (programa_id vacío) → lista "Equipos reparación sin programa"
-- estado: ESPERA (por ingresar) · EN_NAVE (está en una nave) · FALTANTES (salió sin terminar) · LISTO (reparado)
-- bd_ot.reparacion_id → enlaza una OT con la reparación (el avance % sale de sus actividades terminadas).
-- =====================================================================

create table if not exists public.bd_taller_reparaciones (
  id               bigserial primary key,
  afi              text not null,
  programa_id      bigint,                 -- bd_programas_calendarios.id (vacío = sin programa)
  programa_item_id bigint,                 -- bd_programas_items.id
  nave             text,                   -- NAVE 1..4 mientras está adentro (vacío = fuera de nave)
  estado           text not null default 'ESPERA',
  faltante         text,                   -- qué le falta (si salió sin terminar)
  observacion      text,
  fecha_ingreso    timestamptz,
  fecha_salida     timestamptz,
  historial        jsonb not null default '[]'::jsonb,   -- bitácora: ingresos / salidas
  creado_por       text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
create index if not exists bd_taller_rep_afi_idx on public.bd_taller_reparaciones (afi);
create index if not exists bd_taller_rep_item_idx on public.bd_taller_reparaciones (programa_item_id);
-- Una nave = un equipo (evita que dos PC ocupen la misma nave al mismo tiempo).
-- Si algún día una nave recibe 2 equipos, borrar este índice:  drop index public.bd_taller_rep_nave_unica;
create unique index if not exists bd_taller_rep_nave_unica on public.bd_taller_reparaciones (nave) where estado = 'EN_NAVE';

-- Enlace OT → reparación
alter table public.bd_ot add column if not exists reparacion_id bigint;
create index if not exists bd_ot_reparacion_idx on public.bd_ot (reparacion_id);

grant select, insert, update, delete on public.bd_taller_reparaciones to authenticated;
grant usage, select on sequence public.bd_taller_reparaciones_id_seq to authenticated;
revoke all on public.bd_taller_reparaciones from anon;

-- Permisos (RLS): leer = cualquier usuario conectado · ingresar/sacar/actualizar = Subadmin o Admin de Operaciones · eliminar = Admin
alter table public.bd_taller_reparaciones enable row level security;
drop policy if exists frc_leer on public.bd_taller_reparaciones;
drop policy if exists frc_agregar on public.bd_taller_reparaciones;
drop policy if exists frc_modificar on public.bd_taller_reparaciones;
drop policy if exists frc_eliminar on public.bd_taller_reparaciones;
create policy frc_leer on public.bd_taller_reparaciones for select to authenticated
  using ((select public.frc_es_miembro()));
create policy frc_agregar on public.bd_taller_reparaciones for insert to authenticated
  with check ((select public.frc_puede(array['operaciones'], 'subadmin')));
create policy frc_modificar on public.bd_taller_reparaciones for update to authenticated
  using ((select public.frc_puede(array['operaciones'], 'subadmin')))
  with check ((select public.frc_puede(array['operaciones'], 'subadmin')));
create policy frc_eliminar on public.bd_taller_reparaciones for delete to authenticated
  using ((select public.frc_puede(array['operaciones'], 'admin')));

notify pgrst, 'reload schema';
