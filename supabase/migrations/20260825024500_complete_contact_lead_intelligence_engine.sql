-- LISTIA / THE CORE — Contact & Lead Intelligence Engine v2
-- Shared, provider-neutral foundation for LISTIA, CloudSales, UpSells and white-label products.

create or replace function public.normalize_contact_email(v text)
returns text language sql immutable as $$
  select nullif(lower(btrim(coalesce(v,''))), '')
$$;

create or replace function public.normalize_contact_phone(v text)
returns text language sql immutable as $$
  select nullif(regexp_replace(coalesce(v,''), '[^0-9+]', '', 'g'), '')
$$;

alter table public.contacts
  add column if not exists timezone text,
  add column if not exists postal_code text,
  add column if not exists company_name text,
  add column if not exists job_title text,
  add column if not exists preferred_channel text,
  add column if not exists lead_score numeric not null default 0,
  add column if not exists quality_score numeric not null default 0,
  add column if not exists engagement_score numeric not null default 0,
  add column if not exists last_activity_at timestamptz,
  add column if not exists first_seen_at timestamptz not null default now(),
  add column if not exists identity_confidence numeric not null default 0,
  add column if not exists normalized_email text generated always as (public.normalize_contact_email(email)) stored,
  add column if not exists normalized_phone text generated always as (public.normalize_contact_phone(coalesce(whatsapp,phone))) stored;

create index if not exists contacts_org_normalized_phone_idx on public.contacts(organization_id, normalized_phone) where normalized_phone is not null;
create index if not exists contacts_org_last_activity_idx on public.contacts(organization_id,last_activity_at desc nulls last);
create index if not exists contacts_org_scores_idx on public.contacts(organization_id,lead_score desc,engagement_score desc);

create table if not exists public.contact_identifiers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  identifier_type text not null check(identifier_type in ('email','phone','whatsapp','external_id','crm_id','social_id','other')),
  identifier_value text not null,
  normalized_value text not null,
  source text,
  verified boolean not null default false,
  is_primary boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create unique index if not exists contact_identifiers_org_type_value_unique on public.contact_identifiers(organization_id,identifier_type,normalized_value);
create index if not exists contact_identifiers_contact_idx on public.contact_identifiers(contact_id);

create table if not exists public.contact_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  source_type text not null,
  source_name text,
  source_ref text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  raw_snapshot jsonb not null default '{}'::jsonb,
  unique(organization_id,contact_id,source_type,source_ref)
);
create index if not exists contact_sources_contact_idx on public.contact_sources(contact_id,last_seen_at desc);

create table if not exists public.contact_preferences (
  contact_id uuid primary key references public.contacts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  min_budget numeric,
  max_budget numeric,
  currency text,
  locations text[] not null default '{}',
  property_types text[] not null default '{}',
  bedrooms_min numeric,
  bathrooms_min numeric,
  intent text,
  timing text,
  interests jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists contact_preferences_org_idx on public.contact_preferences(organization_id);

create table if not exists public.contact_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  activity_type text not null,
  channel text,
  direction text check(direction is null or direction in ('inbound','outbound','system')),
  subject text,
  body_preview text,
  related_entity_type text,
  related_entity_id uuid,
  source text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists contact_activity_contact_time_idx on public.contact_activity(contact_id,occurred_at desc);
create index if not exists contact_activity_org_type_idx on public.contact_activity(organization_id,activity_type,occurred_at desc);

create table if not exists public.contact_merge_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  survivor_contact_id uuid not null references public.contacts(id) on delete cascade,
  merged_contact_id uuid,
  matched_on text[] not null default '{}',
  confidence numeric,
  merge_reason text,
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  event_type text not null,
  from_stage text,
  to_stage text,
  quality_score numeric,
  occurred_at timestamptz not null default now(),
  source text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists lead_events_lead_time_idx on public.lead_events(lead_id,occurred_at desc);
create index if not exists lead_events_org_type_idx on public.lead_events(organization_id,event_type,occurred_at desc);

alter table public.leads
  add column if not exists contact_id uuid references public.contacts(id) on delete set null,
  add column if not exists quality_score numeric not null default 0,
  add column if not exists lead_score numeric not null default 0,
  add column if not exists verification_status text not null default 'unknown',
  add column if not exists source_detail jsonb not null default '{}'::jsonb,
  add column if not exists attribution jsonb not null default '{}'::jsonb,
  add column if not exists last_activity_at timestamptz;
create index if not exists leads_contact_idx on public.leads(contact_id);
create index if not exists leads_org_quality_idx on public.leads(organization_id,quality_score desc,created_at desc);

create table if not exists public.contact_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  marketplace_listing_id uuid references public.marketplace_listings(id) on delete cascade,
  match_score numeric not null default 0,
  reasons jsonb not null default '[]'::jsonb,
  status text not null default 'candidate' check(status in ('candidate','recommended','sent','interested','dismissed','converted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(property_id is not null or marketplace_listing_id is not null)
);
create index if not exists contact_matches_contact_score_idx on public.contact_matches(contact_id,match_score desc);
create index if not exists contact_matches_org_status_idx on public.contact_matches(organization_id,status,match_score desc);

create table if not exists public.provider_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_scope text not null default 'core',
  provider_type text not null,
  provider_key text not null,
  status text not null default 'inactive' check(status in ('inactive','active','degraded','blocked','disabled')),
  capabilities text[] not null default '{}',
  quota_state jsonb not null default '{}'::jsonb,
  config jsonb not null default '{}'::jsonb,
  secret_ref text,
  last_health_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,product_scope,provider_type,provider_key)
);

