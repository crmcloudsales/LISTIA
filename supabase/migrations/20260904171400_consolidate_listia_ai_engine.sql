-- LISTIA AI Engine v1: one provider-neutral control plane for all AI execution.

-- Every provider secret used by LISTIA must be LISTIA-scoped.
update private.ai_provider_runtimes
set enabled=true,
    credential_secret_names=array['listia_openai_api_key']::text[],
    credential_status=case when exists(select 1 from vault.secrets where name='listia_openai_api_key') then 'configured' else 'not_configured' end,
    configuration=coalesce(configuration,'{}'::jsonb)||jsonb_build_object(
      'mode','direct','api_style','responses','base_url','https://api.openai.com/v1/responses','credential_owner','listia','credential_scope','server_side_only'
    ),
    updated_at=now()
where runtime_key='openai:direct';

update private.ai_provider_runtimes
set enabled=true,
    credential_secret_names=array['listia_nvidia_api_key']::text[],
    configuration=coalesce(configuration,'{}'::jsonb)||jsonb_build_object(
      'credential_owner','listia','credential_scope','server_side_only','free_endpoint_preferred',true
    ),
    updated_at=now()
where runtime_key='nvidia:listia_direct';

-- Conversation routing: prefer Nemotron when available; escalate to OpenAI by quality tier.
insert into private.ai_route_policies(
  task_type,quality_tier,strategy,primary_models,reviewer_models,fallback_models,
  required_validators,max_parallel,max_attempts,escalate_on_failure,
  optimization_objective,active,notes
) values
('conversation','q1','single_then_validate',array['nvidia_nemotron_3_5_lightning'],array[]::text[],array['openai:gpt-5.6-luna'],array['structured_json'],1,2,true,'lowest_cost_passing_quality',true,'LISTIA AI Engine: Nemotron-first economy conversation; OpenAI Luna fallback.'),
('conversation','q2','single_then_validate',array['nvidia_nemotron_3_5_lightning'],array[]::text[],array['openai:gpt-5.6-terra','openai:gpt-5.6-luna'],array['structured_json'],1,3,true,'lowest_cost_passing_quality',true,'LISTIA AI Engine: Nemotron-first balanced conversation; OpenAI escalation.'),
('conversation','q3','primary_review',array['openai:gpt-5.6-sol'],array[]::text[],array['nvidia_nemotron_3_5_lightning','openai:gpt-5.6-terra'],array['structured_json'],1,3,true,'best_quality_within_ceiling',true,'LISTIA AI Engine: complex conversation/reasoning uses OpenAI Sol when configured.')
on conflict(task_type,quality_tier) do update set
 strategy=excluded.strategy,primary_models=excluded.primary_models,reviewer_models=excluded.reviewer_models,
 fallback_models=excluded.fallback_models,required_validators=excluded.required_validators,
 max_parallel=excluded.max_parallel,max_attempts=excluded.max_attempts,
 escalate_on_failure=excluded.escalate_on_failure,optimization_objective=excluded.optimization_objective,
 active=true,notes=excluded.notes;

-- Property extraction is cheap-first as well. Deterministic validation remains mandatory downstream.
insert into private.ai_route_policies(
  task_type,quality_tier,strategy,primary_models,reviewer_models,fallback_models,
  required_validators,max_parallel,max_attempts,escalate_on_failure,
  optimization_objective,active,notes
) values
('property_extract','q1','single_then_validate',array['nvidia_nemotron_3_5_lightning'],array[]::text[],array['openai:gpt-5.6-luna'],array['schema','source_grounding','numeric_exactness','missing_field_detection'],1,2,true,'lowest_cost_passing_quality',true,'LISTIA AI Engine: Nemotron-first property extraction; deterministic source grounding remains authoritative.'),
('property_extract','q2','primary_review',array['nvidia_nemotron_3_5_lightning'],array['openai:gpt-5.6-terra'],array['openai:gpt-5.6-luna'],array['schema','source_grounding','numeric_exactness','missing_field_detection'],1,3,true,'lowest_cost_passing_quality',true,'LISTIA AI Engine: Nemotron primary with OpenAI quality escalation.')
on conflict(task_type,quality_tier) do update set
 strategy=excluded.strategy,primary_models=excluded.primary_models,reviewer_models=excluded.reviewer_models,
 fallback_models=excluded.fallback_models,required_validators=excluded.required_validators,
 max_parallel=excluded.max_parallel,max_attempts=excluded.max_attempts,
 escalate_on_failure=excluded.escalate_on_failure,optimization_objective=excluded.optimization_objective,
 active=true,notes=excluded.notes;

-- Internal Engine authentication secret is generated in-database and never committed.
do $$
begin
  if not exists(select 1 from vault.secrets where name='listia_ai_engine_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),
      'listia_ai_engine_secret',
      'LISTIA internal AI Engine service authentication'
    );
  end if;
end $$;

comment on table private.ai_providers is 'LISTIA AI Engine provider registry. Adding providers does not require product functions to know provider APIs.';
comment on table private.ai_provider_runtimes is 'LISTIA AI Engine runtime/adapters, credential health and execution surface registry.';
comment on table private.ai_route_policies is 'LISTIA AI Engine task routing: quality/cost strategy, primary, reviewers and fallback models.';
comment on table private.ai_runs is 'LISTIA AI Engine execution telemetry and quality/cost audit trail.';
