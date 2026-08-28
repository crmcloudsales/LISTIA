create table if not exists private.web_event_rate_limits (
  principal_hash text primary key,
  website_host text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table private.web_event_rate_limits enable row level security;
revoke all on table private.web_event_rate_limits from public, anon, authenticated;

create index if not exists web_event_rate_limits_updated_at_idx
  on private.web_event_rate_limits(updated_at);

create or replace function private.consume_web_event_ingest_rate_limit(
  p_principal_hash text,
  p_host text
)
returns table(allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path to 'pg_catalog', 'private'
as $function$
declare
  v_count integer;
  v_window timestamptz;
  v_limit constant integer := 120;
  v_window_seconds constant integer := 600;
begin
  if p_principal_hash is null or length(p_principal_hash) < 32
     or p_host is null or length(p_host) > 253 then
    return query select false, v_window_seconds;
    return;
  end if;

  insert into private.web_event_rate_limits(
    principal_hash, website_host, window_started_at, request_count, updated_at
  ) values (
    p_principal_hash, lower(p_host), now(), 1, now()
  )
  on conflict (principal_hash) do update
  set website_host = excluded.website_host,
      window_started_at = case
        when private.web_event_rate_limits.window_started_at <= now() - make_interval(secs => v_window_seconds)
          then now()
        else private.web_event_rate_limits.window_started_at
      end,
      request_count = case
        when private.web_event_rate_limits.window_started_at <= now() - make_interval(secs => v_window_seconds)
          then 1
        else private.web_event_rate_limits.request_count + 1
      end,
      updated_at = now()
  returning request_count, window_started_at into v_count, v_window;

  return query
  select
    v_count <= v_limit,
    greatest(1, ceil(extract(epoch from (v_window + make_interval(secs => v_window_seconds) - now()))))::integer;
end;
$function$;

revoke all on function private.consume_web_event_ingest_rate_limit(text,text) from public, anon, authenticated;
grant execute on function private.consume_web_event_ingest_rate_limit(text,text) to service_role;
