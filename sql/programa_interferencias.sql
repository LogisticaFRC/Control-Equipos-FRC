-- =====================================================================
-- INTERFERENCIAS DIARIAS DEL PROGRAMA DE REPARACIÓN (2026-11-23)
-- Ejecutar en Supabase → SQL Editor → Run (se puede volver a ejecutar).
--   · bd_programas_interferencias: razones/problemas de cada día que demoraron la reparación
--     (falta de repuestos, espera de OC, falta de personal, etc.). Pueden ser de un equipo (afi)
--     o generales del programa (afi vacío). Salen en la hoja "Interferencias" del Excel del programa.
-- =====================================================================
create table if not exists public.bd_programas_interferencias (
  id             bigserial primary key,
  created_at     timestamptz not null default now(),
  programa_id    text not null,                 -- id de bd_programas_calendarios
  fecha          date not null default current_date,
  afi            text,                          -- vacío = interferencia general del programa
  nave           text,
  categoria      text not null,
  descripcion    text not null,
  horas_perdidas numeric,
  usuario        text
);
create index if not exists bd_programas_interferencias_prog_idx on public.bd_programas_interferencias (programa_id, fecha desc);
grant select, insert, update, delete on public.bd_programas_interferencias to authenticated;
grant usage, select on sequence public.bd_programas_interferencias_id_seq to authenticated;
alter table public.bd_programas_interferencias enable row level security;
drop policy if exists frc_ver on public.bd_programas_interferencias;
create policy frc_ver on public.bd_programas_interferencias for select to authenticated using ((select public.frc_es_miembro()));
drop policy if exists frc_agregar on public.bd_programas_interferencias;
create policy frc_agregar on public.bd_programas_interferencias for insert to authenticated
  with check ((select public.frc_puede(array['operaciones', 'mecanicos'], 'subadmin')));
drop policy if exists frc_modificar on public.bd_programas_interferencias;
create policy frc_modificar on public.bd_programas_interferencias for update to authenticated
  using ((select public.frc_puede(array['operaciones'], 'subadmin'))) with check ((select public.frc_puede(array['operaciones'], 'subadmin')));
drop policy if exists frc_eliminar on public.bd_programas_interferencias;
create policy frc_eliminar on public.bd_programas_interferencias for delete to authenticated using ((select public.frc_puede(array['operaciones'], 'subadmin')));

notify pgrst, 'reload schema';
