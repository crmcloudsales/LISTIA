begin;

do $block$
declare
  v_status text := case
    when exists (select 1 from vault.secrets where name='listia_cloudco_nvidia_gateway_token') then 'configured'
    else 'not_configured'
  end;
begin
  insert into private.ai_provider_runtimes(
    runtime_key,provider_key,execution_surface,adapter_key,enabled,
    credential_status,credential_secret_names,health_status,configuration,
    last_healthcheck_at,last_error,updated_at
  ) values (
    'nvidia:cloudco','nvidia','nvidia','cloudco_nvidia_gateway',true,
    v_status,array['listia_cloudco_nvidia_gateway_token'],'unknown',
    jsonb_build_object(
      'mode','gateway',
      'model','nvidia/nemotron-3.5-lightning-30b-a3b',
      'base_url','https://fkahaqprzgcimgyathqx.supabase.co/functions/v1/nvidia-nim',
      'preferred_for','property_extraction',
      'credential_owner','cloudco',
      'credential_scope','server_side_only'
    ),
    now(),null,now()
  )
  on conflict (provider_key,execution_surface) do update set
    runtime_key=excluded.runtime_key,
    adapter_key=excluded.adapter_key,
    enabled=true,
    credential_status=excluded.credential_status,
    credential_secret_names=excluded.credential_secret_names,
    health_status='unknown',
    configuration=excluded.configuration,
    last_healthcheck_at=now(),
    last_error=null,
    updated_at=now();
end;
$block$;

commit;
