create table if not exists private.external_rate_cards (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  service_key text not null,
  country_code text,
  category text,
  direction text,
  unit text not null,
  currency text not null default 'usd',
  provider_rate numeric(20,8),
  pricing_mode text not null check (pricing_mode in ('fixed','from','variable_by_country','zero','benchmark_pending')),
  additive_fees text[] not null default '{}'::text[],
  source_url text,
  source_note text,
  valid_from date,
  last_verified_at timestamptz not null default now(),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_key, service_key, country_code, category, direction, unit)
);

create table if not exists private.communication_channel_policies (
  channel_key text primary key,
  priority integer not null check (priority between 1 and 100),
  enabled boolean not null default true,
  primary_provider text,
  fallback_provider text,
  consent_required boolean not null default true,
  user_initiation_required boolean not null default false,
  supports_remarketing boolean not null default true,
  supports_rich_property_set boolean not null default false,
  pricing_rule text not null default 'actual_cost_plus_plan_markup',
  legal_notes text,
  operational_notes text,
  updated_at timestamptz not null default now()
);

alter table private.external_rate_cards enable row level security;
alter table private.communication_channel_policies enable row level security;
revoke all on private.external_rate_cards from public, anon, authenticated;
revoke all on private.communication_channel_policies from public, anon, authenticated;
grant all on private.external_rate_cards to service_role;
grant all on private.communication_channel_policies to service_role;

insert into private.communication_channel_policies(channel_key,priority,primary_provider,fallback_provider,consent_required,user_initiation_required,supports_remarketing,supports_rich_property_set,legal_notes,operational_notes) values
('whatsapp',1,'meta_cloud_api','telnyx',true,false,true,true,'Use approved templates for business-initiated/out-of-window messaging; record opt-in, template category, locale, source and opt-out. Marketing outreach requires valid consent under applicable law and Meta policy.','Primary remarketing/contact channel. Prefer direct Meta Cloud API for lowest provider overhead; Telnyx remains fallback/unified CPaaS route.'),
('sms',2,'telnyx',null,true,false,true,false,'Respect country-specific A2P registration, sender-ID rules, quiet hours, opt-in/opt-out and carrier requirements.','Second contact route when WhatsApp is unavailable, undelivered, unconsented or unsuitable.'),
('telegram',3,'telegram_bot_api',null,true,true,true,true,'A normal Telegram bot cannot cold-start a private conversation. Use only after the user has initiated/connected a Telegram chat or where an authorized Telegram Business connection permits messaging.','Third contact route. Normal Bot API usage is effectively zero provider-message cost within standard limits; store Telegram chat reachability separately from phone reachability.'),
('email',4,'amazon_ses',null,true,false,true,true,'Marketing email requires lawful basis/consent as applicable, sender identification, unsubscribe and suppression handling.','Additional/parallel remarketing and nurture channel; use SES pay-as-you-go/à-la-carte while volume is low.'),
('voice',5,'telnyx',null,true,false,true,false,'Outbound automated/AI calling must comply with local telemarketing, consent, recording, caller-ID and do-not-call rules. Recording requires jurisdiction-aware consent.','Use for high-intent follow-up, inbound AI receptionist and escalations; not default first-touch remarketing where messaging is cheaper.')
on conflict (channel_key) do update set
  priority=excluded.priority,
  primary_provider=excluded.primary_provider,
  fallback_provider=excluded.fallback_provider,
  consent_required=excluded.consent_required,
  user_initiation_required=excluded.user_initiation_required,
  supports_remarketing=excluded.supports_remarketing,
  supports_rich_property_set=excluded.supports_rich_property_set,
  legal_notes=excluded.legal_notes,
  operational_notes=excluded.operational_notes,
  updated_at=now();

