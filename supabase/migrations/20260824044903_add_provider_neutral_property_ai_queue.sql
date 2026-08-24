create table if not exists private.property_ai_jobs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_type text not null default 'property_extract' check (job_type in ('property_extract','property_enrich','property_generate_draft')),
  input_fingerprint text not null,
  input_manifest jsonb not null,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','cancelled')),
  provider text,
  model text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  provider_cost numeric,
  provider_currency text,
  result jsonb,
  error_message text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(property_id, job_type, input_fingerprint)
);

create index if not exists property_ai_jobs_queue_idx
  on private.property_ai_jobs(status, queued_at)
  where status='queued';
create index if not exists property_ai_jobs_org_idx
  on private.property_ai_jobs(organization_id, queued_at desc);

alter table private.property_ai_jobs enable row level security;
revoke all on private.property_ai_jobs from public, anon, authenticated;
grant all on private.property_ai_jobs to service_role;

create or replace function public.queue_property_ai_job()
returns trigger
language plpgsql
security definer
set search_path=public,private
as $$
begin
  if new.stage='ready_for_ai' and coalesce(new.input_manifest,'{}'::jsonb) <> '{}'::jsonb then
    insert into private.property_ai_jobs(
      property_id,organization_id,job_type,input_fingerprint,input_manifest,status,queued_at,updated_at
    ) values (
      new.property_id,
      new.organization_id,
      'property_extract',
      md5(new.input_manifest::text),
      new.input_manifest,
      'queued',
      now(),
      now()
    )
    on conflict (property_id,job_type,input_fingerprint) do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function public.queue_property_ai_job() from public, anon, authenticated;
grant execute on function public.queue_property_ai_job() to service_role;

drop trigger if exists property_processing_state_queue_ai_job on public.property_processing_state;
create trigger property_processing_state_queue_ai_job
after insert or update of stage,input_manifest on public.property_processing_state
for each row execute function public.queue_property_ai_job();

insert into private.property_ai_jobs(property_id,organization_id,job_type,input_fingerprint,input_manifest,status)
select property_id,organization_id,'property_extract',md5(input_manifest::text),input_manifest,'queued'
from public.property_processing_state
where stage='ready_for_ai' and input_manifest <> '{}'::jsonb
on conflict (property_id,job_type,input_fingerprint) do nothing;
