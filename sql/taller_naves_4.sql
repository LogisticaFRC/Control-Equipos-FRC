-- =====================================================================
-- TALLER · HASTA 4 EQUIPOS POR NAVE (2026-11-16)
-- Ejecutar UNA vez en Supabase → SQL Editor → Run (se puede repetir).
-- Antes: 1 equipo por nave (índice único bd_taller_rep_nave_unica).
-- Ahora: hasta 4 equipos a la vez en cada nave (lo controla un trigger).
-- Para cambiar el máximo, cambiar el 4 de abajo y en js/modules/taller/taller.service.js (CAPACIDAD_NAVE).
-- =====================================================================

drop index if exists public.bd_taller_rep_nave_unica;

create or replace function public.frc_taller_nave_cupo()
returns trigger language plpgsql as $$
declare n integer;
begin
  if new.estado = 'EN_NAVE' and new.nave is not null then
    perform pg_advisory_xact_lock(hashtext('frc_nave_' || new.nave));   -- evita que 2 PC llenen la nave al mismo tiempo
    select count(*) into n from public.bd_taller_reparaciones
     where estado = 'EN_NAVE' and nave = new.nave and id <> new.id;
    if n >= 4 then
      raise exception 'nave_llena: la % ya tiene 4 equipos', new.nave;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists frc_taller_nave_cupo on public.bd_taller_reparaciones;
create trigger frc_taller_nave_cupo before insert or update of nave, estado on public.bd_taller_reparaciones
  for each row execute function public.frc_taller_nave_cupo();

notify pgrst, 'reload schema';
