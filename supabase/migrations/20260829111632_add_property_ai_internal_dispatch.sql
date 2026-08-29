begin;

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
  v_fingerprint text;
  v_id uuid;
begin
  if p_property_id is null or p_organization_id is null or coalesce(p_input_manifest,'{}'::jsonb)='{}'::jsonb then
    raise exception 'invalid_property_ai_input';
  end if;
  if not exists (
    select 1 from public.properties p
    where p.id=p_property_id and p.organization_id=p_organization_id
  ) then
    raise exception 'property_ai_org_mismatch';
  end if;

  v_fingerprint := md5((p_input_manifest - 'prepared_at')::text);

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
    p_property_id,p_organization_id,'property_extract',v_fingerprint,p_input_manifest,
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

create or replace function public.queue_property_ai_job()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $function$
begin
  if new.stage='ready_for_ai' and coalesce(new.input_manifest,'{}'::jsonb) <> '{}'::jsonb then
    perform private.enqueue_property_ai_job(new.property_id,new.organization_id,new.input_manifest);
  end if;
  return new;
end;
$function$;

revoke all on function public.queue_property_ai_job() from public, anon, authenticated;
grant execute on function public.queue_property_ai_job() to service_role;

do $block$
begin
  if not exists (select 1 from vault.secrets where name='listia_property_ai_dispatch_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32),'hex'),
      'listia_property_ai_dispatch_secret',
      'LISTIA internal property AI dispatcher credential'
    );
  end if;
end;
$block$;

create or replace function private.dispatch_property_ai_worker(p_limit integer default 1)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, vault, net, pg_temp
as $function$
declare
  v_key text;
  v_request_id bigint;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name='listia_property_ai_dispatch_secret'
  limit 1;
  if coalesce(v_key,'')='' then
    raise exception 'property_ai_dispatch_secret_missing';
  end if;
  v_request_id := net.http_post(
    url := 'https://zvzafiarwerbuoaccnoz.supabase.co/functions/v1/property-ai-worker',
    headers := jsonb_build_object('Content-Type','application/json','x-listia-ai-dispatch-key',v_key),
    body := jsonb_build_object('limit',least(greatest(coalesce(p_limit,1),1),3)),
    timeout_milliseconds := 120000
  );
  return v_request_id;
end;
$function$;

revoke all on function private.dispatch_property_ai_worker(integer) from public, anon, authenticated;
grant execute on function private.dispatch_property_ai_worker(integer) to service_role;

commit;
