create table if not exists private.ai_route_policies (
  task_type text not null,
  quality_tier text not null check (quality_tier in ('q0','q1','q2','q3','q4')),
  strategy text not null check (strategy in ('deterministic_only','single_then_validate','primary_review','primary_multi_review','deterministic_protected_generate')),
  primary_models text[] not null default '{}'::text[],
  reviewer_models text[] not null default '{}'::text[],
  fallback_models text[] not null default '{}'::text[],
  required_validators text[] not null default '{}'::text[],
  max_parallel integer not null default 1 check (max_parallel between 1 and 8),
  max_attempts integer not null default 2 check (max_attempts between 1 and 8),
  escalate_on_failure boolean not null default true,
  cost_ceiling_usd numeric(12,4),
  active boolean not null default true,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (task_type, quality_tier)
);

alter table private.ai_route_policies enable row level security;
revoke all on private.ai_route_policies from public, anon, authenticated;
grant all on private.ai_route_policies to service_role;

insert into private.ai_route_policies(task_type,quality_tier,strategy,primary_models,reviewer_models,fallback_models,required_validators,max_parallel,max_attempts,escalate_on_failure,notes) values
('property_extract','q1','single_then_validate',array['google:gemini-3.7-flash'],array[]::text[],array['alibaba:qwen-current','deepseek:v4-flash'],array['schema','source_grounding','numeric_exactness','missing_field_detection'],1,2,true,'Economy extraction. Escalate only if deterministic validators fail.'),
('property_extract','q2','primary_review',array['google:gemini-3.7-flash'],array['openai:gpt-5.6-sol'],array['anthropic:claude-sonnet-5','alibaba:qwen-current'],array['schema','source_grounding','numeric_exactness','missing_field_detection'],1,3,true,'Default LISTIA property extraction.'),
('property_extract','q3','primary_multi_review',array['google:gemini-3.7-flash'],array['openai:gpt-5.6-sol','anthropic:claude-opus-5'],array['alibaba:qwen-current','deepseek:v4-pro'],array['schema','source_grounding','numeric_exactness','missing_field_detection'],2,4,true,'Premium property extraction with independent review.'),
('property_extract','q4','primary_multi_review',array['google:gemini-3.7-flash','openai:gpt-5.6-sol'],array['anthropic:claude-opus-5'],array['alibaba:qwen-current','deepseek:v4-pro'],array['schema','source_grounding','numeric_exactness','missing_field_detection','cross_model_agreement'],2,5,true,'Critical extraction: independent specialists plus arbitration.'),
('flyer_copy','q1','single_then_validate',array['openai:gpt-5.6-luna'],array[]::text[],array['deepseek:v4-flash'],array['fact_lock','spelling','numbers','locale','length'],1,2,true,'Cheap copy generation; authoritative facts stay locked.'),
('flyer_copy','q2','primary_review',array['openai:gpt-5.6-terra'],array['anthropic:claude-sonnet-5'],array['google:gemini-3.7-flash'],array['fact_lock','spelling','numbers','locale','length'],1,3,true,'Default marketing copy route.'),
('flyer_copy','q3','primary_multi_review',array['openai:gpt-5.6-sol'],array['anthropic:claude-opus-5','google:gemini-3.7-flash'],array['deepseek:v4-pro'],array['fact_lock','spelling','numbers','locale','length','cross_model_agreement'],2,4,true,'Premium copy with cross-review.'),
('flyer_render','q2','deterministic_protected_generate',array['openai:gpt-image-2'],array['google:gemini-3.7-flash'],array['google:nano-banana-2','byteplus:seedream-5-pro','recraft:v4.1'],array['protected_asset_hash','text_exactness','layout_overflow','brand_rules'],1,3,true,'AI generates visual layers; authoritative text is rendered deterministically after generation.'),
('flyer_render','q3','deterministic_protected_generate',array['openai:gpt-image-2','byteplus:seedream-5-pro'],array['google:gemini-3.7-flash','anthropic:claude-sonnet-5'],array['google:nano-banana-2','recraft:v4.1'],array['protected_asset_hash','text_exactness','layout_overflow','brand_rules','cross_model_visual_review'],2,4,true,'Premium flyer visual exploration; final text remains deterministic.'),
('advisor_identity_preserve','q4','deterministic_only',array[]::text[],array['openai:gpt-5.6-sol','google:gemini-3.7-flash'],array[]::text[],array['protected_region_diff','face_identity_similarity','unauthorized_edit_detection'],1,1,false,'Exact identity uses original pixels/masks/compositing. Generative replacement of protected face/body is prohibited unless explicitly authorized.'),
('property_fidelity_preserve','q4','deterministic_only',array[]::text[],array['google:gemini-3.7-flash','openai:gpt-5.6-sol'],array[]::text[],array['protected_region_diff','geometry_consistency','unauthorized_object_change'],1,1,false,'Exact property fidelity uses protected original pixels and deterministic composition.'),
('video_generate','q2','single_then_validate',array['byteplus:seedance-2.5'],array['google:gemini-3.7-flash'],array['google:veo-3.1','runway:gen-4.5','kling:3.0','higgsfield:cinema-studio-3'],array['frame_identity','property_consistency','temporal_consistency','prompt_adherence'],1,3,true,'Default video route: Seedance first, only escalate on validation failure.'),
('video_generate','q3','primary_review',array['byteplus:seedance-2.5'],array['google:gemini-3.7-flash','openai:gpt-5.6-sol'],array['google:veo-3.1','runway:gen-4.5','kling:3.0','minimax:h3','higgsfield:cinema-studio-3'],array['frame_identity','property_consistency','temporal_consistency','prompt_adherence','cross_model_visual_review'],1,4,true,'Premium video route. Do not fan out expensive generation unless the first candidate fails.'),
('video_generate','q4','deterministic_protected_generate',array['byteplus:seedance-2.5'],array['google:gemini-3.7-flash','openai:gpt-5.6-sol','anthropic:claude-opus-5'],array['google:veo-3.1','runway:aleph-2','kling:3.0','minimax:h3'],array['protected_region_diff','frame_identity','property_consistency','temporal_consistency','prompt_adherence','human_gate_when_unresolved'],1,5,true,'Critical video preserves protected source regions; human gate if fidelity cannot be proven.'),
('quality_review','q2','primary_review',array['anthropic:claude-sonnet-5'],array['openai:gpt-5.6-sol'],array['google:gemini-3.7-flash'],array['defect_recall','false_pass_rate'],1,2,true,'Independent reviewer should differ from producing model when practical.'),
('quality_review','q4','primary_multi_review',array['anthropic:claude-opus-5'],array['openai:gpt-5.6-sol','google:gemini-3.7-flash'],array['xai:grok-4.6'],array['defect_recall','false_pass_rate','cross_model_agreement'],2,3,true,'Critical final quality council.')
on conflict (task_type,quality_tier) do update set
  strategy=excluded.strategy,
  primary_models=excluded.primary_models,
  reviewer_models=excluded.reviewer_models,
  fallback_models=excluded.fallback_models,
  required_validators=excluded.required_validators,
  max_parallel=excluded.max_parallel,
  max_attempts=excluded.max_attempts,
  escalate_on_failure=excluded.escalate_on_failure,
  notes=excluded.notes,
  updated_at=now();
