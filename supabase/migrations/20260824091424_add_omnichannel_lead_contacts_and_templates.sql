create table if not exists public.lead_contact_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  channel_key text not null check (channel_key in ('whatsapp','sms','telegram','email','voice')),
  address text not null,
  normalized_address text,
  reachable boolean,
  consent_status text not null default 'unknown' check (consent_status in ('unknown','not_required','opted_in','opted_out','revoked','blocked')),
  consent_source text,
  consent_text_version text,
  consent_at timestamptz,
  opt_out_at timestamptz,
  last_verified_at timestamptz,
  last_contact_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(lead_id, channel_key, address)
);
create index if not exists lead_contact_channels_org_lead_idx on public.lead_contact_channels(organization_id, lead_id);
create index if not exists lead_contact_channels_channel_reachable_idx on public.lead_contact_channels(channel_key, reachable) where reachable is true;
create index if not exists lead_contact_channels_consent_idx on public.lead_contact_channels(consent_status, channel_key);
alter table public.lead_contact_channels enable row level security;
create policy lead_contact_channels_select_member on public.lead_contact_channels for select to authenticated using (
  exists (select 1 from public.organization_members m where m.organization_id=lead_contact_channels.organization_id and m.user_id=(select auth.uid()) and m.status='active')
);
revoke all on public.lead_contact_channels from anon;
grant select on public.lead_contact_channels to authenticated;
grant all on public.lead_contact_channels to service_role;
drop trigger if exists lead_contact_channels_set_updated_at on public.lead_contact_channels;
create trigger lead_contact_channels_set_updated_at before update on public.lead_contact_channels for each row execute function public.set_updated_at();

create table if not exists private.communication_templates (
  template_key text primary key,
  channel_key text not null,
  purpose text not null,
  category text,
  locale text not null default 'es',
  provider_key text,
  provider_template_id text,
  approval_status text not null default 'draft' check (approval_status in ('draft','submitted','approved','rejected','paused','retired')),
  max_property_cards integer check (max_property_cards is null or max_property_cards between 1 and 10),
  content_schema jsonb not null default '{}'::jsonb,
  legal_requirements jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists private.communication_dispatches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  channel_key text not null,
  template_key text references private.communication_templates(template_key) on delete set null,
  provider_key text,
  provider_message_id text,
  direction text not null default 'outbound' check (direction in ('inbound','outbound')),
  purpose text,
  consent_snapshot jsonb not null default '{}'::jsonb,
  property_ids uuid[] not null default '{}'::uuid[],
  status text not null default 'queued' check (status in ('queued','sent','delivered','read','failed','undelivered','replied','cancelled')),
  provider_cost numeric(20,8),
  currency text not null default 'usd',
  gestion_id uuid references public.gestiones(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  replied_at timestamptz
);
create index if not exists communication_dispatches_org_created_idx on private.communication_dispatches(organization_id, created_at desc);
create index if not exists communication_dispatches_lead_created_idx on private.communication_dispatches(lead_id, created_at desc) where lead_id is not null;
create index if not exists communication_dispatches_channel_status_idx on private.communication_dispatches(channel_key, status, created_at desc);
alter table private.communication_templates enable row level security;
alter table private.communication_dispatches enable row level security;
revoke all on private.communication_templates from public, anon, authenticated;
revoke all on private.communication_dispatches from public, anon, authenticated;
grant all on private.communication_templates to service_role;
grant all on private.communication_dispatches to service_role;

insert into private.communication_templates(template_key,channel_key,purpose,category,locale,provider_key,approval_status,max_property_cards,content_schema,legal_requirements) values
('wa_property_remarketing_carousel_es','whatsapp','property_remarketing','MARKETING','es','meta_cloud_api','draft',10,
 '{"body":"Hola {{lead_name}}, además de {{requested_property}}, encontré otras opciones que podrían interesarte.","cards":"2-10 ranked available properties with image, short verified facts, price when authorized, property URL/CTA","selection_rules":["availability","lead_budget","location_fit","bedrooms_fit","intent_fit","no_duplicate_cards"]}'::jsonb,
 '{"requires_opt_in":true,"requires_meta_template_approval":true,"outside_service_window_template_required":true,"honor_opt_out":true,"do_not_misclassify_as_utility":true}'::jsonb),
('email_property_remarketing_es','email','property_remarketing','MARKETING','es','amazon_ses','draft',10,
 '{"subject":"Más propiedades que pueden encajar contigo","properties":"ranked available properties","cta":"property detail or schedule"}'::jsonb,
 '{"requires_lawful_basis":true,"requires_unsubscribe":true,"honor_suppression":true}'::jsonb),
('telegram_property_remarketing_es','telegram','property_remarketing','MARKETING','es','telegram_bot_api','draft',10,
 '{"properties":"ranked available properties with media and inline buttons"}'::jsonb,
 '{"requires_reachable_chat":true,"requires_user_initiation_or_authorized_business_connection":true,"honor_opt_out":true}'::jsonb)
on conflict (template_key) do update set channel_key=excluded.channel_key,purpose=excluded.purpose,category=excluded.category,locale=excluded.locale,provider_key=excluded.provider_key,max_property_cards=excluded.max_property_cards,content_schema=excluded.content_schema,legal_requirements=excluded.legal_requirements,updated_at=now();