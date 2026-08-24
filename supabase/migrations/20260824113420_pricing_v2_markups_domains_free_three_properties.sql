alter table public.organization_billing alter column usage_markup_percent set default 50;

create or replace function private.plan_usage_markup_percent(p_plan text)
returns numeric
language sql
immutable
as $$
  select case lower(coalesce(p_plan,'free'))
    when 'pro' then 25::numeric
    when 'premium' then 12.5::numeric
    else 50::numeric
  end
$$;

create or replace function private.normalize_organization_billing_markup()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  new.usage_markup_percent := private.plan_usage_markup_percent(new.plan_key);
  return new;
end
$$;

drop trigger if exists normalize_organization_billing_markup on public.organization_billing;
create trigger normalize_organization_billing_markup
before insert or update of plan_key, usage_markup_percent on public.organization_billing
for each row execute function private.normalize_organization_billing_markup();

update public.organization_billing
set usage_markup_percent = private.plan_usage_markup_percent(plan_key), updated_at=now();

create or replace function private.ensure_default_organization_billing()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into public.organization_billing(organization_id, plan_key, billing_status, access_state, included_seats, extra_seats, usage_markup_percent)
  values (new.id, 'free', 'free', 'active', 0, 0, 50)
  on conflict (organization_id) do nothing;
  return new;
end
$$;

drop trigger if exists ensure_default_organization_billing on public.organizations;
create trigger ensure_default_organization_billing
after insert on public.organizations
for each row execute function private.ensure_default_organization_billing();

insert into public.organization_billing(organization_id, plan_key, billing_status, access_state, included_seats, extra_seats, usage_markup_percent)
select o.id, 'free', 'free', 'active', 0, 0, 50
from public.organizations o
left join public.organization_billing b on b.organization_id=o.id
where b.organization_id is null
on conflict (organization_id) do nothing;

create table if not exists private.plan_entitlements (
  plan_key text primary key check (plan_key in ('free','pro','premium')),
  property_limit integer check (property_limit is null or property_limit >= 0),
  usage_markup_percent numeric not null check (usage_markup_percent >= 0),
  updated_at timestamptz not null default now()
);
alter table private.plan_entitlements enable row level security;
revoke all on private.plan_entitlements from public, anon, authenticated;
grant all on private.plan_entitlements to service_role;

insert into private.plan_entitlements(plan_key, property_limit, usage_markup_percent, updated_at) values
('free',3,50,now()),('pro',null,25,now()),('premium',null,12.5,now())
on conflict (plan_key) do update set property_limit=excluded.property_limit, usage_markup_percent=excluded.usage_markup_percent, updated_at=now();

alter table private.gestion_price_book add column if not exists minimum_markup_percent numeric check (minimum_markup_percent is null or minimum_markup_percent >= 0);
alter table private.gestion_price_book add column if not exists maximum_markup_percent numeric check (maximum_markup_percent is null or maximum_markup_percent >= 0);
alter table private.gestion_price_book add column if not exists reference_cost_usd numeric check (reference_cost_usd is null or reference_cost_usd >= 0);
alter table private.gestion_price_book add column if not exists reference_cost_status text;

alter table private.gestion_price_book drop constraint if exists gestion_price_book_pricing_mode_check;
alter table private.gestion_price_book add constraint gestion_price_book_pricing_mode_check
check (pricing_mode = any(array['fixed'::text,'included'::text,'provider_quote_plus_fee'::text,'provider_quote_plus_markup'::text,'benchmark_guarded'::text]));

update private.gestion_price_book
set target_markup_free=50,
    target_markup_pro=25,
    target_markup_premium=12.5,
    minimum_markup_percent=case when pricing_mode='included' then 0 else 5 end,
    maximum_markup_percent=case when pricing_mode='included' then 0 else 50 end,
    updated_at=now()
where active=true;

create or replace function private.domain_markup_percent(p_provider_cost numeric)
returns numeric
language sql
immutable
as $$
  select case
    when p_provider_cost is null or p_provider_cost < 0 then null
    when p_provider_cost <= 10 then 100::numeric
    when p_provider_cost <= 20 then 80::numeric
    when p_provider_cost <= 50 then 60::numeric
    else 50::numeric
  end
$$;

update private.gestion_price_book
set pricing_mode='provider_quote_plus_markup',
    price_free=0,
    price_pro=0,
    price_premium=0,
    target_markup_free=75,
    target_markup_pro=75,
    target_markup_premium=75,
    minimum_margin_percent=0,
    minimum_markup_percent=50,
    maximum_markup_percent=100,
    requires_live_cost_check=true,
    notes='Domain registration and renewal use the same dynamic markup in every plan: 50%-100% of current provider wholesale cost. Cheap domains receive higher markup; expensive domains lower markup. No teaser renewal pricing. Premium domains require separate live quote.',
    pricebook_version='v2',
    updated_at=now()
where service_key in ('domain_registration','domain_renewal') and active=true;

update private.gestion_price_book
set price_free=0.0075,
    price_pro=0.00625,
    price_premium=0.005625,
    target_markup_free=50,
    target_markup_pro=25,
    target_markup_premium=12.5,
    minimum_markup_percent=5,
    maximum_markup_percent=50,
    reference_cost_usd=0.005,
    reference_cost_status='engineering_estimate_published_benchmark',
    benchmark_required=true,
    pricing_mode='benchmark_guarded',
    notes='HyperFrames/FFmpeg exact-source composition reference cost target: US$0.005 per <=10s accepted clip including conservative compute/overhead allowance. Must be replaced by measured LISTIA benchmark before automated paid release.',
    pricebook_version='v2', updated_at=now()
where service_key='video_exact_10s' and active=true;

update private.gestion_price_book
set price_free=0.0375,
    price_pro=0.03125,
    price_premium=0.028125,
    target_markup_free=50,
    target_markup_pro=25,
    target_markup_premium=12.5,
    minimum_markup_percent=5,
    maximum_markup_percent=50,
    reference_cost_usd=0.025,
    reference_cost_status='engineering_estimate_published_benchmark',
    benchmark_required=true,
    pricing_mode='benchmark_guarded',
    notes='MuseTalk 1.5 lip-sync reference accepted-output cost target: US$0.025 per <=10s after conservative GPU/cold-start/QA buffer. Must be replaced by measured LISTIA benchmark before automated paid release.',
    pricebook_version='v2', updated_at=now()
where service_key='video_lipsync_10s' and active=true;

update private.gestion_price_book
set price_free=0.24,
    price_pro=0.20,
    price_premium=0.18,
    target_markup_free=50,
    target_markup_pro=25,
    target_markup_premium=12.5,
    minimum_markup_percent=5,
    maximum_markup_percent=50,
    reference_cost_usd=0.16,
    reference_cost_status='engineering_estimate_published_benchmark',
    benchmark_required=true,
    pricing_mode='benchmark_guarded',
    notes='EchoMimicV2 photo-avatar reference accepted-output cost target: US$0.16 per <=10s after conservative A100-class compute/cold-start/QA/retry allowance. Use only when canonical advisor video is unavailable. Must be replaced by measured LISTIA benchmark before automated paid release.',
    pricebook_version='v2', updated_at=now()
where service_key='video_avatar_photo_10s' and active=true;

update private.gestion_price_book
set pricebook_version='v2', updated_at=now()
where active=true and pricebook_version <> 'v2';
