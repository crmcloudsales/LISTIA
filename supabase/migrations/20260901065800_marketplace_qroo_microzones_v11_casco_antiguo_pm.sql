-- LISTIA Marketplace only.
-- Casco Antiguo / center reference for explicit Puerto Morelos streets documented by the municipality.
insert into public.marketplace_qroo_places
  (place_key,canonical_place,municipality,place_type,latitude,longitude,aliases,coordinate_source_url)
values
  ('puerto-morelos-casco-antiguo','Casco Antiguo Puerto Morelos','Puerto Morelos','zone',20.848040,-86.875220,
   array['Rafael E. Melgar','Avenida Rafael E. Melgar','Av. Rafael E. Melgar','Rafael Melgar','Calle Cozumel'],
   'https://puertomorelos.gob.mx/comunicacionsocial/establece-gobierno-de-blanca-merari-tziu-munoz-rutas-y-horarios-para-la-recoleccion-de-basura/')
on conflict(place_key) do update set
  canonical_place=excluded.canonical_place,
  municipality=excluded.municipality,
  place_type=excluded.place_type,
  latitude=excluded.latitude,
  longitude=excluded.longitude,
  aliases=excluded.aliases,
  coordinate_source_url=excluded.coordinate_source_url,
  updated_at=now();
