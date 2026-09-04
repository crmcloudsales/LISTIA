-- LISTIA-only property AI runtime.
-- Removes the live cross-product NVIDIA gateway dependency from the active runtime.

do $$
begin
  if exists (
    select 1
    from private.ai_provider_runtimes
    where runtime_key = 'nvidia:cloudco'
  ) then
    update private.ai_provider_runtimes
    set runtime_key = 'nvidia:listia_direct',
        adapter_key = 'nvidia_direct_api',
        enabled = true,
        credential_status = case
          when exists (select 1 from vault.secrets where name = 'listia_nvidia_api_key') then 'configured'
          else 'not_configured'
        end,
        credential_secret_names = array['listia_nvidia_api_key']::text[],
        health_status = 'unknown',
        configuration = jsonb_build_object(
          'mode', 'direct',
          'model', 'nvidia/nemotron-3.5-lightning-30b-a3b',
          'base_url', 'https://integrate.api.nvidia.com/v1/chat/completions',
          'preferred_for', 'property_extraction',
          'credential_owner', 'listia',
          'credential_scope', 'server_side_only',
          'fallback', 'deterministic_property_type_v1'
        ),
        last_healthcheck_at = now(),
        last_error = case
          when exists (select 1 from vault.secrets where name = 'listia_nvidia_api_key') then null
          else 'LISTIA NVIDIA API key not configured; deterministic fallback active'
        end,
        updated_at = now()
    where runtime_key = 'nvidia:cloudco';
  elsif not exists (
    select 1
    from private.ai_provider_runtimes
    where provider_key = 'nvidia' and execution_surface = 'nvidia'
  ) then
    insert into private.ai_provider_runtimes (
      runtime_key, provider_key, execution_surface, adapter_key, enabled,
      credential_status, credential_secret_names, health_status, configuration,
      last_healthcheck_at, last_error, created_at, updated_at
    ) values (
      'nvidia:listia_direct', 'nvidia', 'nvidia', 'nvidia_direct_api', true,
      case when exists (select 1 from vault.secrets where name = 'listia_nvidia_api_key') then 'configured' else 'not_configured' end,
      array['listia_nvidia_api_key']::text[],
      'unknown',
      jsonb_build_object(
        'mode', 'direct',
        'model', 'nvidia/nemotron-3.5-lightning-30b-a3b',
        'base_url', 'https://integrate.api.nvidia.com/v1/chat/completions',
        'preferred_for', 'property_extraction',
        'credential_owner', 'listia',
        'credential_scope', 'server_side_only',
        'fallback', 'deterministic_property_type_v1'
      ),
      now(),
      case when exists (select 1 from vault.secrets where name = 'listia_nvidia_api_key') then null else 'LISTIA NVIDIA API key not configured; deterministic fallback active' end,
      now(), now()
    );
  end if;
end $$;
