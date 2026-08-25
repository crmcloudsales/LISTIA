create table if not exists private.canonical_policies (
  policy_key text primary key,
  scope text[] not null default '{}',
  version text not null,
  status text not null default 'active' check (status in ('active','paused','retired')),
  policy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.provider_opportunity_log (
  id uuid primary key default gen_random_uuid(),
  provider_name text,
  opportunity_type text not null check (opportunity_type in ('permanent_free','free_tier','free_credit','free_trial','discount','coupon','price_drop','grant','open_source','other')),
  source text,
  source_ref text,
  detected_at timestamptz not null default now(),
  expires_at timestamptz,
  discount_percent numeric,
  estimated_savings_usd numeric,
  requires_approval boolean not null default true,
  zero_cost boolean not null default false,
  auto_eligible boolean not null default false,
  status text not null default 'detected' check (status in ('detected','notified','approved','claimed','activated','scheduled_cancel','cancelled','expired','rejected','not_applicable')),
  cancellation_due_at timestamptz,
  action_taken text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.canonical_policies enable row level security;
alter table private.provider_opportunity_log enable row level security;
revoke all on private.canonical_policies from anon, authenticated;
revoke all on private.provider_opportunity_log from anon, authenticated;
grant select, insert, update, delete on private.canonical_policies to service_role;
grant select, insert, update, delete on private.provider_opportunity_log to service_role;

insert into private.canonical_policies(policy_key,scope,version,status,policy,updated_at)
values (
  'cloudco_provider_savings_v1',
  array['cloudco','listia','cloudsales','upsales','white_label','internal_agents','customers'],
  '1.0','active',
  jsonb_build_object(
    'objective','continuously reduce operating and development costs without reducing required quality, security, legal compliance, privacy, reliability, or user value',
    'review_frequency_days',2,
    'sources',jsonb_build_array('provider emails','official pricing pages','provider dashboards','official newsletters','GitHub/open-source releases','free tiers','credits','grants','promotions','coupons','trial offers','price reductions'),
    'permanent_free_rule','If genuinely free with no payment obligation or paid commitment and commercial/security/privacy/license checks pass, it may be adopted internally without additional user approval when technically possible.',
    'free_credit_rule','Free credits may be claimed automatically when they create no paid commitment, no required purchase, and no hidden renewal obligation.',
    'free_trial_rule','A time-limited free trial may be activated without further approval only when there is zero upfront charge and cancellation before billing can be technically guaranteed and scheduled. Schedule cancellation at least 24 hours before billing; prefer 48 hours when billing timezone or cutoff is uncertain. Otherwise notify the user before activation.',
    'discount_rule','Any discount, coupon, reduced-price plan, prepaid commitment, paid upgrade, purchase, or offer that creates a financial obligation requires explicit user authorization before acceptance.',
    'temporary_feature_rule','A temporary free benefit is primarily for internal savings and must not automatically become a promised user-facing product feature. It may become a product feature only if it is sustainably free or economically viable, strategically useful, legally permitted, and consistent with the canonical product definition.',
    'customer_priority','Prefer opportunities that reduce customer cost, improve customer quality, or let CloudCo preserve low prices while improving margin and reliability.',
    'quality_gate','Never switch to a cheaper/free option if it fails the required quality threshold or materially harms reliability, fidelity, security, privacy, compliance, or mobile-first simplicity.',
    'security_legal_gate','Before adoption check commercial-use rights, license terms, data use/training terms, privacy, security, required permissions, vendor reputation, data residency where relevant, cancellation terms, and hidden fees.',
    'audit_rule','Every material opportunity and action should be logged with provider, offer type, source, expiry, estimated savings, approval requirement, action taken, and cancellation date when applicable.',
    'approval_rule','Paid or discounted opportunities require explicit approval. Truly free and zero-obligation opportunities do not require approval if they pass all gates and can be activated with available authorized tools.',
    'scope_rule','Applies across CloudCo, LISTIA, CloudSales, UpSales, white-label operations, development tooling, AI models, infrastructure, agents, skills, customer-support tooling, communications, storage, domains, security, analytics, media, and any other supplier relationship.'
  ),now()
)
on conflict (policy_key) do update set scope=excluded.scope,version=excluded.version,status=excluded.status,policy=excluded.policy,updated_at=now();
