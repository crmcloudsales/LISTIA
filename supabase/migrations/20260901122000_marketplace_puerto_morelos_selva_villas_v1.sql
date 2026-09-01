-- LISTIA Marketplace only.
insert into public.marketplace_qroo_places
  (place_key,canonical_place,municipality,place_type,latitude,longitude,aliases,coordinate_source_url)
values
  ('puerto-morelos-selva-escondida','Selva Escondida','Puerto Morelos','zone',20.8720,-86.9011,
   array['Selva Escondida','Selva Escondida II'],
   'https://www.centraldevacaciones.com/blog/hoteles/selva-escondida/'),
  ('puerto-morelos-villas-morelos-ii','Villas Morelos II','Puerto Morelos','zone',20.87174,-86.89387,
   array['Villas Morelos II','Villa Morelos II','Col. Villas Morelos II'],
   'https://mapcarta.com/es/N6621364323')
on conflict(place_key) do update set
  canonical_place=excluded.canonical_place,
  municipality=excluded.municipality,
  place_type=excluded.place_type,
  latitude=excluded.latitude,
  longitude=excluded.longitude,
  aliases=excluded.aliases,
  coordinate_source_url=excluded.coordinate_source_url,
  updated_at=now();