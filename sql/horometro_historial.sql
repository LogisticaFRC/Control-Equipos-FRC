-- =====================================================================
-- HISTORIAL DE HORÓMETRO (2026-11-27) · solo lo ve el Admin general
-- Ejecutar en Supabase → SQL Editor → Run (se puede volver a ejecutar).
-- Cada cambio del horómetro queda registrado AUTOMÁTICAMENTE (trigger), venga de donde venga:
--   · BD_INVENTARIO.horometroactual / fecha_horometro_manual (app de técnicos, perfil, vehículos, Excel, panel de Supabase)
--   · BD_HISTORIAL.horometro (mantenciones / intervenciones: nuevo, cambiado o eliminado)
-- Guarda antes → después, fecha de la lectura, quién (usuario del sistema) y cuándo.
-- El registro nunca bloquea un guardado: si algo falla al registrar, el cambio se guarda igual.
-- =====================================================================
create table if not exists public.bd_horometro_log (
  id             bigserial primary key,
  created_at     timestamptz not null default now(),
  afi            text,
  origen         text not null default 'INVENTARIO',   -- INVENTARIO | HISTORIAL
  accion         text not null default 'CAMBIO',       -- CAMBIO | BORRADO | NUEVO
  anterior       numeric,
  nuevo          numeric,
  fecha_anterior text,
  fecha_nueva    text,
  registro_id    text,                                 -- id de la fila (inventario o historial)
  detalle        text,
  usuario        text
);
create index if not exists bd_horometro_log_afi_idx on public.bd_horometro_log (afi, created_at desc);
create index if not exists bd_horometro_log_fecha_idx on public.bd_horometro_log (created_at desc);

grant select on public.bd_horometro_log to authenticated;
alter table public.bd_horometro_log enable row level security;
drop policy if exists frc_ver on public.bd_horometro_log;
create policy frc_ver on public.bd_horometro_log for select to authenticated using ((select public.frc_es_admin_general()));
-- (sin políticas de insert/update/delete: solo escribe el trigger; nadie puede borrar el registro desde la app)

-- Quién hizo el cambio (usuario del sistema)
create or replace function public.frc_horo_quien() returns text
language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  begin
    select coalesce(nullif(trim(nombre), ''), usuario) into v from public.usuarios where auth_id = auth.uid();
  exception when others then v := null; end;
  if v is null then
    begin v := coalesce(auth.jwt() ->> 'email', 'sistema / panel Supabase'); exception when others then v := 'sistema / panel Supabase'; end;
  end if;
  return v;
end $$;

create or replace function public.frc_num(t text) returns numeric
language plpgsql immutable as $$
begin
  return nullif(replace(trim(t), ',', '.'), '')::numeric;
exception when others then return null;
end $$;

-- ---------- Inventario (horómetro manual) ----------
create or replace function public.frc_horo_log_inventario() returns trigger
language plpgsql security definer set search_path = public as $$
declare o jsonb := to_jsonb(OLD); n jsonb := to_jsonb(NEW); va numeric; vn numeric;
begin
  begin
    if (o ->> 'horometroactual') is not distinct from (n ->> 'horometroactual')
       and (o ->> 'fecha_horometro_manual') is not distinct from (n ->> 'fecha_horometro_manual') then
      return NEW;
    end if;
    va := public.frc_num(o ->> 'horometroactual'); vn := public.frc_num(n ->> 'horometroactual');
    insert into public.bd_horometro_log (afi, origen, accion, anterior, nuevo, fecha_anterior, fecha_nueva, registro_id, detalle, usuario)
    values (n ->> 'afi', 'INVENTARIO', case when coalesce(vn, 0) = 0 and coalesce(va, 0) > 0 then 'BORRADO' else 'CAMBIO' end,
            va, vn, o ->> 'fecha_horometro_manual', n ->> 'fecha_horometro_manual', n ->> 'id', null, public.frc_horo_quien());
  exception when others then null;   -- nunca bloquear el guardado
  end;
  return NEW;
end $$;
drop trigger if exists frc_horo_log_inventario on public."BD_INVENTARIO";
create trigger frc_horo_log_inventario after update on public."BD_INVENTARIO"
  for each row execute function public.frc_horo_log_inventario();

-- ---------- Historial (horómetro de cada mantención / intervención) ----------
create or replace function public.frc_horo_log_historial() returns trigger
language plpgsql security definer set search_path = public as $$
declare o jsonb; n jsonb; va numeric; vn numeric; r jsonb; det text;
begin
  begin
    o := case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(OLD) else null end;
    n := case when TG_OP in ('UPDATE', 'INSERT') then to_jsonb(NEW) else null end;
    va := public.frc_num(o ->> 'horometro'); vn := public.frc_num(n ->> 'horometro');
    r := coalesce(n, o);
    det := concat_ws(' · ', nullif(r ->> 'tipo_mantencion', ''), nullif(r ->> 'numero_folio', ''), 'fecha ' || coalesce(r ->> 'fecha', ''));
    if TG_OP = 'INSERT' and coalesce(vn, 0) > 0 then
      insert into public.bd_horometro_log (afi, origen, accion, anterior, nuevo, fecha_nueva, registro_id, detalle, usuario)
      values (r ->> 'afi', 'HISTORIAL', 'NUEVO', null, vn, r ->> 'fecha', r ->> 'id', det, public.frc_horo_quien());
    elsif TG_OP = 'UPDATE' and va is distinct from vn then
      insert into public.bd_horometro_log (afi, origen, accion, anterior, nuevo, fecha_anterior, fecha_nueva, registro_id, detalle, usuario)
      values (r ->> 'afi', 'HISTORIAL', case when coalesce(vn, 0) = 0 and coalesce(va, 0) > 0 then 'BORRADO' else 'CAMBIO' end,
              va, vn, o ->> 'fecha', n ->> 'fecha', r ->> 'id', det, public.frc_horo_quien());
    elsif TG_OP = 'DELETE' and coalesce(va, 0) > 0 then
      insert into public.bd_horometro_log (afi, origen, accion, anterior, nuevo, fecha_anterior, registro_id, detalle, usuario)
      values (r ->> 'afi', 'HISTORIAL', 'BORRADO', va, null, o ->> 'fecha', r ->> 'id', 'REGISTRO ELIMINADO · ' || det, public.frc_horo_quien());
    end if;
  exception when others then null;   -- nunca bloquear el guardado
  end;
  return coalesce(NEW, OLD);
end $$;
drop trigger if exists frc_horo_log_historial on public."BD_HISTORIAL";
create trigger frc_horo_log_historial after insert or update or delete on public."BD_HISTORIAL"
  for each row execute function public.frc_horo_log_historial();

revoke all on function public.frc_horo_log_inventario(), public.frc_horo_log_historial(), public.frc_horo_quien() from public, anon;

notify pgrst, 'reload schema';
