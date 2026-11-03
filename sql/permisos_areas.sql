-- =====================================================================
-- PERMISOS POR ÁREA · columna `permisos` en la tabla usuarios
-- Ejecutar UNA vez en Supabase → SQL Editor.
-- ---------------------------------------------------------------------
-- rol = 'admin'  → Admin general (todo el sistema + gestión de usuarios)
-- otros usuarios → rol = 'lectura' y el nivel de cada área va en `permisos`:
--   {"operaciones": "admin", "finanzas": "subadmin"}
--   Niveles: admin (todo en el área) · subadmin · (sin clave = solo lectura)
--   Áreas: operaciones, ventas, seguridad, rrhh, finanzas, administracion, general
-- =====================================================================

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS permisos jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Usuarios antiguos con rol 'subadmin' → Subadmin de Operaciones (lo que podían hacer antes)
UPDATE public.usuarios
   SET permisos = '{"operaciones": "subadmin"}'::jsonb,
       rol = 'lectura'
 WHERE rol = 'subadmin' AND (permisos IS NULL OR permisos = '{}'::jsonb);
