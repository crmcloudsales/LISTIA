-- LISTIA / THE CORE — Contact & Lead + Audience + Email Campaign foundation
-- Provider-neutral by design. Bulk marketing recipients must be explicitly eligible.

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  first_name text,
  last_name text,
  full_name text,
  email text,
  phone text,
  whatsapp text,
  country_code text,
  region text,
  city text,
  locale text not null default 'es',
  source text not null default 'manual',
  source_ref text,
  contact_type text not null default 'contact' check (contact_type in ('contact','lead','client','partner','owner','developer','realtor','other')),
  lifecycle_stage text not null default 'new' check (lifecycle_stage in ('new','active','qualified','opportunity','client','inactive','closed')),
  consent_status text not null default 'unknown' check (consent_status in ('unknown','opted_in','opted_out','transactional_only')),
  consent_source text,
  consent_at timestamptz,
  marketing_eligible boolean not null default false,
  unsubscribed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists contacts_org_email_unique
  on public.contacts(organization_id, lower(email)) where email is not null and btrim(email) <> '';
create index if not exists contacts_org_stage_idx on public.contacts(organization_id, lifecycle_stage, created_at desc);
create index if not exists contacts_org_country_locale_idx on public.contacts(organization_id, country_code, locale);
create index if not exists contacts_org_marketing_idx on public.contacts(organization_id, marketing_eligible) where marketing_eligible = true;

create table if not exists public.contact_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  source_type text not null default 'upload' check (source_type in ('upload','google_drive','csv','xlsx','google_sheets','api','manual','other')),
  source_name text,
  source_ref text,
  status text not null default 'queued' check (status in ('queued','processing','needs_review','completed','failed','cancelled')),
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  invalid_rows integer not null default 0,
  blocked_rows integer not null default 0,
  mapping jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.contact_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.contact_imports(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb not null default '{}'::jsonb,
  contact_id uuid references public.contacts(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','imported','duplicate','invalid','blocked','skipped')),
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(import_id,row_number)
);

create index if not exists contact_imports_org_created_idx on public.contact_imports(organization_id, created_at desc);
create index if not exists contact_import_rows_import_idx on public.contact_import_rows(import_id, row_number);

create table if not exists public.audiences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  description text,
  audience_type text not null default 'static' check (audience_type in ('static','dynamic','property_match','campaign_import')),
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audience_members (
  audience_id uuid not null references public.audiences(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key(audience_id,contact_id)
);

create index if not exists audience_members_org_idx on public.audience_members(organization_id, audience_id);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  audience_id uuid references public.audiences(id) on delete set null,
  name text not null,
  campaign_type text not null default 'property_marketing' check (campaign_type in ('property_marketing','listia_growth','newsletter','follow_up','announcement','other')),
  channel text not null default 'email' check (channel in ('email','whatsapp','multichannel')),
  status text not null default 'draft' check (status in ('draft','review','approved','scheduled','sending','paused','completed','cancelled','failed')),
  subject_template text,
  preheader_template text,
  body_html text,
  body_text text,
  asset_url text,
  landing_url text,
  provider_key text,
  provider_campaign_id text,
  locale_strategy text not null default 'contact' check (locale_strategy in ('contact','campaign','auto')),
  default_locale text not null default 'es',
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  send_limit integer,
  settings jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  locale text,
  email text,
  status text not null default 'pending' check (status in ('pending','blocked','queued','sent','delivered','opened','clicked','bounced','unsubscribed','complained','failed')),
  block_reason text,
  provider_message_id text,
  queued_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(campaign_id,contact_id)
);

create index if not exists campaign_recipients_campaign_status_idx on public.campaign_recipients(campaign_id,status);
create index if not exists campaign_recipients_org_contact_idx on public.campaign_recipients(organization_id,contact_id);

create table if not exists public.communication_suppressions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text,
  phone text,
  reason text not null default 'unsubscribe' check (reason in ('unsubscribe','complaint','hard_bounce','invalid','manual','legal','other')),
  source text,
  created_at timestamptz not null default now(),
  check (email is not null or phone is not null)
);

create unique index if not exists communication_suppressions_org_email_unique
  on public.communication_suppressions(organization_id, lower(email)) where email is not null and btrim(email) <> '';

create table if not exists public.communication_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  channel text not null check (channel in ('email','whatsapp','sms','voice','other')),
  event_type text not null,
  provider_key text,
  provider_event_id text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists communication_events_org_time_idx on public.communication_events(organization_id, occurred_at desc);
create index if not exists communication_events_campaign_idx on public.communication_events(campaign_id, occurred_at desc);