create table if not exists public.communication_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  channel text not null,
  provider_account_id uuid references public.provider_accounts(id) on delete set null,
  status text not null default 'queued' check(status in ('queued','processing','sent','failed','blocked','cancelled')),
  priority integer not null default 100,
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index if not exists communication_jobs_queue_idx on public.communication_jobs(status,available_at,priority);

create or replace view public.contact_360 as
select c.*,
  (select count(*) from public.contact_activity a where a.contact_id=c.id) as activity_count,
  (select max(a.occurred_at) from public.contact_activity a where a.contact_id=c.id) as latest_activity_at,
  (select count(*) from public.leads l where l.contact_id=c.id) as lead_count,
  (select count(*) from public.contact_matches m where m.contact_id=c.id and m.status in ('candidate','recommended','sent','interested')) as active_match_count
from public.contacts c;

create or replace view public.contact_engine_metrics as
select organization_id,
  count(*) as contacts,
  count(*) filter(where normalized_email is not null) as contacts_with_email,
  count(*) filter(where normalized_phone is not null) as contacts_with_phone,
  count(*) filter(where marketing_eligible and consent_status='opted_in') as marketable,
  count(*) filter(where lifecycle_stage='qualified') as qualified,
  count(*) filter(where lifecycle_stage='client') as clients,
  avg(quality_score) as avg_quality_score,
  avg(engagement_score) as avg_engagement_score
from public.contacts group by organization_id;

alter table public.contact_identifiers enable row level security;
alter table public.contact_sources enable row level security;
alter table public.contact_preferences enable row level security;
alter table public.contact_activity enable row level security;
alter table public.contact_merge_log enable row level security;
alter table public.lead_events enable row level security;
alter table public.contact_matches enable row level security;
alter table public.provider_accounts enable row level security;
alter table public.communication_jobs enable row level security;

create policy contact_identifiers_members on public.contact_identifiers for all to authenticated using(exists(select 1 from public.organization_members m where m.organization_id=contact_identifiers.organization_id and m.user_id=(select auth.uid()) and m.status='active')) with check(exists(select 1 from public.organization_members m where m.organization_id=contact_identifiers.organization_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy contact_sources_members on public.contact_sources for all to authenticated using(exists(select 1 from public.organization_members m where m.organization_id=contact_sources.organization_id and m.user_id=(select auth.uid()) and m.status='active')) with check(exists(select 1 from public.organization_members m where m.organization_id=contact_sources.organization_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy contact_preferences_members on public.contact_preferences for all to authenticated using(exists(select 1 from public.organization_members m where m.organization_id=contact_preferences.organization_id and m.user_id=(select auth.uid()) and m.status='active')) with check(exists(select 1 from public.organization_members m where m.organization_id=contact_preferences.organization_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy contact_activity_members on public.contact_activity for all to authenticated using(exists(select 1 from public.organization_members m where m.organization_id=contact_activity.organization_id and m.user_id=(select auth.uid()) and m.status='active')) with check(exists(select 1 from public.organization_members m where m.organization_id=contact_activity.organization_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy contact_merge_log_members on public.contact_merge_log for select to authenticated using(exists(select 1 from public.organization_members m where m.organization_id=contact_merge_log.organization_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy lead_events_members on public.lead_events for all to authenticated using(exists(select 1 from public.organization_members m where m.organization_id=lead_events.organization_id and m.user_id=(select auth.uid()) and m.status='active')) with check(exists(select 1 from public.organization_members m where m.organization_id=lead_events.organization_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy contact_matches_members on public.contact_matches for all to authenticated using(exists(select 1 from public.organization_members m where m.organization_id=contact_matches.organization_id and m.user_id=(select auth.uid()) and m.status='active')) with check(exists(select 1 from public.organization_members m where m.organization_id=contact_matches.organization_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy provider_accounts_members on public.provider_accounts for select to authenticated using(exists(select 1 from public.organization_members m where m.organization_id=provider_accounts.organization_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy communication_jobs_members on public.communication_jobs for select to authenticated using(exists(select 1 from public.organization_members m where m.organization_id=communication_jobs.organization_id and m.user_id=(select auth.uid()) and m.status='active'));

grant select,insert,update,delete on public.contact_identifiers,public.contact_sources,public.contact_preferences,public.contact_activity,public.lead_events,public.contact_matches to authenticated;
grant select on public.contact_merge_log,public.provider_accounts,public.communication_jobs,public.contact_360,public.contact_engine_metrics to authenticated;
grant all on public.contact_identifiers,public.contact_sources,public.contact_preferences,public.contact_activity,public.contact_merge_log,public.lead_events,public.contact_matches,public.provider_accounts,public.communication_jobs to service_role;

drop trigger if exists contact_preferences_set_updated_at on public.contact_preferences;
create trigger contact_preferences_set_updated_at before update on public.contact_preferences for each row execute function public.set_updated_at();
drop trigger if exists contact_matches_set_updated_at on public.contact_matches;
create trigger contact_matches_set_updated_at before update on public.contact_matches for each row execute function public.set_updated_at();
drop trigger if exists provider_accounts_set_updated_at on public.provider_accounts;
create trigger provider_accounts_set_updated_at before update on public.provider_accounts for each row execute function public.set_updated_at();