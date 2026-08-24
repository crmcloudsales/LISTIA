create table if not exists private.ai_provider_runtimes (
  runtime_key text primary key,
  provider_key text not null references private.ai_providers(provider_key) on delete cascade,
  execution_surface text not null,
  adapter_key text not null,
  enabled boolean not null default false,
  credential_status text not null default 'not_configured' check (credential_status in ('not_configured','configured','invalid','not_required')),
  credential_secret_names text[] not null default '{}'::text[],
  health_status text not null default 'unknown' check (health_status in ('unknown','healthy','degraded','down')),
  configuration jsonb not null default '{}'::jsonb,
  last_healthcheck_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_key, execution_surface)
);

create index if not exists ai_provider_runtimes_surface_idx
  on private.ai_provider_runtimes(execution_surface, enabled, credential_status);

alter table private.ai_provider_runtimes enable row level security;
revoke all on private.ai_provider_runtimes from public, anon, authenticated;
grant all on private.ai_provider_runtimes to service_role;

insert into private.ai_provider_runtimes(runtime_key,provider_key,execution_surface,adapter_key,enabled,credential_status,credential_secret_names,health_status,configuration) values
('openai:direct','openai','openai','openai_responses',false,'not_configured',array['OPENAI_API_KEY'],'unknown','{"mode":"direct"}'::jsonb),
('anthropic:direct','anthropic','anthropic','anthropic_messages',false,'not_configured',array['ANTHROPIC_API_KEY'],'unknown','{"mode":"direct"}'::jsonb),
('google:direct','google','google','google_genai',false,'not_configured',array['GOOGLE_GENAI_API_KEY'],'unknown','{"mode":"direct"}'::jsonb),
('xai:direct','xai','xai','xai_api',false,'not_configured',array['XAI_API_KEY'],'unknown','{"mode":"direct"}'::jsonb),
('deepseek:direct','deepseek','deepseek','deepseek_api',false,'not_configured',array['DEEPSEEK_API_KEY'],'unknown','{"mode":"direct"}'::jsonb),
('byteplus:direct','byteplus','byteplus','byteplus_modelark',false,'not_configured',array['BYTEPLUS_API_KEY'],'unknown','{"mode":"direct"}'::jsonb),
('alibaba:direct','alibaba','alibaba','alibaba_dashscope',false,'not_configured',array['DASHSCOPE_API_KEY'],'unknown','{"mode":"direct"}'::jsonb),
('runway:direct','runway','runway','runway_api',false,'not_configured',array['RUNWAYML_API_SECRET'],'unknown','{"mode":"direct"}'::jsonb),
('higgsfield:gateway','higgsfield','higgsfield','higgsfield_gateway',false,'not_configured',array['HIGGSFIELD_API_KEY'],'unknown','{"mode":"gateway"}'::jsonb),
('microsoft_foundry:gateway','microsoft_foundry','microsoft_foundry','azure_ai_foundry',false,'not_configured',array['AZURE_AI_FOUNDRY_API_KEY'],'unknown','{"mode":"gateway"}'::jsonb),
('black_forest_labs:direct','black_forest_labs','black_forest_labs','bfl_api',false,'not_configured',array['BFL_API_KEY'],'unknown','{"mode":"direct"}'::jsonb),
('recraft:direct','recraft','recraft','recraft_api',false,'not_configured',array['RECRAFT_API_KEY'],'unknown','{"mode":"direct"}'::jsonb)
on conflict (runtime_key) do update set
  provider_key=excluded.provider_key,
  execution_surface=excluded.execution_surface,
  adapter_key=excluded.adapter_key,
  credential_secret_names=excluded.credential_secret_names,
  configuration=excluded.configuration,
  updated_at=now();
