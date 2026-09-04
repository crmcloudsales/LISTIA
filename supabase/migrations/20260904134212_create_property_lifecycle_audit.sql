create table if not exists private.property_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  actor_user_id uuid,
  action text not null check (action in ('archive','restore')),
  from_status text not null,
  to_status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists property_lifecycle_events_org_property_created_idx
  on private.property_lifecycle_events(organization_id, property_id, created_at desc);

alter table private.property_lifecycle_events enable row level security;
revoke all on private.property_lifecycle_events from public, anon, authenticated;
grant select, insert on private.property_lifecycle_events to service_role;
