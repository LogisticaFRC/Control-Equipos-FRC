-- =====================================================================
-- COSTOS DE MANTENCIÓN · configuración compartida (qué filtros van en 250 / 500 / 1000 hrs,
-- costo adicional por mantención y horas a proyectar por defecto).
-- Ejecutar UNA vez en Supabase → SQL Editor → Run (se puede repetir sin perder datos).
-- Requiere sql/seguridad_paso1_auth_rls.sql (funciones frc_es_miembro / frc_puede).
-- Tabla genérica: sirve para guardar otras configuraciones del sistema (clave → JSON).
-- =====================================================================
create table if not exists public.bd_config (
  clave      text primary key,
  valor      jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

grant select, insert, update, delete on public.bd_config to authenticated;
revoke all on public.bd_config from anon;

-- RLS: leer = cualquier usuario conectado · guardar = Admin de Operaciones
alter table public.bd_config enable row level security;
drop policy if exists frc_leer on public.bd_config;
drop policy if exists frc_agregar on public.bd_config;
drop policy if exists frc_modificar on public.bd_config;
drop policy if exists frc_eliminar on public.bd_config;
create policy frc_leer on public.bd_config for select to authenticated using ((select public.frc_es_miembro()));
create policy frc_agregar on public.bd_config for insert to authenticated with check ((select public.frc_puede(array['operaciones'], 'admin')));
create policy frc_modificar on public.bd_config for update to authenticated using ((select public.frc_puede(array['operaciones'], 'admin'))) with check ((select public.frc_puede(array['operaciones'], 'admin')));
create policy frc_eliminar on public.bd_config for delete to authenticated using ((select public.frc_puede(array['operaciones'], 'admin')));

notify pgrst, 'reload schema';
