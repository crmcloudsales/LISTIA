create table if not exists private.ai_providers (
  provider_key text primary key,
  display_name text not null,
  provider_type text not null check (provider_type in ('direct','gateway','self_hosted','hybrid')),
  lifecycle_status text not null default 'discovered' check (lifecycle_status in ('discovered','verified','adapter_ready','benchmarked','active','fallback','deprecated','removed')),
  direct_api_available boolean not null default false,
  capabilities jsonb not null default '{}'::jsonb,
  notes text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.ai_models (
  model_key text primary key,
  provider_key text not null references private.ai_providers(provider_key) on delete cascade,
  provider_model_id text,
  display_name text not null,
  family text,
  lifecycle_status text not null default 'discovered' check (lifecycle_status in ('discovered','verified','adapter_ready','benchmarked','active','fallback','deprecated','removed')),
  input_modalities text[] not null default '{}'::text[],
  output_modalities text[] not null default '{}'::text[],
  route_tags text[] not null default '{}'::text[],
  capabilities jsonb not null default '{}'::jsonb,
  cost_profile jsonb not null default '{}'::jsonb,
  deprecation_risk text not null default 'normal' check (deprecation_risk in ('low','normal','high','scheduled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.ai_benchmark_cases (
  case_key text primary key,
  task_type text not null,
  description text not null,
  risk_level text not null default 'standard' check (risk_level in ('low','standard','high','critical')),
  input_manifest jsonb not null default '{}'::jsonb,
  expected_manifest jsonb not null default '{}'::jsonb,
  validators jsonb not null default '[]'::jsonb,
  score_weights jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  benchmark_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.ai_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  task_type text not null,
  quality_tier text not null default 'q2' check (quality_tier in ('q0','q1','q2','q3','q4')),
  provider_key text references private.ai_providers(provider_key) on delete set null,
  model_key text references private.ai_models(model_key) on delete set null,
  attempt_no integer not null default 1 check (attempt_no >= 1),
  input_fingerprint text,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','rejected','cancelled')),
  latency_ms bigint check (latency_ms is null or latency_ms >= 0),
  provider_cost numeric(20,8) check (provider_cost is null or provider_cost >= 0),
  provider_currency text not null default 'usd',
  usage jsonb not null default '{}'::jsonb,
  validation jsonb not null default '{}'::jsonb,
  accepted boolean,
  output_ref text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.ai_model_scores (
  model_key text not null references private.ai_models(model_key) on delete cascade,
  task_type text not null,
  benchmark_version integer not null default 1,
  sample_count integer not null default 0 check (sample_count >= 0),
  accepted_rate numeric(8,5),
  quality_score numeric(8,5),
  factual_score numeric(8,5),
  text_accuracy_score numeric(8,5),
  identity_fidelity_score numeric(8,5),
  property_fidelity_score numeric(8,5),
  latency_p50_ms bigint,
  cost_per_accepted_output numeric(20,8),
  score_details jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (model_key, task_type, benchmark_version)
);

create index if not exists ai_models_provider_status_idx on private.ai_models(provider_key, lifecycle_status);
create index if not exists ai_runs_task_created_idx on private.ai_runs(task_type, created_at desc);
create index if not exists ai_runs_model_accepted_idx on private.ai_runs(model_key, accepted, created_at desc);
create index if not exists ai_runs_org_created_idx on private.ai_runs(organization_id, created_at desc) where organization_id is not null;
create index if not exists ai_runs_property_created_idx on private.ai_runs(property_id, created_at desc) where property_id is not null;

alter table private.ai_providers enable row level security;
alter table private.ai_models enable row level security;
alter table private.ai_benchmark_cases enable row level security;
alter table private.ai_runs enable row level security;
alter table private.ai_model_scores enable row level security;

revoke all on private.ai_providers from public, anon, authenticated;
revoke all on private.ai_models from public, anon, authenticated;
revoke all on private.ai_benchmark_cases from public, anon, authenticated;
revoke all on private.ai_runs from public, anon, authenticated;
revoke all on private.ai_model_scores from public, anon, authenticated;

grant all on private.ai_providers to service_role;
grant all on private.ai_models to service_role;
grant all on private.ai_benchmark_cases to service_role;
grant all on private.ai_runs to service_role;
grant all on private.ai_model_scores to service_role;

insert into private.ai_providers(provider_key,display_name,provider_type,lifecycle_status,direct_api_available,capabilities,notes,verified_at) values
('openai','OpenAI','direct','verified',true,'{"reasoning":true,"image":true,"audio":true,"video_legacy":true}'::jsonb,'Direct provider. Keep Sora video path isolated because the current Sora API has a scheduled shutdown.',now()),
('anthropic','Anthropic','direct','verified',true,'{"reasoning":true,"vision":true,"coding":true,"review":true}'::jsonb,'Claude specialist pool for reasoning, coding and review.',now()),
('google','Google Gemini','direct','verified',true,'{"reasoning":true,"multimodal":true,"image":true,"video":true,"voice":true,"documents":true}'::jsonb,'Gemini/Nano Banana/Veo and Google-native workflows.',now()),
('xai','xAI','direct','verified',true,'{"reasoning":true,"image":true,"video":true,"voice":true,"realtime_search":true}'::jsonb,'Grok reasoning and Imagine media APIs.',now()),
('deepseek','DeepSeek','direct','verified',true,'{"reasoning":true,"coding":true,"large_context":true,"open_weights":true}'::jsonb,'Cost-efficient reasoning/coding pool.',now()),
('byteplus','BytePlus ModelArk','direct','verified',true,'{"reasoning":true,"image":true,"video":true,"voice":true,"multimodal":true}'::jsonb,'Dola Seed, Seedream, Seedance and Seed Speech.',now()),
('alibaba','Alibaba Model Studio','direct','verified',true,'{"qwen":true,"wan":true,"multimodal":true,"video":true,"open_models":true}'::jsonb,'Qwen/Wan direct and open-model routes.',now()),
('runway','Runway','hybrid','verified',true,'{"video":true,"image":true,"gateway":true,"third_party_models":true}'::jsonb,'Native Runway models plus routed third-party models.',now()),
('higgsfield','Higgsfield','gateway','verified',true,'{"video":true,"image":true,"audio":true,"gateway":true,"reference_elements":true}'::jsonb,'Connected execution surface available in this workspace; LISTIA production adapter still requires explicit app-side configuration.',now()),
('microsoft_foundry','Microsoft Foundry','gateway','verified',true,'{"model_catalog":true,"serverless":true,"open_models":true,"edge_local":true}'::jsonb,'Optional gateway/enterprise/local route; avoid duplicate paid hops when direct provider is better.',now()),
('black_forest_labs','Black Forest Labs','direct','discovered',true,'{"image":true,"video":true}'::jsonb,'FLUX family candidate; direct adapter pending verification/benchmark.',null),
('kling','Kling','direct','discovered',false,'{"video":true,"image":true}'::jsonb,'Currently verified through Higgsfield surface; direct official API path not yet canonicalized.',null),
('minimax','MiniMax','direct','discovered',false,'{"video":true,"audio":true}'::jsonb,'Currently verified through Higgsfield surface; direct adapter pending.',null),
('recraft','Recraft','direct','discovered',false,'{"image":true,"vector":true,"brand":true,"typography":true}'::jsonb,'Useful specialist for logos/vector/brand utility; adapter pending.',null),
('midjourney','Midjourney','direct','discovered',false,'{"image":true,"automation_prohibited":true}'::jsonb,'Creative benchmark/manual reference only while official automation API is unavailable; do not automate unofficially.',now()),
('open_source_local','Open Source / Local','self_hosted','discovered',false,'{"qwen":true,"deepseek":true,"wan":true,"phi":true,"llama":true,"mistral":true,"local_inference":true}'::jsonb,'Self-hosted pool for cost/privacy/offline cases when benchmarks justify it.',null)
on conflict (provider_key) do update set
  display_name=excluded.display_name,
  provider_type=excluded.provider_type,
  direct_api_available=excluded.direct_api_available,
  capabilities=excluded.capabilities,
  notes=excluded.notes,
  verified_at=coalesce(private.ai_providers.verified_at,excluded.verified_at),
  updated_at=now();

insert into private.ai_models(model_key,provider_key,provider_model_id,display_name,family,lifecycle_status,input_modalities,output_modalities,route_tags,capabilities,deprecation_risk) values
('openai:gpt-5.6-sol','openai','gpt-5.6-sol','GPT-5.6 Sol','gpt-5.6','verified',array['text','image'],array['text'],array['reasoning','coding','review','tools'], '{"structured_outputs":true,"tool_use":true}'::jsonb,'normal'),
('openai:gpt-5.6-terra','openai','gpt-5.6-terra','GPT-5.6 Terra','gpt-5.6','verified',array['text','image'],array['text'],array['reasoning','balanced','tools'], '{"structured_outputs":true,"tool_use":true}'::jsonb,'normal'),
('openai:gpt-5.6-luna','openai','gpt-5.6-luna','GPT-5.6 Luna','gpt-5.6','verified',array['text','image'],array['text'],array['economy','reasoning','tools'], '{"structured_outputs":true,"tool_use":true}'::jsonb,'normal'),
('openai:gpt-image-2','openai','gpt-image-2','GPT Image 2','gpt-image','verified',array['text','image'],array['image'],array['image','editing','text_rendering','high_fidelity_input'], '{}'::jsonb,'low'),
('anthropic:claude-opus-5','anthropic','claude-opus-5','Claude Opus 5','claude-5','verified',array['text','image'],array['text'],array['reasoning','review','coding','critical'], '{"long_context":true}'::jsonb,'normal'),
('anthropic:claude-sonnet-5','anthropic','claude-sonnet-5','Claude Sonnet 5','claude-5','verified',array['text','image'],array['text'],array['reasoning','coding','agentic','balanced'], '{}'::jsonb,'normal'),
('google:gemini-3.7-flash','google','gemini-3.7-flash','Gemini 3.7 Flash','gemini','verified',array['text','image','video','document'],array['text'],array['multimodal','documents','google','economy'], '{"structured_outputs":true,"tool_use":true}'::jsonb,'normal'),
('google:nano-banana-2','google','gemini-3.1-flash-image-preview','Nano Banana 2','gemini-image','verified',array['text','image'],array['image'],array['image','editing','fast','text_rendering'], '{}'::jsonb,'normal'),
('google:veo-3.1','google','veo-3.1-generate-preview','Veo 3.1','veo','verified',array['text','image'],array['video','audio'],array['video','cinematic','reference','premium'], '{"reference_images":3}'::jsonb,'normal'),
('xai:grok-4.6','xai','grok-4.6','Grok 4.6','grok','verified',array['text','image'],array['text'],array['reasoning','coding','realtime','x_search'], '{"structured_outputs":true,"tool_use":true}'::jsonb,'normal'),
('xai:grok-imagine-image-2.0','xai','grok-imagine-image-2.0','Grok Imagine Image 2.0','grok-imagine','verified',array['text','image'],array['image'],array['image','editing'], '{}'::jsonb,'normal'),
('xai:grok-imagine-video-1.5','xai','grok-imagine-video-1.5','Grok Imagine Video 1.5','grok-imagine','verified',array['text','image','audio'],array['video'],array['video','reference','audio'], '{}'::jsonb,'normal'),
('deepseek:v4-flash','deepseek','deepseek-v4-flash','DeepSeek V4 Flash','deepseek-v4','verified',array['text'],array['text'],array['economy','reasoning','coding','large_context'], '{"open_weights":true,"structured_outputs":true}'::jsonb,'low'),
('deepseek:v4-pro','deepseek','deepseek-v4-pro','DeepSeek V4 Pro','deepseek-v4','verified',array['text'],array['text'],array['reasoning','coding','large_context'], '{"open_weights":true,"structured_outputs":true}'::jsonb,'low'),
('byteplus:dola-seed-2.1-turbo','byteplus',null,'Dola Seed 2.1 Turbo','dola-seed','verified',array['text','image','video'],array['text'],array['reasoning','multimodal','economy'], '{}'::jsonb,'normal'),
('byteplus:seedream-5-pro','byteplus','dola-seedream-5-0-pro-260628','Dola Seedream 5.0 Pro','seedream','verified',array['text','image'],array['image'],array['image','editing','visual_reasoning','precision'], '{"multilingual":true}'::jsonb,'normal'),
('byteplus:seedance-2.5','byteplus','dreamina-seedance-2-5-260628','Dreamina Seedance 2.5','seedance','verified',array['text','image','video','audio'],array['video','audio'],array['video','multireference','identity','longer_video'], '{"max_reference_assets":50,"max_duration_seconds":30}'::jsonb,'normal'),
('alibaba:wan-2.7','alibaba',null,'Wan 2.7','wan','verified',array['text','image','video','audio'],array['video'],array['video','open_model','reference','cost'], '{}'::jsonb,'normal'),
('alibaba:qwen-current','alibaba',null,'Qwen Current Multimodal','qwen','verified',array['text','image','video'],array['text'],array['multimodal','extraction','open_model','cost'], '{}'::jsonb,'normal'),
('runway:gen-4.5','runway','gen4.5','Runway Gen-4.5','runway-gen','verified',array['text','image'],array['video'],array['video','cinematic','fast'], '{}'::jsonb,'normal'),
('runway:aleph-2','runway','aleph2','Runway Aleph 2','runway-aleph','verified',array['video','text','image'],array['video'],array['video_edit','reference'], '{}'::jsonb,'normal'),
('higgsfield:cinema-studio-3','higgsfield','cinematic_studio_3_0','Cinema Studio Video 3.0','higgsfield-cinema','verified',array['text','image'],array['video'],array['cinematic','premium','gateway'], '{}'::jsonb,'normal'),
('kling:3.0','kling','kling3_0','Kling 3.0','kling','verified',array['text','image'],array['video','audio'],array['multi_shot','motion','audio'], '{"verified_via":"higgsfield"}'::jsonb,'normal'),
('minimax:h3','minimax','minimax_h3','MiniMax H3','minimax','verified',array['text','image','video','audio'],array['video'],array['video','keyframes','reference','2k'], '{"verified_via":"higgsfield"}'::jsonb,'normal'),
('black_forest_labs:flux-2','black_forest_labs','flux_2','FLUX.2','flux','verified',array['text','image'],array['image'],array['image','prompt_adherence','editing'], '{"verified_via":"higgsfield"}'::jsonb,'normal'),
('recraft:v4.1','recraft','recraft_v4_1','Recraft V4.1','recraft','verified',array['text'],array['image','vector'],array['vector','logo','brand','typography'], '{"verified_via":"higgsfield"}'::jsonb,'normal')
on conflict (model_key) do update set
  provider_model_id=excluded.provider_model_id,
  display_name=excluded.display_name,
  family=excluded.family,
  input_modalities=excluded.input_modalities,
  output_modalities=excluded.output_modalities,
  route_tags=excluded.route_tags,
  capabilities=excluded.capabilities,
  deprecation_risk=excluded.deprecation_risk,
  updated_at=now();

insert into private.ai_benchmark_cases(case_key,task_type,description,risk_level,validators,score_weights) values
('property_extract_v1','property_extract','Extract structured real-estate facts without inventing missing data.','critical','["schema","source_grounding","numeric_exactness","missing_field_detection"]'::jsonb,'{"factual":0.45,"schema":0.2,"missing":0.2,"cost":0.1,"latency":0.05}'::jsonb),
('flyer_copy_v1','flyer_copy','Generate concise property marketing copy from verified structured facts.','high','["fact_lock","spelling","numbers","locale","length"]'::jsonb,'{"factual":0.35,"copy_quality":0.25,"text_accuracy":0.25,"cost":0.1,"latency":0.05}'::jsonb),
('flyer_render_v1','flyer_render','Create flyer visual while authoritative text is rendered deterministically.','critical','["protected_asset_hash","text_exactness","layout_overflow","brand_rules"]'::jsonb,'{"identity_fidelity":0.3,"property_fidelity":0.3,"text_accuracy":0.25,"visual_quality":0.1,"cost":0.05}'::jsonb),
('advisor_identity_v1','advisor_identity_preserve','Preserve advisor identity from canonical source assets.','critical','["protected_region_diff","face_identity_similarity","unauthorized_edit_detection"]'::jsonb,'{"identity_fidelity":0.7,"visual_quality":0.15,"cost":0.1,"latency":0.05}'::jsonb),
('property_fidelity_v1','property_fidelity_preserve','Preserve property geometry, finishes, layout and visible details from canonical assets.','critical','["protected_region_diff","geometry_consistency","unauthorized_object_change"]'::jsonb,'{"property_fidelity":0.75,"visual_quality":0.1,"cost":0.1,"latency":0.05}'::jsonb),
('video_reference_v1','video_generate','Generate real-estate video from protected references with consistent subject/property.','high','["frame_identity","property_consistency","temporal_consistency","prompt_adherence"]'::jsonb,'{"identity_fidelity":0.3,"property_fidelity":0.3,"temporal":0.2,"visual_quality":0.1,"cost":0.05,"latency":0.05}'::jsonb),
('review_council_v1','quality_review','Independently review a candidate output and identify release-blocking defects.','critical','["independence","defect_recall","false_pass_rate"]'::jsonb,'{"defect_recall":0.55,"false_pass":0.3,"cost":0.1,"latency":0.05}'::jsonb)
on conflict (case_key) do update set
  description=excluded.description,
  risk_level=excluded.risk_level,
  validators=excluded.validators,
  score_weights=excluded.score_weights,
  updated_at=now();