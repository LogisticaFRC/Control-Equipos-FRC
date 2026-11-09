-- =====================================================================
-- HISTORIAL · Datos de la hoja escaneada (ART, folio, causa de la falla)
-- Ejecutar UNA vez en Supabase → SQL Editor. No borra ni cambia datos existentes.
-- (bloqueo_de_equipo y hora_falla ya existían; ahora el formulario sí los guarda)
-- =====================================================================
ALTER TABLE "BD_HISTORIAL" ADD COLUMN IF NOT EXISTS art          text;   -- Uso de ART: SI / NO
ALTER TABLE "BD_HISTORIAL" ADD COLUMN IF NOT EXISTS numero_folio text;   -- N° impreso de la hoja (ej. 000214)
ALTER TABLE "BD_HISTORIAL" ADD COLUMN IF NOT EXISTS causa_falla  text;   -- ACCIDENTE / FALLA OPERACIONAL / FALLA MECANICA / CONDICION DE LA OPERACION

-- Para que la API vea las columnas nuevas al tiro
NOTIFY pgrst, 'reload schema';
