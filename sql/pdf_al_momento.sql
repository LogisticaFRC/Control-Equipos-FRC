-- =====================================================================
-- REPORTS DE LA APP: PDF AL MOMENTO + BLOQUEO AL FIRMAR (2026-11-20)
-- Ejecutar en Supabase → SQL Editor → Run (se puede volver a ejecutar).
--   · plantilla: con qué versión del formato se hizo cada report (si mañana cambia
--     el formato, los antiguos se siguen armando con el suyo).
--   · Bloqueo: un report FIRMADO / EN_HISTORIAL no se puede modificar, solo ELIMINAR.
--     (solo se permite el paso FIRMADA → EN_HISTORIAL y el enlace del Historial)
--   · URGENCIA (editar uno firmado): en el SQL Editor, en la MISMA ejecución:
--         set local frc.desbloqueo = 'si';
--         update public.bd_mec_intervenciones set ... where id = ...;
-- =====================================================================
alter table public.bd_mec_intervenciones add column if not exists plantilla text;

create or replace function public.frc_mec_bloqueo_firmado()
returns trigger language plpgsql as $$
declare v_libres text[] := array['historial_id', 'documento_url', 'estado', 'updated_at'];
begin
  if coalesce(current_setting('frc.desbloqueo', true), '') = 'si' then return new; end if;
  if old.estado in ('FIRMADA', 'EN_HISTORIAL') then
    if (to_jsonb(new) - v_libres) is distinct from (to_jsonb(old) - v_libres)
       or (new.estado is distinct from old.estado and not (old.estado = 'FIRMADA' and new.estado = 'EN_HISTORIAL')) then
      raise exception 'El report N° % ya está FIRMADO: no se puede modificar (solo eliminar).', old.id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists frc_mec_bloqueo_firmado on public.bd_mec_intervenciones;
create trigger frc_mec_bloqueo_firmado before update on public.bd_mec_intervenciones
  for each row execute function public.frc_mec_bloqueo_firmado();

notify pgrst, 'reload schema';
