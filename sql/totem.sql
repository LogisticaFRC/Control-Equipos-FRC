-- =====================================================================
-- TÓTEM DEL TALLER · contraseña para salir de pantalla completa (2026-11-16)
-- Ejecutar UNA vez en Supabase → SQL Editor → Run.
-- La contraseña se guarda cifrada (bcrypt) y nadie puede leerla:
-- solo se puede CAMBIAR (Admin general) o VERIFICAR (usuarios del sistema).
-- =====================================================================

create table if not exists public.bd_totem_clave (
  id          int primary key default 1 check (id = 1),
  hash        text not null,
  updated_at  timestamptz not null default now(),
  updated_by  text
);
alter table public.bd_totem_clave enable row level security;
-- Sin políticas: la tabla no se lee ni se escribe directo, solo por las funciones de abajo.
revoke all on public.bd_totem_clave from anon, authenticated;

-- Admin general: define / cambia la contraseña del tótem
create or replace function public.frc_totem_set_clave(p_clave text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  if not public.frc_es_admin_general() then raise exception 'No autorizado: requiere Admin general.'; end if;
  if length(coalesce(trim(p_clave), '')) < 4 then raise exception 'La contraseña del tótem debe tener al menos 4 caracteres.'; end if;
  insert into public.bd_totem_clave (id, hash, updated_at, updated_by)
  values (1, extensions.crypt(p_clave, extensions.gen_salt('bf')), now(),
          (select usuario from public.usuarios where auth_id = auth.uid()))
  on conflict (id) do update set hash = excluded.hash, updated_at = now(), updated_by = excluded.updated_by;
end $$;

-- Cualquier usuario del sistema (el tótem): ¿la contraseña es correcta?
create or replace function public.frc_totem_verificar(p_clave text)
returns boolean language plpgsql security definer
set search_path = public, extensions as $$
declare v_hash text;
begin
  if not public.frc_es_miembro() then return false; end if;
  select hash into v_hash from public.bd_totem_clave where id = 1;
  if v_hash is null then return false; end if;
  if extensions.crypt(coalesce(p_clave, ''), v_hash) = v_hash then return true; end if;
  perform pg_sleep(1);   -- frena intentos al azar
  return false;
end $$;

-- ¿Ya hay contraseña definida? (para mostrarlo en Configuración / en el tótem)
create or replace function public.frc_totem_info()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.frc_es_miembro()
    then coalesce((select jsonb_build_object('definida', true, 'updated_at', updated_at, 'updated_by', updated_by)
                   from public.bd_totem_clave where id = 1), jsonb_build_object('definida', false))
    else jsonb_build_object('definida', false) end
$$;

revoke all on function public.frc_totem_set_clave(text), public.frc_totem_verificar(text), public.frc_totem_info() from public, anon;
grant execute on function public.frc_totem_set_clave(text), public.frc_totem_verificar(text), public.frc_totem_info() to authenticated;
