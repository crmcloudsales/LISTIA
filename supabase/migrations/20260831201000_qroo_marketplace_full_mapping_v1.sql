create table if not exists public.marketplace_qroo_places (
  place_key text primary key,
  canonical_place text not null,
  municipality text not null,
  place_type text not null default 'locality',
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  aliases text[] not null default '{}',
  coordinate_source_url text,
  updated_at timestamptz not null default now()
);

alter table public.marketplace_qroo_places enable row level security;
revoke all on public.marketplace_qroo_places from anon, authenticated;
grant select,insert,update,delete on public.marketplace_qroo_places to service_role;

insert into public.marketplace_qroo_places(place_key,canonical_place,municipality,place_type,latitude,longitude,aliases,coordinate_source_url) values
('cancun','Cancún','Benito Juárez','locality',21.152700,-86.842600,array['Cancún','Cancun','Benito Juárez','Benito Juarez'],'https://mapcarta.com/es/Canc%C3%BAn'),
('playa-del-carmen','Playa del Carmen','Playa del Carmen','locality',20.646300,-87.080800,array['Playa del Carmen','Solidaridad','Mayakoba Country Club'],'https://mapcarta.com/es/Playa_del_Carmen'),
('tulum','Tulum','Tulum','locality',20.214700,-87.428900,array['Tulum'],'https://mapcarta.com/es/Tulum'),
('puerto-morelos','Puerto Morelos','Puerto Morelos','locality',20.855200,-86.900100,array['Puerto Morelos'],'https://mapcarta.com/es/Puerto_Morelos'),
('cozumel','Cozumel','Cozumel','locality',20.453500,-86.928400,array['Cozumel'],'https://mapcarta.com/es/Cozumel'),
('puerto-aventuras','Puerto Aventuras','Playa del Carmen','locality',20.506700,-87.230100,array['Puerto Aventuras'],'https://mapcarta.com/es/Puerto_Aventuras'),
('bacalar','Bacalar','Bacalar','locality',18.678300,-88.392300,array['Bacalar'],'https://mapcarta.com/es/Bacalar'),
('akumal','Akumal','Tulum','locality',20.398800,-87.317300,array['Akumal'],'https://mapcarta.com/es/Akumal'),
('chetumal','Chetumal','Othón P. Blanco','locality',18.502400,-88.295800,array['Chetumal','Othón P. Blanco','Othon P. Blanco'],'https://mapcarta.com/es/Chetumal'),
('isla-mujeres','Isla Mujeres','Isla Mujeres','locality',21.237200,-86.735000,array['Isla Mujeres'],'https://mapcarta.com/es/Isla_Mujeres'),
('holbox','Holbox','Lázaro Cárdenas','locality',21.522100,-87.378300,array['Holbox'],'https://mapcarta.com/es/Holbox'),
('mahahual','Mahahual','Othón P. Blanco','locality',18.725700,-87.707200,array['Mahahual'],'https://mapcarta.com/es/Mahahual'),
('felipe-carrillo-puerto','Felipe Carrillo Puerto','Felipe Carrillo Puerto','locality',19.577600,-88.046300,array['Felipe Carrillo Puerto'],'https://mapcarta.com/es/Felipe_Carrillo_Puerto_%28Quintana_Roo%29'),
('jose-maria-morelos','José María Morelos','José María Morelos','locality',19.748890,-88.709810,array['José María Morelos','Jose Maria Morelos'],'https://mapcarta.com/es/19991656'),
('kantunilkin','Kantunilkín','Lázaro Cárdenas','locality',21.101660,-87.486920,array['Lázaro Cárdenas','Lazaro Cardenas','Kantunilkín','Kantunilkin'],'https://mapcarta.com/es/19991082'),
('costa-mujeres','Costa Mujeres','Isla Mujeres','zone',21.271000,-86.899000,array['Costa Mujeres','Playa Mujeres'],'https://mapcarta.com/es/29512242'),
('xpu-ha','Xpu-Ha','Playa del Carmen','zone',20.470000,-87.250000,array['Xpu-Ha','Xpu Ha','Nahal'],null),
('xul-ha','Xul-Ha','Othón P. Blanco','locality',18.550000,-88.470000,array['Xul-ha','Xul-Ha'],null)
on conflict(place_key) do update set canonical_place=excluded.canonical_place,municipality=excluded.municipality,place_type=excluded.place_type,latitude=excluded.latitude,longitude=excluded.longitude,aliases=excluded.aliases,coordinate_source_url=excluded.coordinate_source_url,updated_at=now();

create or replace view public.marketplace_qroo_mapped_listings as
with candidates as (
  select l.*, coalesce(nullif(trim(l.city),''),nullif(trim(l.location_text),'')) as raw_place
  from public.marketplace_listings l
  where lower(coalesce(l.state_region,''))='quintana roo'
     or lower(coalesce(l.location_text,'')) like '%quintana roo%'
), resolved as (
  select c.*, p.place_key,p.canonical_place,p.municipality,p.place_type,
    coalesce(c.latitude,p.latitude) as map_latitude,
    coalesce(c.longitude,p.longitude) as map_longitude,
    case when c.latitude is not null and c.longitude is not null then 'listing_exact' when p.place_key is not null then 'locality_centroid' else 'unmapped' end as map_precision
  from candidates c
  left join lateral (
    select qp.* from public.marketplace_qroo_places qp
    where lower(c.raw_place)=any(select lower(x) from unnest(qp.aliases) x)
       or lower(c.raw_place)=lower(qp.canonical_place)
    order by case when lower(c.raw_place)=lower(qp.canonical_place) then 0 else 1 end
    limit 1
  ) p on true
)
select *, case when place_key is null then true else false end as location_review_required
from resolved;

revoke all on public.marketplace_qroo_mapped_listings from anon, authenticated;
grant select on public.marketplace_qroo_mapped_listings to service_role;

create or replace view public.marketplace_qroo_mapping_review as
select q.*,
case
  when lower(coalesce(raw_place,'')) in (
    'el molino residencial','el campanario','fraccionamiento el campanario','punta tiburón','punta tiburon',
    'punta tiburón residencial marina & golf','querétaro','santiago de querétaro','valle real','abu dhabi','la espiga',
    'león de los aldama','arcos vallarta','boca del río','tapalpa','jardines del campestre'
  ) then 'out_of_state_quarantine'
  when location_review_required then 'manual_review'
  else 'mapped'
end as mapping_status
from public.marketplace_qroo_mapped_listings q;
revoke all on public.marketplace_qroo_mapping_review from anon,authenticated;
grant select on public.marketplace_qroo_mapping_review to service_role;

create or replace view public.marketplace_qroo_clean_map as
select * from public.marketplace_qroo_mapping_review where mapping_status='mapped';
revoke all on public.marketplace_qroo_clean_map from anon,authenticated;
grant select on public.marketplace_qroo_clean_map to service_role;

create or replace view public.marketplace_qroo_mapping_summary as
select municipality,canonical_place,map_precision,count(*)::bigint as listings,
       count(*) filter(where source_id is not null)::bigint as attributed_listings,
       count(distinct source_id)::bigint as sources
from public.marketplace_qroo_clean_map
group by municipality,canonical_place,map_precision;
revoke all on public.marketplace_qroo_mapping_summary from anon, authenticated;
grant select on public.marketplace_qroo_mapping_summary to service_role;
