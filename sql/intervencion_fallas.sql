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
create index if not exists bd_taller_problemas_afi_idx on public.bd_taller_problemas (afi);

-- 3) El técnico marca la falla REPARADA (sin permiso para editar toda la tabla)
create or replace function public.frc_falla_reparada(p_id bigint, p_intervencion_id bigint, p_quien text default '', p_trabajo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.bd_taller_problemas%rowtype;
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
  return to_jsonb(v);
end $$;
revoke all on function public.frc_falla_reparada(bigint, bigint, text, text) from public, anon;
grant execute on function public.frc_falla_reparada(bigint, bigint, text, text) to authenticated;

notify pgrst, 'reload schema';
