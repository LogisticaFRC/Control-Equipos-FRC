-- =====================================================================
-- SEGURIDAD · PASO 1 — Supabase Auth + RLS (reglas en la base de datos)
-- ---------------------------------------------------------------------
-- Ejecutar UNA vez en Supabase → SQL Editor → Run,
-- JUSTO cuando se suba la nueva versión de la app (la versión antigua deja
-- de funcionar apenas se ejecuta este archivo).
--
-- Qué hace:
--   1. Crea una cuenta de Supabase Auth (contraseña cifrada) por cada usuario
--      de la tabla `usuarios`, con la MISMA contraseña que tiene hoy.
--      Al entrar por primera vez, la app les pide una contraseña nueva.
--   2. Respalda las contraseñas actuales en `usuarios_respaldo_claves`
--      (tabla bloqueada, invisible desde la página) y las BORRA de `usuarios`.
--   3. Activa RLS en todas las tablas: sin iniciar sesión no se puede leer
--      ni modificar nada, y cada acción se valida según el nivel por área.
--   4. Crea las funciones que usa la pantalla Config & Usuarios
--      (crear usuario, restablecer clave, eliminar usuario).
--
-- Se puede volver a ejecutar sin duplicar nada.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1) Columnas nuevas en `usuarios`
-- ---------------------------------------------------------------------
alter table public.usuarios add column if not exists auth_id uuid unique references auth.users(id) on delete cascade;
alter table public.usuarios add column if not exists email text;
alter table public.usuarios add column if not exists debe_cambiar_clave boolean not null default true;
alter table public.usuarios add column if not exists permisos jsonb not null default '{}'::jsonb;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'usuarios' and column_name = 'clave') then
    execute 'alter table public.usuarios alter column clave drop not null';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2) Funciones de apoyo
-- ---------------------------------------------------------------------

-- Correo interno de cada usuario (Supabase Auth exige un correo).
-- Debe ser IGUAL a emailDeUsuario() de js/core/supabase.js.
create or replace function public.frc_email(p_usuario text)
returns text language sql immutable as $$
  select regexp_replace(
           translate(lower(trim(coalesce(p_usuario, ''))), 'áéíóúàèìòùäëïöüñç', 'aeiouaeiouaeiounc'),
           '[^a-z0-9._-]', '_', 'g') || '@usuarios.frchile.cl'
$$;

-- Crea la cuenta en Supabase Auth (uso interno, no se puede llamar desde la página).
create or replace function public.frc_crear_auth(p_email text, p_clave text)
returns uuid language plpgsql security definer
set search_path = public, extensions, auth as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
          extensions.crypt(p_clave, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
          '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
          'email', now(), now(), now());
  return v_id;
end $$;
revoke all on function public.frc_crear_auth(text, text) from public, anon, authenticated;

-- ¿El usuario conectado existe en la tabla usuarios?
create or replace function public.frc_es_miembro()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.usuarios where auth_id = auth.uid())
$$;

-- ¿Es Admin general?
create or replace function public.frc_es_admin_general()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.usuarios where auth_id = auth.uid() and rol = 'admin')
$$;

-- Nivel del usuario conectado en un área: 'admin' | 'subadmin' | 'lectura' (null si no es usuario del sistema).
-- Misma lógica que nivelEnArea()/permisosDe() de js/core/store.js.
create or replace function public.frc_nivel(p_area text)
returns text language sql stable security definer set search_path = public as $$
  select case
           when u.rol = 'admin' then 'admin'
           when coalesce(u.permisos, '{}'::jsonb) <> '{}'::jsonb then coalesce(u.permisos ->> p_area, 'lectura')
           when u.rol = 'subadmin' and p_area = 'operaciones' then 'subadmin'
           else 'lectura'
         end
  from public.usuarios u where u.auth_id = auth.uid()
$$;

-- ¿Tiene al menos el nivel p_minimo ('subadmin' o 'admin') en alguna de las áreas?
create or replace function public.frc_puede(p_areas text[], p_minimo text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from unnest(p_areas) a
    where case public.frc_nivel(a)
            when 'admin' then true
            when 'subadmin' then p_minimo = 'subadmin'
            else false
          end)
$$;

revoke all on function public.frc_es_miembro(), public.frc_es_admin_general(),
                       public.frc_nivel(text), public.frc_puede(text[], text) from public, anon;