-- Reusable eligibility view: provider adapters must select from here for marketing sends.
create or replace view public.marketable_contacts as
select c.*
from public.contacts c
where c.marketing_eligible = true
  and c.consent_status = 'opted_in'
  and c.unsubscribed_at is null
  and c.email is not null
  and btrim(c.email) <> ''
  and not exists (
    select 1 from public.communication_suppressions s
    where s.organization_id = c.organization_id
      and s.email is not null
      and lower(s.email) = lower(c.email)
  );

-- RLS: organization data remains tenant-isolated.
alter table public.contacts enable row level security;
alter table public.contact_imports enable row level security;
alter table public.contact_import_rows enable row level security;
alter table public.audiences enable row level security;
alter table public.audience_members enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_recipients enable row level security;
alter table public.communication_suppressions enable row level security;
alter table public.communication_events enable row level security;

-- Helper membership predicate is intentionally repeated so this migration does not depend on a new function.
create policy contacts_member_all on public.contacts for all to authenticated
using (exists(select 1 from public.organization_members m where m.organization_id=contacts.organization_id and m.user_id=(select auth.uid()) and m.status='active'))
with check (exists(select 1 from public.organization_members m where m.organization_id=contacts.organization_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy contact_imports_member_all on public.contact_imports for all to authenticated
using (exists(select 1 from public.organization_members m where m.organization_id=contact_imports.organization_id and m.user_id=(select auth.uid()) and m.status='active'))
with check (created_by=(select auth.uid()) and exists(select 1 from public.organization_members m where m.organization_id=contact_imports.organization_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy contact_import_rows_member_all on public.contact_import_rows for all to authenticated
using (exists(select 1 from public.organization_members m where m.organization_id=contact_import_rows.organization_id and m.user_id=(select auth.uid()) and m.status='active'))
with check (exists(select 1 from public.organization_members m where m.organization_id=contact_import_rows.organization_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy audiences_member_all on public.audiences for all to authenticated
using (exists(select 1 from public.organization_members m where m.organization_id=audiences.organization_id and m.user_id=(select auth.uid()) and m.status='active'))
with check (exists(select 1 from public.organization_members m where m.organization_id=audiences.organization_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy audience_members_member_all on public.audience_members for all to authenticated
using (exists(select 1 from public.organization_members m where m.organization_id=audience_members.organization_id and m.user_id=(select auth.uid()) and m.status='active'))
with check (exists(select 1 from public.organization_members m where m.organization_id=audience_members.organization_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy campaigns_member_all on public.campaigns for all to authenticated
using (exists(select 1 from public.organization_members m where m.organization_id=campaigns.organization_id and m.user_id=(select auth.uid()) and m.status='active'))
with check (exists(select 1 from public.organization_members m where m.organization_id=campaigns.organization_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy campaign_recipients_member_all on public.campaign_recipients for all to authenticated
using (exists(select 1 from public.organization_members m where m.organization_id=campaign_recipients.organization_id and m.user_id=(select auth.uid()) and m.status='active'))
with check (exists(select 1 from public.organization_members m where m.organization_id=campaign_recipients.organization_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy communication_suppressions_member_all on public.communication_suppressions for all to authenticated
using (exists(select 1 from public.organization_members m where m.organization_id=communication_suppressions.organization_id and m.user_id=(select auth.uid()) and m.status='active'))
with check (exists(select 1 from public.organization_members m where m.organization_id=communication_suppressions.organization_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy communication_events_member_select on public.communication_events for select to authenticated
using (exists(select 1 from public.organization_members m where m.organization_id=communication_events.organization_id and m.user_id=(select auth.uid()) and m.status='active'));

revoke all on public.contacts, public.contact_imports, public.contact_import_rows, public.audiences, public.audience_members, public.campaigns, public.campaign_recipients, public.communication_suppressions, public.communication_events from anon;
grant select,insert,update,delete on public.contacts, public.contact_imports, public.contact_import_rows, public.audiences, public.audience_members, public.campaigns, public.campaign_recipients, public.communication_suppressions to authenticated;
grant select on public.communication_events, public.marketable_contacts to authenticated;
grant all on public.contacts, public.contact_imports, public.contact_import_rows, public.audiences, public.audience_members, public.campaigns, public.campaign_recipients, public.communication_suppressions, public.communication_events to service_role;

drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at before update on public.contacts for each row execute function public.set_updated_at();
drop trigger if exists audiences_set_updated_at on public.audiences;
create trigger audiences_set_updated_at before update on public.audiences for each row execute function public.set_updated_at();
drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at before update on public.campaigns for each row execute function public.set_updated_at();
