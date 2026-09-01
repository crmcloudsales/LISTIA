-- LISTIA Marketplace only: privacy-minimized demand analytics.
create table if not exists private.marketplace_demand_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (event_name in ('listing_view','search','voice_search','map_view','property_open','save','share','contact_click','whatsapp_click','inquiry')),
  listing_id uuid references public.marketplace_listings(id) on delete set null,
  source_id uuid references public.marketplace_sources(id) on delete set null,
  city text,
  session_hash text not null check (char_length(session_hash) between 16 and 128),
  client_hash text not null check (char_length(client_hash) between 16 and 128),
  query_text text,
  metadata jsonb not null default '{}'::jsonb,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  check (octet_length(coalesce(query_text,'')) <= 400),
  check (pg_column_size(metadata) <= 4096)
);
revoke all on private.marketplace_demand_events from public,anon,authenticated;
grant select,insert on private.marketplace_demand_events to service_role;
create index if not exists marketplace_demand_events_created_idx on private.marketplace_demand_events(created_at desc);
create index if not exists marketplace_demand_events_listing_idx on private.marketplace_demand_events(listing_id,created_at desc) where is_test=false;
create index if not exists marketplace_demand_events_source_idx on private.marketplace_demand_events(source_id,created_at desc) where is_test=false;
create index if not exists marketplace_demand_events_client_rate_idx on private.marketplace_demand_events(client_hash,created_at desc);

create or replace view private.marketplace_demand_source_30d as
select source_id,
       count(*) filter(where event_name='listing_view')::bigint listing_views,
       count(*) filter(where event_name='property_open')::bigint property_opens,
       count(*) filter(where event_name='save')::bigint saves,
       count(*) filter(where event_name='share')::bigint shares,
       count(*) filter(where event_name in ('contact_click','whatsapp_click'))::bigint contact_actions,
       count(*) filter(where event_name='inquiry')::bigint inquiries,
       count(distinct session_hash)::bigint unique_sessions,
       max(created_at) last_demand_at
from private.marketplace_demand_events
where is_test=false and created_at>=now()-interval '30 days' and source_id is not null
group by source_id;
revoke all on private.marketplace_demand_source_30d from public,anon,authenticated;
grant select on private.marketplace_demand_source_30d to service_role;

create or replace view private.marketplace_demand_listing_30d as
select listing_id,source_id,
       count(*) filter(where event_name='listing_view')::bigint listing_views,
       count(*) filter(where event_name='property_open')::bigint property_opens,
       count(*) filter(where event_name='save')::bigint saves,
       count(*) filter(where event_name='share')::bigint shares,
       count(*) filter(where event_name in ('contact_click','whatsapp_click'))::bigint contact_actions,
       count(*) filter(where event_name='inquiry')::bigint inquiries,
       count(distinct session_hash)::bigint unique_sessions,
       max(created_at) last_demand_at
from private.marketplace_demand_events
where is_test=false and created_at>=now()-interval '30 days' and listing_id is not null
group by listing_id,source_id;
revoke all on private.marketplace_demand_listing_30d from public,anon,authenticated;
grant select on private.marketplace_demand_listing_30d to service_role;

create or replace view public.marketplace_claim_opportunities as
with source_stats as (
  select s.id source_id,s.name source_name,s.source_url,s.rights_basis,
         count(*) filter(where l.status='published' and l.visibility='public') public_listings,
         count(*) filter(where l.status='published' and l.visibility='public' and private.marketplace_image_url_is_valid(l.cover_image_url)) valid_cover,
         count(*) filter(where l.status='published' and l.visibility='public' and jsonb_array_length(coalesce(l.gallery,'[]'::jsonb))>=5) rich5,
         count(*) filter(where l.status='published' and l.visibility='public' and jsonb_array_length(coalesce(l.gallery,'[]'::jsonb))>=10) rich10
  from public.marketplace_sources s left join public.marketplace_listings l on l.source_id=s.id
  group by s.id,s.name,s.source_url,s.rights_basis
), matched as (
  select p.id party_id,p.display_name,p.party_type,p.city,p.state_region,p.country_code,p.website_url,p.email,p.phone,p.whatsapp,p.contact_status,p.is_claimable,p.listia_organization_id,p.confidence,p.last_verified_at,
         ss.source_id,ss.source_name,ss.source_url,ss.rights_basis,ss.public_listings,ss.valid_cover,ss.rich5,ss.rich10,
         coalesce(d.listing_views,0) listing_views_30d,coalesce(d.property_opens,0) property_opens_30d,coalesce(d.saves,0) saves_30d,coalesce(d.shares,0) shares_30d,coalesce(d.contact_actions,0) contact_actions_30d,coalesce(d.inquiries,0) inquiries_30d,coalesce(d.unique_sessions,0) unique_sessions_30d,d.last_demand_at,
         (case when p.listia_organization_id is null then 25 else 0 end
          +case when p.is_claimable then 15 else 0 end
          +case when p.contact_status='verified' then 15 when p.contact_status='partially_verified' then 8 else 2 end
          +case when coalesce(p.email,'')<>'' then 10 else 0 end
          +case when coalesce(p.phone,'')<>'' or coalesce(p.whatsapp,'')<>'' then 10 else 0 end
          +least(coalesce(ss.public_listings,0),15)
          +least(coalesce(ss.rich5,0),10)
          +least(coalesce(d.unique_sessions,0),10)
          +least(coalesce(d.contact_actions,0)*3,15)
          +least(coalesce(d.inquiries,0)*5,20))::integer claim_score
  from public.marketplace_parties p
  left join lateral (
    select x.* from source_stats x
    where lower(regexp_replace(coalesce(x.source_url,''),'^https?://(www\.)?','','i')) like '%'||lower(split_part(regexp_replace(coalesce(p.website_url,''),'^https?://(www\.)?','','i'),'/',1))||'%'
    order by x.public_listings desc,x.source_name limit 1
  ) ss on true
  left join private.marketplace_demand_source_30d d on d.source_id=ss.source_id
)
select *,case when claim_score>=80 then 'hot' when claim_score>=60 then 'warm' else 'develop' end opportunity_tier
from matched where is_claimable is true and listia_organization_id is null;