grant execute on function public.frc_es_miembro(), public.frc_es_admin_general(),
                          public.frc_nivel(text), public.frc_puede(text[], text) to authenticated;

-- ---------------------------------------------------------------------
-- 3) Migrar los usuarios actuales a Supabase Auth
-- ---------------------------------------------------------------------
create table if not exists public.usuarios_respaldo_claves (
  usuario text primary key,
  clave text,
  respaldado_at timestamptz default now()
);
alter table public.usuarios_respaldo_claves enable row level security;   -- sin políticas = nadie la lee desde la página
revoke all on public.usuarios_respaldo_claves from anon, authenticated;

do $$
declare
  u record;
  v_clave text;
  v_email text;
  v_id uuid;
begin
  for u in select * from public.usuarios where auth_id is null loop
    v_clave := to_jsonb(u) ->> 'clave';
    v_email := public.frc_email(u.usuario);
    select id into v_id from auth.users where lower(email) = v_email;
    if v_id is null then
      if coalesce(v_clave, '') = '' then
        raise notice 'Usuario "%" no tiene clave: se omite (créalo de nuevo desde Config & Usuarios).', u.usuario;
        continue;
      end if;
      v_id := public.frc_crear_auth(v_email, v_clave);
    elsif exists (select 1 from public.usuarios where auth_id = v_id) then
      raise notice 'Usuario "%" choca con otro usuario de nombre parecido: se omite.', u.usuario;
      continue;
    end if;
    update public.usuarios set auth_id = v_id, email = v_email where usuario = u.usuario;
    if v_clave is not null then
      insert into public.usuarios_respaldo_claves (usuario, clave) values (u.usuario, v_clave)
      on conflict (usuario) do nothing;
    end if;
  end loop;

  -- Las contraseñas ya quedaron cifradas en Supabase Auth: se borran de la tabla visible
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'usuarios' and column_name = 'clave') then
    execute 'update public.usuarios set clave = null where auth_id is not null';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4) Protección del usuario principal (logistica)
-- ---------------------------------------------------------------------
create or replace function public.frc_proteger_principal()
returns trigger language plpgsql as $$
begin
  if lower(old.usuario) = 'logistica' then
    if tg_op = 'DELETE' then
      raise exception 'El usuario principal no se puede eliminar.';
    end if;
    if new.rol is distinct from 'admin' or lower(new.usuario) <> 'logistica' then
      raise exception 'El usuario principal debe seguir siendo Admin general.';
    end if;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists frc_proteger_principal on public.usuarios;
create trigger frc_proteger_principal before update or delete on public.usuarios
  for each row execute function public.frc_proteger_principal();

-- ---------------------------------------------------------------------
-- 5) Funciones para Config & Usuarios (solo Admin general)
-- ---------------------------------------------------------------------
create or replace function public.frc_admin_crear_usuario(p_usuario text, p_clave text, p_rol text, p_permisos jsonb)
returns void language plpgsql security definer
set search_path = public, extensions, auth as $$
declare
  v_usuario text := trim(coalesce(p_usuario, ''));
  v_email text;
  v_id uuid;
begin
  if not public.frc_es_admin_general() then raise exception 'No autorizado: requiere Admin general.'; end if;
  if v_usuario = '' then raise exception 'Falta el nombre de usuario.'; end if;
  if length(coalesce(p_clave, '')) < 10 then raise exception 'La contraseña debe tener al menos 10 caracteres.'; end if;
  if p_rol not in ('admin', 'lectura') then raise exception 'Tipo de usuario no válido.'; end if;
  if exists (select 1 from public.usuarios where lower(usuario) = lower(v_usuario)) then
    raise exception 'Ya existe un usuario con ese nombre.';
  end if;
  v_email := public.frc_email(v_usuario);
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Ya existe un usuario con un nombre muy parecido. Usa otro nombre.';
  end if;
  v_id := public.frc_crear_auth(v_email, p_clave);
  insert into public.usuarios (usuario, nombre, rol, permisos, auth_id, email, debe_cambiar_clave)
  values (v_usuario, v_usuario, p_rol, case when p_rol = 'admin' then '{}'::jsonb else coalesce(p_permisos, '{}'::jsonb) end,
          v_id, v_email, true);
end $$;

