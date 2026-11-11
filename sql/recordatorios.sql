-- =====================================================================
-- MIS TAREAS · Recordatorio de tareas PERSONAL de cada usuario
-- Ejecutar UNA VEZ en Supabase → SQL Editor → Run (se puede repetir sin problema)
-- ---------------------------------------------------------------------
-- · Cada fila pertenece al usuario que la creó (auth_id = auth.uid()).
-- · RLS: cada usuario SOLO ve, crea, modifica y elimina SUS tareas.
--   Nadie más las ve (tampoco el Admin general): es un apoyo personal.
-- =====================================================================

-- Tareas (una fila = una tarea única o una tarea que se repite)
CREATE TABLE IF NOT EXISTS public.bd_recordatorios (
  id            bigserial PRIMARY KEY,
  auth_id       uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  usuario       text,                         -- nombre de usuario (solo referencia)
  titulo        text NOT NULL,
  detalle       text,                         -- notas
  fecha         date NOT NULL,                -- fecha de la tarea (o desde cuándo se repite)
  hora          time,                         -- vacío = todo el día
  repeticion    text NOT NULL DEFAULT 'NINGUNA',  -- NINGUNA | DIARIA | LABORAL | SEMANAL | MENSUAL | ANUAL
  cada          integer NOT NULL DEFAULT 1,   -- cada N días / semanas / meses / años
  dias_semana   integer[],                    -- SEMANAL: 0=dom 1=lun … 6=sáb
  fecha_fin     date,                         -- hasta cuándo se repite (vacío = siempre)
  aviso_min     integer DEFAULT 15,           -- avisar N minutos antes de la hora (null = sin aviso)
  aviso_dias    integer DEFAULT 0,            -- avisar N días antes (tareas programadas)
  prioridad     text DEFAULT 'MEDIA',         -- ALTA | MEDIA | BAJA
  categoria     text DEFAULT 'GENERAL',
  checklist     jsonb DEFAULT '[]'::jsonb,    -- sub-tareas [{ "t": "texto", "ok": false }]
  activa        boolean DEFAULT true,         -- false = pausada (no aparece ni avisa)
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Estado de cada día de una tarea (Hecha / Omitida). Una tarea que se repite tiene una fila por día marcado.
CREATE TABLE IF NOT EXISTS public.bd_recordatorios_estado (
  id               bigserial PRIMARY KEY,
  recordatorio_id  bigint NOT NULL REFERENCES public.bd_recordatorios(id) ON DELETE CASCADE,
  auth_id          uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha            date NOT NULL,
  estado           text NOT NULL DEFAULT 'HECHA',   -- HECHA | OMITIDA
  hecha_at         timestamptz DEFAULT now(),
  UNIQUE (recordatorio_id, fecha)
);

CREATE INDEX IF NOT EXISTS bd_recordatorios_auth_idx ON public.bd_recordatorios (auth_id);
CREATE INDEX IF NOT EXISTS bd_recordatorios_estado_auth_idx ON public.bd_recordatorios_estado (auth_id, fecha);

-- ---------- Seguridad: cada uno solo lo suyo ----------
ALTER TABLE public.bd_recordatorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_recordatorios_estado ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname, tablename FROM pg_policies
           WHERE schemaname = 'public' AND tablename IN ('bd_recordatorios', 'bd_recordatorios_estado') LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

CREATE POLICY frc_propias ON public.bd_recordatorios FOR ALL TO authenticated
  USING (auth_id = (select auth.uid())) WITH CHECK (auth_id = (select auth.uid()));
CREATE POLICY frc_propias ON public.bd_recordatorios_estado FOR ALL TO authenticated
  USING (auth_id = (select auth.uid())) WITH CHECK (auth_id = (select auth.uid()));

REVOKE ALL ON public.bd_recordatorios, public.bd_recordatorios_estado FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_recordatorios, public.bd_recordatorios_estado TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.bd_recordatorios_id_seq, public.bd_recordatorios_estado_id_seq TO authenticated;

NOTIFY pgrst, 'reload schema';
