-- =====================================================================
-- ESTANDARIZACIÓN DE EQUIPOS (2026-11-18)
-- Ejecutar en Supabase → SQL Editor → Run (se puede volver a ejecutar).
--   · bd_estandarizaciones: cada "Inspección general estandarización" que hace un mecánico
--     (taller, terreno, CRTG o tótem): ítems Bueno / Malo / N/A, cantidades, observaciones y firmas.
--   · Se ve en Perfil del equipo → pestaña Estandarización (con la figura 3D).
-- =====================================================================
create table if not exists public.bd_estandarizaciones (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),
  afi           text not null,
  equipo        text,
  fecha         date not null default current_date,
  plantilla     text not null default 'EGT-FRC',
  horometro     numeric,
  items         jsonb not null default '[]'::jsonb,   -- [{k, t, cant, encontrada, estado: BUENO|MALO|NA, obs}]
  observaciones text,
  responsables  jsonb not null default '[]'::jsonb,   -- [{nombre, firma_url}]
  cumplimiento  integer,                              -- % de ítems Bueno sobre los evaluados
  usuario       text
);
create index if not exists bd_estandarizaciones_afi_idx on public.bd_estandarizaciones (afi, fecha desc);
grant select, insert, update, delete on public.bd_estandarizaciones to authenticated;
grant usage, select on sequence public.bd_estandarizaciones_id_seq to authenticated;
alter table public.bd_estandarizaciones enable row level security;
drop policy if exists frc_ver on public.bd_estandarizaciones;
create policy frc_ver on public.bd_estandarizaciones for select to authenticated using ((select public.frc_es_miembro()));
drop policy if exists frc_agregar on public.bd_estandarizaciones;
create policy frc_agregar on public.bd_estandarizaciones for insert to authenticated
  with check ((select public.frc_puede(array['mecanicos', 'operaciones'], 'subadmin')));
drop policy if exists frc_modificar on public.bd_estandarizaciones;
create policy frc_modificar on public.bd_estandarizaciones for update to authenticated
  using ((select public.frc_puede(array['operaciones'], 'admin'))) with check ((select public.frc_puede(array['operaciones'], 'admin')));
drop policy if exists frc_eliminar on public.bd_estandarizaciones;
create policy frc_eliminar on public.bd_estandarizaciones for delete to authenticated using ((select public.frc_puede(array['operaciones'], 'admin')));

notify pgrst, 'reload schema';
