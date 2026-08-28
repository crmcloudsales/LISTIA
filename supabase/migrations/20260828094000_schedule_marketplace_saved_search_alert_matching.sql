create or replace function private.process_marketplace_saved_search_alerts()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer := 0;
  v_searches integer := 0;
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
    returning 1
  )
  select count(*) into v_inserted from inserted;

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
    'processed_at', v_now
  );
end;
$$;

revoke all on function private.process_marketplace_saved_search_alerts() from public, anon, authenticated;
grant execute on function private.process_marketplace_saved_search_alerts() to service_role;

select cron.schedule(
  'listia_marketplace_saved_search_alerts_v1',
  '*/5 * * * *',
  $$select private.process_marketplace_saved_search_alerts();$$
);
