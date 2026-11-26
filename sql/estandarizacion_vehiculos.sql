-- =====================================================================
-- ESTANDARIZACIÓN · CHECK LIST DE VEHÍCULO (2026-11-25)
-- Ejecutar en Supabase → SQL Editor → Run (se puede volver a ejecutar).
-- Requiere sql/estandarizacion.sql (tabla bd_estandarizaciones).
--   · tipo_inspeccion: 'PROGRAMADA' o 'NO_PROGRAMADA' (check list de vehículo EVL-FRC).
--   · Sin esta columna la app guarda igual y deja el tipo escrito al inicio de Observaciones.
-- =====================================================================
alter table public.bd_estandarizaciones add column if not exists tipo_inspeccion text;
notify pgrst, 'reload schema';
