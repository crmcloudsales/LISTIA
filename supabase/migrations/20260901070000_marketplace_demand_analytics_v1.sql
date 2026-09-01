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

create or replace view public.marketplace_claim_opportunities_v2 as
select o.*,
       coalesce(d.listing_views,0) listing_views_30d,
       coalesce(d.property_opens,0) property_opens_30d,
       coalesce(d.saves,0) saves_30d,
       coalesce(d.shares,0) shares_30d,
       coalesce(d.contact_actions,0) contact_actions_30d,
       coalesce(d.inquiries,0) inquiries_30d,
       coalesce(d.unique_sessions,0) unique_sessions_30d,
       d.last_demand_at,
       (o.claim_score
        +least(coalesce(d.unique_sessions,0),10)
        +least(coalesce(d.contact_actions,0)*3,15)
        +least(coalesce(d.inquiries,0)*5,20))::integer demand_claim_score,
       case when (o.claim_score+least(coalesce(d.unique_sessions,0),10)+least(coalesce(d.contact_actions,0)*3,15)+least(coalesce(d.inquiries,0)*5,20))>=80 then 'hot'
            when (o.claim_score+least(coalesce(d.unique_sessions,0),10)+least(coalesce(d.contact_actions,0)*3,15)+least(coalesce(d.inquiries,0)*5,20))>=60 then 'warm'
            else 'develop' end demand_opportunity_tier
from public.marketplace_claim_opportunities o
left join private.marketplace_demand_source_30d d on d.source_id=o.source_id;
revoke all on public.marketplace_claim_opportunities_v2 from anon,authenticated;
grant select on public.marketplace_claim_opportunities_v2 to service_role;
