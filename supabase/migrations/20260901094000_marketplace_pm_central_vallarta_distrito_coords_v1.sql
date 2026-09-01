-- LISTIA Marketplace only.
-- Add Central Vallarta as a verified Puerto Morelos locality and assign published
-- project coordinates for Distrito Puerto / Distrito Morelos from their environmental filing.

insert into public.marketplace_qroo_places
  (place_key,canonical_place,municipality,place_type,latitude,longitude,aliases,coordinate_source_url)
values
  ('puerto-morelos-central-vallarta','Central Vallarta','Puerto Morelos','locality',20.863330,-87.048790,
   array['Central Vallarta','terreno en central vallarta'],
   'https://www.inegi.org.mx/app/geo2/rgnp/generaPDF.do?id=142029&tipo=100')
on conflict(place_key) do update set
  canonical_place=excluded.canonical_place,
  municipality=excluded.municipality,
  place_type=excluded.place_type,
  latitude=excluded.latitude,
  longitude=excluded.longitude,
  aliases=excluded.aliases,
  coordinate_source_url=excluded.coordinate_source_url,
  updated_at=now();

update public.marketplace_listings
set latitude=20.842495,
    longitude=-86.881427,
    location_text='Distrito Puerto, Manzana 14, SuperManzana 01, Puerto Morelos, Quintana Roo, México',
    updated_at=now()
where status='published' and visibility='public'
  and title='Distrito Puerto'
  and external_url ilike '%grupotsalach.com/distrito-puerto%';

update public.marketplace_listings
set latitude=20.842012,
    longitude=-86.881815,
    location_text='Distrito Morelos, Manzana 14, SuperManzana 01, Puerto Morelos, Quintana Roo, México',
    updated_at=now()
where status='published' and visibility='public'
  and lower(title) like '%distrito morelos%';
