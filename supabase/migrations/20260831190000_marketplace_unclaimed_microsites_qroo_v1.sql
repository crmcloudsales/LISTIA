create table if not exists public.marketplace_microsites (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null unique references public.marketplace_sources(id) on delete cascade,
  slug text not null unique,
  hostname text not null unique,
  status text not null default 'unclaimed' check (status in ('draft','unclaimed','claimed','paused')),
  primary_state text,
  company_name text not null,
  principal_name text,
  principal_role text,
  website_url text,
  email text,
  phone text,
  whatsapp text,
  logo_url text,
  hero_image_url text,
  brand jsonb not null default '{}'::jsonb,
  video_urls jsonb not null default '[]'::jsonb,
  listings_count integer not null default 0,
  claim_cta text not null default 'RECLAMA TU NUEVO SITIO WEB Y RECIBE MÁS LEADS',
  robots_index boolean not null default false,
  provenance jsonb not null default '{}'::jsonb,
  last_generated_at timestamptz,
  claimed_at timestamptz,
  claimed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketplace_microsites enable row level security;
revoke all on public.marketplace_microsites from anon, authenticated;
grant select,insert,update,delete on public.marketplace_microsites to service_role;

create index if not exists marketplace_microsites_state_status_idx
  on public.marketplace_microsites(primary_state,status);

with qroo as (
  select b.*,
         lower(trim(both '-' from regexp_replace(
           coalesce(
             nullif(
               regexp_replace(
                 split_part(regexp_replace(coalesce(b.website_url,''),'^https?://(www\\.)?','','i'),'/',1),
                 '\\.[a-zA-Z]{2,}$','','g'
               ),
               ''
             ),
             b.company_name
           ),
           '[^a-zA-Z0-9]+','-','g'
         ))) as base_slug
  from public.marketplace_source_prospect_backup b
  where b.primary_state='Quintana Roo'
), ranked as (
  select q.*,
         case when base_slug='' then 'inmobiliaria' else left(base_slug,48) end as stem,
         row_number() over(
           partition by case when base_slug='' then 'inmobiliaria' else left(base_slug,48) end
           order by company_name,source_id
         ) as rn,
         count(*) over(
           partition by case when base_slug='' then 'inmobiliaria' else left(base_slug,48) end
         ) as dup_count
  from qroo q
), prepared as (
  select r.*,
         case when dup_count=1 then stem else left(stem,43)||'-'||rn::text end as final_slug
  from ranked r
)
insert into public.marketplace_microsites(
  source_id,slug,hostname,status,primary_state,company_name,principal_name,principal_role,
  website_url,email,phone,whatsapp,listings_count,provenance,last_generated_at
)
select p.source_id,p.final_slug,p.final_slug||'.listiaapp.com','unclaimed',p.primary_state,
       p.company_name,p.principal_name,p.principal_role,p.website_url,p.email,p.phone,p.whatsapp,
       coalesce(p.listings_count,0),
       jsonb_build_object(
         'source','marketplace_source_prospect_backup',
         'contact_status',p.contact_status,
         'confidence',p.confidence,
         'provenance_url',p.provenance_url
       ),
       now()
from prepared p
on conflict(source_id) do update set
  company_name=excluded.company_name,
  principal_name=excluded.principal_name,
  principal_role=excluded.principal_role,
  website_url=excluded.website_url,
  email=excluded.email,
  phone=excluded.phone,
  whatsapp=excluded.whatsapp,
  listings_count=excluded.listings_count,
  primary_state=excluded.primary_state,
  provenance=excluded.provenance,
  last_generated_at=now(),
  updated_at=now();

update public.marketplace_microsites m
set hero_image_url = (
  select l.cover_image_url
  from public.marketplace_listings l
  where l.source_id=m.source_id
    and l.cover_image_url is not null
    and l.cover_image_url<>''
  order by coalesce(l.published_at,l.updated_at,l.created_at) desc
  limit 1
), updated_at=now()
where m.primary_state='Quintana Roo'
  and m.hero_image_url is null;

create or replace view public.marketplace_microsite_public_payload as
select m.id,m.source_id,m.slug,m.hostname,m.status,m.primary_state,m.company_name,
       m.principal_name,m.principal_role,m.website_url,m.email,m.phone,m.whatsapp,
       m.logo_url,m.hero_image_url,m.brand,m.video_urls,m.listings_count,m.claim_cta,m.robots_index,
       coalesce((
         select jsonb_agg(jsonb_build_object(
           'id',z.id,
           'slug',z.slug,
           'title',z.title,
           'operation_type',z.operation_type,
           'property_type',z.property_type,
           'price',z.price,
           'currency',z.currency,
           'location_text',z.location_text,
           'city',z.city,
           'state_region',z.state_region,
           'bedrooms',z.bedrooms,
           'bathrooms',z.bathrooms,
           'area_m2',z.area_m2,
           'cover_image_url',z.cover_image_url,
           'external_url',z.external_url
         ) order by z.ord)
         from (
           select l.*,
                  row_number() over(order by coalesce(l.published_at,l.updated_at,l.created_at) desc) ord
           from public.marketplace_listings l
           where l.source_id=m.source_id
             and l.cover_image_url is not null
             and l.cover_image_url<>''
           order by coalesce(l.published_at,l.updated_at,l.created_at) desc
           limit 40
         ) z
       ),'[]'::jsonb) as properties
from public.marketplace_microsites m
where m.status in ('unclaimed','claimed');

revoke all on public.marketplace_microsite_public_payload from anon, authenticated;
grant select on public.marketplace_microsite_public_payload to service_role;
