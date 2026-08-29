begin;

create or replace function private.normalize_property_ai_manifest(p_manifest jsonb)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, pg_temp
as $function$
declare
  v jsonb;
begin
  if p_manifest is null then return '{}'::jsonb; end if;
  if jsonb_typeof(p_manifest)='object' then return p_manifest; end if;
  if jsonb_typeof(p_manifest)='string' then
    begin
      v := (p_manifest #>> '{}')::jsonb;
      if jsonb_typeof(v)='object' then return v; end if;
    exception when others then
      return '{}'::jsonb;
    end;
  end if;
  return '{}'::jsonb;
end;
$function$;

revoke all on function private.normalize_property_ai_manifest(jsonb) from public, anon, authenticated;
grant execute on function private.normalize_property_ai_manifest(jsonb) to service_role;

update public.property_processing_state
set input_manifest=private.normalize_property_ai_manifest(input_manifest),updated_at=now()
where jsonb_typeof(input_manifest)='string'
  and private.normalize_property_ai_manifest(input_manifest)<>'{}'::jsonb;

create or replace function private.enqueue_property_ai_job(
  p_property_id uuid,
  p_organization_id uuid,
  p_input_manifest jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $function$
declare
  v_manifest jsonb;
  v_fingerprint text;
  v_id uuid;
begin
  v_manifest := private.normalize_property_ai_manifest(p_input_manifest);
  if p_property_id is null or p_organization_id is null or v_manifest='{}'::jsonb then
    raise exception 'invalid_property_ai_input';
  end if;
  if not exists (
    select 1 from public.properties p
    where p.id=p_property_id and p.organization_id=p_organization_id
  ) then
    raise exception 'property_ai_org_mismatch';
  end if;

  v_fingerprint := md5((v_manifest - 'prepared_at')::text);

  update private.property_ai_jobs
  set status='cancelled',
      error_message='superseded_by_newer_input',
      completed_at=coalesce(completed_at,now()),
      updated_at=now()
  where property_id=p_property_id
    and organization_id=p_organization_id
    and job_type='property_extract'
    and status='queued'
    and input_fingerprint<>v_fingerprint;

  insert into private.property_ai_jobs(
    property_id,organization_id,job_type,input_fingerprint,input_manifest,
    status,attempt_count,queued_at,started_at,completed_at,error_message,updated_at
  ) values (
    p_property_id,p_organization_id,'property_extract',v_fingerprint,v_manifest,
    'queued',0,now(),null,null,null,now()
  )
  on conflict (property_id,job_type,input_fingerprint) do update
  set input_manifest=excluded.input_manifest,
      status=case when private.property_ai_jobs.status in ('failed','cancelled') then 'queued' else private.property_ai_jobs.status end,
      attempt_count=case when private.property_ai_jobs.status in ('failed','cancelled') then 0 else private.property_ai_jobs.attempt_count end,
      queued_at=case when private.property_ai_jobs.status in ('failed','cancelled') then now() else private.property_ai_jobs.queued_at end,
      started_at=case when private.property_ai_jobs.status in ('failed','cancelled') then null else private.property_ai_jobs.started_at end,
      completed_at=case when private.property_ai_jobs.status in ('failed','cancelled') then null else private.property_ai_jobs.completed_at end,
      error_message=case when private.property_ai_jobs.status in ('failed','cancelled') then null else private.property_ai_jobs.error_message end,
      updated_at=now()
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function private.enqueue_property_ai_job(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function private.enqueue_property_ai_job(uuid,uuid,jsonb) to service_role;

select private.enqueue_property_ai_job(ps.property_id,ps.organization_id,ps.input_manifest)
from public.property_processing_state ps
where private.normalize_property_ai_manifest(ps.input_manifest)<>'{}'::jsonb;

commit;
