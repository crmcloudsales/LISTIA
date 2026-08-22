create table if not exists public.discovery_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid references public.integration_connections(id) on delete set null,
  source_type text not null check (source_type in ('google_drive','google_calendar','url','upload','portal','feed','api')),
  status text not null default 'running' check (status in ('running','completed','partial','error')),
  scope_mode text not null default 'minimal' check (scope_mode in ('minimal','expanded')),
  started_by uuid not null references auth.users(id) on delete restrict,
  item_count integer not null default 0 check (item_count >= 0),
  selected_count integer not null default 0 check (selected_count >= 0),
  summary jsonb not null default '{}'::jsonb,
  error_code text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.discovery_runs(id) on delete cascade,
  connection_id uuid references public.integration_connections(id) on delete set null,
  source_type text not null check (source_type in ('google_drive','google_calendar','url','upload','portal','feed','api')),
  source_key text not null,
  external_id text,
  name text not null,
  mime_type text,
  candidate_type text not null default 'other' check (candidate_type in ('property_document','image','video','spreadsheet','folder','calendar','brand_asset','other')),
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  web_url text,
  thumbnail_url text,
  checksum text,
  source_created_at timestamptz,
  source_modified_at timestamptz,
  selected boolean not null default true,
  import_status text not null default 'pending' check (import_status in ('pending','imported','ignored','error')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source_type, source_key)
);

create index if not exists discovery_runs_org_started_idx on public.discovery_runs (organization_id, started_at desc);
create index if not exists discovery_items_org_selected_idx on public.discovery_items (organization_id, selected, source_modified_at desc);
create index if not exists discovery_items_run_idx on public.discovery_items (run_id);

alter table public.discovery_runs enable row level security;
alter table public.discovery_items enable row level security;

create policy discovery_runs_select_member on public.discovery_runs for select to authenticated using (
  exists (select 1 from public.organization_members m where m.organization_id = discovery_runs.organization_id and m.user_id = (select auth.uid()) and m.status = 'active')
);
create policy discovery_items_select_member on public.discovery_items for select to authenticated using (
  exists (select 1 from public.organization_members m where m.organization_id = discovery_items.organization_id and m.user_id = (select auth.uid()) and m.status = 'active')
);
create policy discovery_items_update_selection_admin on public.discovery_items for update to authenticated using (
  exists (select 1 from public.organization_members m where m.organization_id = discovery_items.organization_id and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner','admin'))
) with check (
  exists (select 1 from public.organization_members m where m.organization_id = discovery_items.organization_id and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner','admin'))
);

revoke all on public.discovery_runs from anon;
revoke all on public.discovery_items from anon;
revoke all on public.discovery_runs from authenticated;
revoke all on public.discovery_items from authenticated;
grant select on public.discovery_runs to authenticated;
grant select on public.discovery_items to authenticated;
grant update(selected) on public.discovery_items to authenticated;
grant select, insert, update, delete on public.discovery_runs to service_role;
grant select, insert, update, delete on public.discovery_items to service_role;

drop trigger if exists discovery_runs_set_updated_at on public.discovery_runs;
create trigger discovery_runs_set_updated_at before update on public.discovery_runs for each row execute function public.set_updated_at();
drop trigger if exists discovery_items_set_updated_at on public.discovery_items;
create trigger discovery_items_set_updated_at before update on public.discovery_items for each row execute function public.set_updated_at();