insert into private.external_rate_cards(provider_key,service_key,country_code,category,direction,unit,currency,provider_rate,pricing_mode,additive_fees,source_url,source_note,valid_from,last_verified_at) values
('meta_cloud_api','whatsapp_template',null,'marketing','outbound','delivered_message','usd',null,'variable_by_country',array[]::text[],'https://developers.facebook.com/docs/whatsapp/pricing','Canonical cost is Meta recipient-country/category rate. Direct Meta route avoids BSP platform markup.',null,now()),
('meta_cloud_api','whatsapp_template',null,'utility','outbound','delivered_message','usd',null,'variable_by_country',array[]::text[],'https://developers.facebook.com/docs/whatsapp/pricing','Canonical cost is Meta recipient-country/category rate.',null,now()),
('meta_cloud_api','whatsapp_template',null,'authentication','outbound','delivered_message','usd',null,'variable_by_country',array[]::text[],'https://developers.facebook.com/docs/whatsapp/pricing','Canonical cost is Meta recipient-country/category rate.',null,now()),
('telnyx','whatsapp_platform',null,null,'outbound','message','usd',0.004,'fixed',array['meta_whatsapp_fee'],'https://telnyx.com/pricing/whatsapp','Telnyx platform fee is added to Meta WhatsApp messaging fee.',null,now()),
('telnyx','sms','US',null,'outbound','message_part','usd',0.004,'from',array['carrier_fee','registration_or_sender_fees'],'https://telnyx.com/pricing/messaging','US local/10DLC base platform rate; carrier fees are additional and destination/sender-specific.',null,now()),
('telnyx','voice_api_platform',null,null,'inbound','minute','usd',0.002,'fixed',array['sip_trunking'],'https://telnyx.com/pricing/voice-api','Voice API platform fee; SIP origination fee is additional.',null,now()),
('telnyx','voice_api_platform',null,null,'outbound','minute','usd',0.002,'fixed',array['sip_trunking'],'https://telnyx.com/pricing/voice-api','Voice API platform fee; SIP termination fee is additional.',null,now()),
('telnyx','sip_trunking','US',null,'inbound','minute','usd',0.0032,'from',array[]::text[],'https://telnyx.com/pricing/elastic-sip','Starting local inbound SIP rate; actual route varies.',null,now()),
('telnyx','sip_trunking','US',null,'outbound','minute','usd',0.005,'from',array[]::text[],'https://telnyx.com/pricing/elastic-sip','Starting local outbound SIP rate; actual route varies.',null,now()),
('telnyx','voice_ai_engine','US',null,'both','minute','usd',0.05,'fixed',array['telephony','llm_tokens'],'https://telnyx.com/pricing/voice-ai-agents','AI voice engine includes orchestration/STT/TTS; telephony and LLM tokens are additive. Telnyx reference production example is about $0.056/min for US local inbound with Kimi.',null,now()),
('telnyx','phone_number','US','local',null,'number_month','usd',1.00,'from',array[]::text[],'https://telnyx.com/pricing/numbers','Starting US local number monthly price.',null,now()),
('telnyx','phone_number','MX','local',null,'number_month','usd',5.00,'from',array[]::text[],'https://telnyx.com/phone-numbers/mexico','Starting Mexico local number monthly price.',null,now()),
('telegram','bot_message',null,null,'outbound','message','usd',0,'zero',array[]::text[],'https://core.telegram.org/bots/api','Standard Bot API messaging has no per-message provider charge within normal broadcast limits; user/chat reachability rules still apply.',null,now()),
('amazon_ses','email_outbound',null,null,'outbound','1000_recipients','usd',0.10,'fixed',array['attachment_data','optional_features'],'https://aws.amazon.com/ses/pricing/','À-la-carte outbound rate. LISTIA should deliberately use pay-as-you-go/à-la-carte unless another SES plan is benchmarked cheaper.',null,now()),
('openai','gpt_image_1_mini_low',null,null,'generate','image_1024','usd',0.005,'fixed',array[]::text[],'https://developers.openai.com/api/docs/models/gpt-image-1-mini','Cost-first image generation reference; final text remains deterministic.',null,now()),
('openai','gpt_image_1_mini_medium',null,null,'generate','image_1024','usd',0.011,'fixed',array[]::text[],'https://developers.openai.com/api/docs/models/gpt-image-1-mini','Medium-quality 1024x1024 reference.',null,now()),
('openai','gpt_image_1_mini_high',null,null,'generate','image_1024','usd',0.036,'fixed',array[]::text[],'https://developers.openai.com/api/docs/models/gpt-image-1-mini','High-quality 1024x1024 reference.',null,now()),
('google','veo_3_1_lite_720p',null,null,'generate','video_second','usd',0.05,'fixed',array[]::text[],'https://ai.google.dev/gemini-api/docs/pricing','Premium generative-video reference; exact/composed open routes should be attempted first when fidelity permits.',null,now()),
('google','veo_3_1_fast_720p',null,null,'generate','video_second','usd',0.10,'fixed',array[]::text[],'https://ai.google.dev/gemini-api/docs/pricing','Fast generative-video reference.',null,now()),
('runway','gen4_turbo',null,null,'generate','video_second','usd',0.05,'fixed',array[]::text[],'https://docs.dev.runwayml.com/guides/pricing/','Budget Runway generation reference.',null,now()),
('runway','gen4_5',null,null,'generate','video_second','usd',0.12,'fixed',array[]::text[],'https://docs.dev.runwayml.com/guides/pricing/','Runway Gen-4.5 generation reference.',null,now()),
('runway','aleph2',null,null,'edit','video_second','usd',0.28,'fixed',array[]::text[],'https://docs.dev.runwayml.com/guides/pricing/','Localized premium video repair/editing; not default generation route.',null,now()),
('listia_gpu','musetalk_1_5',null,null,'lip_sync','video_second','usd',null,'benchmark_pending',array['gpu_compute','storage','egress'],'https://github.com/TMElyralab/MuseTalk','Cost is infrastructure-dependent; benchmark Cloud Run GPU/Modal/RunPod by accepted-output cost.',null,now()),
('listia_gpu','echomimic_v2',null,null,'avatar','video_second','usd',null,'benchmark_pending',array['gpu_compute','storage','egress'],'https://github.com/antgroup/echomimic_v2','Cost is infrastructure-dependent; benchmark before activation.',null,now()),
('hyperframes','deterministic_composition',null,null,'compose','render','usd',null,'benchmark_pending',array['cpu_compute','storage','egress'],'https://github.com/heygen-com/hyperframes','Software license cost is zero; operational compute/storage cost must be measured.',null,now())
on conflict (provider_key, service_key, country_code, category, direction, unit) do update set
  provider_rate=excluded.provider_rate,
  pricing_mode=excluded.pricing_mode,
  additive_fees=excluded.additive_fees,
  source_url=excluded.source_url,
  source_note=excluded.source_note,
  last_verified_at=excluded.last_verified_at,
  active=true,
  updated_at=now();