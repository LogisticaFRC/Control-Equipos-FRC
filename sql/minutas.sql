-- =====================================================================
-- MINUTAS · Minutas semanales de mejora continua (Operaciones)
-- Ejecutar UNA VEZ en Supabase → SQL Editor → Run (se puede repetir sin problema)
-- =====================================================================

-- Cabecera de cada minuta (una por semana / reunión)
CREATE TABLE IF NOT EXISTS public.bd_minutas (
  id          bigserial PRIMARY KEY,
  nombre      text NOT NULL,             -- ej. MINUTA SEMANA 03-11-2026
  fecha       date NOT NULL,             -- fecha de la reunión (define el mes/año de la carpeta)
  origen_id   bigint,                    -- minuta desde la que se copiaron las tareas
  creado_por  text,
  created_at  timestamptz DEFAULT now()
);

-- Tareas / compromisos de cada minuta
CREATE TABLE IF NOT EXISTS public.bd_minutas_items (
  id                bigserial PRIMARY KEY,
  minuta_id         bigint NOT NULL REFERENCES public.bd_minutas(id) ON DELETE CASCADE,
  n_item            integer,
  personal          text,                -- Personal Encargado
  fecha_compromiso  date,                -- cuándo se adquirió el compromiso
  fecha_estimada    date,                -- fecha estimada de cumplimiento
  tarea             text,
  estado            text DEFAULT 'Pendiente',   -- Proceso / Pendiente / Realizado / No Realizado
  fecha_realizado   date,                -- día en que quedó Realizado
  created_at        timestamptz DEFAULT now()
);
-- Campos del formato Word de la minuta (Sección "Seguridad", Área "SSO", fecha en texto "Siempre")
-- (ALTER: sirve aunque las tablas ya se hayan creado antes)
ALTER TABLE public.bd_minutas_items ADD COLUMN IF NOT EXISTS seccion text;       -- título que agrupa tareas (ej. Seguridad)
ALTER TABLE public.bd_minutas_items ADD COLUMN IF NOT EXISTS area text;          -- Área (ej. SSO)
ALTER TABLE public.bd_minutas_items ADD COLUMN IF NOT EXISTS fecha_texto text;   -- fecha que no es fecha (ej. Siempre)

CREATE INDEX IF NOT EXISTS bd_minutas_items_minuta_idx ON public.bd_minutas_items (minuta_id);

-- Permisos (igual que las demás tablas: clave anon)
ALTER TABLE public.bd_minutas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_minutas_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bd_minutas_anon_all ON public.bd_minutas;
CREATE POLICY bd_minutas_anon_all ON public.bd_minutas FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS bd_minutas_items_anon_all ON public.bd_minutas_items;
CREATE POLICY bd_minutas_items_anon_all ON public.bd_minutas_items FOR ALL TO anon USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
