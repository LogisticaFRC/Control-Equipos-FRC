-- =====================================================================
-- CONTACTOS DE SUPERVISORES DE OTRAS EMPRESAS (2026-11-20)
-- Ejecutar en Supabase → SQL Editor → Run (se puede volver a ejecutar).
--   · bd_contactos_clientes: nombre, apellido, empresa y correo que van poniendo
--     los mecánicos. Al escribir el nombre en la app aparecen y se autocompletan.
--   · frc_contacto_guardar: guarda / corrige el contacto (si el mecánico corrige
--     el correo de un contacto ya guardado, se actualiza ese mismo contacto).
-- =====================================================================
create table if not exists public.bd_contactos_clientes (
  id            bigserial primary key,
  nombre        text not null,
  apellido      text not null default '',
  empresa       text not null default '',
  correo        text not null,
  veces         integer not null default 1,
  creado_por    text,
  actualizado_por text,
  created_at    timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);
create unique index if not exists bd_contactos_clientes_correo on public.bd_contactos_clientes (lower(correo));

alter table public.bd_contactos_clientes enable row level security;
drop policy if exists frc_leer on public.bd_contactos_clientes;
create policy frc_leer on public.bd_contactos_clientes for select to authenticated using ((select public.frc_es_miembro()));

create or replace function public.frc_contacto_guardar(p_id bigint, p_nombre text, p_apellido text, p_empresa text, p_correo text, p_quien text default '')
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_otro bigint; v_correo text := lower(trim(coalesce(p_correo, '')));
begin
  if not public.frc_puede(array['mecanicos', 'operaciones'], 'subadmin') then raise exception 'Sin permiso.'; end if;
  if v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Correo no válido: %', p_correo; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Falta el nombre.'; end if;
  select id into v_otro from public.bd_contactos_clientes where lower(correo) = v_correo;
  -- contacto elegido de la lista y le corrigieron el correo: se corrige ese mismo
  if p_id is not null and exists (select 1 from public.bd_contactos_clientes where id = p_id) and (v_otro is null or v_otro = p_id) then
    v_id := p_id;
  else
    v_id := v_otro;   -- el correo ya existe: se actualiza ese contacto
  end if;
  if v_id is null then
    insert into public.bd_contactos_clientes (nombre, apellido, empresa, correo, creado_por, actualizado_por)
    values (initcap(trim(p_nombre)), initcap(trim(coalesce(p_apellido, ''))), upper(trim(coalesce(p_empresa, ''))), v_correo, nullif(p_quien, ''), nullif(p_quien, ''))
    returning id into v_id;
  else
    update public.bd_contactos_clientes set
      nombre = initcap(trim(p_nombre)), apellido = initcap(trim(coalesce(p_apellido, ''))),
      empresa = coalesce(nullif(upper(trim(coalesce(p_empresa, ''))), ''), empresa),
      correo = v_correo, veces = veces + 1, actualizado_por = nullif(p_quien, ''), actualizado_at = now()
    where id = v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.frc_contacto_guardar(bigint, text, text, text, text, text) from public, anon;
grant execute on function public.frc_contacto_guardar(bigint, text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
