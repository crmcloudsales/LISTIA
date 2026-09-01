-- LISTIA Marketplace only.
-- Representative point from a verified address within Aldea Civitas; zone reference only.
insert into public.marketplace_qroo_places
  (place_key,canonical_place,municipality,place_type,latitude,longitude,aliases,coordinate_source_url)
values
  ('puerto-morelos-aldea-civitas','Aldea Civitas','Puerto Morelos','zone',20.9035,-87.124111,
   array['Aldea Civitas','Col. Aldea Civitas','Residencial Civitas'],
   'https://www.vitacasa.com.mx/propiedades/3775-Terreno-En-Venta-Aldea-Civitas-Ciudad-Cenote/')
on conflict(place_key) do update set
  canonical_place=excluded.canonical_place,
  municipality=excluded.municipality,
  place_type=excluded.place_type,
  latitude=excluded.latitude,
  longitude=excluded.longitude,
  aliases=excluded.aliases,
  coordinate_source_url=excluded.coordinate_source_url,
  updated_at=now();