-- LISTIA Marketplace only.
-- Add verified approximate neighborhood reference points for Playacar phases.
-- These are zone references, never exact property coordinates.

insert into public.marketplace_qroo_places
  (place_key,canonical_place,municipality,place_type,latitude,longitude,aliases,coordinate_source_url)
values
  ('playacar-phase-1','Playacar Fase I','Solidaridad','zone',20.61533,-87.07999,array['Playacar Phase 1','Playacar Fase 1','Playacar Phase I','Playacar Fase I'],'https://mapcarta.com/es/N13239293310'),
  ('playacar-phase-2','Playacar Fase II','Solidaridad','zone',20.61361,-87.09023,array['Playacar Phase 2','Playacar Fase 2','Playacar Phase II','Playacar Fase II'],'https://mapcarta.com/es/N13239293315')
on conflict(place_key) do update set
  canonical_place=excluded.canonical_place,
  municipality=excluded.municipality,
  place_type=excluded.place_type,
  latitude=excluded.latitude,
  longitude=excluded.longitude,
  aliases=excluded.aliases,
  coordinate_source_url=excluded.coordinate_source_url,
  updated_at=now();
