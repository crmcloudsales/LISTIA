alter table public.appointments
  add column if not exists assigned_user_id uuid references public.profiles(id) on delete set null;

alter table public.appointments
  drop constraint if exists appointments_time_order_check;
alter table public.appointments
  add constraint appointments_time_order_check
  check (ends_at is null or ends_at > starts_at);

create index if not exists appointments_org_assignee_starts_idx
  on public.appointments(organization_id, assigned_user_id, starts_at)
  where assigned_user_id is not null and status in ('scheduled','confirmed');

create or replace function private.enforce_appointment_assignee_and_conflict()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_assigned uuid;
  v_end timestamptz;
begin
  if new.lead_id is not null and new.assigned_user_id is null then
    select l.assigned_user_id
      into v_assigned
    from public.leads l
    where l.id = new.lead_id
      and l.organization_id = new.organization_id
    limit 1;
    new.assigned_user_id := v_assigned;
  end if;

  if new.assigned_user_id is not null and not exists (
    select 1
    from public.organization_members m
    where m.organization_id = new.organization_id
      and m.user_id = new.assigned_user_id
      and m.status = 'active'
  ) then
    raise exception using errcode='P0001', message='appointment_assignee_not_active_member';
  end if;

  if new.status in ('scheduled','confirmed') and new.assigned_user_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('listia-appointment:' || new.assigned_user_id::text, 0));
    v_end := coalesce(new.ends_at, new.starts_at + interval '30 minutes');

    if exists (
      select 1
      from public.appointments a
      where a.organization_id = new.organization_id
        and a.assigned_user_id = new.assigned_user_id
        and a.status in ('scheduled','confirmed')
        and a.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and a.starts_at < v_end
        and coalesce(a.ends_at, a.starts_at + interval '30 minutes') > new.starts_at
    ) then
      raise exception using errcode='P0001', message='appointment_conflict';
    end if;
  end if;

  return new;
end
$$;

revoke all on function private.enforce_appointment_assignee_and_conflict() from public, anon, authenticated;
grant execute on function private.enforce_appointment_assignee_and_conflict() to service_role;

drop trigger if exists enforce_appointment_assignee_and_conflict on public.appointments;
create trigger enforce_appointment_assignee_and_conflict
before insert or update of organization_id, lead_id, assigned_user_id, starts_at, ends_at, status
on public.appointments
for each row execute function private.enforce_appointment_assignee_and_conflict();
