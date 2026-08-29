create table if not exists private.marketplace_interest_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

revoke all on private.marketplace_interest_rate_limits from public, anon, authenticated;

create or replace function public.consume_marketplace_interest_rate_limit(
  p_user_id uuid,
  p_max_requests integer default 6,
  p_window_seconds integer default 600
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_row private.marketplace_interest_rate_limits%rowtype;
  v_now timestamptz := now();
  v_window interval;
begin
  if p_user_id is null or p_max_requests < 1 or p_max_requests > 50 or p_window_seconds < 10 or p_window_seconds > 86400 then
    return false;
  end if;
  v_window := make_interval(secs => p_window_seconds);

  insert into private.marketplace_interest_rate_limits(user_id, window_started_at, request_count, updated_at)
  values (p_user_id, v_now, 1, v_now)
  on conflict (user_id) do update
    set window_started_at = case
          when private.marketplace_interest_rate_limits.window_started_at + v_window <= v_now then v_now
          else private.marketplace_interest_rate_limits.window_started_at
        end,
        request_count = case
          when private.marketplace_interest_rate_limits.window_started_at + v_window <= v_now then 1
          else private.marketplace_interest_rate_limits.request_count + 1
        end,
        updated_at = v_now
  returning * into v_row;

  return v_row.request_count <= p_max_requests;
end;
$$;

revoke all on function public.consume_marketplace_interest_rate_limit(uuid,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_marketplace_interest_rate_limit(uuid,integer,integer) to service_role;

comment on function public.consume_marketplace_interest_rate_limit(uuid,integer,integer) is 'Service-role-only rate limiter for authenticated Marketplace interest submissions. Default 6 accepted attempts per 10 minute rolling window.';
