-- =====================================================================
-- REPORTS EN EL HISTORIAL SIN FIRMA DEL SUPERVISOR (2026-11-20)
-- Ejecutar en Supabase → SQL Editor → Run (se puede volver a ejecutar).
-- Requiere: sql/intervencion_fallas.sql (frc_historial_doc_app).
--   · BD_HISTORIAL.falta_firma: el report de la app entra al Historial al enviarlo
--     y queda marcado FALTA FIRMA (en rojo) hasta que firma el supervisor.
--   · frc_historial_doc_firma: cambia el PDF del registro y pone / quita la marca.
-- =====================================================================
alter table public."BD_HISTORIAL" add column if not exists falta_firma boolean not null default false;

create or replace function public.frc_historial_doc_firma(p_hist bigint, p_link text, p_falta_firma boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.frc_puede(array['mecanicos','operaciones'], 'subadmin') then raise exception 'Sin permiso.'; end if;
  if not exists (select 1 from public.bd_mec_intervenciones where historial_id = p_hist) then
    raise exception 'El registro % del Historial no viene de la app.', p_hist;
  end if;
  update public."BD_HISTORIAL" set link = coalesce(nullif(p_link, ''), link), falta_firma = coalesce(p_falta_firma, false) where id = p_hist;
end $$;
revoke all on function public.frc_historial_doc_firma(bigint, text, boolean) from public, anon;
grant execute on function public.frc_historial_doc_firma(bigint, text, boolean) to authenticated;

-- Marca los que ya están en el Historial y siguen sin firma
update public."BD_HISTORIAL" h set falta_firma = true
from public.bd_mec_intervenciones m
where m.historial_id = h.id and m.estado in ('PENDIENTE_FIRMA', 'RECHAZADA') and h.falta_firma = false;

notify pgrst, 'reload schema';
