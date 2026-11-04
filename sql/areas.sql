-- =====================================================================
-- MÓDULO ÁREAS · Empresas → Áreas → Sectores → Locaciones → Equipos (AFI) + Georreferencia
-- SCRIPT COMPLETO: crea todo lo del módulo (incluye lo de areas_georef.sql).
-- Ejecutar UNA vez en Supabase → SQL Editor → Run (se puede repetir sin perder datos).
-- Requiere haber ejecutado antes sql/seguridad_paso1_auth_rls.sql.
-- ---------------------------------------------------------------------
-- Una sola tabla en árbol:
--   tipo = 'EMPRESA'  (padre_id = null)
--   tipo = 'AREA'     (padre_id = id de la empresa)
--   tipo = 'SECTOR'   (padre_id = id del área)
--   tipo = 'LOCACION' (padre_id = id del sector)  ← aquí están los equipos
-- Cada equipo (BD_INVENTARIO) guarda su locacion_id. Las columnas de texto
-- "ubicacion" (= "ÁREA / SECTOR / LOCACIÓN") y "empresa_arriendo" (= EMPRESA) se siguen
-- llenando para que los demás módulos (Programas, Inventario, Excel) no cambien.
-- =====================================================================

create table if not exists public.bd_locaciones (
  id           bigserial primary key,
  tipo         text not null,
  nombre       text not null,
  padre_id     bigint references public.bd_locaciones(id) on delete restrict,
  descripcion  text,
  lat          double precision,   -- georreferencia: latitud  (ej. -33.4489)
  lng          double precision,   -- georreferencia: longitud (ej. -70.6693)
  maps_url     text,               -- link de Google Maps pegado por el usuario
  creado_por   text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Tipos permitidos (se recrea para agregar SECTOR si la tabla ya existía)
alter table public.bd_locaciones drop constraint if exists bd_locaciones_tipo_check;
alter table public.bd_locaciones add constraint bd_locaciones_tipo_check check (tipo in ('EMPRESA', 'AREA', 'SECTOR', 'LOCACION'));

-- No se repite el mismo nombre dentro de la misma carpeta (sin distinguir mayúsculas ni espacios extra)
create unique index if not exists bd_locaciones_nombre_uidx
  on public.bd_locaciones (tipo, coalesce(padre_id, 0), upper(regexp_replace(trim(nombre), '\s+', ' ', 'g')));
create index if not exists bd_locaciones_padre_idx on public.bd_locaciones (padre_id);

create or replace function public.frc_locaciones_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists frc_locaciones_touch on public.bd_locaciones;
create trigger frc_locaciones_touch before update on public.bd_locaciones for each row execute function public.frc_locaciones_touch();

-- Jerarquía obligatoria: EMPRESA (sin padre) → AREA → SECTOR → LOCACION
create or replace function public.frc_locaciones_jerarquia() returns trigger language plpgsql as $$
declare tipo_padre text;
begin
  new.tipo := upper(new.tipo);
  if new.padre_id is null then
    if new.tipo <> 'EMPRESA' then raise exception 'Un(a) % debe estar dentro de su carpeta superior', new.tipo; end if;
    return new;
  end if;
  select tipo into tipo_padre from public.bd_locaciones where id = new.padre_id;
  if (new.tipo = 'AREA'     and tipo_padre is distinct from 'EMPRESA')
  or (new.tipo = 'SECTOR'   and tipo_padre is distinct from 'AREA')
  or (new.tipo = 'LOCACION' and tipo_padre is distinct from 'SECTOR')
  or  new.tipo = 'EMPRESA' then
    raise exception 'Jerarquía inválida: % no puede ir dentro de %', new.tipo, coalesce(tipo_padre, '?');
  end if;
  return new;
end $$;

-- Migración: locaciones que estaban directo en un área (versión anterior sin sectores)
-- → se crea el sector "GENERAL" en esa área y se mueven ahí (los equipos no se pierden).
drop trigger if exists frc_locaciones_jerarquia on public.bd_locaciones;
insert into public.bd_locaciones (tipo, nombre, padre_id, creado_por)
select distinct 'SECTOR', 'GENERAL', l.padre_id, 'migración'
from public.bd_locaciones l join public.bd_locaciones a on a.id = l.padre_id
where l.tipo = 'LOCACION' and a.tipo = 'AREA'
  and not exists (select 1 from public.bd_locaciones s where s.tipo = 'SECTOR' and s.padre_id = l.padre_id and upper(trim(s.nombre)) = 'GENERAL');
update public.bd_locaciones l set padre_id = s.id
from public.bd_locaciones a, public.bd_locaciones s
where l.tipo = 'LOCACION' and a.id = l.padre_id and a.tipo = 'AREA'
  and s.tipo = 'SECTOR' and s.padre_id = a.id and upper(trim(s.nombre)) = 'GENERAL';
create trigger frc_locaciones_jerarquia before insert or update of tipo, padre_id on public.bd_locaciones
  for each row execute function public.frc_locaciones_jerarquia();

-- Georreferencia (por si la tabla ya existía sin estas columnas)
alter table public.bd_locaciones add column if not exists lat double precision;
alter table public.bd_locaciones add column if not exists lng double precision;
alter table public.bd_locaciones add column if not exists maps_url text;
alter table public.bd_locaciones drop constraint if exists bd_locaciones_latlng_chk;
alter table public.bd_locaciones add constraint bd_locaciones_latlng_chk check (
  (lat is null and lng is null) or (lat between -90 and 90 and lng between -180 and 180)
);

-- Equipo → locación (si se elimina la locación, el equipo queda "Sin locación")
alter table public."BD_INVENTARIO" add column if not exists locacion_id bigint
  references public.bd_locaciones(id) on delete set null;
alter table public."BD_INVENTARIO" add column if not exists empresa_arriendo text;   -- por si no se ejecutó empresa_arriendo.sql
create index if not exists bd_inventario_locacion_idx on public."BD_INVENTARIO" (locacion_id);

-- Movimiento → locación de destino (el texto de destino se sigue guardando)
alter table public."BD_MOVIMIENTOS" add column if not exists locacion_id bigint
  references public.bd_locaciones(id) on delete set null;

-- Texto de ubicación de los equipos = "ÁREA / SECTOR / LOCACIÓN" (y empresa) según su locación
update public."BD_INVENTARIO" i
   set ubicacion = a.nombre || ' / ' || s.nombre || ' / ' || l.nombre,
       empresa_arriendo = case when lower(coalesce(i.disponibilidad, '')) like '%fuera%' then 'TALLER FRC' else e.nombre end
  from public.bd_locaciones l
  join public.bd_locaciones s on s.id = l.padre_id
  join public.bd_locaciones a on a.id = s.padre_id
  join public.bd_locaciones e on e.id = a.padre_id
 where i.locacion_id = l.id
   and i.ubicacion is distinct from (a.nombre || ' / ' || s.nombre || ' / ' || l.nombre);

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
