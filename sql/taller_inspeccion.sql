-- =====================================================================
-- TALLER · INSPECCIÓN DE EQUIPO (2026-11-16)
-- Ejecutar DESPUÉS de sql/taller_hallazgos.sql (SQL Editor → Run; se puede repetir).
-- ---------------------------------------------------------------------
-- Botón "INSPECCIÓN EQUIPO": cuando el equipo entra a la nave, el mecánico enumera TODAS las
-- fallas y repuestos que le faltan (ítem 1, 2, 3...). Cada ítem queda como un hallazgo de la
-- misma inspección (inspeccion_id + item_n). Con esa información Operaciones arma la OT.
-- Pueden revisar la inspección, crear la OT y dejar notas:
--   Admin / Subadmin de Operaciones  y  Admin / Subadmin del área Administración.
-- =====================================================================

alter table public.bd_taller_problemas add column if not exists inspeccion_id text;   -- INS-<reparación>-<fecha>
alter table public.bd_taller_problemas add column if not exists item_n        integer; -- N° del ítem dentro de la inspección
create index if not exists bd_taller_problemas_insp_idx on public.bd_taller_problemas (inspeccion_id);

-- Revisar / marcar hallazgos (en OT, descartado, nota y fecha del repuesto)
drop policy if exists frc_modificar on public.bd_taller_problemas;
create policy frc_modificar on public.bd_taller_problemas for update to authenticated
  using ((select public.frc_puede(array['operaciones','administracion'], 'subadmin')))
  with check ((select public.frc_puede(array['operaciones','administracion'], 'subadmin')));

-- Crear la OT con la inspección y enlazarla al equipo
drop policy if exists frc_agregar on public.bd_ot;
drop policy if exists frc_modificar on public.bd_ot;
create policy frc_agregar on public.bd_ot for insert to authenticated
  with check ((select public.frc_puede(array['operaciones','administracion'], 'subadmin')));
create policy frc_modificar on public.bd_ot for update to authenticated
  using ((select public.frc_puede(array['operaciones','administracion'], 'subadmin')))
  with check ((select public.frc_puede(array['operaciones','administracion'], 'subadmin')));

notify pgrst, 'reload schema';
