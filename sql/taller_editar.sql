-- =====================================================================
-- TALLER · EDITAR HALLAZGOS + DETALLE DEL TRABAJO DEL MECÁNICO (2026-11-17)
-- Ejecutar en Supabase → SQL Editor → Run (se puede volver a ejecutar).
--   · frc_hallazgo_editar: mecánicos y Operaciones / Administración corrigen el texto de un hallazgo
--     mientras está "Esperando OT" (queda guardado el texto original).
--   · frc_mec_actividad_detalle: el mecánico describe el trabajo hecho en una actividad de la OT
--     (queda en bd_ot.actividades[i].detalle_mec; no sale en la OT impresa).
-- =====================================================================

alter table public.bd_taller_problemas add column if not exists descripcion_original text;
alter table public.bd_taller_problemas add column if not exists editado_por text;
alter table public.bd_taller_problemas add column if not exists editado_at timestamptz;

create or replace function public.frc_hallazgo_editar(
  p_id bigint, p_sistema text, p_descripcion text,
  p_necesita_repuesto boolean default false, p_repuesto text default null, p_cantidad text default null, p_quien text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_h public.bd_taller_problemas%rowtype;
begin
  if not public.frc_puede(array['mecanicos', 'operaciones', 'administracion'], 'subadmin') then raise exception 'Sin permiso para editar.'; end if;
  if coalesce(trim(p_descripcion), '') = '' then raise exception 'La descripción no puede quedar vacía.'; end if;
  select * into v_h from public.bd_taller_problemas where id = p_id for update;
  if not found then raise exception 'No existe el hallazgo.'; end if;
  if coalesce(v_h.estado, 'PENDIENTE') <> 'PENDIENTE' then raise exception 'Solo se editan los hallazgos que esperan OT (este está %).', v_h.estado; end if;
  update public.bd_taller_problemas set
    descripcion_original = coalesce(descripcion_original, v_h.descripcion),
    sistema = nullif(trim(coalesce(p_sistema, '')), ''),
    descripcion = trim(p_descripcion),
    necesita_repuesto = coalesce(p_necesita_repuesto, false),
    repuesto = case when p_necesita_repuesto then nullif(trim(coalesce(p_repuesto, '')), '') end,
    cantidad = case when p_necesita_repuesto then nullif(trim(coalesce(p_cantidad, '')), '') end,
    editado_por = nullif(upper(trim(coalesce(p_quien, ''))), ''),
    editado_at = now()
  where id = p_id returning * into v_h;
  return to_jsonb(v_h);
end $$;
revoke all on function public.frc_hallazgo_editar(bigint, text, text, boolean, text, text, text) from public, anon;
grant execute on function public.frc_hallazgo_editar(bigint, text, text, boolean, text, text, text) to authenticated;

create or replace function public.frc_mec_actividad_detalle(p_ot_id bigint, p_idx integer, p_detalle text, p_quien text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ot public.bd_ot%rowtype; v_act jsonb;
begin
  if not public.frc_puede(array['mecanicos', 'operaciones'], 'subadmin') then raise exception 'Sin permiso.'; end if;
  select * into v_ot from public.bd_ot where id = p_ot_id for update;
  if not found then raise exception 'No existe la OT.'; end if;
  if upper(coalesce(v_ot.estado, '')) = 'ANULADA' then raise exception 'La OT N° % está anulada.', v_ot.folio; end if;
  if p_idx < 0 or p_idx >= jsonb_array_length(v_ot.actividades) then raise exception 'Actividad no válida.'; end if;
  v_act := (v_ot.actividades -> p_idx) || jsonb_build_object(
    'detalle_mec', trim(coalesce(p_detalle, '')),
    'detalle_por', upper(trim(coalesce(p_quien, ''))),
    'detalle_at', to_char(now() at time zone 'America/Santiago', 'YYYY-MM-DD"T"HH24:MI'));
  update public.bd_ot set actividades = jsonb_set(actividades, array[p_idx::text], v_act), updated_at = now() where id = p_ot_id;
  return v_act;
end $$;
revoke all on function public.frc_mec_actividad_detalle(bigint, integer, text, text) from public, anon;
grant execute on function public.frc_mec_actividad_detalle(bigint, integer, text, text) to authenticated;

notify pgrst, 'reload schema';
