create table if not exists private.technology_registry (
  technology_key text primary key,
  display_name text not null,
  layer text not null check (layer in ('ai_model','ai_gateway','orchestration','model_serving','development_agent','development_tool','design_tool','research_tool','observability','media_composer','media_model','compute','platform','distribution','pdf_tool')),
  decision text not null check (decision in ('core','priority_candidate','development','benchmark','lab','fallback','internal_only','deferred','excluded')),
  cost_class text not null check (cost_class in ('zero_license_cost','free_tier','open_weight_requires_compute','pay_per_use_no_fixed_fee','subscription','mixed','unknown')),
  license_class text not null default 'unknown',
  self_hostable boolean not null default false,
  user_visible boolean not null default false,
  mobile_transparent boolean not null default true,
  production_allowed boolean not null default false,
  requires_external_compute boolean not null default false,
  replaces_or_complements text[] not null default '{}'::text[],
  roles text[] not null default '{}'::text[],
  constraints jsonb not null default '{}'::jsonb,
  notes text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.technology_registry enable row level security;
revoke all on private.technology_registry from public, anon, authenticated;
grant all on private.technology_registry to service_role;

alter table private.ai_route_policies
  add column if not exists optimization_objective text not null default 'lowest_cost_passing_quality'
  check (optimization_objective in ('lowest_cost_passing_quality','best_quality_within_ceiling','lowest_latency_passing_quality','manual_priority'));

alter table private.ai_route_policies
  add column if not exists minimum_quality_score numeric(8,5);

insert into private.technology_registry(technology_key,display_name,layer,decision,cost_class,license_class,self_hostable,user_visible,mobile_transparent,production_allowed,requires_external_compute,replaces_or_complements,roles,constraints,notes,verified_at) values
('nvidia_nemotron','NVIDIA Nemotron','ai_model','priority_candidate','open_weight_requires_compute','NVIDIA Open Model License',true,false,true,true,true,array['premium_reasoning_api'],array['reasoning','agents','review','open_model'],'{"benchmark_required":true}'::jsonb,'Open/open-weight reasoning family. No API license fee when self-hosted; compute is not free.',now()),
('litellm','LiteLLM','ai_gateway','core','zero_license_cost','MIT',true,false,true,true,false,array['provider_specific_sdk_sprawl'],array['provider_normalization','fallbacks','routing_transport','cost_tracking'],'{}'::jsonb,'Transport/gateway layer beneath LISTIA Router; does not replace LISTIA business routing.',now()),
('langgraph','LangGraph','orchestration','core','zero_license_cost','MIT',true,false,true,true,false,array['ad_hoc_agent_chains','crewai_core'],array['durable_workflows','state','human_in_loop','multi_agent'],'{}'::jsonb,'Production orchestration/state layer; preferred over CrewAI for core durable workflows.',now()),
('openhands','OpenHands','development_agent','development','zero_license_cost','MIT core',true,false,true,false,true,array['manual_long_running_dev_tasks'],array['autonomous_coding','sandboxed_dev_agents'],'{"not_end_user_runtime":true}'::jsonb,'Development Engine only; isolate from production user data and secrets.',now()),
('opencode','OpenCode','development_agent','development','zero_license_cost','MIT',true,false,true,false,false,array['claude_code_dependency'],array['coding_agent','provider_agnostic_cli'],'{"sandbox_commands":true}'::jsonb,'Development agent. Commands require controlled permissions/sandbox.',now()),
('google_antigravity','Google Antigravity','development_agent','development','free_tier','provider_terms',false,false,true,false,false,array['paid_coding_agents'],array['coding_agent','subagents','skills','mcp'],'{"free_limits_change":true}'::jsonb,'Use free tier for development acceleration; never make LISTIA production depend on free quota.',now()),
('google_jules','Google Jules','development_agent','development','free_tier','provider_terms',false,false,true,false,false,array['manual_github_tasks'],array['async_github_agent','pr_generation'],'{"free_limits_change":true}'::jsonb,'Development/GitHub agent only.',now()),
('google_ai_studio_free','Google AI Studio / Gemini API Free','ai_gateway','lab','free_tier','provider_terms',false,false,true,false,false,array['paid_model_calls_for_non_sensitive_tests'],array['benchmark','prototype','non_sensitive_inference'],'{"non_sensitive_only":true,"free_limits_change":true}'::jsonb,'Useful for development/benchmarks. Do not route private client production data through a free tier without approved data terms.',now()),
('google_stitch','Google Stitch','design_tool','development','free_tier','provider_terms',false,false,true,false,false,array['manual_ui_prototyping'],array['ui_design','design_system','prototyping'],'{"free_limits_change":true}'::jsonb,'Development/design workflow, not production dependency.',now()),
('google_opal','Google Opal','development_tool','lab','free_tier','provider_terms',false,false,true,false,false,array['workflow_prototypes'],array['mini_apps','workflow_prototyping'],'{"not_core_runtime":true}'::jsonb,'Prototype workflows only.',now()),
('github_copilot_free','GitHub Copilot Free','development_agent','development','free_tier','provider_terms',false,false,true,false,false,array['manual_coding'],array['coding_assist'],'{"free_limits_change":true}'::jsonb,'Development assistant only.',now()),
('windsurf_codeium','Windsurf / Codeium','development_agent','development','free_tier','provider_terms',false,false,true,false,false,array['manual_coding'],array['coding_assist'],'{"free_limits_change":true}'::jsonb,'Optional development assistant; not production dependency.',now()),
('ollama','Ollama','model_serving','development','zero_license_cost','MIT',true,false,true,false,true,array['local_model_api'],array['local_inference','model_dev','testing'],'{}'::jsonb,'Best for development/local/small deployments; production high-throughput path should benchmark vLLM.',now()),
('vllm','vLLM','model_serving','core','zero_license_cost','Apache-2.0',true,false,true,true,true,array['managed_open_model_api'],array['gpu_serving','open_weights','high_throughput'],'{}'::jsonb,'Preferred production serving candidate for open-weight models when economics beat external APIs.',now()),
('qwen_2_5_coder','Qwen2.5-Coder','ai_model','priority_candidate','open_weight_requires_compute','Apache-2.0 for selected variants',true,false,true,true,true,array['paid_coding_models'],array['coding','review','structured_generation'],'{"variant_license_must_be_checked":true}'::jsonb,'Coding/open-model pool. Verify exact variant license before deployment.',now()),
('deepseek_coder_v2','DeepSeek-Coder-V2','ai_model','priority_candidate','open_weight_requires_compute','model-specific + repo license',true,false,true,true,true,array['paid_coding_models'],array['coding','reasoning','fallback'],'{"exact_weight_license_check":true}'::jsonb,'Coding/reasoning candidate; verify exact model terms per deployed weights.',now()),
('starcoder2','StarCoder2','ai_model','fallback','open_weight_requires_compute','BigCode OpenRAIL-M weights',true,false,true,true,true,array['coding_fallback'],array['coding','completion','multilingual_code'],'{"license_gate":true}'::jsonb,'Specialist/fallback, not default until benchmarked.',now()),
('codellama','Code Llama','ai_model','deferred','open_weight_requires_compute','Meta model license',true,false,true,false,true,array['legacy_coding_model'],array['historical_benchmark'],'{"archived_upstream":true}'::jsonb,'Keep only as historical benchmark; do not prioritize for a 2026 production stack.',now()),
('crawl4ai','Crawl4AI','research_tool','priority_candidate','zero_license_cost','Apache-2.0',true,false,true,true,true,array['paid_web_extraction'],array['public_web_research','seo','structured_extraction','comparables'],'{"respect_robots_terms":true,"separate_browser_service":true}'::jsonb,'Run as isolated crawler/browser service, not inside browser/mobile client.',now()),
('langfuse','Langfuse OSS','observability','core','zero_license_cost','MIT core',true,false,true,true,true,array['vendor_only_llm_observability'],array['tracing','evals','datasets','prompt_observability'],'{}'::jsonb,'Pair with LISTIA ai_runs; self-host when economical.',now()),
('bifrost','Bifrost','ai_gateway','benchmark','zero_license_cost','open-source core',true,false,true,false,false,array['litellm'],array['gateway','routing','guardrails'],'{"benchmark_against_litellm":true}'::jsonb,'Benchmark only; avoid two gateways in production without a measured advantage.',now()),
('portkey','Portkey OSS Core','ai_gateway','fallback','mixed','open-source core + hosted features',true,false,true,false,false,array['litellm'],array['gateway','guardrails','observability'],'{"benchmark_against_litellm":true}'::jsonb,'Reserve/fallback; do not duplicate LiteLLM by default.',now()),
('dify','Dify','platform','internal_only','zero_license_cost','source license with additional conditions',true,false,true,false,true,array['internal_workflow_builder'],array['workflow_prototyping','rag','internal_agents'],'{"no_listia_multitenant_backend_without_license_review":true}'::jsonb,'Internal prototyping only; do not use as LISTIA multi-tenant product core without legal/license approval.',now()),
('open_webui','Open WebUI','platform','internal_only','mixed','project-specific license',true,false,true,false,true,array['internal_model_ui'],array['internal_chat','model_testing'],'{"branding_scale_constraints":true}'::jsonb,'Internal testing UI only; not LISTIA white-label user interface.',now()),
('stirling_pdf','Stirling PDF','pdf_tool','excluded','mixed','mixed / engine production restrictions',true,false,true,false,true,array['pdf_processing'],array['pdf_reference'],'{"production_license_review_required":true}'::jsonb,'Do not embed full engine into LISTIA production under assumption that it is fully free. Use permissive PDF components instead.',now()),
('openrouter','OpenRouter','ai_gateway','benchmark','pay_per_use_no_fixed_fee','provider_terms',false,false,true,true,false,array['direct_provider_testing'],array['model_marketplace','benchmark','fallback'],'{"markup_and_provider_terms_check":true}'::jsonb,'Useful to test many models quickly; direct routes win when cheaper/better.',now()),
('abacus_ai','Abacus AI / ChatLLM','platform','benchmark','subscription','provider_terms',false,false,true,false,false,array['listia_ai_engine'],array['external_benchmark'],'{"not_core_dependency":true}'::jsonb,'Benchmark competitor/reference only; duplicates much of LISTIA architecture and adds fixed cost.',now()),
('grok_api','xAI Grok API','ai_model','benchmark','pay_per_use_no_fixed_fee','provider_terms',false,false,true,true,false,array['reasoning_providers'],array['reasoning','realtime','media'],'{"activate_only_if_benchmark_wins":true}'::jsonb,'Not a free route; activate only for tasks where quality/value beats cheaper alternatives.',now()),
('hyperframes','HyperFrames','media_composer','core','zero_license_cost','Apache-2.0',true,false,true,true,true,array['generative_full_frame_video'],array['deterministic_video_composition','original_asset_preservation','layouts','aspect_ratios'],'{}'::jsonb,'Core deterministic compositor: preserve original property/advisor pixels whenever exact fidelity is required.',now()),
('ffmpeg','FFmpeg','media_composer','core','zero_license_cost','LGPL/GPL depending build',true,false,true,true,true,array['managed_video_postprocessing'],array['encode','transcode','concat','audio_mux','frame_extract'],'{"build_license_profile_required":true}'::jsonb,'Deterministic media utility behind the mobile PWA.',now()),
('musetalk_1_5','MuseTalk 1.5','media_model','priority_candidate','open_weight_requires_compute','MIT code / commercial model use stated by project',true,false,true,true,true,array['heygen_lipsync','paid_lipsync_api'],array['lip_sync','canonical_advisor_video'],'{"benchmark_identity_and_sync":true}'::jsonb,'Primary low-cost lip-sync candidate; run server-side/GPU, invisible to mobile user.',now()),
('echomimic_v2','EchoMimicV2','media_model','priority_candidate','open_weight_requires_compute','Apache-2.0',true,false,true,true,true,array['photo_avatar_api'],array['photo_to_talking_advisor','half_body_animation'],'{"benchmark_identity_fidelity":true}'::jsonb,'Photo-only advisor fallback; exact identity cannot be promised until benchmark passes.',now()),
('runpod_serverless','RunPod Serverless','compute','priority_candidate','pay_per_use_no_fixed_fee','provider_terms',false,false,true,true,false,array['fixed_gpu_server'],array['gpu_serverless','scale_to_zero'],'{"benchmark_cold_start":true,"no_user_ui":true}'::jsonb,'Candidate GPU execution layer. Mobile user sees only LISTIA.',now()),
('modal_gpu','Modal GPU','compute','priority_candidate','free_tier','provider_terms',false,false,true,true,false,array['fixed_gpu_server'],array['gpu_serverless','scale_to_zero','development_credits'],'{"free_limits_change":true,"benchmark_cold_start":true,"no_user_ui":true}'::jsonb,'Benchmark against RunPod on cost per accepted output, not headline GPU price.',now())
on conflict (technology_key) do update set
 display_name=excluded.display_name, layer=excluded.layer, decision=excluded.decision, cost_class=excluded.cost_class,
 license_class=excluded.license_class, self_hostable=excluded.self_hostable, user_visible=excluded.user_visible,
 mobile_transparent=excluded.mobile_transparent, production_allowed=excluded.production_allowed,
 requires_external_compute=excluded.requires_external_compute, replaces_or_complements=excluded.replaces_or_complements,
 roles=excluded.roles, constraints=excluded.constraints, notes=excluded.notes, verified_at=excluded.verified_at, updated_at=now();

update private.ai_route_policies
set optimization_objective='lowest_cost_passing_quality',
    updated_at=now()
where active=true;
