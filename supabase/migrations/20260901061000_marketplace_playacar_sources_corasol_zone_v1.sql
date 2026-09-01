-- LISTIA Marketplace only.
-- Register newly verified Riviera Maya public sources for research/staging only,
-- add private index observations, and improve map resolution for Corasol.

insert into public.marketplace_sources(scope,source_type,name,source_url,rights_basis,rights_reference,active,created_at,updated_at)
values
('platform','url','Playacar Homes','https://www.playacarhomes.com/','public_link_only','Public inventory index; research/staging only until individual listing rights are confirmed.',true,now(),now()),
('platform','url','Playacar Real Estate / Playacar Beach Properties','https://www.playacarrealestate.com/','public_link_only','Public inventory index; research/staging only until individual listing rights are confirmed.',true,now(),now())
on conflict do nothing;

insert into public.marketplace_qroo_places(place_key,canonical_place,municipality,place_type,latitude,longitude,aliases,coordinate_source_url)
values('playa-corasol','Corasol','Playa del Carmen','zone',20.663300,-87.044900,array['Corasol','Awa Corasol','AWA Corasol'],'https://www.doomos.com.mx/propiedad/departamento-3-rec---exclusivo-residencial-frente-al-mar--corasol-playa-del-carmen-13309076')
on conflict(place_key) do update set canonical_place=excluded.canonical_place,municipality=excluded.municipality,place_type=excluded.place_type,latitude=excluded.latitude,longitude=excluded.longitude,aliases=excluded.aliases,coordinate_source_url=excluded.coordinate_source_url,updated_at=now();

with s as (select id from public.marketplace_sources where source_url='https://www.playacarhomes.com/' limit 1), rows(observation_key,title,price,currency,location_text,city,bedrooms,bathrooms,area_m2) as (values
('playacarhomes-modern-club-real-jungle-villa','Modern Club Real Jungle Villa',30000000,'MXN','Club Real, Playacar, 77717','Playa del Carmen',5,5,440),
('playacarhomes-bamoa-2-bedroom','Bamoa 2 Bedroom Apartment',310000,'USD','Playacar, Bamoa, 77717','Playa del Carmen',2,2,null),
('playacarhomes-modern-villa','Playacar Modern Villa',1700000,'USD','Playacar, 77717','Playa del Carmen',6,6,null),
('playacarhomes-paseo-del-sol-penthouse','Paseo Del Sol Penthouse For Sale',650000,'USD','Playacar Paseo Del Sol, 77710','Playa del Carmen',2,3,null),
('playacarhomes-la-fabrica-villa','La Fábrica Luxury Biophilic Villa',690000,'USD','Playacar Fase II, 77710','Playa del Carmen',4,5,360),
('playacarhomes-playacar-golf-one-ph','Playacar Golf One Penthouse',10000000,'MXN','Playacar, 77717','Playa del Carmen',4,4,293),
('playacarhomes-playacar-phase1-villa','Playacar Phase 1 Villa',900000,'USD','Playacar Fase 1, 77710','Playa del Carmen',7,8,258),
('playacarhomes-land-sale','Playacar Land For Sale',6500000,'MXN','Playacar Club Real, 77710','Playa del Carmen',0,0,433),
('playacarhomes-beachfront-land','Playacar Beach Front Land sale',1900000,'USD','Playacar, 77717','Playa del Carmen',0,0,795.1),
('playacarhomes-vaiven-del-mar','Vaiven Del Mar Condo For Sale',420000,'USD','Playacar Phase 2, 77717','Playa del Carmen',3,3,199)
)
insert into private.marketplace_index_observations(observation_key,source_id,source_url,source_page_url,title,operation_type,property_type,price,currency,location_text,city,state_region,country_code,bedrooms,bathrooms,area_m2,observed_at,raw_data,created_at,updated_at)
select r.observation_key,s.id,'https://www.playacarhomes.com/','https://www.playacarhomes.com/listings',r.title,'sale',case when r.bedrooms=0 then 'land' else 'residential' end,r.price,r.currency,r.location_text,r.city,'Quintana Roo','MX',r.bedrooms,r.bathrooms,r.area_m2,now(),jsonb_build_object('rights_basis','public_link_only','publication_state','private_observation_only'),now(),now()
from rows r cross join s
on conflict(observation_key) do update set price=excluded.price,currency=excluded.currency,location_text=excluded.location_text,bedrooms=excluded.bedrooms,bathrooms=excluded.bathrooms,area_m2=excluded.area_m2,observed_at=now(),updated_at=now();

with s as (select id from public.marketplace_sources where source_url='https://www.playacarrealestate.com/' limit 1), rows(observation_key,title,price,currency,location_text,city,bedrooms,bathrooms,area_m2) as (values
('playacarrealestate-casa-vista-real','Casa Vista Real',24000000,'MXN','Playacar Phase 1, Playa del Carmen','Playa del Carmen',3,3.5,null),
('playacarrealestate-casa-blanca','Casa Blanca',1995000,'USD','Playacar, Playa del Carmen','Playa del Carmen',5,5.5,650),
('playacarrealestate-quinta-clara','Quinta Clara',3500000,'USD','Playacar Phase 1, Playa del Carmen','Playa del Carmen',7,7,null),
('playacarrealestate-xaana-tulum','Xaana',148621,'USD','Tulum, Quintana Roo','Tulum',2,2,130.67),
('playacarrealestate-xaman-ha-7111','Xaman Ha 7111',590000,'USD','Playacar, Playa del Carmen','Playa del Carmen',3,3,null),
('playacarrealestate-casa-tlalolcan','Casa Tlalolcan',1995000,'USD','Akumal, Quintana Roo','Akumal',4,4,2235.21)
)
insert into private.marketplace_index_observations(observation_key,source_id,source_url,source_page_url,title,operation_type,property_type,price,currency,location_text,city,state_region,country_code,bedrooms,bathrooms,area_m2,observed_at,raw_data,created_at,updated_at)
select r.observation_key,s.id,'https://www.playacarrealestate.com/','https://www.playacarrealestate.com/es/propiedades',r.title,'sale','residential',r.price,r.currency,r.location_text,r.city,'Quintana Roo','MX',r.bedrooms,r.bathrooms,r.area_m2,now(),jsonb_build_object('rights_basis','public_link_only','publication_state','private_observation_only','public_contact_phone','+52 984 87 62 199','public_contact_email','info@playacarrealestate.com'),now(),now()
from rows r cross join s
on conflict(observation_key) do update set price=excluded.price,currency=excluded.currency,location_text=excluded.location_text,bedrooms=excluded.bedrooms,bathrooms=excluded.bathrooms,area_m2=excluded.area_m2,observed_at=now(),updated_at=now();
