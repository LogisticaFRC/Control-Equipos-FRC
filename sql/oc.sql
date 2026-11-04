-- =====================================================================
-- MÓDULO OC · Órdenes de Compra (registro histórico)
-- Ejecutar UNA vez en Supabase → SQL Editor → Run (se puede repetir sin perder datos).
-- Requiere haber ejecutado antes sql/seguridad_paso1_auth_rls.sql.
-- ---------------------------------------------------------------------
-- Enlace con mantenciones: NO hay llave foránea. Una mantención (BD_HISTORIAL)
-- guarda en su columna numero_oc uno o varios N° separados por coma ("4521, 4533").
-- La app une cada OC con la(s) mantención(es) que contienen su número.
-- Los documentos se suben al bucket existente "archivos_frc" (carpeta oc/).
-- =====================================================================

create table if not exists public.bd_oc (
  id              bigserial primary key,
  numero_oc       text not null,
  fecha           date default current_date,
  afi             text,
  proveedor       text,
  descripcion     text,
  precio          numeric(14,2) not null default 0,
  link            text,            -- URL del documento (PDF / imagen) en Storage
  archivo_nombre  text,
  creado_por      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- N° de OC único (sin distinguir mayúsculas ni espacios)
create unique index if not exists bd_oc_numero_uidx on public.bd_oc (upper(regexp_replace(numero_oc, '\s', '', 'g')));
create index if not exists bd_oc_afi_idx on public.bd_oc (afi);

-- updated_at automático
create or replace function public.frc_oc_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists frc_oc_touch on public.bd_oc;
create trigger frc_oc_touch before update on public.bd_oc for each row execute function public.frc_oc_touch();

grant select, insert, update, delete on public.bd_oc to authenticated;
grant usage, select on sequence public.bd_oc_id_seq to authenticated;
revoke all on public.bd_oc from anon;

-- Permisos (RLS): leer = cualquier usuario conectado · crear/editar = Subadmin o Admin de Operaciones · eliminar = Admin
alter table public.bd_oc enable row level security;
drop policy if exists frc_leer on public.bd_oc;
drop policy if exists frc_agregar on public.bd_oc;
drop policy if exists frc_modificar on public.bd_oc;
drop policy if exists frc_eliminar on public.bd_oc;
create policy frc_leer on public.bd_oc for select to authenticated
  using ((select public.frc_es_miembro()));
create policy frc_agregar on public.bd_oc for insert to authenticated
  with check ((select public.frc_puede(array['operaciones'], 'subadmin')));
create policy frc_modificar on public.bd_oc for update to authenticated
  using ((select public.frc_puede(array['operaciones'], 'subadmin')))
  with check ((select public.frc_puede(array['operaciones'], 'subadmin')));
create policy frc_eliminar on public.bd_oc for delete to authenticated
  using ((select public.frc_puede(array['operaciones'], 'admin')));
