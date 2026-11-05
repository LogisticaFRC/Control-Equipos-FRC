-- =====================================================================
-- TALLER · Firmas en la OT + "Enviar nuevo problema para OT"
-- Ejecutar UNA vez en Supabase → SQL Editor → Run (se puede repetir sin perder datos).
-- Requiere haber ejecutado antes sql/taller.sql.
-- =====================================================================

-- Firmas dibujadas (imagen) del mecánico y supervisor responsables.
-- Las firmas del "Personal asignado" van dentro de bd_ot.personal (no necesitan columna).
alter table public.bd_ot add column if not exists firmas jsonb not null default '{}'::jsonb;

-- Problemas nuevos que encuentra el mecánico: el Admin los agrega a la OT o los rechaza.
create table if not exists public.bd_taller_problemas (
  id             bigserial primary key,
  reparacion_id  bigint not null,          -- bd_taller_reparaciones.id
  ot_id          bigint,                   -- bd_ot.id (OT donde se agregó / OT abierta al enviarlo)
  afi            text,
  nave           text,
  descripcion    text not null,
  reportado_por  text,
  estado         text not null default 'PENDIENTE',   -- PENDIENTE | AGREGADO | RECHAZADO
  respuesta      text,
  procesado_por  text,
  procesado_at   timestamptz,
  created_at     timestamptz default now()
);
create index if not exists bd_taller_problemas_rep_idx on public.bd_taller_problemas (reparacion_id);

grant select, insert, update, delete on public.bd_taller_problemas to authenticated;
grant usage, select on sequence public.bd_taller_problemas_id_seq to authenticated;
revoke all on public.bd_taller_problemas from anon;

-- Permisos: leer = todos los conectados · enviar = Subadmin o Admin · procesar/eliminar = Admin de Operaciones
alter table public.bd_taller_problemas enable row level security;
drop policy if exists frc_leer on public.bd_taller_problemas;
drop policy if exists frc_agregar on public.bd_taller_problemas;
drop policy if exists frc_modificar on public.bd_taller_problemas;
drop policy if exists frc_eliminar on public.bd_taller_problemas;
create policy frc_leer on public.bd_taller_problemas for select to authenticated
  using ((select public.frc_es_miembro()));
create policy frc_agregar on public.bd_taller_problemas for insert to authenticated
  with check ((select public.frc_puede(array['operaciones'], 'subadmin')));
create policy frc_modificar on public.bd_taller_problemas for update to authenticated
  using ((select public.frc_puede(array['operaciones'], 'admin')))
  with check ((select public.frc_puede(array['operaciones'], 'admin')));
create policy frc_eliminar on public.bd_taller_problemas for delete to authenticated
  using ((select public.frc_puede(array['operaciones'], 'admin')));

notify pgrst, 'reload schema';
