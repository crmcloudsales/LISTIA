create table if not exists private.pwa_product_event_rate_limits (
  user_id uuid primary key,
  organization_id uuid not null,
  window_started_at timestamptz not null default now(),
  event_count integer not null default 0 check (event_count >= 0),
  updated_at timestamptz not null default now()
);

alter table private.pwa_product_event_rate_limits enable row level security;
revoke all on table private.pwa_product_event_rate_limits from public, anon, authenticated;

create index if not exists pwa_product_event_rate_limits_updated_at_idx
  on private.pwa_product_event_rate_limits(updated_at);

create or replace function private.consume_pwa_product_event_rate_limit(
  p_user_id uuid,
  p_organization_id uuid,
  p_event_count integer
)
returns table(allowed boolean, retry_after integer, remaining integer)
language plpgsql
security definer
set search_path to 'pg_catalog', 'private'
as $function$
declare
  v_count integer;
  v_window timestamptz;
  v_limit constant integer := 600;
  v_window_seconds constant integer := 600;
  v_increment integer := greatest(1, least(coalesce(p_event_count,1),25));
begin
  if p_user_id is null or p_organization_id is null then
    return query select false, v_window_seconds, 0;
    return;
  end if;

  insert into private.pwa_product_event_rate_limits(
    user_id, organization_id, window_started_at, event_count, updated_at
  ) values (
    p_user_id, p_organization_id, now(), v_increment, now()
  )
  on conflict (user_id) do update
  set organization_id = excluded.organization_id,
      window_started_at = case
        when private.pwa_product_event_rate_limits.window_started_at <= now() - make_interval(secs => v_window_seconds)
          then now()
        else private.pwa_product_event_rate_limits.window_started_at
      end,
      event_count = case
        when private.pwa_product_event_rate_limits.window_started_at <= now() - make_interval(secs => v_window_seconds)
          then v_increment
        else private.pwa_product_event_rate_limits.event_count + v_increment
      end,
      updated_at = now()
  returning event_count, window_started_at into v_count, v_window;

  return query
  select
    v_count <= v_limit,
    greatest(1, ceil(extract(epoch from (v_window + make_interval(secs => v_window_seconds) - now()))))::integer,
    greatest(0, v_limit - v_count);
end;
$function$;

revoke all on function private.consume_pwa_product_event_rate_limit(uuid,uuid,integer) from public, anon, authenticated;
grant execute on function private.consume_pwa_product_event_rate_limit(uuid,uuid,integer) to service_role;
