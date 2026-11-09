-- =====================================================================
-- MINUTAS · Orden de las secciones (títulos) — botones ▲▼ en la tabla
-- Ejecutar UNA vez en Supabase → SQL Editor. No borra ni cambia datos.
-- =====================================================================
ALTER TABLE public.bd_minutas_items ADD COLUMN IF NOT EXISTS orden_seccion integer;

-- Recarga el esquema para que la API vea la columna nueva
NOTIFY pgrst, 'reload schema';
