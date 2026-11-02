-- =====================================================================
-- INVENTARIO · Registro de equipos eliminados (motivo, detalle, quién y cuándo)
-- Ejecutar UNA VEZ en Supabase → SQL Editor → Run
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.bd_equipos_eliminados (
  id             bigserial PRIMARY KEY,
  fecha          timestamptz DEFAULT now(),
  afi            text,
  tipo           text,
  marca          text,
  modelo         text,
  motivo         text NOT NULL,
  detalle        text NOT NULL,
  usuario        text,
  datos          jsonb,          -- copia completa del equipo (para poder restaurarlo)
  restaurado_at  timestamptz,
  restaurado_por text
);
ALTER TABLE public.bd_equipos_eliminados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bd_equipos_eliminados_anon_all ON public.bd_equipos_eliminados;
CREATE POLICY bd_equipos_eliminados_anon_all ON public.bd_equipos_eliminados FOR ALL TO anon USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
