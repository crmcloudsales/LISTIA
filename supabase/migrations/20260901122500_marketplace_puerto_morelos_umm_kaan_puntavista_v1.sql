-- LISTIA Marketplace only.
insert into public.marketplace_qroo_places
(place_key,canonical_place,municipality,place_type,latitude,longitude,aliases,coordinate_source_url)
values
('puerto-morelos-aldea-umm','Aldea Umm','Puerto Morelos','zone',20.894840,-86.878500,array['Aldea Umm'],'https://mapcarta.com/es/N13238142882'),
('puerto-morelos-aldea-kaan','Aldea Kaan','Puerto Morelos','zone',20.898880,-86.878490,array['Aldea Kaan'],'https://mapcarta.com/es/N13238142881'),
('puerto-morelos-punta-vista','Punta Vista','Puerto Morelos','zone',20.874210,-86.888720,array['Punta Vista','Residencial Punta Vista'],'https://mapcarta.com/es/N13238142897')
on conflict(place_key) do update set
canonical_place=excluded.canonical_place,municipality=excluded.municipality,place_type=excluded.place_type,
latitude=excluded.latitude,longitude=excluded.longitude,aliases=excluded.aliases,
coordinate_source_url=excluded.coordinate_source_url,updated_at=now();
