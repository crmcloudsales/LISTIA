create table if not exists public.marketplace_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  push_enabled boolean not null default false,
  email_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketplace_notification_preferences enable row level security;

revoke all on public.marketplace_notification_preferences from anon;
revoke all on public.marketplace_notification_preferences from authenticated;
grant select, insert, update on public.marketplace_notification_preferences to authenticated;

create policy marketplace_notification_preferences_select_own
on public.marketplace_notification_preferences
for select to authenticated
using (user_id = (select auth.uid()));

create policy marketplace_notification_preferences_insert_own
on public.marketplace_notification_preferences
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy marketplace_notification_preferences_update_own
on public.marketplace_notification_preferences
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create table if not exists private.marketplace_alert_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_search_id uuid not null references public.marketplace_saved_searches(id) on delete cascade,
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  channel text not null check (channel in ('push','email')),
  status text not null default 'queued' check (status in ('queued','processing','delivered','skipped','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (saved_search_id, listing_id, channel)
);

create index if not exists marketplace_alert_outbox_delivery_idx
  on private.marketplace_alert_outbox (status, next_attempt_at, created_at)
  where status in ('queued','failed');

revoke all on private.marketplace_alert_outbox from public, anon, authenticated;

create or replace function private.process_marketplace_saved_search_alerts()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_inserted integer := 0;
  v_searches integer := 0;
  v_queued integer := 0;
  v_now timestamptz := now();
begin
  select count(*) into v_searches
  from public.marketplace_saved_searches
  where alert_enabled is true;

  with candidates as (
    select
      s.user_id,
      s.id as saved_search_id,
      l.id as listing_id,
      coalesce(l.published_at, l.created_at, v_now) as matched_at
    from public.marketplace_saved_searches s
    join public.marketplace_listings l
      on l.status = 'published'
     and l.visibility = 'public'
     and l.rights_confirmed_at is not null
     and coalesce(l.published_at, l.created_at, 'epoch'::timestamptz)
         > coalesce(s.last_checked_at, s.created_at, 'epoch'::timestamptz)
    where s.alert_enabled is true
      and (
        nullif(lower(trim(coalesce(s.criteria->>'operation',''))),'') is null
        or lower(coalesce(l.operation_type,'')) = lower(trim(s.criteria->>'operation'))
      )
      and (
        nullif(lower(trim(coalesce(s.criteria->>'property_type',''))),'') is null
        or lower(coalesce(l.property_type,'')) = lower(trim(s.criteria->>'property_type'))
      )
      and (
        nullif(trim(coalesce(s.criteria->>'min_price','')),'') is null
        or coalesce(l.price,0) >= case when (s.criteria->>'min_price') ~ '^[0-9]+([.][0-9]+)?$' then (s.criteria->>'min_price')::numeric else 0 end
      )
      and (
        nullif(trim(coalesce(s.criteria->>'max_price','')),'') is null
        or coalesce(l.price,0) <= case when (s.criteria->>'max_price') ~ '^[0-9]+([.][0-9]+)?$' then (s.criteria->>'max_price')::numeric else 999999999999999 end
      )
      and (
        nullif(trim(coalesce(s.criteria->>'bedrooms','')),'') is null
        or coalesce(l.bedrooms,0) = case when (s.criteria->>'bedrooms') ~ '^[0-9]+([.][0-9]+)?$' then (s.criteria->>'bedrooms')::numeric else coalesce(l.bedrooms,0) end
      )
      and (
        nullif(lower(trim(coalesce(s.criteria->>'q',''))),'') is null
        or concat_ws(' ',l.title,l.description,l.location_text,l.city,l.state_region,l.country_code)
           ilike '%' || replace(replace(trim(s.criteria->>'q'),'\\','\\\\'),'%','\\%') || '%' escape '\\'
      )
  ), inserted as (
    insert into public.marketplace_saved_search_matches
      (user_id,saved_search_id,listing_id,matched_at)
    select user_id,saved_search_id,listing_id,matched_at
    from candidates
    on conflict (saved_search_id,listing_id) do nothing
    returning user_id,saved_search_id,listing_id,matched_at
  ), queued as (
    insert into private.marketplace_alert_outbox
      (user_id,saved_search_id,listing_id,channel,status,next_attempt_at,metadata)
    select
      i.user_id,
      i.saved_search_id,
      i.listing_id,
      ch.channel,
      'queued',
      v_now,
      jsonb_build_object('matched_at', i.matched_at)
    from inserted i
    join public.marketplace_notification_preferences p on p.user_id = i.user_id
    cross join lateral (
      values ('push'::text,p.push_enabled),('email'::text,p.email_enabled)
    ) as ch(channel,enabled)
    where ch.enabled is true
    on conflict (saved_search_id,listing_id,channel) do nothing
    returning 1
  )
  select
    (select count(*) from inserted),
    (select count(*) from queued)
  into v_inserted, v_queued;

  update public.marketplace_saved_searches s
  set
    last_checked_at = v_now,
    last_match_at = greatest(
      s.last_match_at,
      (
        select max(m.matched_at)
        from public.marketplace_saved_search_matches m
        where m.saved_search_id = s.id
      )
    ),
    updated_at = v_now
  where s.alert_enabled is true;

  return jsonb_build_object(
    'ok', true,
    'processed_searches', v_searches,
    'new_matches', v_inserted,
    'queued_deliveries', v_queued,
    'processed_at', v_now
  );
end;
$function$;

revoke all on function private.process_marketplace_saved_search_alerts() from public, anon, authenticated;
grant execute on function private.process_marketplace_saved_search_alerts() to service_role;
