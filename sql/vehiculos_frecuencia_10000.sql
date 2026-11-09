-- =====================================================================
-- VEHÍCULOS · Frecuencia de mantención = 10.000 km para TODOS los vehículos
-- (vehículo = equipo de BD_INVENTARIO cuyo AFI es una patente XXXX-XX).
-- En los vehículos el "horómetro" del sistema es el KILOMETRAJE.
-- Ejecutar en Supabase → SQL Editor → Run. Se puede repetir.
-- =====================================================================
update public."BD_INVENTARIO"
   set frecuencia_mantencion = 10000
 where upper(regexp_replace(afi, '\s', '', 'g')) ~ '^[A-Z0-9]{4}-[A-Z0-9]{2}$'
   and upper(afi) ~ '[A-Z]';

-- Lo mismo en la tabla del módulo (si ya existe)
do $$
begin
  if to_regclass('public.bd_vehiculos') is not null then
    update public.bd_vehiculos set frecuencia_km = 10000, updated_at = now();
  end if;
end $$;

-- Revisión: vehículos y su frecuencia
select afi as patente, tipo, marca, modelo, horometroactual as km_tomado, frecuencia_mantencion
  from public."BD_INVENTARIO"
 where upper(regexp_replace(afi, '\s', '', 'g')) ~ '^[A-Z0-9]{4}-[A-Z0-9]{2}$' and upper(afi) ~ '[A-Z]'
 order by afi;
