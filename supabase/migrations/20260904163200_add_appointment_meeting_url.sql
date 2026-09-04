alter table public.appointments
  add column if not exists meeting_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.appointments'::regclass
      and conname='appointments_meeting_url_check'
  ) then
    alter table public.appointments
      add constraint appointments_meeting_url_check
      check (meeting_url is null or (char_length(meeting_url) <= 2048 and meeting_url ~ '^https://'));
  end if;
end $$;

comment on column public.appointments.meeting_url is
  'LISTIA-managed meeting URL, populated by connected meeting/calendar providers when available.';
