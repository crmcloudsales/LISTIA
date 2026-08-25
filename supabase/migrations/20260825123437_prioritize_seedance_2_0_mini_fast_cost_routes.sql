insert into private.ai_models(model_key,provider_key,provider_model_id,display_name,family,lifecycle_status,input_modalities,output_modalities,route_tags,capabilities,deprecation_risk)
values
('byteplus:seedance-2.0-mini','byteplus','dreamina-seedance-2-0-mini-260615','Dreamina Seedance 2.0 Mini','seedance','verified',array['text','image','video','audio'],array['video'],array['video','cost_first','draft','social','image_to_video','multimodal_reference'],'{"max_duration_seconds":15,"max_resolution":"720p","audio_video_cogeneration":true,"pricing_usd_per_m_tokens":{"with_video":2.1,"without_video":3.5},"promo":{"discount_percent":60,"ends":"2026-09-07T23:59:59+08:00"}}'::jsonb,'normal'),
('byteplus:seedance-2.0-fast','byteplus','dreamina-seedance-2-0-fast-260128','Dreamina Seedance 2.0 Fast','seedance','verified',array['text','image','video','audio'],array['video'],array['video','cost_first','fast','social','image_to_video','multimodal_reference'],'{"max_duration_seconds":15,"max_resolution":"720p","audio_video_cogeneration":true,"pricing_usd_per_m_tokens":{"with_video":3.3,"without_video":5.6},"promo":{"discount_percent":25,"ends":"2026-09-07T23:59:59+08:00"}}'::jsonb,'normal')
on conflict (model_key) do update set provider_model_id=excluded.provider_model_id,display_name=excluded.display_name,family=excluded.family,lifecycle_status=excluded.lifecycle_status,input_modalities=excluded.input_modalities,output_modalities=excluded.output_modalities,route_tags=excluded.route_tags,capabilities=excluded.capabilities,deprecation_risk=excluded.deprecation_risk,updated_at=now();

update private.ai_route_policies
set primary_models=array['byteplus:seedance-2.0-mini'],
    fallback_models=array['byteplus:seedance-2.0-fast','byteplus:seedance-2.5','google:veo-3.1','runway:gen-4.5','kling:3.0','higgsfield:cinema-studio-3'],
    notes='Cost-first standard video route: Seedance 2.0 Mini first; Fast then 2.5 only if quality validation requires escalation. Promotional discounts increase LISTIA margin and do not automatically reduce public Gestion pricing.',
    updated_at=now()
where task_type='video_generate' and quality_tier='q2';

update private.ai_route_policies
set primary_models=array['byteplus:seedance-2.0-fast'],
    fallback_models=array['byteplus:seedance-2.5','google:veo-3.1','runway:gen-4.5','kling:3.0','minimax:h3','higgsfield:cinema-studio-3'],
    notes='Balanced cost/quality video route: Seedance 2.0 Fast first; Seedance 2.5 escalates when validators reject the cheaper result.',
    updated_at=now()
where task_type='video_generate' and quality_tier='q3';

update private.ai_route_policies
set primary_models=array['byteplus:seedance-2.5'],
    fallback_models=array['byteplus:seedance-2.0-fast','google:veo-3.1','runway:aleph-2','kling:3.0','minimax:h3'],
    notes='Critical fidelity route keeps Seedance 2.5 primary; Seedance 2.0 Fast may be used only when it passes all protected-region and identity/property validators.',
    updated_at=now()
where task_type='video_generate' and quality_tier='q4';