create table if not exists public.development_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 160),
  slug text not null check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$'),
  location_text text,
  description text,
  status text not null default 'draft' check (status in ('draft','active','sold_out','archived')),
  delivery_date date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,slug)
);
create table if not exists public.development_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.development_projects(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  unit_code text not null check (length(trim(unit_code)) between 1 and 80),
  status text not null default 'available' check (status in ('available','reserved','sold','hold','off_market')),
  floor text,
  bedrooms numeric,
  bathrooms numeric,
  area_m2 numeric check (area_m2 is null or area_m2 >= 0),
  price numeric check (price is null or price >= 0),
  currency text not null default 'MXN' check (currency in ('MXN','USD','CAD','EUR')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,unit_code)
);
create unique index if not exists development_units_property_unique on public.development_units(property_id) where property_id is not null;
create index if not exists development_projects_org_status_idx on public.development_projects(organization_id,status,updated_at desc);
create index if not exists development_units_project_status_idx on public.development_units(project_id,status,unit_code);
alter table public.development_projects enable row level security;
alter table public.development_units enable row level security;
drop policy if exists development_projects_member_read on public.development_projects;
create policy development_projects_member_read on public.development_projects for select to authenticated using (exists(select 1 from public.organization_members m where m.organization_id=development_projects.organization_id and m.user_id=auth.uid() and m.status='active'));
drop policy if exists development_units_member_read on public.development_units;
create policy development_units_member_read on public.development_units for select to authenticated using (exists(select 1 from public.organization_members m where m.organization_id=development_units.organization_id and m.user_id=auth.uid() and m.status='active'));
drop policy if exists development_units_admin_manage on public.development_units;
create policy development_units_admin_manage on public.development_units for all to authenticated using (exists(select 1 from public.organization_members m where m.organization_id=development_units.organization_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin'))) with check (exists(select 1 from public.organization_members m where m.organization_id=development_units.organization_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin')) and exists(select 1 from public.development_projects p where p.id=development_units.project_id and p.organization_id=development_units.organization_id));
revoke all on public.development_projects from anon;
revoke all on public.development_units from anon;
grant select,insert,update,delete on public.development_projects to authenticated;
grant select,insert,update,delete on public.development_units to authenticated;
grant all on public.development_projects to service_role;
grant all on public.development_units to service_role;