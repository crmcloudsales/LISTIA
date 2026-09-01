-- LISTIA Marketplace only.
insert into public.marketplace_qroo_places
(place_key,canonical_place,municipality,place_type,latitude,longitude,aliases,coordinate_source_url)
values
('puerto-morelos-residencial-alborada','Residencial Alborada','Puerto Morelos','zone',20.863930,-86.903010,array['Residencial Alborada','Alborada Condos','Cerrada Alborada'],'https://mapcarta.com/es/N6180322685'),
('puerto-morelos-regatta','Residencial Regatta','Puerto Morelos','zone',20.879130,-86.887490,array['Residencial Regatta','Regatta'],'https://mapcarta.com/es/N13238142883')
on conflict(place_key) do update set
canonical_place=excluded.canonical_place,municipality=excluded.municipality,place_type=excluded.place_type,
latitude=excluded.latitude,longitude=excluded.longitude,aliases=excluded.aliases,
coordinate_source_url=excluded.coordinate_source_url,updated_at=now();
