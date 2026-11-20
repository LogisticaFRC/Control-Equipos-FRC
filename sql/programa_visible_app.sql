-- =====================================================================
-- PROGRAMAS · MOSTRAR EN LA APP DE TÉCNICOS (2026-11-20)
-- Ejecutar en Supabase → SQL Editor → Run (se puede volver a ejecutar).
-- visible_app: qué técnicos ven el programa en su app: 'crtg', 'terreno', 'taller'.
-- Se elige en Programas → lápiz del programa → "Mostrar en la app de técnicos".
-- (Los técnicos marcan Realizado / No realizado con frc_crtg_programa de sql/crtg.sql.)
-- =====================================================================
alter table public.bd_programas_calendarios add column if not exists visible_app text[] not null default '{}';

-- Los programas de mantención que ya tienen "CRTG" en el nombre quedan visibles para CRTG
update public.bd_programas_calendarios
   set visible_app = array['crtg']
 where visible_app = '{}'
   and upper(coalesce(nombre_programa, '') || ' ' || coalesce(mes, '')) like '%CRTG%';

notify pgrst, 'reload schema';
