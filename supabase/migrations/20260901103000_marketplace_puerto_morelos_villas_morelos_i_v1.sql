-- LISTIA Marketplace only.
insert into public.marketplace_qroo_places
  (place_key,canonical_place,municipality,place_type,latitude,longitude,aliases,coordinate_source_url)
values
  ('puerto-morelos-villas-morelos-i','Villas Morelos I','Puerto Morelos','zone',20.860183,-86.904870,
   array['Villas Morelos I','Villas Morelos I, Puerto Morelos','J Rojo 69, Villas Morelos I'],
   'https://mx.micodigopostal.info/provincia/quintana-roo-puerto-morelos')
on conflict(place_key) do update set
  canonical_place=excluded.canonical_place,municipality=excluded.municipality,place_type=excluded.place_type,
  latitude=excluded.latitude,longitude=excluded.longitude,aliases=excluded.aliases,
  coordinate_source_url=excluded.coordinate_source_url,updated_at=now();

update public.marketplace_listings
set location_text='Villas Morelos I, Puerto Morelos, Quintana Roo, México, C.P. 77580',updated_at=now()
where id='ae56f2f4-dd68-4900-b11c-03d141933dbc'
  and status='published' and visibility='public';
