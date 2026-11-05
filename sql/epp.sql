-- =====================================================================
-- SEGURIDAD · CONTROL ENTREGA EPP
-- Ejecutar UNA vez en Supabase → SQL Editor → Run (se puede repetir sin perder datos).
-- Requiere haber ejecutado antes sql/seguridad_paso1_auth_rls.sql.
-- ---------------------------------------------------------------------
-- bd_trabajadores  → ficha de cada trabajador (nombre, RUT, cargo, tallas y EPP que requiere).
--                    Pensada para que después RRHH la use como base total de trabajadores
--                    (se le agregan columnas; no hay que migrar nada).
-- bd_epp_entregas  → historial: una fila por elemento entregado (fecha, talla, cantidad, motivo).
-- Elementos (columna elemento / llaves de epp_requiere): calzado, buzo, pantalon, polera, parka,
--   primera_capa, guantes_cabritilla, guantes_multiflex, guante_soldador, lente_claro,
--   lente_oscuro, respirador, fonos_auditivos, tapon_auditivo  (ver js/modules/epp/epp.mapper.js)
-- =====================================================================

create table if not exists public.bd_trabajadores (
  id                  bigserial primary key,
  nombre              text not null,
  rut                 text,
  cargo               text,
  activo              boolean not null default true,
  talla_calzado       text,
  talla_buzo          text,
  talla_pantalon      text,
  talla_polera        text,
  talla_parka         text,
  talla_primera_capa  text,
  talla_respirador    text,
  epp_requiere        jsonb not null default '{}'::jsonb,   -- {"calzado": true, "guante_soldador": false, ...}
  observaciones       text,
  creado_por          text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
create unique index if not exists bd_trabajadores_nombre_uidx on public.bd_trabajadores (upper(trim(nombre)));
create unique index if not exists bd_trabajadores_rut_uidx on public.bd_trabajadores (upper(regexp_replace(rut, '[^0-9kK]', '', 'g'))) where rut is not null and rut <> '';

create table if not exists public.bd_epp_entregas (
  id              bigserial primary key,
  trabajador_id   bigint not null references public.bd_trabajadores(id) on delete cascade,
  fecha           date not null default current_date,
  elemento        text not null,
  talla           text,
  cantidad        integer not null default 1 check (cantidad > 0),
  motivo          text,            -- NUEVO / REPOSICION / DETERIORO / PERDIDA / HISTORICO
  observaciones   text,
  entregado_por   text,
  created_at      timestamptz default now()
);
create index if not exists bd_epp_entregas_trab_idx on public.bd_epp_entregas (trabajador_id, fecha desc);

-- updated_at automático
create or replace function public.frc_trabajadores_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists frc_trabajadores_touch on public.bd_trabajadores;
create trigger frc_trabajadores_touch before update on public.bd_trabajadores for each row execute function public.frc_trabajadores_touch();

grant select, insert, update, delete on public.bd_trabajadores, public.bd_epp_entregas to authenticated;
grant usage, select on sequence public.bd_trabajadores_id_seq, public.bd_epp_entregas_id_seq to authenticated;
revoke all on public.bd_trabajadores, public.bd_epp_entregas from anon;

-- Permisos (RLS): leer = cualquier usuario conectado
-- crear/editar = Subadmin o Admin de Seguridad (o de RRHH) · eliminar = Admin de Seguridad (o de RRHH)
alter table public.bd_trabajadores enable row level security;
alter table public.bd_epp_entregas enable row level security;
do $$
declare t text;
begin
  foreach t in array array['bd_trabajadores', 'bd_epp_entregas'] loop
    execute format('drop policy if exists frc_leer on public.%I', t);
    execute format('drop policy if exists frc_agregar on public.%I', t);
    execute format('drop policy if exists frc_modificar on public.%I', t);
    execute format('drop policy if exists frc_eliminar on public.%I', t);
    execute format('create policy frc_leer on public.%I for select to authenticated using ((select public.frc_es_miembro()))', t);
    execute format('create policy frc_agregar on public.%I for insert to authenticated with check ((select public.frc_puede(array[''seguridad'',''rrhh''], ''subadmin'')))', t);
    execute format('create policy frc_modificar on public.%I for update to authenticated using ((select public.frc_puede(array[''seguridad'',''rrhh''], ''subadmin''))) with check ((select public.frc_puede(array[''seguridad'',''rrhh''], ''subadmin'')))', t);
    execute format('create policy frc_eliminar on public.%I for delete to authenticated using ((select public.frc_puede(array[''seguridad'',''rrhh''], ''admin'')))', t);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- CARGA INICIAL desde CONTROL ENTREGA EPP.xlsx (solo agrega lo que falta; se puede repetir)
-- ---------------------------------------------------------------------
insert into public.bd_trabajadores (nombre, cargo, talla_calzado, talla_buzo, talla_pantalon, talla_polera, talla_parka, talla_primera_capa, talla_respirador, epp_requiere, creado_por)
select 'DAMIAN PINO', 'MECÁNICO', '41', 'XL', 'XL', 'XL', 'XL', 'XL', 'L', '{"calzado": true, "buzo": true, "pantalon": true, "polera": true, "parka": true, "primera_capa": true, "respirador": true, "guantes_cabritilla": true, "guantes_multiflex": true, "guante_soldador": false, "lente_claro": true, "lente_oscuro": true, "fonos_auditivos": false, "tapon_auditivo": true}'::jsonb, 'IMPORTACION EXCEL'
where not exists (select 1 from public.bd_trabajadores where upper(nombre) = 'DAMIAN PINO');
insert into public.bd_trabajadores (nombre, cargo, talla_calzado, talla_buzo, talla_pantalon, talla_polera, talla_parka, talla_primera_capa, talla_respirador, epp_requiere, creado_por)
select 'JORDAN ARAYA', 'AYU. MECANICO', '41', 'L', 'L', 'L', 'L', 'L', 'L', '{"calzado": true, "buzo": true, "pantalon": true, "polera": true, "parka": true, "primera_capa": true, "respirador": true, "guantes_cabritilla": true, "guantes_multiflex": true, "guante_soldador": false, "lente_claro": true, "lente_oscuro": true, "fonos_auditivos": false, "tapon_auditivo": true}'::jsonb, 'IMPORTACION EXCEL'
where not exists (select 1 from public.bd_trabajadores where upper(nombre) = 'JORDAN ARAYA');
insert into public.bd_trabajadores (nombre, cargo, talla_calzado, talla_buzo, talla_pantalon, talla_polera, talla_parka, talla_primera_capa, talla_respirador, epp_requiere, creado_por)
select 'JUAN PABLO LORCA', 'AYU. MECANICO', '41', 'M', 'M', 'M', 'M', 'M', 'M', '{"calzado": true, "buzo": true, "pantalon": true, "polera": true, "parka": true, "primera_capa": true, "respirador": true, "guantes_cabritilla": true, "guantes_multiflex": true, "guante_soldador": false, "lente_claro": true, "lente_oscuro": true, "fonos_auditivos": false, "tapon_auditivo": true}'::jsonb, 'IMPORTACION EXCEL'
where not exists (select 1 from public.bd_trabajadores where upper(nombre) = 'JUAN PABLO LORCA');
insert into public.bd_trabajadores (nombre, cargo, talla_calzado, talla_buzo, talla_pantalon, talla_polera, talla_parka, talla_primera_capa, talla_respirador, epp_requiere, creado_por)
select 'RENE TORRES', 'MECÁNICO', '41', 'M', 'M', 'M', 'M', 'M', 'M', '{"calzado": true, "buzo": true, "pantalon": true, "polera": true, "parka": true, "primera_capa": true, "respirador": true, "guantes_cabritilla": true, "guantes_multiflex": true, "guante_soldador": false, "lente_claro": true, "lente_oscuro": true, "fonos_auditivos": false, "tapon_auditivo": true}'::jsonb, 'IMPORTACION EXCEL'
where not exists (select 1 from public.bd_trabajadores where upper(nombre) = 'RENE TORRES');
insert into public.bd_trabajadores (nombre, cargo, talla_calzado, talla_buzo, talla_pantalon, talla_polera, talla_parka, talla_primera_capa, talla_respirador, epp_requiere, creado_por)
select 'FELIPE VILLEGAS', 'MECÁNICO', '43', 'L', 'L', 'L', 'L', 'L', 'M', '{"calzado": true, "buzo": true, "pantalon": true, "polera": true, "parka": true, "primera_capa": true, "respirador": true, "guantes_cabritilla": true, "guantes_multiflex": true, "guante_soldador": false, "lente_claro": true, "lente_oscuro": true, "fonos_auditivos": false, "tapon_auditivo": true}'::jsonb, 'IMPORTACION EXCEL'
where not exists (select 1 from public.bd_trabajadores where upper(nombre) = 'FELIPE VILLEGAS');
insert into public.bd_trabajadores (nombre, cargo, talla_calzado, talla_buzo, talla_pantalon, talla_polera, talla_parka, talla_primera_capa, talla_respirador, epp_requiere, creado_por)
select 'ENRIQUE ORDENES', 'CONDUCTOR', '41', 'M', 'M', 'L', 'M', 'M', '', '{"calzado": true, "buzo": true, "pantalon": true, "polera": true, "parka": true, "primera_capa": true, "respirador": false, "guantes_cabritilla": true, "guantes_multiflex": true, "guante_soldador": false, "lente_claro": true, "lente_oscuro": true, "fonos_auditivos": false, "tapon_auditivo": false}'::jsonb, 'IMPORTACION EXCEL'
where not exists (select 1 from public.bd_trabajadores where upper(nombre) = 'ENRIQUE ORDENES');
insert into public.bd_trabajadores (nombre, cargo, talla_calzado, talla_buzo, talla_pantalon, talla_polera, talla_parka, talla_primera_capa, talla_respirador, epp_requiere, creado_por)
select 'MATIAS PINO', 'SUPERVISOR', '44', 'XL', 'XL', 'XL', 'XL', 'XL', 'L', '{"calzado": true, "buzo": true, "pantalon": true, "polera": true, "parka": true, "primera_capa": true, "respirador": true, "guantes_cabritilla": true, "guantes_multiflex": true, "guante_soldador": false, "lente_claro": true, "lente_oscuro": true, "fonos_auditivos": false, "tapon_auditivo": true}'::jsonb, 'IMPORTACION EXCEL'
where not exists (select 1 from public.bd_trabajadores where upper(nombre) = 'MATIAS PINO');
insert into public.bd_trabajadores (nombre, cargo, talla_calzado, talla_buzo, talla_pantalon, talla_polera, talla_parka, talla_primera_capa, talla_respirador, epp_requiere, creado_por)
select 'EDUARDO BRAVO', 'OP. PLUMA', '40', 'M', 'M', 'M', 'M', 'M', 'M', '{"calzado": true, "buzo": true, "pantalon": true, "polera": true, "parka": true, "primera_capa": true, "respirador": true, "guantes_cabritilla": true, "guantes_multiflex": true, "guante_soldador": false, "lente_claro": true, "lente_oscuro": true, "fonos_auditivos": false, "tapon_auditivo": true}'::jsonb, 'IMPORTACION EXCEL'
where not exists (select 1 from public.bd_trabajadores where upper(nombre) = 'EDUARDO BRAVO');
insert into public.bd_trabajadores (nombre, cargo, talla_calzado, talla_buzo, talla_pantalon, talla_polera, talla_parka, talla_primera_capa, talla_respirador, epp_requiere, creado_por)
select 'RONALD ESCOBAR', 'RIGGER', '41', 'M', 'M', 'M', 'M', 'M', 'M', '{"calzado": true, "buzo": true, "pantalon": true, "polera": true, "parka": true, "primera_capa": true, "respirador": true, "guantes_cabritilla": true, "guantes_multiflex": true, "guante_soldador": false, "lente_claro": true, "lente_oscuro": true, "fonos_auditivos": false, "tapon_auditivo": true}'::jsonb, 'IMPORTACION EXCEL'
where not exists (select 1 from public.bd_trabajadores where upper(nombre) = 'RONALD ESCOBAR');
insert into public.bd_trabajadores (nombre, cargo, talla_calzado, talla_buzo, talla_pantalon, talla_polera, talla_parka, talla_primera_capa, talla_respirador, epp_requiere, creado_por)
select 'NICOLAS GUTIERREZ', 'ELECTRICISTA', '43', 'XXL', 'XXL', 'XXL', 'XXL', 'XXL', 'L', '{"calzado": true, "buzo": true, "pantalon": true, "polera": true, "parka": true, "primera_capa": true, "respirador": true, "guantes_cabritilla": true, "guantes_multiflex": true, "guante_soldador": false, "lente_claro": true, "lente_oscuro": true, "fonos_auditivos": false, "tapon_auditivo": true}'::jsonb, 'IMPORTACION EXCEL'
where not exists (select 1 from public.bd_trabajadores where upper(nombre) = 'NICOLAS GUTIERREZ');
insert into public.bd_trabajadores (nombre, cargo, talla_calzado, talla_buzo, talla_pantalon, talla_polera, talla_parka, talla_primera_capa, talla_respirador, epp_requiere, creado_por)
select 'BRANDON PÉREZ', 'SUPERVISOR', '41', 'M', 'S', 'M', 'M', 'M', 'M', '{"calzado": true, "buzo": true, "pantalon": true, "polera": true, "parka": true, "primera_capa": true, "respirador": true, "guantes_cabritilla": true, "guantes_multiflex": true, "guante_soldador": false, "lente_claro": true, "lente_oscuro": true, "fonos_auditivos": false, "tapon_auditivo": true}'::jsonb, 'IMPORTACION EXCEL'
where not exists (select 1 from public.bd_trabajadores where upper(nombre) = 'BRANDON PÉREZ');
insert into public.bd_trabajadores (nombre, cargo, talla_calzado, talla_buzo, talla_pantalon, talla_polera, talla_parka, talla_primera_capa, talla_respirador, epp_requiere, creado_por)
select 'MARTIN MADARIAGA', 'MECÁNICO', '46', 'XXXL', 'XXXL', 'XXXL', 'XXXL', 'XXXL', 'XL', '{"calzado": true, "buzo": true, "pantalon": true, "polera": true, "parka": true, "primera_capa": true, "respirador": true, "guantes_cabritilla": true, "guantes_multiflex": true, "guante_soldador": false, "lente_claro": true, "lente_oscuro": true, "fonos_auditivos": false, "tapon_auditivo": true}'::jsonb, 'IMPORTACION EXCEL'
where not exists (select 1 from public.bd_trabajadores where upper(nombre) = 'MARTIN MADARIAGA');
insert into public.bd_trabajadores (nombre, cargo, talla_calzado, talla_buzo, talla_pantalon, talla_polera, talla_parka, talla_primera_capa, talla_respirador, epp_requiere, creado_por)
select 'JORGE RAMIREZ', 'MECÁNICO', '42', 'XL', 'XL', 'XL', 'XL', 'XL', 'M', '{"calzado": true, "buzo": true, "pantalon": true, "polera": true, "parka": true, "primera_capa": true, "respirador": true, "guantes_cabritilla": true, "guantes_multiflex": true, "guante_soldador": false, "lente_claro": true, "lente_oscuro": true, "fonos_auditivos": false, "tapon_auditivo": true}'::jsonb, 'IMPORTACION EXCEL'
where not exists (select 1 from public.bd_trabajadores where upper(nombre) = 'JORGE RAMIREZ');
insert into public.bd_trabajadores (nombre, cargo, talla_calzado, talla_buzo, talla_pantalon, talla_polera, talla_parka, talla_primera_capa, talla_respirador, epp_requiere, creado_por)
select 'DUBAL CABAÑAS', 'PRÁCTICA', '42', 'XL', 'XL', 'XL', 'XL', 'XL', 'M', '{"calzado": true, "buzo": true, "pantalon": true, "polera": true, "parka": true, "primera_capa": true, "respirador": true, "guantes_cabritilla": true, "guantes_multiflex": true, "guante_soldador": false, "lente_claro": true, "lente_oscuro": true, "fonos_auditivos": false, "tapon_auditivo": true}'::jsonb, 'IMPORTACION EXCEL'
where not exists (select 1 from public.bd_trabajadores where upper(nombre) = 'DUBAL CABAÑAS');
insert into public.bd_trabajadores (nombre, cargo, talla_calzado, talla_buzo, talla_pantalon, talla_polera, talla_parka, talla_primera_capa, talla_respirador, epp_requiere, creado_por)
select 'IGNACIO NEIRA', 'JEFE OPERACIONES', '', '', '', '', '', '', 'M', '{"calzado": false, "buzo": false, "pantalon": false, "polera": false, "parka": false, "primera_capa": false, "respirador": true, "guantes_cabritilla": true, "guantes_multiflex": true, "guante_soldador": false, "lente_claro": true, "lente_oscuro": true, "fonos_auditivos": false, "tapon_auditivo": true}'::jsonb, 'IMPORTACION EXCEL'
where not exists (select 1 from public.bd_trabajadores where upper(nombre) = 'IGNACIO NEIRA');
insert into public.bd_trabajadores (nombre, cargo, talla_calzado, talla_buzo, talla_pantalon, talla_polera, talla_parka, talla_primera_capa, talla_respirador, epp_requiere, creado_por)
select 'HERMAN ACUÑA', 'ING. RESIDENTE', '', '', '', '', '', '', 'M', '{"calzado": false, "buzo": false, "pantalon": false, "polera": false, "parka": false, "primera_capa": false, "respirador": true, "guantes_cabritilla": true, "guantes_multiflex": true, "guante_soldador": false, "lente_claro": true, "lente_oscuro": true, "fonos_auditivos": false, "tapon_auditivo": true}'::jsonb, 'IMPORTACION EXCEL'
where not exists (select 1 from public.bd_trabajadores where upper(nombre) = 'HERMAN ACUÑA');
insert into public.bd_trabajadores (nombre, cargo, talla_calzado, talla_buzo, talla_pantalon, talla_polera, talla_parka, talla_primera_capa, talla_respirador, epp_requiere, creado_por)
select 'CARLOS NAVARRO', 'CONDUCTOR', '43', 'XL', 'L', 'L', 'L', 'L', 'M', '{"calzado": true, "buzo": true, "pantalon": true, "polera": true, "parka": true, "primera_capa": true, "respirador": true, "guantes_cabritilla": true, "guantes_multiflex": true, "guante_soldador": false, "lente_claro": true, "lente_oscuro": true, "fonos_auditivos": false, "tapon_auditivo": true}'::jsonb, 'IMPORTACION EXCEL'
where not exists (select 1 from public.bd_trabajadores where upper(nombre) = 'CARLOS NAVARRO');
insert into public.bd_trabajadores (nombre, cargo, talla_calzado, talla_buzo, talla_pantalon, talla_polera, talla_parka, talla_primera_capa, talla_respirador, epp_requiere, creado_por)
select 'FRANCISCO GUTIERREZ', 'EJEC. COMERCIAL', '42', 'XL', 'L', 'L', 'L', 'L', 'M', '{"calzado": true, "buzo": true, "pantalon": true, "polera": true, "parka": true, "primera_capa": true, "respirador": true, "guantes_cabritilla": true, "guantes_multiflex": true, "guante_soldador": false, "lente_claro": true, "lente_oscuro": true, "fonos_auditivos": false, "tapon_auditivo": true}'::jsonb, 'IMPORTACION EXCEL'
where not exists (select 1 from public.bd_trabajadores where upper(nombre) = 'FRANCISCO GUTIERREZ');
insert into public.bd_trabajadores (nombre, cargo, talla_calzado, talla_buzo, talla_pantalon, talla_polera, talla_parka, talla_primera_capa, talla_respirador, epp_requiere, creado_por)
select 'IVAN LUNA MOYA', 'APR', '42', '', 'S', 'M', 'M', 'M', 'M', '{"calzado": true, "buzo": false, "pantalon": true, "polera": true, "parka": true, "primera_capa": true, "respirador": true, "guantes_cabritilla": true, "guantes_multiflex": true, "guante_soldador": false, "lente_claro": true, "lente_oscuro": true, "fonos_auditivos": false, "tapon_auditivo": true}'::jsonb, 'IMPORTACION EXCEL'
where not exists (select 1 from public.bd_trabajadores where upper(nombre) = 'IVAN LUNA MOYA');
insert into public.bd_trabajadores (nombre, cargo, talla_calzado, talla_buzo, talla_pantalon, talla_polera, talla_parka, talla_primera_capa, talla_respirador, epp_requiere, creado_por)
select 'JUVENAL SILVA', 'M1', '', '', '', '', '', '', '', '{"calzado": false, "buzo": false, "pantalon": false, "polera": false, "parka": false, "primera_capa": false, "guantes_cabritilla": false, "guantes_multiflex": false, "guante_soldador": false, "lente_claro": false, "lente_oscuro": false, "respirador": false, "fonos_auditivos": false, "tapon_auditivo": false}'::jsonb, 'IMPORTACION EXCEL'
where not exists (select 1 from public.bd_trabajadores where upper(nombre) = 'JUVENAL SILVA');
insert into public.bd_trabajadores (nombre, cargo, talla_calzado, talla_buzo, talla_pantalon, talla_polera, talla_parka, talla_primera_capa, talla_respirador, epp_requiere, creado_por)
select 'VICTOR SOTO', 'CAPATAZ', '', '', '', '', '', '', '', '{"calzado": false, "buzo": false, "pantalon": false, "polera": false, "parka": false, "primera_capa": false, "guantes_cabritilla": false, "guantes_multiflex": false, "guante_soldador": false, "lente_claro": false, "lente_oscuro": false, "respirador": false, "fonos_auditivos": false, "tapon_auditivo": false}'::jsonb, 'IMPORTACION EXCEL'
where not exists (select 1 from public.bd_trabajadores where upper(nombre) = 'VICTOR SOTO');
insert into public.bd_trabajadores (nombre, cargo, talla_calzado, talla_buzo, talla_pantalon, talla_polera, talla_parka, talla_primera_capa, talla_respirador, epp_requiere, creado_por)
select 'FELIPE VIVEROS', 'M1', '', '', '', '', '', '', '', '{"calzado": false, "buzo": false, "pantalon": false, "polera": false, "parka": false, "primera_capa": false, "guantes_cabritilla": false, "guantes_multiflex": false, "guante_soldador": false, "lente_claro": false, "lente_oscuro": false, "respirador": false, "fonos_auditivos": false, "tapon_auditivo": false}'::jsonb, 'IMPORTACION EXCEL'
where not exists (select 1 from public.bd_trabajadores where upper(nombre) = 'FELIPE VIVEROS');
insert into public.bd_trabajadores (nombre, cargo, talla_calzado, talla_buzo, talla_pantalon, talla_polera, talla_parka, talla_primera_capa, talla_respirador, epp_requiere, creado_por)
select 'ABEL MUÑOZ', 'M1', '', '', '', '', '', '', '', '{"calzado": false, "buzo": false, "pantalon": false, "polera": false, "parka": false, "primera_capa": false, "guantes_cabritilla": false, "guantes_multiflex": false, "guante_soldador": false, "lente_claro": false, "lente_oscuro": false, "respirador": false, "fonos_auditivos": false, "tapon_auditivo": false}'::jsonb, 'IMPORTACION EXCEL'
where not exists (select 1 from public.bd_trabajadores where upper(nombre) = 'ABEL MUÑOZ');
insert into public.bd_trabajadores (nombre, cargo, talla_calzado, talla_buzo, talla_pantalon, talla_polera, talla_parka, talla_primera_capa, talla_respirador, epp_requiere, creado_por)
select 'SEBASTIÁN DÍAZ', 'M1', '', '', '', '', '', '', '', '{"calzado": false, "buzo": false, "pantalon": false, "polera": false, "parka": false, "primera_capa": false, "guantes_cabritilla": false, "guantes_multiflex": false, "guante_soldador": false, "lente_claro": false, "lente_oscuro": false, "respirador": false, "fonos_auditivos": false, "tapon_auditivo": false}'::jsonb, 'IMPORTACION EXCEL'
where not exists (select 1 from public.bd_trabajadores where upper(nombre) = 'SEBASTIÁN DÍAZ');

insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-09-30', 'buzo', t.talla_buzo, 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'ABEL MUÑOZ' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-09-30' and e.elemento = 'buzo');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-09-30', 'guantes_cabritilla', '', 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'ABEL MUÑOZ' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-09-30' and e.elemento = 'guantes_cabritilla');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-10-13', 'guantes_cabritilla', '', 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'ABEL MUÑOZ' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-10-13' and e.elemento = 'guantes_cabritilla');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-10-17', 'guantes_cabritilla', '', 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'ABEL MUÑOZ' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-10-17' and e.elemento = 'guantes_cabritilla');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-10-20', 'guantes_cabritilla', '', 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'CARLOS NAVARRO' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-10-20' and e.elemento = 'guantes_cabritilla');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-10-22', 'guantes_cabritilla', '', 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'EDUARDO BRAVO' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-10-22' and e.elemento = 'guantes_cabritilla');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-09-30', 'lente_oscuro', '', 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'FELIPE VILLEGAS' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-09-30' and e.elemento = 'lente_oscuro');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-09-29', 'guantes_cabritilla', '', 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'FELIPE VIVEROS' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-09-29' and e.elemento = 'guantes_cabritilla');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-09-29', 'lente_oscuro', '', 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'FELIPE VIVEROS' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-09-29' and e.elemento = 'lente_oscuro');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-09-30', 'buzo', t.talla_buzo, 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'FELIPE VIVEROS' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-09-30' and e.elemento = 'buzo');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-09-30', 'guantes_cabritilla', '', 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'FELIPE VIVEROS' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-09-30' and e.elemento = 'guantes_cabritilla');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-11-03', 'lente_claro', '', 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'FELIPE VIVEROS' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-11-03' and e.elemento = 'lente_claro');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-11-05', 'buzo', t.talla_buzo, 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'JUAN PABLO LORCA' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-11-05' and e.elemento = 'buzo');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-09-30', 'buzo', t.talla_buzo, 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'JUVENAL SILVA' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-09-30' and e.elemento = 'buzo');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-09-29', 'lente_claro', '', 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'MARTIN MADARIAGA' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-09-29' and e.elemento = 'lente_claro');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-10-28', 'guantes_cabritilla', '', 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'MARTIN MADARIAGA' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-10-28' and e.elemento = 'guantes_cabritilla');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-09-30', 'guantes_cabritilla', '', 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'MATIAS PINO' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-09-30' and e.elemento = 'guantes_cabritilla');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-10-22', 'guantes_cabritilla', '', 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'MATIAS PINO' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-10-22' and e.elemento = 'guantes_cabritilla');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-10-22', 'lente_claro', '', 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'MATIAS PINO' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-10-22' and e.elemento = 'lente_claro');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-10-22', 'lente_oscuro', '', 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'MATIAS PINO' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-10-22' and e.elemento = 'lente_oscuro');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-09-26', 'guantes_cabritilla', '', 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'RENE TORRES' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-09-26' and e.elemento = 'guantes_cabritilla');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-09-26', 'lente_claro', '', 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'RENE TORRES' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-09-26' and e.elemento = 'lente_claro');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-09-30', 'lente_oscuro', '', 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'RENE TORRES' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-09-30' and e.elemento = 'lente_oscuro');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-09-30', 'guantes_cabritilla', '', 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'RONALD ESCOBAR' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-09-30' and e.elemento = 'guantes_cabritilla');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-09-30', 'lente_oscuro', '', 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'RONALD ESCOBAR' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-09-30' and e.elemento = 'lente_oscuro');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-09-30', 'buzo', t.talla_buzo, 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'SEBASTIÁN DÍAZ' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-09-30' and e.elemento = 'buzo');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-09-30', 'calzado', t.talla_calzado, 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'SEBASTIÁN DÍAZ' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-09-30' and e.elemento = 'calzado');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-09-30', 'guantes_cabritilla', '', 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'SEBASTIÁN DÍAZ' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-09-30' and e.elemento = 'guantes_cabritilla');
insert into public.bd_epp_entregas (trabajador_id, fecha, elemento, talla, cantidad, motivo, entregado_por)
select t.id, '2025-10-23', 'guantes_cabritilla', '', 1, 'HISTORICO', 'IMPORTACION EXCEL' from public.bd_trabajadores t
where upper(t.nombre) = 'VICTOR SOTO' and not exists (select 1 from public.bd_epp_entregas e where e.trabajador_id = t.id and e.fecha = '2025-10-23' and e.elemento = 'guantes_cabritilla');
