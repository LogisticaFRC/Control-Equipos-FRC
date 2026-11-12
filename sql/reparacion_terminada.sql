-- =====================================================================
-- HISTORIAL · "Reparación terminada" (programas de REPARACIÓN)
-- Ejecutar UNA vez en Supabase → SQL Editor → Run (se puede repetir sin problema).
-- Un equipo en reparación puede tener muchos reportes; solo el reporte marcado
-- "Reparación terminada" deja al equipo REPARADO en el programa.
-- =====================================================================
ALTER TABLE public."BD_HISTORIAL" ADD COLUMN IF NOT EXISTS reparacion_terminada boolean DEFAULT false;
NOTIFY pgrst, 'reload schema';
