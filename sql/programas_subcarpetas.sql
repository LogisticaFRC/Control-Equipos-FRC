-- =====================================================================
-- PROGRAMAS · Subcarpetas (ej. "NOVIEMBRE") dentro de Reparación / Mantención
-- Ejecutar UNA VEZ en Supabase → SQL Editor → Run (se puede repetir sin problema)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.bd_programas_carpetas (
  id         bigserial PRIMARY KEY,
  tipo       text NOT NULL,          -- REPARACION / MANTENCION
  nombre     text NOT NULL,          -- nombre de la subcarpeta (ej. NOVIEMBRE 2026)
  created_at timestamptz DEFAULT now(),
  CONSTRAINT bd_programas_carpetas_unica UNIQUE (tipo, nombre)
);
ALTER TABLE public.bd_programas_carpetas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bd_programas_carpetas_anon_all ON public.bd_programas_carpetas;
CREATE POLICY bd_programas_carpetas_anon_all ON public.bd_programas_carpetas FOR ALL TO anon USING (true) WITH CHECK (true);

-- En qué subcarpeta está cada programa (vacío = carpeta principal)
ALTER TABLE public.bd_programas_calendarios ADD COLUMN IF NOT EXISTS subcarpeta text;

-- Switch "Descontar kits de bodega" (por si aún no se ejecutó)
ALTER TABLE public.bd_programas_calendarios ADD COLUMN IF NOT EXISTS descontar_bodega boolean DEFAULT true;

NOTIFY pgrst, 'reload schema';
