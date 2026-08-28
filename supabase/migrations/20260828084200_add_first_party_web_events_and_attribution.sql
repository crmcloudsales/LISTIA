create table if not exists public.web_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_host text not null,
  event_name text not null check (event_name in ('page_view','listing_view','lead_submit','appointment','qualified_lead','conversion')),
  event_id text not null,
  anonymous_id text,
  session_id text,
  listing_id uuid references public.marketplace_listings(id) on delete set null,
  lead_id uuid,
  page_url text,
  referrer text,
  source text,
  medium text,
  campaign text,
  content text,
  term text,
  click_ids jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id,event_id)
);
create index if not exists web_events_org_time_idx on public.web_events(organization_id,occurred_at desc);
create index if not exists web_events_listing_idx on public.web_events(listing_id,occurred_at desc) where listing_id is not null;
alter table public.web_events enable row level security;
drop policy if exists web_events_member_select on public.web_events;
create policy web_events_member_select on public.web_events for select to authenticated using (exists(select 1 from public.organization_members m where m.organization_id=web_events.organization_id and m.user_id=auth.uid() and m.status='active'));
revoke all on public.web_events from anon;
grant select on public.web_events to authenticated;

create table if not exists public.attribution_touchpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  anonymous_id text,
  session_id text,
  lead_id uuid,
  event_id text not null,
  touch_type text not null check (touch_type in ('first','last','conversion')),
  source text,
  medium text,
  campaign text,
  content text,
  term text,
  click_ids jsonb not null default '{}'::jsonb,
  landing_url text,
  referrer text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id,event_id,touch_type)
);
create index if not exists attribution_org_time_idx on public.attribution_touchpoints(organization_id,occurred_at desc);
alter table public.attribution_touchpoints enable row level security;
drop policy if exists attribution_member_select on public.attribution_touchpoints;
create policy attribution_member_select on public.attribution_touchpoints for select to authenticated using (exists(select 1 from public.organization_members m where m.organization_id=attribution_touchpoints.organization_id and m.user_id=auth.uid() and m.status='active'));
revoke all on public.attribution_touchpoints from anon;
grant select on public.attribution_touchpoints to authenticated;