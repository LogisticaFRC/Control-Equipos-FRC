-- =====================================================================
-- MECÁNICOS · App móvil de mecánicos + intervenciones con firma
-- Ejecutar UNA vez en Supabase → SQL Editor → Run (se puede repetir sin problema).
-- Requiere sql/seguridad_paso1_auth_rls.sql (funciones frc_es_miembro / frc_puede).
-- ---------------------------------------------------------------------
-- Usuarios: área "mecanicos" en usuarios.permisos
--   { "mecanicos": "subadmin" } → MECÁNICO: entra a la app móvil (equipos, horómetro, intervenciones)
--   { "mecanicos": "admin" }    → SUPERVISOR: ve el panel Mecánicos, revisa y firma
--   (el Admin general ve todo)
-- =====================================================================

-- 1) Intervenciones llenadas por los mecánicos (formato FRC-RE-OPE-017 mecánica / IE-FRC eléctrica)
CREATE TABLE IF NOT EXISTS public.bd_mec_intervenciones (
  id                 bigserial PRIMARY KEY,
  tipo               text NOT NULL DEFAULT 'MECANICA',      -- MECANICA | ELECTRICA
  afi                text NOT NULL,
  equipo             text,
  fecha              date,
  horometro          numeric,
  turno              text,
  lugar              text,
  hora_falla         text,
  hora_inicio        text,
  hora_termino       text,
  uso_art            boolean DEFAULT false,
  bloqueo            boolean DEFAULT false,
  mecanicos          jsonb NOT NULL DEFAULT '[]'::jsonb,    -- [{ nombre, firma (imagen) }]
  causa_intervencion text,
  descripcion        text,
  interferencia      text,
  causa_falla        text,                                   -- ACCIDENTE | FALLA OPERACIONAL | CONDICION DE LA OPERACION | FALLA MECANICA
  lubricantes        jsonb NOT NULL DEFAULT '[]'::jsonb,    -- [{ tipo, cantidad }]
  usuario_arriendo   text,
  operador           text,
  vale_consumo       text,
  registro_bloqueo   jsonb,                                  -- formato FRC-RE-OP-015 completo
  supervisor         jsonb,                                  -- { nombre, empresa, tipo: 'FRC'|'CLIENTE', firma, fecha }
  estado             text NOT NULL DEFAULT 'PENDIENTE_FIRMA', -- PENDIENTE_FIRMA | FIRMADA | EN_HISTORIAL | RECHAZADA
  motivo_rechazo     text,
  historial_id       bigint,
  documento_url      text,
  creado_por         text,
  auth_id            uuid DEFAULT auth.uid(),
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bd_mec_intervenciones_afi_idx ON public.bd_mec_intervenciones (afi);
CREATE INDEX IF NOT EXISTS bd_mec_intervenciones_estado_idx ON public.bd_mec_intervenciones (estado);

ALTER TABLE public.bd_mec_intervenciones ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bd_mec_intervenciones' LOOP
    EXECUTE format('DROP POLICY %I ON public.bd_mec_intervenciones', p.policyname);
  END LOOP;
END $$;
CREATE POLICY frc_leer ON public.bd_mec_intervenciones FOR SELECT TO authenticated USING ((select public.frc_es_miembro()));
CREATE POLICY frc_agregar ON public.bd_mec_intervenciones FOR INSERT TO authenticated WITH CHECK ((select public.frc_puede(array['mecanicos','operaciones'], 'subadmin')));
CREATE POLICY frc_modificar ON public.bd_mec_intervenciones FOR UPDATE TO authenticated USING ((select public.frc_puede(array['mecanicos','operaciones'], 'subadmin'))) WITH CHECK ((select public.frc_puede(array['mecanicos','operaciones'], 'subadmin')));
CREATE POLICY frc_eliminar ON public.bd_mec_intervenciones FOR DELETE TO authenticated USING ((select public.frc_puede(array['mecanicos','operaciones'], 'admin')));
REVOKE ALL ON public.bd_mec_intervenciones FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_mec_intervenciones TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.bd_mec_intervenciones_id_seq TO authenticated;

-- 2) Los mecánicos pueden AGREGAR registros al Historial (la intervención firmada pasa sola)
--    y subir el PDF de la hoja. (Modificar / eliminar sigue siendo de Operaciones.)
DROP POLICY IF EXISTS frc_agregar ON public."BD_HISTORIAL";
CREATE POLICY frc_agregar ON public."BD_HISTORIAL" FOR INSERT TO authenticated
  WITH CHECK ((select public.frc_puede(array['operaciones','mecanicos'], 'subadmin')));
DROP POLICY IF EXISTS frc_archivos_subir ON storage.objects;
CREATE POLICY frc_archivos_subir ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'archivos_frc' AND (select public.frc_puede(array['operaciones','ventas','seguridad','rrhh','finanzas','administracion','general','mecanicos'], 'subadmin')));

-- 3) Actualizar SOLO el horómetro de un equipo desde la app (sin dar permiso para editar todo el inventario)
CREATE OR REPLACE FUNCTION public.frc_mec_horometro(p_afi text, p_horometro numeric, p_fecha date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.frc_puede(array['mecanicos','operaciones'], 'subadmin') THEN
    RAISE EXCEPTION 'Sin permiso para actualizar el horómetro.';
  END IF;
  IF p_horometro IS NULL OR p_horometro <= 0 THEN
    RAISE EXCEPTION 'Horómetro inválido.';
  END IF;
  UPDATE public."BD_INVENTARIO"
     SET horometroactual = p_horometro, fecha_horometro_manual = coalesce(p_fecha, current_date)
   WHERE upper(trim(afi::text)) = upper(trim(p_afi));
  IF NOT FOUND THEN RAISE EXCEPTION 'No existe el AFI %', p_afi; END IF;
END $$;
REVOKE ALL ON FUNCTION public.frc_mec_horometro(text, numeric, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.frc_mec_horometro(text, numeric, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
