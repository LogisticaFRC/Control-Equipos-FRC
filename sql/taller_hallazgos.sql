-- =====================================================================
-- TALLER · HALLAZGOS DE LOS MECÁNICOS → OT  (2026-11-13)
-- Ejecutar UNA vez en Supabase → SQL Editor → Run (se puede repetir sin perder datos).
-- Requiere haber ejecutado antes: sql/taller.sql, sql/taller_firmas_problemas.sql y sql/mecanicos.sql.
-- ---------------------------------------------------------------------
-- Nuevo flujo:
--   1) Operaciones crea el Programa de Reparación (igual que antes).
--   2) El mecánico (app móvil → pestaña TALLER) ve las cartas de los equipos del programa,
--      INGRESA el equipo a la nave y reporta HALLAZGOS por ítem (sistema, descripción, foto,
--      ¿necesita repuesto? + cuál y cuántos).
--   3) El Admin recibe los hallazgos, elige uno o varios y crea UNA OT con ellos (queda enlazada al equipo).
--      Puede dejar una NOTA y la FECHA APROXIMADA del repuesto: el mecánico la ve en su carta.
--   4) El mecánico marca las actividades de la OT terminadas desde el celular.
-- Los hallazgos se guardan en la misma tabla bd_taller_problemas (se le agregan columnas).
-- =====================================================================

-- 1) Columnas nuevas del hallazgo
alter table public.bd_taller_problemas add column if not exists sistema              text;      -- MOTOR, ELECTRICO, HIDRAULICO...
alter table public.bd_taller_problemas add column if not exists foto_url             text;      -- foto (opcional) en el bucket archivos_frc
alter table public.bd_taller_problemas add column if not exists necesita_repuesto    boolean not null default false;
alter table public.bd_taller_problemas add column if not exists repuesto             text;      -- qué repuesto pide el mecánico
alter table public.bd_taller_problemas add column if not exists cantidad             text;
alter table public.bd_taller_problemas add column if not exists nota_admin           text;      -- nota del Admin (la ve el mecánico)
alter table public.bd_taller_problemas add column if not exists fecha_aprox_repuesto date;      -- fecha aprox. de llegada del repuesto
alter table public.bd_taller_problemas add column if not exists nota_at              timestamptz;
create index if not exists bd_taller_problemas_estado_idx on public.bd_taller_problemas (estado);

-- 2) Los MECÁNICOS (área mecanicos = subadmin) pueden reportar hallazgos e ingresar equipos a la nave
drop policy if exists frc_agregar on public.bd_taller_problemas;
create policy frc_agregar on public.bd_taller_problemas for insert to authenticated
  with check ((select public.frc_puede(array['operaciones','mecanicos'], 'subadmin')));

drop policy if exists frc_agregar on public.bd_taller_reparaciones;
drop policy if exists frc_modificar on public.bd_taller_reparaciones;
create policy frc_agregar on public.bd_taller_reparaciones for insert to authenticated
  with check ((select public.frc_puede(array['operaciones','mecanicos'], 'subadmin')));
create policy frc_modificar on public.bd_taller_reparaciones for update to authenticated
  using ((select public.frc_puede(array['operaciones','mecanicos'], 'subadmin')))
  with check ((select public.frc_puede(array['operaciones','mecanicos'], 'subadmin')));

-- 3) El mecánico marca / desmarca una actividad de una OT del TALLER (sin permiso para editar toda la OT)
create or replace function public.frc_mec_actividad(p_ot_id bigint, p_idx integer, p_hecha boolean, p_quien text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ot   public.bd_ot%rowtype;
  v_act  jsonb;
  v_hoy  text := to_char((now() at time zone 'America/Santiago')::date, 'YYYY-MM-DD');
  v_hora text := to_char(now() at time zone 'America/Santiago', 'HH24:MI');
begin
  if not public.frc_puede(array['mecanicos','operaciones'], 'subadmin') then
    raise exception 'Sin permiso para marcar actividades.';
  end if;
  select * into v_ot from public.bd_ot where id = p_ot_id for update;
  if not found then raise exception 'No existe la OT.'; end if;
  if v_ot.reparacion_id is null then raise exception 'La OT N° % no está enlazada al taller.', v_ot.folio; end if;
  if upper(coalesce(v_ot.estado, '')) in ('ANULADA', 'CERRADA') then raise exception 'La OT N° % está %.', v_ot.folio, v_ot.estado; end if;
  if p_idx < 0 or p_idx >= jsonb_array_length(v_ot.actividades) then raise exception 'Actividad no válida.'; end if;
  v_act := v_ot.actividades -> p_idx;
  if p_hecha then
    v_act := v_act || jsonb_build_object('f_term', v_hoy, 'h_term', v_hora);
    if coalesce(v_act ->> 'f_inicio', '') = '' then v_act := v_act || jsonb_build_object('f_inicio', v_hoy); end if;
    if coalesce(v_act ->> 'ejecutante', '') = '' and coalesce(p_quien, '') <> '' then v_act := v_act || jsonb_build_object('ejecutante', p_quien); end if;
  else
    v_act := v_act || jsonb_build_object('f_term', '', 'h_term', '');
  end if;
  update public.bd_ot set actividades = jsonb_set(actividades, array[p_idx::text], v_act), updated_at = now() where id = p_ot_id;
  return v_act;
end $$;
revoke all on function public.frc_mec_actividad(bigint, integer, boolean, text) from public, anon;
grant execute on function public.frc_mec_actividad(bigint, integer, boolean, text) to authenticated;

-- 4) Al ingresar a la nave el equipo queda "En Mantencion" en el Inventario (el mecánico no edita el inventario completo)
create or replace function public.frc_mec_en_mantencion(p_afi text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.frc_puede(array['mecanicos','operaciones'], 'subadmin') then
    raise exception 'Sin permiso.';
  end if;
  update public."BD_INVENTARIO" set disponibilidad = 'En Mantencion'
   where upper(trim(afi::text)) = upper(trim(p_afi));
end $$;
revoke all on function public.frc_mec_en_mantencion(text) from public, anon;
grant execute on function public.frc_mec_en_mantencion(text) to authenticated;

notify pgrst, 'reload schema';
