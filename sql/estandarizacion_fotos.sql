-- 2026-11-27 · Estandarización: hasta 5 fotos generales por inspección
alter table public.bd_estandarizaciones add column if not exists fotos jsonb default '[]'::jsonb;
notify pgrst, 'reload schema';
