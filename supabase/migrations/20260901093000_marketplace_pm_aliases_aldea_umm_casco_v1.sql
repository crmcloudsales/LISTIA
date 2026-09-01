-- LISTIA Marketplace only.
-- Broaden aliases for two already-verified Puerto Morelos zones so current and future
-- listings with literal variants resolve without manual per-listing edits.

update public.marketplace_qroo_places
set aliases = (
  select array_agg(distinct x)
  from unnest(coalesce(aliases,'{}'::text[]) || array[
    'Aldea Umm - Vesna',
    'Aldea Umm Puerto Morelos',
    'Aldea Umm, Puerto Morelos'
  ]) x
), updated_at=now()
where place_key='puerto-morelos-aldea-umm';

update public.marketplace_qroo_places
set aliases = (
  select array_agg(distinct x)
  from unnest(coalesce(aliases,'{}'::text[]) || array[
    'RAFAEL MELGAR #82',
    'Avenida Rafael melgar, am 01, mz 5, lote 9, puerto morelos',
    'Av. Rafael E. Melgar, Puerto Morelos'
  ]) x
), updated_at=now()
where place_key='puerto-morelos-casco-antiguo';
