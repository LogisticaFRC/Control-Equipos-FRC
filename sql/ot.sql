-- =====================================================================
-- MÓDULO OT · Órdenes de Trabajo (formato FRC-RE-OPE-006)
-- Ejecutar UNA vez en Supabase → SQL Editor → Run (se puede repetir sin perder datos).
-- Requiere haber ejecutado antes sql/seguridad_paso1_auth_rls.sql.
-- ---------------------------------------------------------------------
-- Folio correlativo: la primera OT nueva será la N° 60 (la última en papel fue la 59).
-- Para cambiar el próximo folio (ej. que la siguiente sea la 75):
--     select setval('public.bd_ot_folio_seq', 74);
-- =====================================================================

create sequence if not exists public.bd_ot_folio_seq start with 60 minvalue 1;

create table if not exists public.bd_ot (
  id              bigserial primary key,
  folio           integer not null unique default nextval('public.bd_ot_folio_seq'),
  fecha           date default current_date,
  afi             text,
  equipo          text,
  marca           text,
  modelo          text,
  hrs_actual      text,
  hrs_prox        text,
  tipo_mantencion text,            -- PREVENTIVA | CORRECTIVA | PREDICTIVA
  pauta           text,            -- 250 | 500 | 1000 | 5000
  actividades     jsonb not null default '[]'::jsonb,   -- 20 filas: descripcion, ejecutante, f_inicio, f_term, h_inicio, h_term
  insumos         jsonb not null default '[]'::jsonb,   -- 10 filas: aceites, repuestos, fecha, retira
  personal        jsonb not null default '[]'::jsonb,   -- 4 filas: nombre, cargo
  mecanico        text,
  supervisor      text,
  estado          text not null default 'ABIERTA',      -- ABIERTA | ANULADA  (Realizada = registrada en Historial)
  creado_por      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter sequence public.bd_ot_folio_seq owned by public.bd_ot.folio;
create index if not exists bd_ot_afi_idx on public.bd_ot (afi);

grant select, insert, update, delete on public.bd_ot to authenticated;
grant usage, select on sequence public.bd_ot_folio_seq to authenticated;
grant usage, select on sequence public.bd_ot_id_seq to authenticated;
revoke all on public.bd_ot from anon;

-- Permisos (RLS): leer = cualquier usuario conectado · crear/editar = Subadmin o Admin de Operaciones · eliminar = Admin
alter table public.bd_ot enable row level security;
drop policy if exists frc_leer on public.bd_ot;
drop policy if exists frc_agregar on public.bd_ot;
drop policy if exists frc_modificar on public.bd_ot;
drop policy if exists frc_eliminar on public.bd_ot;
create policy frc_leer on public.bd_ot for select to authenticated
  using ((select public.frc_es_miembro()));
create policy frc_agregar on public.bd_ot for insert to authenticated
  with check ((select public.frc_puede(array['operaciones'], 'subadmin')));
create policy frc_modificar on public.bd_ot for update to authenticated
  using ((select public.frc_puede(array['operaciones'], 'subadmin')))
  with check ((select public.frc_puede(array['operaciones'], 'subadmin')));
create policy frc_eliminar on public.bd_ot for delete to authenticated
  using ((select public.frc_puede(array['operaciones'], 'admin')));

-- Al importar OT antiguas con su folio: si se importa un folio igual o mayor al próximo,
-- el contador salta para que las OT nuevas nunca repitan un folio.
create or replace function public.frc_ot_ajustar_folio()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_max integer; v_ult bigint; v_llamado boolean;
begin
  select max(folio) into v_max from public.bd_ot;
  select last_value, is_called into v_ult, v_llamado from public.bd_ot_folio_seq;
  if v_max is not null and v_max >= (case when v_llamado then v_ult + 1 else v_ult end) then
    perform setval('public.bd_ot_folio_seq', v_max, true);
  end if;
  return null;
end $$;
drop trigger if exists frc_ot_ajustar_folio on public.bd_ot;
create trigger frc_ot_ajustar_folio after insert or update of folio on public.bd_ot
  for each statement execute function public.frc_ot_ajustar_folio();

-- Próximo folio que se asignará
select case when is_called then last_value + 1 else last_value end as proximo_folio
from public.bd_ot_folio_seq;
