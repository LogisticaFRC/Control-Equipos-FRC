-- =====================================================================
-- TALLER · Bitácora de enlaces OT ↔ taller (Programas Reparación → OT enlazadas)
-- Ejecutar UNA vez en Supabase → SQL Editor → Run (se puede repetir sin perder datos).
-- Requiere haber ejecutado antes sql/seguridad_paso1_auth_rls.sql, sql/ot.sql y sql/taller.sql.
-- ---------------------------------------------------------------------
-- Cada vez que una OT se enlaza o se quita del taller queda una fila aquí (no se modifica después).
-- accion: CREADA (OT creada ya enlazada) · ENLAZADA · QUITADA
-- Se guarda el texto del programa / nave del momento para que el historial no cambie
-- aunque después se borre la reparación o el programa.
-- =====================================================================
create table if not exists public.bd_ot_enlaces (
  id             bigserial primary key,
  ot_id          bigint,
  folio          text,
  afi            text,
  reparacion_id  bigint,
  programa_id    bigint,
  programa       text,
  nave           text,
  accion         text not null,
  detalle        text,
  quien          text,
  created_at     timestamptz default now()
);
create index if not exists bd_ot_enlaces_fecha_idx on public.bd_ot_enlaces (created_at desc);
create index if not exists bd_ot_enlaces_ot_idx on public.bd_ot_enlaces (ot_id);

grant select, insert, delete on public.bd_ot_enlaces to authenticated;
grant usage, select on sequence public.bd_ot_enlaces_id_seq to authenticated;
revoke all on public.bd_ot_enlaces from anon;

-- Permisos (RLS): leer = Admin de Operaciones · registrar = Subadmin o Admin de Operaciones · eliminar = Admin general
alter table public.bd_ot_enlaces enable row level security;
drop policy if exists frc_leer on public.bd_ot_enlaces;
drop policy if exists frc_agregar on public.bd_ot_enlaces;
drop policy if exists frc_eliminar on public.bd_ot_enlaces;
create policy frc_leer on public.bd_ot_enlaces for select to authenticated
  using ((select public.frc_puede(array['operaciones'], 'admin')));
create policy frc_agregar on public.bd_ot_enlaces for insert to authenticated
  with check ((select public.frc_puede(array['operaciones'], 'subadmin')));
create policy frc_eliminar on public.bd_ot_enlaces for delete to authenticated
  using ((select public.frc_es_admin_general()));

notify pgrst, 'reload schema';
