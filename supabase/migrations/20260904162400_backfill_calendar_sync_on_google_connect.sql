-- When Google Calendar becomes connected/reconnected, enqueue current LISTIA appointments.
-- When it disconnects, discard stale pending jobs; reconnect will backfill again.

create or replace function private.refresh_google_calendar_sync_queue()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  if new.provider <> 'google' then
    return new;
  end if;

  if new.status = 'connected'
     and nullif(new.metadata->>'calendar_id','') is not null
     and 'https://www.googleapis.com/auth/calendar.app.created' = any(coalesce(new.granted_scopes,array[]::text[])) then
    insert into private.appointment_calendar_sync_jobs(
      appointment_id,organization_id,desired_action,status,attempt_count,next_attempt_at,last_error,created_at,updated_at
    )
    select a.id,a.organization_id,'upsert','pending',0,now(),null,now(),now()
    from public.appointments a
    where a.organization_id=new.organization_id
      and a.status in ('scheduled','confirmed')
      and a.starts_at >= now() - interval '1 day'
    on conflict(appointment_id) do update
      set organization_id=excluded.organization_id,
          desired_action='upsert',
          status='pending',
          attempt_count=0,
          next_attempt_at=now(),
          last_error=null,
          updated_at=now();
  else
    delete from private.appointment_calendar_sync_jobs
    where organization_id=new.organization_id;
  end if;

  return new;
end;
$$;

revoke all on function private.refresh_google_calendar_sync_queue() from public, anon, authenticated;
grant execute on function private.refresh_google_calendar_sync_queue() to service_role;

drop trigger if exists refresh_google_calendar_sync_queue on public.integration_connections;
create trigger refresh_google_calendar_sync_queue
after insert or update of status,metadata,granted_scopes
on public.integration_connections
for each row
execute function private.refresh_google_calendar_sync_queue();
