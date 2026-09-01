-- LISTIA Marketplace only.
insert into public.marketplace_qroo_places
(place_key,canonical_place,municipality,place_type,latitude,longitude,aliases,coordinate_source_url)
values
('puerto-morelos-palma-real','Palma Real','Puerto Morelos','zone',20.86702,-86.89513,array['Palma Real, Puerto Morelos','Residencial Palma Real, Puerto Morelos'],'https://mapcarta.com/N10152332616')
on conflict(place_key) do update set canonical_place=excluded.canonical_place,municipality=excluded.municipality,place_type=excluded.place_type,latitude=excluded.latitude,longitude=excluded.longitude,aliases=excluded.aliases,coordinate_source_url=excluded.coordinate_source_url,updated_at=now();

update public.marketplace_listings
set location_text='Palma Real, Puerto Morelos, Quintana Roo, México',updated_at=now()
where id='827b5700-981d-46ad-b023-bd3f54201f8d';

update public.marketplace_listings
set location_text='Rafael E. Melgar 36, Casco Antiguo, Puerto Morelos, Quintana Roo, México',updated_at=now()
where id='2dba6653-2435-48d7-ba09-8cec2111c8bc';