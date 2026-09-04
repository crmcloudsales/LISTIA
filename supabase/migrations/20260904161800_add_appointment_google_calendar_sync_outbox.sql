-- LISTIA appointment -> Google Calendar durable sync boundary.
-- Local appointment writes never depend on Google availability.

create table if not exists private.appointment_calendar_sync_jobs (
  appointment_id uuid primary key references public.appointments(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  desired_action text not null check (desired_action in ('upsert','delete')),
  status text not null default 'pending' check (status in ('pending','processing','retry','failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.appointment_calendar_sync_jobs enable row level security;
revoke all on private.appointment_calendar_sync_jobs from public, anon, authenticated;
grant select, insert, update, delete on private.appointment_calendar_sync_jobs to service_role;

create index if not exists appointment_calendar_sync_due_idx
  on private.appointment_calendar_sync_jobs(status,next_attempt_at)
  where status in ('pending','retry');

create or replace function private.enqueue_appointment_calendar_sync()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_action text;
begin
  -- Only LISTIA-created Google calendars are eligible for this sync.
  if not exists (
    select 1
    from public.integration_connections c
    where c.organization_id = new.organization_id
      and c.provider = 'google'
      and c.status = 'connected'
      and nullif(c.metadata->>'calendar_id','') is not null
      and 'https://www.googleapis.com/auth/calendar.app.created' = any(coalesce(c.granted_scopes,array[]::text[]))
  ) then
    return new;
  end if;

  if new.status in ('scheduled','confirmed') then
    v_action := 'upsert';
  elsif new.status = 'cancelled' then
    v_action := 'delete';
  else
    return new;
  end if;

  insert into private.appointment_calendar_sync_jobs(
    appointment_id,organization_id,desired_action,status,attempt_count,next_attempt_at,last_error,created_at,updated_at
  ) values (
    new.id,new.organization_id,v_action,'pending',0,now(),null,now(),now()
  )
  on conflict(appointment_id) do update
    set organization_id=excluded.organization_id,
        desired_action=excluded.desired_action,
        status='pending',
        attempt_count=0,
        next_attempt_at=now(),
        last_error=null,
        updated_at=now();

  return new;
end;
$$;

revoke all on function private.enqueue_appointment_calendar_sync() from public, anon, authenticated;
grant execute on function private.enqueue_appointment_calendar_sync() to service_role;

drop trigger if exists enqueue_appointment_calendar_sync on public.appointments;
create trigger enqueue_appointment_calendar_sync
after insert or update of organization_id,title,starts_at,ends_at,meeting_type,status
on public.appointments
for each row
when (
  tg_op = 'INSERT'
  or old.organization_id is distinct from new.organization_id
  or old.title is distinct from new.title
  or old.starts_at is distinct from new.starts_at
  or old.ends_at is distinct from new.ends_at
  or old.meeting_type is distinct from new.meeting_type
  or old.status is distinct from new.status
)
execute function private.enqueue_appointment_calendar_sync();

-- Private dispatch secret. Its value is generated in-database and never committed.
do $$
begin
  if not exists (select 1 from vault.secrets where name='listia_calendar_sync_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''),
      'listia_calendar_sync_secret',
      'LISTIA internal appointment calendar sync dispatcher'
    );
  end if;
end $$;

create or replace function private.dispatch_appointment_calendar_sync(p_limit integer default 10)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, vault, net, private, pg_temp
as $$
declare
  v_key text;
  v_request_id bigint;
begin
  if not exists (
    select 1 from private.appointment_calendar_sync_jobs
    where status in ('pending','retry') and next_attempt_at <= now()
  ) then
    return 0;
  end if;

  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name='listia_calendar_sync_secret'
  limit 1;

  if coalesce(v_key,'')='' then
    raise exception 'appointment_calendar_sync_secret_missing';
  end if;

  v_request_id := net.http_post(
    url := 'https://zvzafiarwerbuoaccnoz.supabase.co/functions/v1/appointment-calendar-sync',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-listia-calendar-sync-key',v_key
    ),
    body := jsonb_build_object(
      'limit',least(greatest(coalesce(p_limit,10),1),25)
    ),
    timeout_milliseconds := 120000
  );

  return v_request_id;
end;
$$;

revoke all on function private.dispatch_appointment_calendar_sync(integer) from public, anon, authenticated;
grant execute on function private.dispatch_appointment_calendar_sync(integer) to service_role;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname='listia_appointment_calendar_sync_v1' limit 1;
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
  perform cron.schedule(
    'listia_appointment_calendar_sync_v1',
    '* * * * *',
    'select private.dispatch_appointment_calendar_sync(10);'
  );
end $$;
