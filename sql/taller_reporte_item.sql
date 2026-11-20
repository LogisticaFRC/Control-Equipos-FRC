-- =====================================================================
-- TALLER · REPORT POR ÍTEM DE LA OT (2026-11-20)
-- Ejecutar en Supabase → SQL Editor → Run (se puede volver a ejecutar).
-- Requiere: sql/ot.sql, sql/taller_hallazgos.sql.
--   · frc_mec_actividad_reporte: el mecánico de taller llena el report de cada ítem
--     (personal, fechas y horas de inicio / término, horómetro, uso ART y bloqueo con fotos,
--     descripción). Queda en bd_ot.actividades[i].reporte y además completa las columnas de la OT
--     (ejecutante, f_inicio, h_inicio, f_term, h_term y detalle_mec) para que salga en la OT impresa.
--   · p_terminada = true marca el ítem terminado (con la fecha/hora de término del report);
--     false lo deja pendiente. Firmas: todavía no (se agregan después).
-- =====================================================================
create or replace function public.frc_mec_actividad_reporte(p_ot_id bigint, p_idx integer, p_reporte jsonb, p_terminada boolean default false, p_quien text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ot  public.bd_ot%rowtype;
  v_act jsonb;
  v_rep jsonb := coalesce(p_reporte, '{}'::jsonb);
  v_per text;
begin
  if not public.frc_puede(array['mecanicos', 'operaciones'], 'subadmin') then raise exception 'Sin permiso.'; end if;
  select * into v_ot from public.bd_ot where id = p_ot_id for update;
  if not found then raise exception 'No existe la OT.'; end if;
  if upper(coalesce(v_ot.estado, '')) in ('ANULADA', 'CERRADA') then raise exception 'La OT N° % está %.', v_ot.folio, v_ot.estado; end if;
  if p_idx < 0 or p_idx >= jsonb_array_length(v_ot.actividades) then raise exception 'Ítem no válido.'; end if;
  select string_agg(trim(x), ', ') into v_per from jsonb_array_elements_text(coalesce(v_rep -> 'personal', '[]'::jsonb)) x where trim(x) <> '';
  v_rep := v_rep || jsonb_build_object('por', upper(coalesce(p_quien, '')), 'at', to_char(now() at time zone 'America/Santiago', 'YYYY-MM-DD"T"HH24:MI'));
  v_act := (v_ot.actividades -> p_idx) || jsonb_build_object(
    'reporte', v_rep,
    'ejecutante', coalesce(v_per, v_ot.actividades -> p_idx ->> 'ejecutante', ''),
    'f_inicio', coalesce(v_rep ->> 'fecha_inicio', ''), 'h_inicio', coalesce(v_rep ->> 'hora_inicio', ''),
    'detalle_mec', coalesce(v_rep ->> 'descripcion', ''), 'detalle_por', upper(coalesce(p_quien, '')),
    'detalle_at', to_char(now() at time zone 'America/Santiago', 'YYYY-MM-DD"T"HH24:MI'),
    'f_term', case when p_terminada then coalesce(v_rep ->> 'fecha_termino', '') else '' end,
    'h_term', case when p_terminada then coalesce(v_rep ->> 'hora_termino', '') else '' end);
  update public.bd_ot set actividades = jsonb_set(actividades, array[p_idx::text], v_act), updated_at = now() where id = p_ot_id;
  return v_act;
end $$;
revoke all on function public.frc_mec_actividad_reporte(bigint, integer, jsonb, boolean, text) from public, anon;
grant execute on function public.frc_mec_actividad_reporte(bigint, integer, jsonb, boolean, text) to authenticated;

notify pgrst, 'reload schema';
