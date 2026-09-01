-- LISTIA Marketplace only.
insert into public.marketplace_qroo_places
  (place_key,canonical_place,municipality,place_type,latitude,longitude,aliases,coordinate_source_url)
values
  ('puerto-morelos-puntarena','Puntarena','Puerto Morelos','zone',20.84958,-86.89916,array['Puntarena','Punta Arena','Residencial Puntarena','Paseo Punta Arena'],'https://mapcarta.com/N13238151380'),
  ('puerto-morelos-ruta-cenotes','Ruta de los Cenotes','Puerto Morelos','zone',20.855042,-86.980433,array['Ruta de los Cenotes','RUTA DE LOS CENOTES'],'https://www.gps-latitude-longitude.com/gps-coordinates-of-ruta-de-los-cenotes-puerto-morelos')
on conflict(place_key) do update set
  canonical_place=excluded.canonical_place,
  municipality=excluded.municipality,
  place_type=excluded.place_type,
  latitude=excluded.latitude,
  longitude=excluded.longitude,
  aliases=excluded.aliases,
  coordinate_source_url=excluded.coordinate_source_url,
  updated_at=now();
