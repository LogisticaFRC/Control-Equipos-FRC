-- =====================================================================
-- OT DE TALLER · FIRMAS Y RESPONSABLES DESDE LA TABLET / TÓTEM (2026-11-19)
-- Ejecutar en Supabase → SQL Editor → Run (se puede volver a ejecutar).
-- Requiere: sql/ot.sql y sql/taller_firmas_problemas.sql (columna firmas de bd_ot).
--   · frc_ot_responsables: el mecánico de taller / tótem y los supervisores FRC
--     (permiso Mecánicos subadmin o admin) guardan en la OT SOLO:
--       firmas (mecánico, supervisor), personal asignado (nombres y firmas) y
--       los nombres de mecánico / supervisor responsable.
--     El resto de la OT sigue siendo solo para Operaciones (subadmin/admin).
-- =====================================================================
create or replace function public.frc_ot_responsables(p_ot_id bigint, p_cambios jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ot public.bd_ot%rowtype;
begin
  if not public.frc_puede(array['mecanicos', 'operaciones'], 'subadmin') then raise exception 'Sin permiso para firmar la OT.'; end if;
  select * into v_ot from public.bd_ot where id = p_ot_id for update;
  if not found then raise exception 'No existe la OT.'; end if;
  if upper(coalesce(v_ot.estado, '')) = 'ANULADA' then raise exception 'La OT N° % está anulada.', v_ot.folio; end if;
  update public.bd_ot set
    firmas     = case when p_cambios ? 'firmas'     then coalesce(firmas, '{}'::jsonb) || coalesce(p_cambios -> 'firmas', '{}'::jsonb) else firmas end,
    personal   = case when p_cambios ? 'personal' and jsonb_typeof(p_cambios -> 'personal') = 'array' then p_cambios -> 'personal' else personal end,
    mecanico   = case when p_cambios ? 'mecanico'   then nullif(trim(p_cambios ->> 'mecanico'), '')   else mecanico end,
    supervisor = case when p_cambios ? 'supervisor' then nullif(trim(p_cambios ->> 'supervisor'), '') else supervisor end,
    updated_at = now()
  where id = p_ot_id returning * into v_ot;
  return jsonb_build_object('id', v_ot.id, 'folio', v_ot.folio);
end $$;
revoke all on function public.frc_ot_responsables(bigint, jsonb) from public, anon;
grant execute on function public.frc_ot_responsables(bigint, jsonb) to authenticated;

notify pgrst, 'reload schema';
