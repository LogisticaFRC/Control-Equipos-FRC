-- =====================================================================
-- MÓDULO ÁREAS · Empresas → Áreas → Locaciones → Equipos (AFI)
-- Ejecutar UNA vez en Supabase → SQL Editor → Run (se puede repetir sin perder datos).
-- Requiere haber ejecutado antes sql/seguridad_paso1_auth_rls.sql.
-- ---------------------------------------------------------------------
-- Una sola tabla en árbol:
--   tipo = 'EMPRESA'  (padre_id = null)
--   tipo = 'AREA'     (padre_id = id de la empresa)
--   tipo = 'LOCACION' (padre_id = id del área)  ← aquí están los equipos
-- Cada equipo (BD_INVENTARIO) guarda su locacion_id. Las columnas de texto
-- "ubicacion" (= "ÁREA / LOCACIÓN") y "empresa_arriendo" (= EMPRESA) se siguen
-- llenando para que los demás módulos (Programas, Inventario, Excel) no cambien.
-- =====================================================================

create table if not exists public.bd_locaciones (
  id           bigserial primary key,
  tipo         text not null check (tipo in ('EMPRESA', 'AREA', 'LOCACION')),
  nombre       text not null,
  padre_id     bigint references public.bd_locaciones(id) on delete restrict,
  descripcion  text,
  lat          double precision,   -- georreferencia (ver también sql/areas_georef.sql)
  lng          double precision,
  maps_url     text,
  creado_por   text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- No se repite el mismo nombre dentro de la misma carpeta (sin distinguir mayúsculas ni espacios extra)
create unique index if not exists bd_locaciones_nombre_uidx
  on public.bd_locaciones (tipo, coalesce(padre_id, 0), upper(regexp_replace(trim(nombre), '\s+', ' ', 'g')));
create index if not exists bd_locaciones_padre_idx on public.bd_locaciones (padre_id);

create or replace function public.frc_locaciones_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists frc_locaciones_touch on public.bd_locaciones;
create trigger frc_locaciones_touch before update on public.bd_locaciones for each row execute function public.frc_locaciones_touch();

-- Georreferencia (por si la tabla ya existía sin estas columnas)
alter table public.bd_locaciones add column if not exists lat double precision;
alter table public.bd_locaciones add column if not exists lng double precision;
alter table public.bd_locaciones add column if not exists maps_url text;

-- Equipo → locación (si se elimina la locación, el equipo queda "Sin locación")
alter table public."BD_INVENTARIO" add column if not exists locacion_id bigint
  references public.bd_locaciones(id) on delete set null;
alter table public."BD_INVENTARIO" add column if not exists empresa_arriendo text;   -- por si no se ejecutó empresa_arriendo.sql
create index if not exists bd_inventario_locacion_idx on public."BD_INVENTARIO" (locacion_id);

-- Movimiento → locación de destino (el texto de destino se sigue guardando)
alter table public."BD_MOVIMIENTOS" add column if not exists locacion_id bigint
  references public.bd_locaciones(id) on delete set null;

-- Empresa por defecto (equipos Fuera de Servicio)
insert into public.bd_locaciones (tipo, nombre)
select 'EMPRESA', 'TALLER FRC'
where not exists (select 1 from public.bd_locaciones where tipo = 'EMPRESA' and upper(trim(nombre)) = 'TALLER FRC');

grant select, insert, update, delete on public.bd_locaciones to authenticated;
grant usage, select on sequence public.bd_locaciones_id_seq to authenticated;
revoke all on public.bd_locaciones from anon;

-- Permisos (RLS): leer = cualquier usuario conectado · crear/renombrar = Subadmin o Admin de Operaciones · eliminar = Admin
alter table public.bd_locaciones enable row level security;
drop policy if exists frc_leer on public.bd_locaciones;
drop policy if exists frc_agregar on public.bd_locaciones;
drop policy if exists frc_modificar on public.bd_locaciones;
drop policy if exists frc_eliminar on public.bd_locaciones;
create policy frc_leer on public.bd_locaciones for select to authenticated
  using ((select public.frc_es_miembro()));
create policy frc_agregar on public.bd_locaciones for insert to authenticated
  with check ((select public.frc_puede(array['operaciones'], 'subadmin')));
create policy frc_modificar on public.bd_locaciones for update to authenticated
  using ((select public.frc_puede(array['operaciones'], 'subadmin')))
  with check ((select public.frc_puede(array['operaciones'], 'subadmin')));
create policy frc_eliminar on public.bd_locaciones for delete to authenticated
  using ((select public.frc_puede(array['operaciones'], 'admin')));

notify pgrst, 'reload schema';
