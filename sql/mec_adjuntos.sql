-- 2026-11-27 · Mecánicos: documentos ENLAZADOS por el Admin (ART / registro de bloqueo) que salen al final del PDF del report
alter table public.bd_mec_intervenciones add column if not exists adjuntos jsonb not null default '[]'::jsonb;
notify pgrst, 'reload schema';
