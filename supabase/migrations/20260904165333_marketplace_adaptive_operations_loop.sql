create table if not exists private.marketplace_source_refresh_state (
  source_id uuid primary key references public.marketplace_sources(id) on delete cascade,
  territory_code text not null,
  status text not null default 'pending'
    check (status in ('pending','leased','succeeded','failed','blocked','inactive')),
  volatility_score numeric not null default 0.50
    check (volatility_score between 0 and 1),
  business_value_score numeric not null default 0.50
    check (business_value_score between 0 and 1),
  inventory_size integer not null default 0 check (inventory_size >= 0),
  last_change_rate numeric not null default 0
    check (last_change_rate between 0 and 1),
  content_hash text,
  last_selected_at timestamptz,
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  next_check_at timestamptz not null default now(),
  lease_worker_id text,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  success_count integer not null default 0 check (success_count >= 0),
  failure_count integer not null default 0 check (failure_count >= 0),
  consecutive_unchanged integer not null default 0 check (consecutive_unchanged >= 0),
  last_candidate_count integer,
  last_accepted_count integer,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.marketplace_source_refresh_state enable row level security;
revoke all on private.marketplace_source_refresh_state from public, anon, authenticated;

create index if not exists marketplace_source_refresh_due_idx
  on private.marketplace_source_refresh_state
  (territory_code, status, next_check_at, lease_expires_at);

insert into private.marketplace_source_refresh_state (
  source_id,
  territory_code,
  status,
  volatility_score,
  business_value_score,
  inventory_size,
  next_check_at
)
select
  b.source_id,
  'MX-ROO',
  'pending',
  0.50,
  least(0.99, 0.40 + least(coalesce(b.listings_count, 0), 300)::numeric / 500),
  coalesce(b.listings_count, 0),
  now()
from public.marketplace_source_prospect_backup b
join public.marketplace_sources s on s.id = b.source_id
where b.primary_state = 'Quintana Roo'
  and s.active
  and s.rights_basis = 'public_link_only'
  and s.source_type in ('url','sitemap','feed','partner')
  and s.source_url ~ '^https://'
on conflict (source_id) do update
set
  inventory_size = excluded.inventory_size,
  business_value_score = excluded.business_value_score,
  updated_at = now();

create or replace function public.claim_marketplace_source_batch(
  p_territory_code text,
  p_worker_id text,
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 200));
  v_result jsonb;
begin
  if nullif(btrim(p_worker_id), '') is null then
    raise exception 'marketplace_worker_id_required';
  end if;
  if p_territory_code <> 'MX-ROO' then
    raise exception 'marketplace_territory_not_enabled: %', p_territory_code;
  end if;

  update private.marketplace_source_refresh_state
  set
    status = 'pending',
    lease_worker_id = null,
    lease_expires_at = null,
    updated_at = now()
  where territory_code = p_territory_code
    and status = 'leased'
    and lease_expires_at <= now();

  with candidates as (
    select r.source_id
    from private.marketplace_source_refresh_state r
    join public.marketplace_sources s on s.id = r.source_id
    where r.territory_code = p_territory_code
      and r.status in ('pending','succeeded','failed')
      and r.next_check_at <= now()
      and (r.lease_expires_at is null or r.lease_expires_at <= now())
      and s.active
    order by
      case when r.status = 'failed' then 0 else 1 end,
      r.next_check_at,
      r.business_value_score desc,
      r.volatility_score desc,
      r.inventory_size desc,
      r.source_id
    for update of r skip locked
    limit v_limit
  ), claimed as (
    update private.marketplace_source_refresh_state r
    set
      status = 'leased',
      lease_worker_id = left(p_worker_id, 200),
      lease_expires_at = now() + interval '2 hours',
      last_selected_at = now(),
      attempt_count = r.attempt_count + 1,
      updated_at = now()
    from candidates c
    where r.source_id = c.source_id
    returning r.*
  ), shaped as (
    select
      s.id,
      s.name,
      s.source_url,
      coalesce((
        select ml.city
        from public.marketplace_listings ml
        where ml.source_id = s.id and nullif(ml.city, '') is not null
        group by ml.city
        order by count(*) desc, ml.city
        limit 1
      ), 'Quintana Roo') as city_hint,
      c.inventory_size,
      c.volatility_score,
      c.business_value_score,
      c.lease_expires_at
    from claimed c
    join public.marketplace_sources s on s.id = c.source_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'source_id', id,
    'name', name,
    'source_url', source_url,
    'crawl_roots', jsonb_build_array(source_url),
    'city_hint', city_hint,
    'existing_listings', inventory_size,
    'priority', 0,
    'volatility_score', volatility_score,
    'business_value_score', business_value_score,
    'lease_expires_at', lease_expires_at
  ) order by business_value_score desc, volatility_score desc, inventory_size desc, name), '[]'::jsonb)
  into v_result
  from shaped;

  return v_result;
