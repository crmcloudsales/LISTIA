-- LISTIA Marketplace only.
insert into public.marketplace_qroo_places
(place_key,canonical_place,municipality,place_type,latitude,longitude,aliases,coordinate_source_url)
values
('puerto-morelos-bahia-petempich','Bahía Petempich','Puerto Morelos','zone',20.89646,-86.85666,array['Bahía Petempich, Puerto Morelos','Bahia Petempich, Puerto Morelos','Fracc. Bahía Petempich','Bahia de Petempich'],'https://mapcarta.com/39399194')
on conflict(place_key) do update set canonical_place=excluded.canonical_place,municipality=excluded.municipality,place_type=excluded.place_type,latitude=excluded.latitude,longitude=excluded.longitude,aliases=excluded.aliases,coordinate_source_url=excluded.coordinate_source_url,updated_at=now();

update public.marketplace_qroo_places
set aliases=(select array_agg(distinct x) from unnest(array_cat(coalesce(aliases,array[]::text[]),array['Punta Vista, Puerto Morelos','Residencial Punta Vista, Puerto Morelos'])) x),updated_at=now()
where place_key='puerto-morelos-punta-vista';
