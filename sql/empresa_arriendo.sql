-- =====================================================================
-- INVENTARIO · Empresa arrendada por equipo
-- Ejecutar UNA VEZ en Supabase → SQL Editor → Run
-- =====================================================================
ALTER TABLE public."BD_INVENTARIO" ADD COLUMN IF NOT EXISTS empresa_arriendo text;

-- Los equipos Fuera de Servicio quedan en TALLER FRC
UPDATE public."BD_INVENTARIO" SET empresa_arriendo = 'TALLER FRC'
 WHERE lower(coalesce(disponibilidad, '')) LIKE '%fuera%';

NOTIFY pgrst, 'reload schema';