end;
$function$;

revoke all on function public.claim_marketplace_source_batch(text,text,integer)
  from public, anon, authenticated;
grant execute on function public.claim_marketplace_source_batch(text,text,integer)
  to service_role;

create or replace function public.complete_marketplace_source_batch(
  p_territory_code text,
  p_worker_id text,
  p_results jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_updated integer := 0;
  v_failed integer := 0;
begin
  if nullif(btrim(p_worker_id), '') is null then
    raise exception 'marketplace_worker_id_required';
  end if;
  if jsonb_typeof(p_results) <> 'array' or jsonb_array_length(p_results) > 200 then
    raise exception 'marketplace_refresh_results_invalid';
  end if;

  with parsed as (
    select
      left(nullif(x->>'source_url',''), 2000) as source_url,
      left(nullif(x->>'content_hash',''), 128) as content_hash,
      case when coalesce(x->>'candidates','') ~ '^[0-9]+$' then (x->>'candidates')::integer else 0 end as candidates,
      case when coalesce(x->>'accepted','') ~ '^[0-9]+$' then (x->>'accepted')::integer else 0 end as accepted,
      case when coalesce(x->>'failures','') ~ '^[0-9]+$' then (x->>'failures')::integer else 0 end as failures
    from jsonb_array_elements(p_results) x
  ), matched as (
    select
      r.source_id,
      p.content_hash,
      p.candidates,
      p.accepted,
      p.failures,
      (r.content_hash is distinct from p.content_hash and p.content_hash is not null) as changed,
      r.consecutive_unchanged,
      r.inventory_size,
      r.last_change_rate
    from parsed p
    join public.marketplace_sources s on s.source_url = p.source_url
    join private.marketplace_source_refresh_state r on r.source_id = s.id
    where r.territory_code = p_territory_code
      and (r.lease_worker_id = p_worker_id or r.lease_worker_id is null or r.lease_expires_at <= now())
  ), upd as (
    update private.marketplace_source_refresh_state r
    set
      status = case when m.accepted > 0 then 'succeeded' else 'failed' end,
      content_hash = coalesce(m.content_hash, r.content_hash),
      last_checked_at = now(),
      last_changed_at = case when m.changed then now() else r.last_changed_at end,
      next_check_at = now() + case
        when m.accepted = 0 then interval '2 days'
        when m.changed and (r.volatility_score >= 0.70 or r.business_value_score >= 0.80) then interval '2 days'
        when m.changed then interval '5 days'
        when r.consecutive_unchanged >= 3 then interval '21 days'
        else interval '10 days'
      end,
      volatility_score = greatest(0.05, least(0.99,
        round((r.last_change_rate * 0.70 + case when m.changed then 0.30 else 0 end)::numeric, 4)
      )),
      last_change_rate = greatest(0, least(1,
        round((r.last_change_rate * 0.70 + case when m.changed then 0.30 else 0 end)::numeric, 4)
      )),
      inventory_size = greatest(r.inventory_size, m.accepted),
      consecutive_unchanged = case when m.changed then 0 else r.consecutive_unchanged + 1 end,
      success_count = r.success_count + case when m.accepted > 0 then 1 else 0 end,
      failure_count = r.failure_count + case when m.accepted = 0 then 1 else 0 end,
      last_candidate_count = m.candidates,
      last_accepted_count = m.accepted,
      last_error = case
        when m.accepted = 0 and m.failures > 0 then 'crawl_failed_or_blocked'
        when m.accepted = 0 then 'no_accepted_property_pages'
        else null
      end,
      lease_worker_id = null,
      lease_expires_at = null,
      updated_at = now()
    from matched m
    where r.source_id = m.source_id
    returning r.status
  )
  select count(*)::integer, count(*) filter (where status = 'failed')::integer
  into v_updated, v_failed
  from upd;

  return jsonb_build_object(
    'updated', v_updated,
    'failed', v_failed,
    'worker_id', p_worker_id,
    'territory_code', p_territory_code
  );
end;
$function$;

revoke all on function public.complete_marketplace_source_batch(text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_marketplace_source_batch(text,text,jsonb)
  to service_role;

create or replace view private.marketplace_contact_enrichment_queue as
select
  b.source_id,
  b.company_name,
  b.website_url,
  b.primary_state,
  b.listings_count,
  b.last_verified_at,
  (nullif(b.email, '') is null) as needs_email,
  (nullif(b.phone, '') is null) as needs_phone,
  (nullif(b.whatsapp, '') is null) as needs_whatsapp,
  (nullif(b.principal_name, '') is null) as needs_decision_maker,
  (
    coalesce(b.listings_count, 0) * 10
    + case when nullif(b.email, '') is null then 40 else 0 end
    + case when nullif(b.phone, '') is null then 30 else 0 end
    + case when nullif(b.whatsapp, '') is null then 35 else 0 end
    + case when nullif(b.principal_name, '') is null then 45 else 0 end
  ) as priority_score,
  case
    when nullif(b.principal_name, '') is null then 'verify_decision_maker'
    when nullif(b.whatsapp, '') is null then 'verify_whatsapp'
    when nullif(b.email, '') is null then 'verify_email'
    when nullif(b.phone, '') is null then 'verify_phone'
    else 'reverify_contact'
  end as exact_next_action
from public.marketplace_source_prospect_backup b
join public.marketplace_sources s on s.id = b.source_id
where s.active
  and (
    nullif(b.email, '') is null
    or nullif(b.phone, '') is null
    or nullif(b.whatsapp, '') is null
    or nullif(b.principal_name, '') is null
  );

create or replace view private.marketplace_inventory_resolution_queue as
select
  l.id as listing_id,
  l.source_id,
  l.slug,
  l.title,
  l.operation_type,
  l.property_type,
  l.city,
  l.state_region,
  l.external_url,
  l.updated_at,
  case
    when l.property_id is null then 'resolve_global_property'
    when r.routing_status in ('unassigned','needs_contact_enrichment') then 'resolve_responsible_party'
    else 'refresh_listing'
  end as exact_next_action,
  case
    when l.property_id is null then 100
    when r.routing_status in ('unassigned','needs_contact_enrichment') then 80
    else 20
  end as priority_score
from public.marketplace_listings l
left join public.marketplace_lead_routing r on r.listing_id = l.id
where l.status = 'published'
  and l.visibility = 'public'
  and (
    l.property_id is null
    or r.routing_status in ('unassigned','needs_contact_enrichment')
  );

revoke all on private.marketplace_contact_enrichment_queue from public, anon, authenticated;
revoke all on private.marketplace_inventory_resolution_queue from public, anon, authenticated;

update private.marketplace_state_expansion_queue
set priority = priority + 100, updated_at = now();

update private.marketplace_state_expansion_queue q
set
  priority = v.priority,
  status = v.status,
  notes = v.notes,
  updated_at = now()
from (values
  ('ROO', 1, 'active', 'Maintenance + completion: global property resolution, direct-source refresh, contact enrichment and lead-routing readiness.'),
  ('YUC', 2, 'queued', 'Parallel discovery permitted while Quintana Roo remains in maintenance.'),
  ('CMX', 3, 'queued', 'Parallel discovery permitted while Quintana Roo remains in maintenance.'),
  ('JAL', 4, 'queued', 'Start after shared deduplication and source locking are verified.'),
  ('NLE', 5, 'queued', 'Expansion follows Jalisco.'),
  ('PUE', 6, 'queued', 'Expansion follows Nuevo León.'),
  ('QUE', 7, 'queued', 'Expansion follows Puebla.')
) as v(state_code, priority, status, notes)
where q.state_code = v.state_code;

update private.marketplace_state_expansion_queue q
set
  source_count = x.source_count,
  published_count = x.published_count,
  last_ingest_at = x.last_ingest_at,
  updated_at = now()
from (
  select
    q2.state_code,
    count(distinct l.source_id)::integer as source_count,
    count(*)::integer as published_count,
    max(l.updated_at) as last_ingest_at
  from private.marketplace_state_expansion_queue q2
  left join public.marketplace_listings l
    on l.state_region = q2.state_name
   and l.status = 'published'
   and l.visibility = 'public'
  group by q2.state_code
) x
where q.state_code = x.state_code;
