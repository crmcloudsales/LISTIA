create table private.security_rate_limits (
  principal_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  action text not null check (action ~ '^[a-z0-9_-]{1,64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (principal_id, organization_id, action)
);

comment on table private.security_rate_limits is
  'LISTIA server-only fixed-window counters for authenticated Edge Functions. Never expose to browser roles.';

alter table private.security_rate_limits enable row level security;

revoke all on table private.security_rate_limits from public, anon, authenticated, service_role;
grant all on table private.security_rate_limits to postgres;
