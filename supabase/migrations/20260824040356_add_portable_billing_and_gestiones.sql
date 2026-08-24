create table if not exists public.billing_price_bindings (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'stripe',
  environment text not null check (environment in ('test','live','sandbox')),
  portable_key text not null,
  plan_key text not null check (plan_key in ('pro','premium','premium_extra_seat')),
  provider_product_id text not null,
  provider_price_id text not null,
  provider_lookup_key text not null,
  currency text not null default 'usd',
  unit_amount_cents bigint not null check (unit_amount_cents >= 0),
  billing_interval text not null default 'month' check (billing_interval in ('day','week','month','year')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, environment, portable_key),
  unique (provider, environment, provider_price_id),
  unique (provider, environment, provider_lookup_key)
);

create table if not exists public.organization_billing (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan_key text not null default 'free' check (plan_key in ('free','pro','premium')),
  billing_status text not null default 'free',
  access_state text not null default 'active' check (access_state in ('active','payment_warning','payment_blocked')),
  included_seats integer not null default 0 check (included_seats >= 0),
  extra_seats integer not null default 0 check (extra_seats >= 0),
  usage_markup_percent numeric(5,2) not null default 30 check (usage_markup_percent >= 0),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_provider_state (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'stripe',
  environment text not null check (environment in ('test','live','sandbox')),
  provider_customer_id text,
  provider_subscription_id text,
  base_portable_key text,
  base_provider_price_id text,
  extra_seat_provider_price_id text,
  provider_status text,
  last_provider_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, environment),
  unique (provider, environment, provider_customer_id),
  unique (provider, environment, provider_subscription_id)
);

create table if not exists public.billing_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'stripe',
  environment text not null check (environment in ('test','live','sandbox')),
  provider_event_id text not null,
  event_type text not null,
  provider_object_id text,
  processing_status text not null default 'processed' check (processing_status in ('processed','ignored','failed')),
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, environment, provider_event_id)
);

create table if not exists public.gestiones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  provider text not null,
  service text not null,
  provider_cost numeric(20,8) not null check (provider_cost >= 0),
  provider_currency text not null default 'usd',
  plan_key text not null check (plan_key in ('free','pro','premium')),
  markup_percent numeric(5,2) not null check (markup_percent >= 0),
  platform_revenue numeric(20,8) not null check (platform_revenue >= 0),
  final_user_cost numeric(20,8) not null check (final_user_cost >= 0),
  external_reference text,
  billing_state text not null default 'pending' check (billing_state in ('pending','billed','waived','reversed')),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists organization_billing_plan_idx on public.organization_billing(plan_key, billing_status);
create index if not exists billing_provider_state_org_idx on public.billing_provider_state(organization_id, environment);
create index if not exists billing_provider_events_received_idx on public.billing_provider_events(received_at desc);
create index if not exists gestiones_org_occurred_idx on public.gestiones(organization_id, occurred_at desc);
create index if not exists gestiones_billing_state_idx on public.gestiones(billing_state, occurred_at);

alter table public.billing_price_bindings enable row level security;
alter table public.organization_billing enable row level security;
alter table public.billing_provider_state enable row level security;
alter table public.billing_provider_events enable row level security;
alter table public.gestiones enable row level security;

create policy organization_billing_select_member
on public.organization_billing
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = organization_billing.organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

create policy gestiones_select_member
on public.gestiones
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = gestiones.organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

insert into public.organization_billing (
  organization_id,
  plan_key,
  billing_status,
  access_state,
  included_seats,
  extra_seats,
  usage_markup_percent
)
select
  o.id,
  case when oo.selected_plan in ('pro','premium') then oo.selected_plan else 'free' end,
  'free',
  'active',
  case when oo.selected_plan = 'pro' then 1 when oo.selected_plan = 'premium' then 2 else 0 end,
  0,
  case when oo.selected_plan = 'pro' then 20 when oo.selected_plan = 'premium' then 10 else 30 end
from public.organizations o
left join public.organization_onboarding oo on oo.organization_id = o.id
on conflict (organization_id) do nothing;