create or replace function public.frc_admin_cambiar_clave(p_usuario text, p_clave text)
returns void language plpgsql security definer
set search_path = public, extensions, auth as $$
declare v_id uuid;
begin
  if not public.frc_es_admin_general() then raise exception 'No autorizado: requiere Admin general.'; end if;
  if length(coalesce(p_clave, '')) < 10 then raise exception 'La contraseña debe tener al menos 10 caracteres.'; end if;
  select auth_id into v_id from public.usuarios where usuario = p_usuario;
  if v_id is null then raise exception 'Usuario no encontrado.'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_clave, extensions.gen_salt('bf')), updated_at = now()
   where id = v_id;
  delete from auth.sessions where user_id = v_id;          -- cierra sus sesiones abiertas
  update public.usuarios set debe_cambiar_clave = true where auth_id = v_id;
end $$;

create or replace function public.frc_admin_eliminar_usuario(p_usuario text)
returns void language plpgsql security definer
set search_path = public, auth as $$
declare v_id uuid;
begin
  if not public.frc_es_admin_general() then raise exception 'No autorizado: requiere Admin general.'; end if;
  select auth_id into v_id from public.usuarios where usuario = p_usuario;
  if v_id = auth.uid() then raise exception 'No puedes eliminar tu propio usuario.'; end if;
  delete from public.usuarios where usuario = p_usuario;   -- el trigger protege al usuario principal
  if v_id is not null then delete from auth.users where id = v_id; end if;
end $$;

-- El propio usuario avisa que ya cambió su contraseña (la cambia con supabase.auth.updateUser)
create or replace function public.frc_clave_cambiada()
returns void language sql security definer set search_path = public as $$
  update public.usuarios set debe_cambiar_clave = false where auth_id = auth.uid()
$$;

revoke all on function public.frc_admin_crear_usuario(text, text, text, jsonb),
                       public.frc_admin_cambiar_clave(text, text),
                       public.frc_admin_eliminar_usuario(text),
                       public.frc_clave_cambiada() from public, anon;
grant execute on function public.frc_admin_crear_usuario(text, text, text, jsonb),
                          public.frc_admin_cambiar_clave(text, text),
                          public.frc_admin_eliminar_usuario(text),
                          public.frc_clave_cambiada() to authenticated;

-- ---------------------------------------------------------------------
-- 6) RLS en la tabla usuarios
--    Leer: cualquier usuario conectado. Modificar permisos: solo Admin general.
--    Crear / eliminar: solo con las funciones de arriba.
-- ---------------------------------------------------------------------
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'usuarios' loop
    execute format('drop policy %I on public.usuarios', p.policyname);
  end loop;
end $$;
alter table public.usuarios enable row level security;
create policy frc_leer on public.usuarios for select to authenticated
  using ((select public.frc_es_miembro()));
create policy frc_modificar on public.usuarios for update to authenticated
  using ((select public.frc_es_admin_general())) with check ((select public.frc_es_admin_general()));

