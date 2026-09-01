-- LISTIA Marketplace only.
insert into public.marketplace_qroo_places
  (place_key,canonical_place,municipality,place_type,latitude,longitude,aliases,coordinate_source_url)
values
  ('puerto-morelos-zona-hotelera','Zona Hotelera Puerto Morelos','Puerto Morelos','zone',20.848037,-86.875221,array['Zona Hotelera Puerto Morelos','ZONA HOTELERAInt. PUERTO MORELOS','Zona Hotelera, Puerto Morelos'],'https://wikipedia.cthon.io/content/wikipedia_en_all_nopic_2024-06/A/Puerto_Morelos_Lighthouse')
on conflict(place_key) do update set
  canonical_place=excluded.canonical_place,
  municipality=excluded.municipality,
  place_type=excluded.place_type,
  latitude=excluded.latitude,
  longitude=excluded.longitude,
  aliases=excluded.aliases,
  coordinate_source_url=excluded.coordinate_source_url,
  updated_at=now();