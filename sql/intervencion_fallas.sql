-- =====================================================================
-- INTERVENCIÓN MECÁNICA / ELÉCTRICA · INSPECCIÓN + FALLAS + REPARACIÓN  (2026-11-18)
-- Ejecutar UNA vez en Supabase → SQL Editor → Run (se puede repetir sin perder datos).
-- Requiere: sql/mecanicos.sql, sql/taller_firmas_problemas.sql, sql/taller_hallazgos.sql, sql/taller_inspeccion.sql
-- ---------------------------------------------------------------------
-- Nuevo flujo del report:
--   · INSPECCIÓN: observación del equipo + fallas enumeradas → cada falla queda ABIERTA en el equipo
--     (en bd_taller_problemas, la misma lista de hallazgos del taller: el Admin la puede pasar a OT).
--   · REPARACIÓN: se elige UNA falla abierta, se describe lo realizado con fecha/hora de inicio y término,
--     ✓ terminado → al enviar la falla queda REPARADA. Cada envío es un report (una hoja).
--   · Cada falla puede pedir repuesto (con código y serie del motor) → aparece en Repuestos pedidos. Hasta 2 fotos.
--   · ART (2 hojas) y bloqueo (1 hoja) se llenan en papel: en la reparación solo se sube la FOTO.
--   · El levantamiento deja el equipo FUERA DE SERVICIO hasta reparar todas sus fallas. Se puede borrar si no tiene reparaciones.
-- =====================================================================

-- 1) Report de intervención: modo, tiempo de trabajo y fallas
alter table public.bd_mec_intervenciones add column if not exists modo          text;      -- INSPECCION | REPARACION (null = formato antiguo)
alter table public.bd_mec_intervenciones add column if not exists fecha_termino date;      -- fecha de término (la de inicio es "fecha")
alter table public.bd_mec_intervenciones add column if not exists duracion_min  integer;   -- minutos entre inicio y término
alter table public.bd_mec_intervenciones add column if not exists terminado     boolean not null default false;   -- ✓ terminado
alter table public.bd_mec_intervenciones add column if not exists fallas        jsonb not null default '[]'::jsonb; -- INSPECCIÓN: [{ n, id, sistema, descripcion }]
alter table public.bd_mec_intervenciones add column if not exists falla_id      bigint;    -- REPARACIÓN: bd_taller_problemas.id
alter table public.bd_mec_intervenciones add column if not exists falla_texto   text;
alter table public.bd_mec_intervenciones add column if not exists levantamiento_id bigint; -- REPARACIÓN: report del levantamiento de fallas de donde viene (2026-11-18)
alter table public.bd_mec_intervenciones add column if not exists art_fotos     jsonb not null default '[]'::jsonb; -- fotos de las 2 hojas del ART (papel)
alter table public.bd_mec_intervenciones add column if not exists bloqueo_foto  text;      -- foto del registro de bloqueo (papel)
alter table public.bd_mec_intervenciones add column if not exists fecha_falla   date;      -- fecha en que falló el equipo (con hora_falla)
alter table public.bd_mec_intervenciones add column if not exists disp_anterior text;      -- LEVANTAMIENTO: disponibilidad del equipo antes de dejarlo Fuera de Servicio
create index if not exists bd_mec_intervenciones_falla_idx on public.bd_mec_intervenciones (falla_id);
create index if not exists bd_mec_intervenciones_lev_idx on public.bd_mec_intervenciones (levantamiento_id);

-- 2) Fallas del equipo: también en terreno (sin reparación del taller) y estado REPARADO
alter table public.bd_taller_problemas alter column reparacion_id drop not null;
alter table public.bd_taller_problemas add column if not exists intervencion_id   bigint;      -- report de inspección que la creó
alter table public.bd_taller_problemas add column if not exists tipo_intervencion text;        -- MECANICA | ELECTRICA
alter table public.bd_taller_problemas add column if not exists reparado_por      text;
alter table public.bd_taller_problemas add column if not exists reparado_at       timestamptz;
alter table public.bd_taller_problemas add column if not exists reparado_int_id   bigint;      -- report de reparación que la cerró
alter table public.bd_taller_problemas add column if not exists trabajo_realizado text;
alter table public.bd_taller_problemas add column if not exists codigo_repuesto   text;        -- código del repuesto (si tiene)
alter table public.bd_taller_problemas add column if not exists serie_motor       text;        -- código / serie del motor
alter table public.bd_taller_problemas add column if not exists fotos             jsonb not null default '[]'::jsonb;  -- hasta 2 fotos de la falla
create index if not exists bd_taller_problemas_afi_idx on public.bd_taller_problemas (afi);

-- 3) Disponibilidad: el LEVANTAMIENTO deja el equipo "Fuera de Servicio" hasta reparar todas sus fallas
--    (al reparar la última vuelve a la disponibilidad que tenía antes).
create or replace function public.frc_levantamiento_restaurar(p_lev bigint)
returns text language plpgsql security definer set search_path = public as $$
declare v_afi text; v_ant text; v_disp text;
begin
  select afi, disp_anterior into v_afi, v_ant from public.bd_mec_intervenciones where id = p_lev;
  if v_afi is null or v_ant is null then return null; end if;
  -- ¿queda alguna falla abierta de este levantamiento?
  if exists (select 1 from public.bd_taller_problemas where intervencion_id = p_lev and estado in ('PENDIENTE','AGREGADO')) then return null; end if;
  -- ¿otro levantamiento del mismo equipo sigue con fallas abiertas? → sigue fuera de servicio
  if exists (select 1 from public.bd_taller_problemas p join public.bd_mec_intervenciones m on m.id = p.intervencion_id
              where m.id <> p_lev and m.disp_anterior is not null and upper(trim(m.afi)) = upper(trim(v_afi)) and p.estado in ('PENDIENTE','AGREGADO')) then return null; end if;
  update public."BD_INVENTARIO" set disponibilidad = v_ant
   where upper(trim(afi::text)) = upper(trim(v_afi)) and disponibilidad = 'Fuera de Servicio'
   returning disponibilidad into v_disp;
  return v_disp;