-- ---------------------------------------------------------------------
-- 7) RLS en las tablas del sistema
--    Leer: cualquier usuario conectado (todos ven todas las áreas).
--    Agregar / modificar / eliminar: nivel mínimo indicado por tabla.
--    'subadmin' = Subadmin o Admin del área · 'admin' = solo Admin del área (o Admin general)
--    Las reglas finas del Subadmin (ej. no cambiar fechas de un ítem asignado) siguen en la app.
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  p record;
begin
  for r in
    select * from (values
      --  tabla                     áreas                                agregar     modificar   eliminar
      ('BD_INVENTARIO',            array['operaciones'],                 'subadmin', 'subadmin', 'admin'),
      ('BD_HISTORIAL',             array['operaciones'],                 'subadmin', 'subadmin', 'admin'),
      ('BD_MOVIMIENTOS',           array['operaciones'],                 'admin',    'admin',    'admin'),
      ('bd_programas_calendarios', array['operaciones'],                 'admin',    'subadmin', 'admin'),
      ('bd_programas_items',       array['operaciones'],                 'subadmin', 'subadmin', 'admin'),
      ('bd_programas_carpetas',    array['operaciones'],                 'admin',    'admin',    'admin'),
      ('bd_equipos_eliminados',    array['operaciones'],                 'admin',    'admin',    'admin'),
      ('bd_minutas',               array['operaciones'],                 'subadmin', 'admin',    'admin'),
      ('bd_minutas_items',         array['operaciones'],                 'subadmin', 'subadmin', 'subadmin'),
      ('bd_filtros',               array['operaciones'],                 'subadmin', 'subadmin', 'subadmin'),
      ('bd_filtros_precios',       array['operaciones'],                 'subadmin', 'subadmin', 'subadmin'),
      ('bd_filtros_stock',         array['operaciones'],                 'subadmin', 'subadmin', 'subadmin'),
      ('bd_filtros_kits',          array['operaciones'],                 'subadmin', 'subadmin', 'subadmin'),
      ('bd_filtros_kits_items',    array['operaciones'],                 'subadmin', 'subadmin', 'subadmin'),
      ('bd_filtros_movimientos',   array['operaciones'],                 'subadmin', 'subadmin', 'admin'),
      ('bd_formatos',              array['general', 'operaciones'],      'admin',    'admin',    'admin'),
      ('bd_modelos_ficha',         array['general', 'operaciones'],      'admin',    'admin',    'admin')
    ) as t(tabla, areas, ins, upd, del)
  loop
    if to_regclass(format('public.%I', r.tabla)) is null then
      raise notice 'La tabla % no existe: se omite.', r.tabla;
      continue;
    end if;
    -- Se borran las políticas antiguas (ej. "anon_all": acceso total sin login)
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = r.tabla loop
      execute format('drop policy %I on public.%I', p.policyname, r.tabla);
    end loop;
    execute format('alter table public.%I enable row level security', r.tabla);
    execute format('create policy frc_leer on public.%I for select to authenticated using ((select public.frc_es_miembro()))', r.tabla);
    execute format('create policy frc_agregar on public.%I for insert to authenticated with check ((select public.frc_puede(%L::text[], %L)))', r.tabla, r.areas, r.ins);
    execute format('create policy frc_modificar on public.%I for update to authenticated using ((select public.frc_puede(%L::text[], %L))) with check ((select public.frc_puede(%L::text[], %L)))', r.tabla, r.areas, r.upd, r.areas, r.upd);
    execute format('create policy frc_eliminar on public.%I for delete to authenticated using ((select public.frc_puede(%L::text[], %L)))', r.tabla, r.areas, r.del);
  end loop;
end $$;

-- Avisa si queda alguna tabla de public SIN RLS (habría que agregarla a la lista de arriba)
do $$
declare t record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity loop
    raise warning 'La tabla public.% NO tiene RLS: cualquiera podría leerla o modificarla.', t.relname;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 8) Archivos (Storage, bucket archivos_frc)
--    Subir / reemplazar / borrar: solo usuarios conectados con nivel Subadmin o Admin en alguna área.
--    (Los enlaces públicos ya guardados siguen funcionando; ver LEEME para dejar el bucket privado.)
-- ---------------------------------------------------------------------
do $$
declare p record;
begin
  -- Se quitan las políticas antiguas que daban acceso al público / sin login
  for p in select policyname from pg_policies
           where schemaname = 'storage' and tablename = 'objects'
             and (roles && array['anon', 'public']::name[]) loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;
drop policy if exists frc_archivos_leer on storage.objects;
drop policy if exists frc_archivos_subir on storage.objects;
drop policy if exists frc_archivos_modificar on storage.objects;
drop policy if exists frc_archivos_borrar on storage.objects;
create policy frc_archivos_leer on storage.objects for select to authenticated
  using (bucket_id = 'archivos_frc' and (select public.frc_es_miembro()));
create policy frc_archivos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'archivos_frc' and (select public.frc_puede(array['operaciones','ventas','seguridad','rrhh','finanzas','administracion','general'], 'subadmin')));
create policy frc_archivos_modificar on storage.objects for update to authenticated
  using (bucket_id = 'archivos_frc' and (select public.frc_puede(array['operaciones','ventas','seguridad','rrhh','finanzas','administracion','general'], 'subadmin')));
create policy frc_archivos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'archivos_frc' and (select public.frc_puede(array['operaciones','ventas','seguridad','rrhh','finanzas','administracion','general'], 'subadmin')));

-- ---------------------------------------------------------------------
-- 9) Resultado: usuarios migrados
-- ---------------------------------------------------------------------
select usuario, rol, email, (auth_id is not null) as migrado, debe_cambiar_clave
from public.usuarios order by usuario;
