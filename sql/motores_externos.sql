-- =====================================================================
-- PROGRAMA REPARACIÓN MOTORES (externos) · Operaciones → Gestión
-- Ejecutar UNA vez en Supabase → SQL Editor → Run (se puede repetir sin problema).
-- Una fila por equipo enviado a reparar el motor (proveedor externo o taller):
--   AFI · proveedor · fecha envío · fecha término (estimada / real) · trabajo o etapa · estado · observación
--   etapas (jsonb): bitácora de etapas anteriores [{ fecha, trabajo, estado, proveedor, nota, usuario }]
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.bd_motores_externos (
  id            bigserial PRIMARY KEY,
  afi           text NOT NULL,
  proveedor     text,                       -- Diego Torres, Taller TNTE, Taller FRC…
  fecha_envio   date,                       -- fecha en que se lleva / se llevó
  fecha_termino date,                       -- fecha de término de la etapa (estimada o real)
  trabajo       text,                       -- Evaluación, Reparación inyectores, Montaje motor ajustado y pruebas…
  estado        text NOT NULL DEFAULT 'PENDIENTE',   -- PENDIENTE · PROCESO · TERMINADO
  observacion   text,
  etapas        jsonb NOT NULL DEFAULT '[]'::jsonb,
  creado_por    text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bd_motores_externos_afi_idx ON public.bd_motores_externos (afi);

-- Seguridad (igual que las demás tablas de Operaciones): leer = usuario conectado ·
-- agregar / modificar = Subadmin o Admin de Operaciones · eliminar = Admin
ALTER TABLE public.bd_motores_externos ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bd_motores_externos' LOOP
    EXECUTE format('DROP POLICY %I ON public.bd_motores_externos', p.policyname);
  END LOOP;
END $$;
CREATE POLICY frc_leer ON public.bd_motores_externos FOR SELECT TO authenticated USING ((select public.frc_es_miembro()));
CREATE POLICY frc_agregar ON public.bd_motores_externos FOR INSERT TO authenticated WITH CHECK ((select public.frc_puede(array['operaciones'], 'subadmin')));
CREATE POLICY frc_modificar ON public.bd_motores_externos FOR UPDATE TO authenticated USING ((select public.frc_puede(array['operaciones'], 'subadmin'))) WITH CHECK ((select public.frc_puede(array['operaciones'], 'subadmin')));
CREATE POLICY frc_eliminar ON public.bd_motores_externos FOR DELETE TO authenticated USING ((select public.frc_puede(array['operaciones'], 'admin')));
REVOKE ALL ON public.bd_motores_externos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_motores_externos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.bd_motores_externos_id_seq TO authenticated;

-- Carga inicial: programa escrito a mano (09-11-2026). Solo si la tabla está vacía.
INSERT INTO public.bd_motores_externos (afi, proveedor, fecha_envio, fecha_termino, trabajo, estado, observacion, creado_por)
SELECT * FROM (VALUES
  ('365', 'DIEGO TORRES', DATE '2026-11-09', DATE '2026-12-09', 'Evaluación', 'PROCESO', NULL, 'carga inicial'),
  ('367', 'TALLER TNTE',  DATE '2026-11-09', DATE '2026-12-09', 'Evaluación', 'PROCESO', NULL, 'carga inicial'),
  ('366', 'TALLER FRC',   DATE '2026-11-09', DATE '2026-12-09', 'Reparación inyectores', 'PROCESO', NULL, 'carga inicial'),
  ('739', 'TALLER FRC',   DATE '2026-11-09', NULL,              'Montaje motor ajustado y pruebas', 'PROCESO', 'Motor reparado por Diego Torres', 'carga inicial'),
  ('362', 'TALLER TNTE',  NULL,              NULL,              'Desmontar y enviar a Diego Torres para evaluación y reparación', 'PENDIENTE', 'Motor ajustado presenta problemas', 'carga inicial'),
  ('742', 'DIEGO TORRES', NULL,              NULL,              'Pendiente evaluación', 'PENDIENTE', NULL, 'carga inicial'),
  ('747', 'TALLER FRC',   DATE '2026-11-09', DATE '2026-11-13', 'Limpieza estanques diésel', 'PROCESO', NULL, 'carga inicial')
) AS v(afi, proveedor, fecha_envio, fecha_termino, trabajo, estado, observacion, creado_por)
WHERE NOT EXISTS (SELECT 1 FROM public.bd_motores_externos);

NOTIFY pgrst, 'reload schema';
