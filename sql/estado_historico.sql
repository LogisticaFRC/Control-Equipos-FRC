-- =====================================================================
-- HISTORIAL DE ESTADO DE LOS EQUIPOS (2026-11-18) · base para la disponibilidad histórica
-- Ejecutar en Supabase → SQL Editor → Run (se puede volver a ejecutar).
--   · Cada vez que cambia el estado (disponibilidad), la empresa o la ubicación de un equipo en
--     BD_INVENTARIO, queda una fila en bd_equipos_estado_hist con la fecha y hora del cambio.
--   · Con eso se puede calcular, por ejemplo, la disponibilidad de octubre o los días que un equipo
--     estuvo en mantención. No cambia nada de lo que ya funciona.
-- =====================================================================
create table if not exists public.bd_equipos_estado_hist (
  id              bigserial primary key,
  afi             text not null,
  disponibilidad  text,
  empresa         text,
  ubicacion       text,
  desde           timestamptz not null default now(),
  usuario         uuid default auth.uid()
);
create index if not exists bd_equipos_estado_hist_afi_idx on public.bd_equipos_estado_hist (afi, desde);
grant select on public.bd_equipos_estado_hist to authenticated;
alter table public.bd_equipos_estado_hist enable row level security;
drop policy if exists frc_ver on public.bd_equipos_estado_hist;
create policy frc_ver on public.bd_equipos_estado_hist for select to authenticated using ((select public.frc_es_miembro()));

create or replace function public.frc_registrar_estado_equipo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT'
     or new.disponibilidad is distinct from old.disponibilidad
     or new.empresa_arriendo is distinct from old.empresa_arriendo
     or new.ubicacion is distinct from old.ubicacion then
    insert into public.bd_equipos_estado_hist (afi, disponibilidad, empresa, ubicacion)
    values (new.afi::text, new.disponibilidad, new.empresa_arriendo, new.ubicacion);
  end if;
  return new;
end $$;
drop trigger if exists frc_estado_equipo_hist on public."BD_INVENTARIO";
create trigger frc_estado_equipo_hist after insert or update on public."BD_INVENTARIO"
  for each row execute function public.frc_registrar_estado_equipo();

-- Punto de partida: el estado de hoy de cada equipo (solo la primera vez)
insert into public.bd_equipos_estado_hist (afi, disponibilidad, empresa, ubicacion, usuario)
select i.afi::text, i.disponibilidad, i.empresa_arriendo, i.ubicacion, null
from public."BD_INVENTARIO" i
where not exists (select 1 from public.bd_equipos_estado_hist h where h.afi = i.afi::text);

notify pgrst, 'reload schema';
