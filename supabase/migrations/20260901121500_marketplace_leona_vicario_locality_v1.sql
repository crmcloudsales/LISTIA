-- LISTIA Marketplace only.
-- Map only Leona Vicario references that explicitly identify Puerto Morelos municipality / CP 77590.
insert into public.marketplace_qroo_places
  (place_key,canonical_place,municipality,place_type,latitude,longitude,aliases,coordinate_source_url)
values
  ('puerto-morelos-leona-vicario','Leona Vicario','Puerto Morelos','locality',20.987679,-87.204523,
   array['Col. Leona Vicario, Puerto Morelos','Leona Vicario, Puerto Morelos','Leona Vicario , Puerto Morelos','C.P. 77590'],
   'https://redcompartida.qroo.gob.mx/sitio/DetalleTorre.php?IdSitio=7008')
on conflict(place_key) do update set
  canonical_place=excluded.canonical_place,
  municipality=excluded.municipality,
  place_type=excluded.place_type,
  latitude=excluded.latitude,
  longitude=excluded.longitude,
  aliases=excluded.aliases,
  coordinate_source_url=excluded.coordinate_source_url,
  updated_at=now();
