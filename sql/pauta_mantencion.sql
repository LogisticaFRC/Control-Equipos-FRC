-- =====================================================================
-- PAUTAS DE MANTENCIÓN en la app de técnicos (2026-11-26)
-- Ejecutar en Supabase → SQL Editor → Run (se puede volver a ejecutar).
-- Requiere sql/mecanicos.sql (tabla bd_mec_intervenciones).
--   · La pauta se guarda como una intervención más con tipo = 'MANTENCION' y su detalle en la columna pauta:
--     { clave, codigo, titulo, tipo_mant, frecuencia, horometro_prox, items:[{s,t,e:REV|REEMP|NA}],
--       filtros:[{filtro,marca,ref,cant}], lubricantes:[{key,tipo,sae,api,marca,litros}], mediciones, observaciones }
--   · Mismas firmas (mecánico + supervisor), mismo paso al Historial y PDF con el formato de la pauta.
-- =====================================================================
alter table public.bd_mec_intervenciones add column if not exists pauta jsonb;
notify pgrst, 'reload schema';
