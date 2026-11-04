-- =====================================================================
-- MÓDULO ÁREAS · Georreferencia (Google Maps) de empresas, áreas y locaciones
-- Ejecutar UNA vez en Supabase → SQL Editor → Run (después de sql/areas.sql).
-- Se puede repetir sin perder datos.
-- =====================================================================
alter table public.bd_locaciones add column if not exists lat      double precision;  -- latitud  (ej. -33.4489)
alter table public.bd_locaciones add column if not exists lng      double precision;  -- longitud (ej. -70.6693)
alter table public.bd_locaciones add column if not exists maps_url text;              -- link de Google Maps pegado por el usuario

-- Coordenadas válidas (o vacías)
alter table public.bd_locaciones drop constraint if exists bd_locaciones_latlng_chk;
alter table public.bd_locaciones add constraint bd_locaciones_latlng_chk check (
  (lat is null and lng is null) or (lat between -90 and 90 and lng between -180 and 180)
);

notify pgrst, 'reload schema';
