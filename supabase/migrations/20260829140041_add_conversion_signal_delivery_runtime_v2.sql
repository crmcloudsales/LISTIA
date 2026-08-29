create table if not exists private.conversion_signal_deliveries (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid not null references public.conversion_signals(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  platform text not null check (platform in ('meta','google','tiktok','linkedin')),
  status text not null default 'queued' check (status in ('queued','processing','sent','failed','suppressed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz,
  external_event_id text,
  last_http_status integer,
  last_error text,
  response_metadata jsonb not null default '{}'::jsonb,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (signal_id, platform, connection_id)
);

create index if not exists conversion_signal_deliveries_dispatch_idx
  on private.conversion_signal_deliveries(status, next_attempt_at, created_at)
  where status in ('queued','failed');
create index if not exists conversion_signal_deliveries_org_idx
  on private.conversion_signal_deliveries(organization_id, created_at desc);

alter table private.conversion_signal_deliveries enable row level security;
revoke all on private.conversion_signal_deliveries from public, anon, authenticated;
grant select, insert, update, delete on private.conversion_signal_deliveries to service_role;

alter table public.conversion_signals drop constraint if exists conversion_signals_delivery_status_check;
alter table public.conversion_signals
  add constraint conversion_signals_delivery_status_check
  check (delivery_status in ('pending','processing','sent','partial','failed','suppressed','waiting'));

drop index if exists public.conversion_signals_pending_idx;
create index conversion_signals_pending_idx
  on public.conversion_signals(delivery_status, created_at)
  where delivery_status in ('pending','failed','partial');

create or replace function private.requeue_conversion_signals_after_connection()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.status='connected' and lower(new.provider) in ('meta','google','tiktok','linkedin') then
    update public.conversion_signals s
       set delivery_status='pending',
           last_error=null,
           updated_at=now()
     where s.organization_id=new.organization_id
       and s.delivery_status='waiting'
       and lower(new.provider)=any(s.platforms);
  end if;
  return new;
end;
$$;
revoke all on function private.requeue_conversion_signals_after_connection() from public, anon, authenticated;

drop trigger if exists trg_requeue_conversion_signals_after_connection on public.integration_connections;
create trigger trg_requeue_conversion_signals_after_connection
after insert or update of status, provider, metadata, granted_scopes
on public.integration_connections
for each row execute function private.requeue_conversion_signals_after_connection();

do $$
declare v_secret text;
begin
  if not exists (select 1 from vault.secrets where name='listia_conversion_dispatch_secret') then
    v_secret := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
    perform vault.create_secret(v_secret, 'listia_conversion_dispatch_secret', 'Internal LISTIA conversion signal dispatcher key', null::uuid);
  end if;
end $$;

create or replace function private.dispatch_conversion_signal_worker(p_limit integer default 20)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, vault, net, private, public, pg_temp
as $$
declare
  v_key text;
  v_request_id bigint;
begin
  if not exists (
    select 1
      from public.conversion_signals
     where delivery_status in ('pending','failed','partial')
        or (delivery_status='processing' and updated_at < now() - interval '10 minutes')
  ) then
    return 0;
  end if;

  select decrypted_secret into v_key
    from vault.decrypted_secrets
   where name='listia_conversion_dispatch_secret'
   limit 1;

  if coalesce(v_key,'')='' then
    raise exception 'conversion_dispatch_secret_missing';
  end if;

  v_request_id := net.http_post(
    url := 'https://zvzafiarwerbuoaccnoz.supabase.co/functions/v1/conversion-signal-dispatch',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-listia-conversion-dispatch-key',v_key
    ),
    body := jsonb_build_object(
      'limit',least(greatest(coalesce(p_limit,20),1),50)
    ),
    timeout_milliseconds := 120000
  );

  return v_request_id;
end;
$$;
revoke all on function private.dispatch_conversion_signal_worker(integer) from public, anon, authenticated;
grant execute on function private.dispatch_conversion_signal_worker(integer) to service_role;
