create table if not exists private.pwa_product_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null,
  event_id text not null,
  anonymous_id text,
  session_id text,
  page_url text,
  referrer text,
  source text,
  medium text,
  campaign text,
  content text,
  term text,
  click_ids jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id,event_id)
);

revoke all on private.pwa_product_events from public,anon,authenticated;
create index if not exists pwa_product_events_org_time_idx on private.pwa_product_events(organization_id,occurred_at desc);
create index if not exists pwa_product_events_name_time_idx on private.pwa_product_events(event_name,occurred_at desc);

create or replace function public.ingest_pwa_product_events(p_organization_id uuid,p_user_id uuid,p_events jsonb)
returns integer language plpgsql security definer set search_path='' as $function$
declare v_count integer:=0;
begin
  if jsonb_typeof(p_events)<>'array' then return 0; end if;
  insert into private.pwa_product_events(
    organization_id,user_id,event_name,event_id,anonymous_id,session_id,page_url,referrer,
    source,medium,campaign,content,term,click_ids,metadata,occurred_at
  )
  select
    p_organization_id,p_user_id,
    left(coalesce(nullif(btrim(e->>'event_name'),''),'unknown'),80),
    left(coalesce(nullif(btrim(e->>'event_id'),''),extensions.gen_random_uuid()::text),120),
    nullif(left(btrim(coalesce(e->>'anonymous_id','')),120),''),
    nullif(left(btrim(coalesce(e->>'session_id','')),120),''),
    nullif(left(btrim(coalesce(e->>'page_url','')),1000),''),
    nullif(left(btrim(coalesce(e->>'referrer','')),1000),''),
    nullif(left(btrim(coalesce(e->>'source','')),120),''),
    nullif(left(btrim(coalesce(e->>'medium','')),120),''),
    nullif(left(btrim(coalesce(e->>'campaign','')),180),''),
    nullif(left(btrim(coalesce(e->>'content','')),180),''),
    nullif(left(btrim(coalesce(e->>'term','')),180),''),
    case when jsonb_typeof(e->'click_ids')='object' then e->'click_ids' else '{}'::jsonb end,
    case when jsonb_typeof(e->'metadata')='object' then e->'metadata' else '{}'::jsonb end,
    case when coalesce(e->>'occurred_at','') ~ '^\d{4}-\d{2}-\d{2}T' then (e->>'occurred_at')::timestamptz else now() end
  from jsonb_array_elements(p_events) e
  where nullif(btrim(coalesce(e->>'event_name','')),'') is not null
  on conflict (organization_id,event_id) do nothing;
  get diagnostics v_count=row_count;
  return v_count;
end;
$function$;

revoke all on function public.ingest_pwa_product_events(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.ingest_pwa_product_events(uuid,uuid,jsonb) to service_role;
