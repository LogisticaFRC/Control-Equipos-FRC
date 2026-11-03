-- =====================================================================
-- SEGURIDAD · PASO 2 — Limpieza final
-- ---------------------------------------------------------------------
-- Ejecutar SOLO cuando ya se comprobó que todos los usuarios pueden entrar
-- con la nueva versión (y idealmente ya cambiaron su contraseña).
-- Borra definitivamente las contraseñas antiguas en texto plano.
-- =====================================================================

drop table if exists public.usuarios_respaldo_claves;
alter table public.usuarios drop column if exists clave;

-- Revisión: usuarios que aún no cambian la contraseña inicial
select usuario, rol, debe_cambiar_clave
from public.usuarios
where debe_cambiar_clave
order by usuario;
