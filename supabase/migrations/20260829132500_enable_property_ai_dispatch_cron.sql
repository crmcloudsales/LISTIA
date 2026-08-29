begin;

create or replace function private.dispatch_property_ai_worker(p_limit integer default 1)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, vault, net, private, pg_temp
as $function$
declare
  v_key text;
  v_request_id bigint;
begin
  if not exists (
    select 1
    from private.property_ai_jobs
    where status='queued'
      and job_type='property_extract'
  ) then
    return 0;
  end if;

  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name='listia_property_ai_dispatch_secret'
  limit 1;

  if coalesce(v_key,'')='' then
    raise exception 'property_ai_dispatch_secret_missing';
  end if;

  v_request_id := net.http_post(
    url := 'https://zvzafiarwerbuoaccnoz.supabase.co/functions/v1/property-ai-worker',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-listia-ai-dispatch-key',v_key
    ),
    body := jsonb_build_object(
      'limit',least(greatest(coalesce(p_limit,1),1),3)
    ),
    timeout_milliseconds := 120000
  );

  return v_request_id;
end;
$function$;

revoke all on function private.dispatch_property_ai_worker(integer) from public, anon, authenticated;
grant execute on function private.dispatch_property_ai_worker(integer) to service_role;

do $block$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname='listia_property_ai_dispatch_v1'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'listia_property_ai_dispatch_v1',
    '* * * * *',
    'select private.dispatch_property_ai_worker(3);'
  );
end;
$block$;

commit;
