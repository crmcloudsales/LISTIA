create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text,
  operation_type text check (operation_type is null or operation_type in ('sale','rent')),
  property_type text,
  description text,
  price numeric,
  currency text,
  commission_text text,
  location_text text,
  postal_code text,
  status text not null default 'material_received' check (status in ('material_received','processing','ready','published','archived','error')),
  processing_state jsonb not null default '{}'::jsonb,
  source text not null default 'manual_material',
  locale text not null default 'es' check (locale in ('es','en','fr')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.property_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  asset_type text not null default 'other' check (asset_type in ('pdf','image','video','brochure','price_list','document','other')),
  storage_bucket text not null default 'property-materials',
  storage_path text not null,
  original_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(storage_bucket, storage_path)
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  name text not null,
  whatsapp text,
  email text,
  message text,
  status text not null default 'new' check (status in ('new','active','qualified','appointment','cold','closed')),
  source text not null default 'listia',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  title text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  meeting_type text check (meeting_type is null or meeting_type in ('in_person','google_meet','zoom','teams','phone','other')),
  status text not null default 'scheduled' check (status in ('scheduled','confirmed','completed','cancelled','no_show')),
  external_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists properties_org_created_idx on public.properties(organization_id, created_at desc);
create index if not exists properties_created_by_idx on public.properties(created_by);
create index if not exists property_assets_org_property_idx on public.property_assets(organization_id, property_id);
create index if not exists property_assets_uploaded_by_idx on public.property_assets(uploaded_by);
create index if not exists leads_org_created_idx on public.leads(organization_id, created_at desc);
create index if not exists leads_property_idx on public.leads(property_id);
create index if not exists appointments_org_starts_idx on public.appointments(organization_id, starts_at);
create index if not exists appointments_property_idx on public.appointments(property_id);
create index if not exists appointments_lead_idx on public.appointments(lead_id);
create index if not exists discovery_items_connection_idx on public.discovery_items(connection_id);
create index if not exists discovery_runs_connection_idx on public.discovery_runs(connection_id);
create index if not exists discovery_runs_started_by_idx on public.discovery_runs(started_by);

alter table public.properties enable row level security;
alter table public.property_assets enable row level security;
alter table public.leads enable row level security;
alter table public.appointments enable row level security;

create policy properties_select_member on public.properties for select to authenticated using (
  exists (select 1 from public.organization_members m where m.organization_id=properties.organization_id and m.user_id=(select auth.uid()) and m.status='active')
);
create policy properties_update_admin on public.properties for update to authenticated using (
  exists (select 1 from public.organization_members m where m.organization_id=properties.organization_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin'))
) with check (
  exists (select 1 from public.organization_members m where m.organization_id=properties.organization_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin'))
);
create policy property_assets_select_member on public.property_assets for select to authenticated using (
  exists (select 1 from public.organization_members m where m.organization_id=property_assets.organization_id and m.user_id=(select auth.uid()) and m.status='active')
);
create policy property_assets_insert_member on public.property_assets for insert to authenticated with check (
  uploaded_by=(select auth.uid())
  and exists (select 1 from public.organization_members m where m.organization_id=property_assets.organization_id and m.user_id=(select auth.uid()) and m.status='active')
  and exists (select 1 from public.properties p where p.id=property_assets.property_id and p.organization_id=property_assets.organization_id)
);
create policy property_assets_delete_admin on public.property_assets for delete to authenticated using (
  exists (select 1 from public.organization_members m where m.organization_id=property_assets.organization_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin'))
);
create policy leads_select_member on public.leads for select to authenticated using (
  exists (select 1 from public.organization_members m where m.organization_id=leads.organization_id and m.user_id=(select auth.uid()) and m.status='active')
);
create policy appointments_select_member on public.appointments for select to authenticated using (
  exists (select 1 from public.organization_members m where m.organization_id=appointments.organization_id and m.user_id=(select auth.uid()) and m.status='active')
);

revoke all on public.properties from anon;
revoke all on public.property_assets from anon;
revoke all on public.leads from anon;
revoke all on public.appointments from anon;
grant select, update on public.properties to authenticated;
grant select, insert, delete on public.property_assets to authenticated;
grant select on public.leads to authenticated;
grant select on public.appointments to authenticated;
grant all on public.properties to service_role;
grant all on public.property_assets to service_role;
grant all on public.leads to service_role;
grant all on public.appointments to service_role;

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at before update on public.properties for each row execute function public.set_updated_at();
drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at before update on public.leads for each row execute function public.set_updated_at();
drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at before update on public.appointments for each row execute function public.set_updated_at();

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('property-materials','property-materials',false,52428800,array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/quicktime','video/webm','text/plain','text/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

create policy property_materials_select_member on storage.objects for select to authenticated using (
  bucket_id='property-materials' and exists (select 1 from public.organization_members m where m.organization_id::text=(storage.foldername(name))[1] and m.user_id=(select auth.uid()) and m.status='active')
);
create policy property_materials_insert_member on storage.objects for insert to authenticated with check (
  bucket_id='property-materials' and exists (select 1 from public.organization_members m where m.organization_id::text=(storage.foldername(name))[1] and m.user_id=(select auth.uid()) and m.status='active')
);
create policy property_materials_delete_admin on storage.objects for delete to authenticated using (
  bucket_id='property-materials' and exists (select 1 from public.organization_members m where m.organization_id::text=(storage.foldername(name))[1] and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin'))
);
