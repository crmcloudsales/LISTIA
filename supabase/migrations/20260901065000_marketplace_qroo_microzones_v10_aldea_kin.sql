-- LISTIA Marketplace only.
-- Add Aldea Kin with a deliberately narrow alias so it does not collide with
-- Aldea Kiin or ambiguous Aldea Civitas records.
insert into public.marketplace_qroo_places
  (place_key,canonical_place,municipality,place_type,latitude,longitude,aliases,coordinate_source_url)
values
  ('puerto-morelos-aldea-kin','Aldea Kin','Puerto Morelos','zone',20.906090,-86.875590,
   array['Aldea Kin, Puerto Morelos'],
   'https://mapcarta.com/N13238142879')
on conflict(place_key) do update set
  canonical_place=excluded.canonical_place,
  municipality=excluded.municipality,
  place_type=excluded.place_type,
  latitude=excluded.latitude,
  longitude=excluded.longitude,
  aliases=excluded.aliases,
  coordinate_source_url=excluded.coordinate_source_url,
  updated_at=now();
