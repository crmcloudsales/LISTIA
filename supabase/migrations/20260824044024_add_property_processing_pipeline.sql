create table if not exists public.property_processing_state (
  property_id uuid primary key references public.properties(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  stage text not null default 'material_received' check (stage in ('material_received','ready_for_processing','processing','ready_for_ai','needs_input','draft_ready','ready','failed')),
  asset_count integer not null default 0 check (asset_count >= 0),
  input_manifest jsonb not null default '{}'::jsonb,
  detected_fields jsonb not null default '{}'::jsonb,
  missing_fields text[] not null default '{}'::text[],
  last_material_at timestamptz,
  processing_started_at timestamptz,
  processing_completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists property_processing_state_org_stage_idx
  on public.property_processing_state(organization_id, stage, updated_at desc);

alter table public.property_processing_state enable row level security;

drop policy if exists property_processing_state_select_member on public.property_processing_state;
create policy property_processing_state_select_member
on public.property_processing_state for select to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id=property_processing_state.organization_id
      and m.user_id=(select auth.uid())
      and m.status='active'
  )
);

revoke all on public.property_processing_state from anon, authenticated;
grant select on public.property_processing_state to authenticated;
grant all on public.property_processing_state to service_role;

create or replace function public.set_property_processing_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists property_processing_state_set_updated_at on public.property_processing_state;
create trigger property_processing_state_set_updated_at
before update on public.property_processing_state
for each row execute function public.set_property_processing_updated_at();

create or replace function public.initialize_property_processing_state()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.property_processing_state(
    property_id, organization_id, stage, asset_count, input_manifest, last_material_at
  ) values (
    new.id,
    new.organization_id,
    'material_received',
    0,
    jsonb_build_object(
      'source', new.source,
      'locale', new.locale,
      'submitted_fields', jsonb_strip_nulls(jsonb_build_object(
        'title', new.title,
        'operation_type', new.operation_type,
        'property_type', new.property_type,
        'description', new.description,
        'price', new.price,
        'currency', new.currency,
        'commission_text', new.commission_text,
        'location_text', new.location_text,
        'postal_code', new.postal_code
      ))
    ),
    now()
  )
  on conflict (property_id) do nothing;
  return new;
end;
$$;

drop trigger if exists properties_initialize_processing_state on public.properties;
create trigger properties_initialize_processing_state
after insert on public.properties
for each row execute function public.initialize_property_processing_state();

create or replace function public.refresh_property_processing_assets()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_property_id uuid;
  v_org_id uuid;
  v_count integer;
begin
  v_property_id := coalesce(new.property_id, old.property_id);
  v_org_id := coalesce(new.organization_id, old.organization_id);

  select count(*)::integer into v_count
  from public.property_assets
  where property_id=v_property_id;

  insert into public.property_processing_state(property_id, organization_id, stage, asset_count, last_material_at)
  values (v_property_id, v_org_id, case when v_count > 0 then 'ready_for_processing' else 'material_received' end, v_count, now())
  on conflict (property_id) do update set
    asset_count=excluded.asset_count,
    stage=case
      when public.property_processing_state.stage in ('processing','ready_for_ai','draft_ready','ready')
        then public.property_processing_state.stage
      when excluded.asset_count > 0 then 'ready_for_processing'
      else 'material_received'
    end,
    last_material_at=now(),
    error_message=null,
    updated_at=now();

  update public.properties
  set processing_state = coalesce(processing_state,'{}'::jsonb) || jsonb_build_object(
    'stage', case when v_count > 0 then 'ready_for_processing' else 'material_received' end,
    'asset_count', v_count,
    'last_material_at', now()
  )
  where id=v_property_id
    and status in ('material_received','error');

  return coalesce(new, old);
end;
$$;

drop trigger if exists property_assets_refresh_processing_after_insert on public.property_assets;
create trigger property_assets_refresh_processing_after_insert
after insert on public.property_assets
for each row execute function public.refresh_property_processing_assets();

drop trigger if exists property_assets_refresh_processing_after_delete on public.property_assets;
create trigger property_assets_refresh_processing_after_delete
after delete on public.property_assets
for each row execute function public.refresh_property_processing_assets();

insert into public.property_processing_state(property_id, organization_id, stage, asset_count, input_manifest, last_material_at)
select p.id, p.organization_id,
       case when count(a.id) > 0 then 'ready_for_processing' else 'material_received' end,
       count(a.id)::integer,
       jsonb_build_object(
         'source', p.source,
         'locale', p.locale,
         'submitted_fields', jsonb_strip_nulls(jsonb_build_object(
           'title', p.title,
           'operation_type', p.operation_type,
           'property_type', p.property_type,
           'description', p.description,
           'price', p.price,
           'currency', p.currency,
           'commission_text', p.commission_text,
           'location_text', p.location_text,
           'postal_code', p.postal_code
         ))
       ),
       p.created_at
from public.properties p
left join public.property_assets a on a.property_id=p.id
group by p.id
on conflict (property_id) do nothing;
