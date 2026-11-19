-- =====================================================================
-- OPCIONAL · 2026-11-19 · OT Terreno: N° "OTF-n" → "OTT-n" en el Historial ya guardado
-- ---------------------------------------------------------------------
-- No es obligatorio: el sistema ya MUESTRA como OTT-n los registros antiguos con OTF-n / OF-n,
-- y los registros nuevos se guardan como OTT-n. Ejecutar solo si se quiere que en la base
-- (y en exportaciones directas desde Supabase) también diga OTT.
-- Supabase → SQL Editor → pegar → Run.
-- =====================================================================
update "BD_HISTORIAL"
set numero_ot = regexp_replace(numero_ot, '^\s*O?T?F\s*-?\s*', 'OTT-', 'i')
where numero_ot ~* '^\s*O?T?F\s*-?\s*\d';
