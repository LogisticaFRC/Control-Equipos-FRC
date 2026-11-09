-- =====================================================================
-- VEHÍCULOS · Operaciones → Equipos → Vehículos
-- Ejecutar UNA vez en Supabase → SQL Editor → Run (se puede repetir sin perder datos).
-- Requiere haber ejecutado antes sql/seguridad_paso1_auth_rls.sql (funciones frc_es_miembro / frc_puede).
-- ---------------------------------------------------------------------
-- Un vehículo es un registro de BD_INVENTARIO cuyo AFI es una PATENTE "XXXX-XX".
-- Estas tablas guardan lo propio del vehículo, unido por la patente (= BD_INVENTARIO.afi):
--   bd_vehiculos             N° AFI interno, mantención cada X km, días de aviso por defecto
--   bd_vehiculos_km          lecturas de kilometraje (tipo LECTURA o MANTENCION)
--   bd_vehiculos_documentos  documentos PRINCIPALES (REVISION_TECNICA, PERMISO_CIRCULACION, SOAP)
--                            y SECUNDARIOS, con emisión, duración, vencimiento y aviso
-- Archivos de documentos: bucket archivos_frc, carpeta vehiculos/<PATENTE>/
-- =====================================================================

create table if not exists public.bd_vehiculos (
  id            bigserial primary key,
  patente       text not null unique,          -- = BD_INVENTARIO.afi (XXXX-XX)
  numero_afi    text,                          -- N° AFI interno del vehículo
  frecuencia_km integer not null default 10000,
  dias_aviso    integer not null default 30,
  observacion   text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table if not exists public.bd_vehiculos_km (
  id          bigserial primary key,
  patente     text not null,
  fecha       date not null,
  km          numeric not null,
  tipo        text not null default 'LECTURA' check (tipo in ('LECTURA', 'MANTENCION')),
  observacion text,
  creado_por  text,
  created_at  timestamptz default now()
);
create index if not exists bd_vehiculos_km_patente_idx on public.bd_vehiculos_km (patente, fecha);

create table if not exists public.bd_vehiculos_documentos (
  id                bigserial primary key,
  patente           text not null,
  categoria         text not null default 'SECUNDARIO' check (categoria in ('PRINCIPAL', 'SECUNDARIO')),
  clave             text,                      -- PRINCIPAL: REVISION_TECNICA | PERMISO_CIRCULACION | SOAP
  nombre            text not null,
  numero            text,                      -- N° / folio (opcional)
  fecha_emision     date,
  duracion          numeric,                   -- cuánto dura el documento
  unidad            text not null default 'MESES' check (unidad in ('DIAS', 'MESES', 'ANIOS')),
  fecha_vencimiento date,                      -- emisión + duración (o escrita a mano)
  dias_aviso        integer not null default 30,
  link              text,                      -- archivo en Storage
  nombre_archivo    text,
  observacion       text,
  creado_por        text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
create index if not exists bd_vehiculos_docs_patente_idx on public.bd_vehiculos_documentos (patente, categoria, clave);

-- Permisos de la API
grant select, insert, update, delete on public.bd_vehiculos, public.bd_vehiculos_km, public.bd_vehiculos_documentos to authenticated;
grant usage, select on sequence public.bd_vehiculos_id_seq, public.bd_vehiculos_km_id_seq, public.bd_vehiculos_documentos_id_seq to authenticated;
revoke all on public.bd_vehiculos, public.bd_vehiculos_km, public.bd_vehiculos_documentos from anon;

-- RLS: leer = cualquier usuario conectado · agregar/modificar = Subadmin o Admin de Operaciones · eliminar = Admin de Operaciones
do $$
declare t text;
begin
  foreach t in array array['bd_vehiculos', 'bd_vehiculos_km', 'bd_vehiculos_documentos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists frc_leer on public.%I', t);
    execute format('drop policy if exists frc_agregar on public.%I', t);
    execute format('drop policy if exists frc_modificar on public.%I', t);
    execute format('drop policy if exists frc_eliminar on public.%I', t);
    execute format('create policy frc_leer on public.%I for select to authenticated using ((select public.frc_es_miembro()))', t);
    execute format('create policy frc_agregar on public.%I for insert to authenticated with check ((select public.frc_puede(array[''operaciones''], ''subadmin'')))', t);
    execute format('create policy frc_modificar on public.%I for update to authenticated using ((select public.frc_puede(array[''operaciones''], ''subadmin''))) with check ((select public.frc_puede(array[''operaciones''], ''subadmin'')))', t);
    execute format('create policy frc_eliminar on public.%I for delete to authenticated using ((select public.frc_puede(array[''operaciones''], ''admin'')))', t);
  end loop;
end $$;

-- Recarga el esquema para que la API vea las tablas nuevas
notify pgrst, 'reload schema';