end $$;
revoke all on function public.frc_levantamiento_restaurar(bigint) from public, anon, authenticated;

create or replace function public.frc_levantamiento_fs(p_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare v_afi text; v_disp text;
begin
  if not public.frc_puede(array['mecanicos','operaciones'], 'subadmin') then raise exception 'Sin permiso.'; end if;
  select afi into v_afi from public.bd_mec_intervenciones where id = p_id and modo = 'INSPECCION';
  if v_afi is null then raise exception 'No existe el levantamiento N° %.', p_id; end if;
  if not exists (select 1 from public.bd_taller_problemas where intervencion_id = p_id and estado in ('PENDIENTE','AGREGADO')) then return null; end if;
  select disponibilidad into v_disp from public."BD_INVENTARIO" where upper(trim(afi::text)) = upper(trim(v_afi)) limit 1;
  -- si ya estaba fuera de servicio por otro levantamiento, se recuerda la disponibilidad original de ese
  if v_disp = 'Fuera de Servicio' then
    select disp_anterior into v_disp from public.bd_mec_intervenciones
     where upper(trim(afi)) = upper(trim(v_afi)) and disp_anterior is not null and id <> p_id order by id desc limit 1;
  end if;
  update public.bd_mec_intervenciones set disp_anterior = coalesce(v_disp, 'Operativo') where id = p_id;
  update public."BD_INVENTARIO" set disponibilidad = 'Fuera de Servicio' where upper(trim(afi::text)) = upper(trim(v_afi));
  return 'Fuera de Servicio';
end $$;
revoke all on function public.frc_levantamiento_fs(bigint) from public, anon;
grant execute on function public.frc_levantamiento_fs(bigint) to authenticated;

-- 4) El técnico marca la falla REPARADA (sin permiso para editar toda la tabla)
drop function if exists public.frc_falla_reparada(bigint, bigint, text, text);
create or replace function public.frc_falla_reparada(p_id bigint, p_intervencion_id bigint, p_quien text default '', p_trabajo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.bd_taller_problemas%rowtype; v_disp text;
begin
  if not public.frc_puede(array['mecanicos','operaciones'], 'subadmin') then
    raise exception 'Sin permiso para cerrar fallas.';
  end if;
  update public.bd_taller_problemas
     set estado = 'REPARADO', reparado_por = nullif(p_quien, ''), reparado_at = now(),
         reparado_int_id = p_intervencion_id, trabajo_realizado = p_trabajo,
         procesado_por = coalesce(procesado_por, nullif(p_quien, '')), procesado_at = coalesce(procesado_at, now())
   where id = p_id and estado in ('PENDIENTE', 'AGREGADO')
   returning * into v;
  if not found then
    select * into v from public.bd_taller_problemas where id = p_id;
    if not found then raise exception 'No existe la falla N° %.', p_id; end if;
  end if;
  if v.intervencion_id is not null then v_disp := public.frc_levantamiento_restaurar(v.intervencion_id); end if;
  return to_jsonb(v) || jsonb_build_object('disp_equipo', v_disp);
end $$;
revoke all on function public.frc_falla_reparada(bigint, bigint, text, text) from public, anon;
grant execute on function public.frc_falla_reparada(bigint, bigint, text, text) to authenticated;

-- 5) Borrar un levantamiento (solo Admin) mientras ninguna falla esté reparada ni en OT
create or replace function public.frc_levantamiento_borrar(p_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare v public.bd_mec_intervenciones%rowtype; v_disp text;
begin
  select * into v from public.bd_mec_intervenciones where id = p_id and modo = 'INSPECCION';
  if not found then raise exception 'No existe el levantamiento N° %.', p_id; end if;
  if not public.frc_puede(array['mecanicos','operaciones'], 'admin') then
    raise exception 'Solo un Admin puede borrar un levantamiento.';
  end if;
  if exists (select 1 from public.bd_taller_problemas where intervencion_id = p_id and estado in ('REPARADO','AGREGADO')) then
    raise exception 'El levantamiento N° % tiene fallas reparadas o en OT: no se puede borrar.', p_id;
  end if;
  delete from public.bd_taller_problemas where intervencion_id = p_id;
  -- devuelve la disponibilidad si este levantamiento lo había dejado fuera de servicio
  if v.disp_anterior is not null and not exists (
       select 1 from public.bd_taller_problemas p join public.bd_mec_intervenciones m on m.id = p.intervencion_id
        where m.id <> p_id and m.disp_anterior is not null and upper(trim(m.afi)) = upper(trim(v.afi)) and p.estado in ('PENDIENTE','AGREGADO')) then
    update public."BD_INVENTARIO" set disponibilidad = v.disp_anterior
     where upper(trim(afi::text)) = upper(trim(v.afi)) and disponibilidad = 'Fuera de Servicio'
     returning disponibilidad into v_disp;
  end if;
  delete from public.bd_mec_intervenciones where id = p_id;
  return v_disp;
end $$;
revoke all on function public.frc_levantamiento_borrar(bigint) from public, anon;
grant execute on function public.frc_levantamiento_borrar(bigint) to authenticated;

notify pgrst, 'reload schema';
