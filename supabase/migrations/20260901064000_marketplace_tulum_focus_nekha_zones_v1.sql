-- LISTIA Marketplace only.
-- Official project sources identify Focus Tulum in Region 15 and Parque Nek Ha in Region 10.
-- These location_text updates improve approximate zone mapping; they are not exact property GPS.

update public.marketplace_listings l
set location_text='Región 15, Tulum', updated_at=now()
from public.marketplace_sources s
where l.source_id=s.id
  and s.name='Focus Tulum'
  and l.status='published' and l.visibility='public'
  and coalesce(l.location_text,'')='Tulum';

insert into public.marketplace_qroo_places
  (place_key,canonical_place,municipality,place_type,latitude,longitude,aliases,coordinate_source_url)
values
  ('tulum-region-10','Región 10','Tulum','zone',20.211000,-87.484000,
   array['Region 10','Región 10','Parque Nek Ha','Parque NekHa'],
   'https://www.parquestulum.com/ubicacion')
on conflict(place_key) do update set
  canonical_place=excluded.canonical_place,
  municipality=excluded.municipality,
  place_type=excluded.place_type,
  latitude=excluded.latitude,
  longitude=excluded.longitude,
  aliases=excluded.aliases,
  coordinate_source_url=excluded.coordinate_source_url,
  updated_at=now();

update public.marketplace_listings l
set location_text='Región 10, Tulum', updated_at=now()
from public.marketplace_sources s
where l.source_id=s.id
  and s.name='Parque Nek Ha'
  and l.status='published' and l.visibility='public';
