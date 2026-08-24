create table if not exists private.gestion_price_book (
  id uuid primary key default gen_random_uuid(),
  service_key text not null,
  display_name text not null,
  category text not null,
  unit text not null,
  pricing_mode text not null check (pricing_mode in ('fixed','included','provider_quote_plus_fee','benchmark_guarded')),
  price_free numeric not null default 0 check (price_free >= 0),
  price_pro numeric not null default 0 check (price_pro >= 0),
  price_premium numeric not null default 0 check (price_premium >= 0),
  currency text not null default 'USD',
  target_markup_free numeric not null default 30,
  target_markup_pro numeric not null default 20,
  target_markup_premium numeric not null default 10,
  minimum_margin_percent numeric not null default 5 check (minimum_margin_percent >= 0),
  requires_live_cost_check boolean not null default true,
  preapproval_required boolean not null default true,
  standing_budget_allowed boolean not null default false,
  customer_visible_provider boolean not null default false,
  benchmark_required boolean not null default false,
  global_scope text,
  exclusions jsonb not null default '{}'::jsonb,
  notes text,
  pricebook_version text not null default 'v1',
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(service_key, pricebook_version)
);

create table if not exists private.gestion_quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  service_key text not null,
  pricebook_version text not null,
  plan_key text not null check (plan_key in ('free','pro','premium')),
  quantity numeric not null default 1 check (quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  provider_quote_cost numeric check (provider_quote_cost is null or provider_quote_cost >= 0),
  service_fee numeric not null default 0 check (service_fee >= 0),
  total_authorized numeric not null check (total_authorized >= 0),
  currency text not null default 'USD',
  status text not null default 'offered' check (status in ('offered','approved','consumed','expired','cancelled','blocked')),
  expires_at timestamptz,
  approved_at timestamptz,
  consumed_at timestamptz,
  blocked_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists gestion_price_book_active_category_idx on private.gestion_price_book(active, category, service_key);
create index if not exists gestion_quotes_org_status_idx on private.gestion_quotes(organization_id, status, created_at desc);
create index if not exists gestion_quotes_expiry_idx on private.gestion_quotes(expires_at) where status='offered';
create index if not exists gestion_quotes_user_idx on private.gestion_quotes(user_id);

alter table private.gestion_price_book enable row level security;
alter table private.gestion_quotes enable row level security;
revoke all on private.gestion_price_book from anon, authenticated;
revoke all on private.gestion_quotes from anon, authenticated;
grant all on private.gestion_price_book to service_role;
grant all on private.gestion_quotes to service_role;

insert into private.technology_registry(technology_key,display_name,layer,decision,cost_class,license_class,self_hostable,user_visible,mobile_transparent,production_allowed,requires_external_compute,replaces_or_complements,roles,constraints,notes,verified_at)
values
('twilio','Twilio','platform','fallback','pay_per_use_no_fixed_fee','provider_terms',false,false,true,true,false,array['telnyx','meta_cloud_api'],array['voice','sms','whatsapp','phone_numbers','pricing_api','verify'],'{"live_pricing_api_required":true,"country_carrier_pricing":true}'::jsonb,'Fallback/benchmark CPaaS. LISTIA should query live Twilio Pricing APIs by country/number and route only when it improves cost, reach or reliability.',now()),
('telnyx','Telnyx','platform','core','pay_per_use_no_fixed_fee','provider_terms',false,false,true,true,false,array['twilio','meta_cloud_api'],array['voice','voice_ai','sms','whatsapp','phone_numbers','sip'],'{"live_pricing_required":true,"country_carrier_pricing":true}'::jsonb,'Primary cost-first communications candidate; actual route remains benchmark/price dependent.',now()),
('cloudflare','Cloudflare','platform','core','mixed','provider_terms',false,false,true,true,false,array['github','supabase'],array['registrar','pages','workers','r2','dns','cdn','ssl','waf','turnstile','images'],'{"registrar_at_cost":true,"pages_static_free_unlimited_requests":true,"workers_free_quota":true,"r2_free_egress":true}'::jsonb,'Core LISTIA infrastructure and user-facing infrastructure provider behind LISTIA. Registrar pricing is returned live by TLD; Pages/static hosting is free within current product rules; measurable paid usage is billed through Gestiones only when material.',now()),
('amazon_ses','Amazon SES','platform','core','pay_per_use_no_fixed_fee','provider_terms',false,false,true,true,false,array[]::text[],array['email','bulk_email','transactional_email'],'{"consent_and_suppression_required":true}'::jsonb,'Cost-first bulk/transactional email candidate.',now())
on conflict (technology_key) do update set
 display_name=excluded.display_name,layer=excluded.layer,decision=excluded.decision,cost_class=excluded.cost_class,license_class=excluded.license_class,self_hostable=excluded.self_hostable,user_visible=excluded.user_visible,mobile_transparent=excluded.mobile_transparent,production_allowed=excluded.production_allowed,requires_external_compute=excluded.requires_external_compute,replaces_or_complements=excluded.replaces_or_complements,roles=excluded.roles,constraints=excluded.constraints,notes=excluded.notes,verified_at=excluded.verified_at,updated_at=now();

insert into private.external_rate_cards(provider_key,service_key,country_code,category,direction,unit,currency,provider_rate,pricing_mode,additive_fees,source_url,source_note,valid_from,last_verified_at,active)
values
('cloudflare','r2_standard_storage',null,'standard',null,'gb_month','USD',0.015,'fixed',array[]::text[],'https://developers.cloudflare.com/r2/pricing/','R2 Standard storage; Internet egress from R2 is free under current pricing.',current_date,now(),true),
('cloudflare','pages_static_assets',null,'free_tier',null,'request','USD',0,'zero',array[]::text[],'https://developers.cloudflare.com/pages/functions/pricing/','Static asset requests are free and unlimited on both free and paid plans.',current_date,now(),true),
('cloudflare','workers_free',null,'free_tier',null,'100k_requests_day','USD',0,'zero',array[]::text[],'https://developers.cloudflare.com/workers/platform/pricing/','Workers Free quota applies; do not treat paid overage/minimum as zero.',current_date,now(),true),
('cloudflare','registrar',null,'registry_at_cost',null,'domain_year','USD',null,'from',array[]::text[],'https://developers.cloudflare.com/registrar/','Cloudflare charges registry + ICANN at cost; exact registration and renewal price must come from live Registrar search/check API.',current_date,now(),true),
('twilio','voice_outbound','US','local','outbound','minute','USD',0.014,'fixed',array[]::text[],'https://www.twilio.com/en-us/voice/pricing/us','Reference local outbound rate; live Pricing API controls routing.',current_date,now(),true),
('twilio','voice_outbound','MX','mobile','outbound','minute','USD',0.0473,'fixed',array[]::text[],'https://www.twilio.com/en-us/voice/pricing/mx','Reference mobile outbound rate; live Pricing API controls routing.',current_date,now(),true),
('twilio','voice_outbound','SA','mobile','outbound','minute','USD',0.3122,'fixed',array[]::text[],'https://www.twilio.com/en-us/voice/pricing/sa','Reference mobile outbound rate; live Pricing API controls routing.',current_date,now(),true),
('twilio','voice_outbound','ZW','mobile','outbound','minute','USD',0.8641,'fixed',array[]::text[],'https://www.twilio.com/en-us/voice/pricing/zw','High-cost ordinary mobile reference for global flat-rate safety.',current_date,now(),true),
('twilio','voice_outbound','SS','local','outbound','minute','USD',0.914,'fixed',array[]::text[],'https://www.twilio.com/en-us/voice/pricing/ss','High-cost ordinary geographic reference for global flat-rate safety.',current_date,now(),true),
('twilio','sms','US','long_code','outbound','message_part','USD',0.0083,'fixed',array['carrier_fee'],'https://www.twilio.com/en-us/sms/pricing/us','Carrier fees apply.',current_date,now(),true),
('twilio','sms','GB','mobile','outbound','message_part','USD',0.056,'fixed',array[]::text[],'https://www.twilio.com/en-us/sms/pricing/gb','Reference country rate.',current_date,now(),true),
('twilio','sms','FR','international','outbound','message_part','USD',0.0798,'fixed',array[]::text[],'https://www.twilio.com/en-us/sms/pricing/fr','Reference country rate.',current_date,now(),true),
('twilio','sms','MX','long_code','outbound','message_part','USD',0.1819,'fixed',array[]::text[],'https://www.twilio.com/en-us/sms/pricing/mx','Reference country rate.',current_date,now(),true),
('twilio','sms','SA','international','outbound','message_part','USD',0.1949,'fixed',array[]::text[],'https://www.twilio.com/en-us/sms/pricing/sa','Reference country rate.',current_date,now(),true),
('twilio','sms','ZA','mobile','outbound','message_part','USD',0.1355,'fixed',array[]::text[],'https://www.twilio.com/en-us/sms/pricing/za','Reference country rate.',current_date,now(),true),
('twilio','whatsapp_platform',null,null,'outbound','message','USD',0.005,'fixed',array['meta_template_fee'],'https://www.twilio.com/en-us/pricing/messaging','Twilio platform fee reference; Meta category/country fee is additional. Meta direct remains preferred when possible.',current_date,now(),true)
on conflict (provider_key,service_key,country_code,category,direction,unit) do update set
 currency=excluded.currency,provider_rate=excluded.provider_rate,pricing_mode=excluded.pricing_mode,additive_fees=excluded.additive_fees,source_url=excluded.source_url,source_note=excluded.source_note,valid_from=excluded.valid_from,last_verified_at=excluded.last_verified_at,active=true,updated_at=now();

insert into private.gestion_price_book(service_key,display_name,category,unit,pricing_mode,price_free,price_pro,price_premium,currency,target_markup_free,target_markup_pro,target_markup_premium,minimum_margin_percent,requires_live_cost_check,preapproval_required,standing_budget_allowed,customer_visible_provider,benchmark_required,global_scope,exclusions,notes,pricebook_version)
values
('property_content_language','Property content package / language','content','package','fixed',0.05,0.04,0.03,'USD',30,20,10,5,true,true,false,false,false,'Global','{}','Structured property description/copy/translation package for one language; provider hidden.', 'v1'),
('image_create_edit','Create or edit 1 image','content','image','fixed',0.10,0.09,0.08,'USD',30,20,10,5,true,true,false,false,false,'Global','{}','Up to standard production resolution. Router may use any qualified provider whose realized cost fits the approved customer price and Quality Gate.', 'v1'),
('flyer_social_creative','1 finished flyer/story/social creative','content','creative','fixed',0.15,0.14,0.12,'USD',30,20,10,5,true,true,false,false,false,'Global','{}','Includes copy/layout/one finished creative; verified factual text remains deterministic.', 'v1'),
('brochure_10_pages','Brochure up to 10 pages','content','brochure','fixed',0.75,0.65,0.55,'USD',30,20,10,5,true,true,false,false,false,'Global','{}','Uses source media by default and low-cost deterministic composition.', 'v1'),
('video_exact_10s','Exact-source video clip up to 10 seconds','video','10_seconds','benchmark_guarded',0.30,0.25,0.20,'USD',30,20,10,5,true,true,false,false,true,'Global','{}','HyperFrames/FFmpeg/MuseTalk/EchoMimic cost must be benchmarked before automated billing. Price is the customer ceiling once benchmark passes.', 'v1'),
('video_lipsync_10s','Lip-sync up to 10 seconds','video','10_seconds','benchmark_guarded',0.10,0.09,0.08,'USD',30,20,10,5,true,true,false,false,true,'Global','{}','MuseTalk-first; premium fallback cannot be used if it would exceed approved price.', 'v1'),
('video_avatar_photo_10s','Advisor avatar from photo up to 10 seconds','video','10_seconds','benchmark_guarded',0.30,0.25,0.20,'USD',30,20,10,5,true,true,false,false,true,'Global','{}','EchoMimic-first; requires advisor/person authorization and Quality Gate.', 'v1'),
('video_cinematic_standard_10s','Cinematic video clip up to 10 seconds','video','10_seconds','fixed',0.75,0.65,0.60,'USD',30,20,10,5,true,true,false,false,false,'Global','{}','Cost cap targets routes around $0.50/10 sec. Escalation above cap requires a new quote, never a surprise charge.', 'v1'),
('video_cinematic_premium_10s','Premium cinematic video clip up to 10 seconds','video','10_seconds','fixed',1.75,1.55,1.35,'USD',30,20,10,5,true,true,false,false,false,'Global','{}','For higher-cost generation only after user approval.', 'v1'),
('video_localized_repair_10s','Localized high-fidelity video repair up to 10 seconds','video','10_seconds','fixed',3.90,3.50,3.20,'USD',30,20,10,5,true,true,false,false,false,'Global','{}','Aleph-class repair only when lower-cost repair cannot pass Quality Gate.', 'v1'),
('whatsapp_marketing_message','WhatsApp marketing template delivered','communications','delivered_message','fixed',0.22,0.20,0.18,'USD',30,20,10,5,true,true,true,false,false,'Global Meta-supported recipient markets','{}','One global LISTIA price. Live Meta/Twilio/Telnyx cost check and consent/template approval required.', 'v1'),
('whatsapp_utility_auth_message','WhatsApp utility/auth template delivered','communications','delivered_message','fixed',0.09,0.08,0.07,'USD',30,20,10,5,true,true,true,false,false,'Global Meta-supported recipient markets','{}','One global LISTIA price. Marketing must never be misclassified as utility/authentication.', 'v1'),
('whatsapp_service_window_message','WhatsApp service-window message','communications','message','included',0,0,0,'USD',30,20,10,0,true,true,true,false,false,'Global where currently free under provider rules','{}','Current $0 customer rate only while direct-provider service-window economics remain zero; rate-card review required when Meta changes policy.', 'v1'),
('sms_global_part','SMS message part','communications','message_part','fixed',0.55,0.52,0.50,'USD',30,20,10,5,true,true,true,false,false,'Ordinary geographic A2P destinations worldwide where a compliant route exists','{"blocked_number_classes":["premium","satellite","special_service"]}','Flat global LISTIA rate per SMS segment. Router must choose cheapest compliant carrier route; if live cost cannot fit margin floor, block before send and trigger pricing review.', 'v1'),
('telegram_message','Telegram normal bot/business message','communications','message','included',0,0,0,'USD',30,20,10,0,true,true,true,false,false,'Reachable Telegram chats only','{}','No cold outreach from phone number alone. $0 customer price under ordinary Bot API limits; consent/reachability still required.', 'v1'),
('email_1000_recipients','Email delivery to 1,000 recipients','communications','1000_recipients','fixed',0.20,0.18,0.15,'USD',30,20,10,5,true,true,true,false,false,'Global','{}','SES-first. Data/attachment fees may require a separate quote if material.', 'v1'),
('ai_call_inbound_minute','AI-assisted inbound call','communications','minute','fixed',0.30,0.27,0.25,'USD',30,20,10,5,true,true,true,false,false,'Supported local geographic DIDs','{"blocked_number_classes":["premium","satellite","special_service","toll_free_high_surcharge"]}','Displayed as price per minute; actual duration can be prorated by seconds under a preapproved maximum call budget.', 'v1'),
('ai_call_outbound_minute','AI-assisted outbound call','communications','minute','fixed',1.25,1.15,1.10,'USD',30,20,10,5,true,true,true,false,false,'Ordinary geographic fixed/mobile destinations worldwide with compliant routing','{"blocked_number_classes":["premium","satellite","personal","special_service"]}','Flat global rate designed around high-cost ordinary geographic termination. Actual duration can be prorated by seconds; live route cost must fit margin floor before dialing.', 'v1'),
('local_business_number_month','Local business phone number','communications','number_month','fixed',10.00,9.00,8.00,'USD',30,20,10,5,true,true,true,false,false,'Supported countries/number inventory only','{"excluded":["mobile_numbers","toll_free","premium"]}','One standard LISTIA monthly price where a compliant local DID can be sourced below the safety ceiling. Otherwise offer an alternate country/number or dynamic quote.', 'v1'),
('domain_registration','Register 1 domain for 1 year','infrastructure','domain_year','provider_quote_plus_fee',1.00,0.75,0.50,'USD',30,20,10,0,true,true,false,false,false,'Cloudflare Registrar-supported standard domains','{"excluded":["premium_domain_registration_via_api"]}','price_* is the LISTIA service fee added to the exact live Cloudflare registry/ICANN quote. User sees one total annual price before approval.', 'v1'),
('domain_renewal','Renew 1 domain for 1 year','infrastructure','domain_year','provider_quote_plus_fee',0.50,0.40,0.30,'USD',30,20,10,0,true,true,false,false,false,'Cloudflare Registrar-supported domains','{}','price_* is the LISTIA service fee added to the exact live Cloudflare renewal quote.', 'v1'),
('website_static_hosting','Static website hosting on LISTIA/Cloudflare','infrastructure','site_month','included',0,0,0,'USD',30,20,10,0,true,true,false,false,false,'Within current Cloudflare Pages static/free quotas','{}','Static Pages asset requests are free; paid Functions/storage/other measurable usage is handled separately only if material.', 'v1'),
('r2_storage_gb_month','Content storage','infrastructure','gb_month','fixed',0.030,0.025,0.020,'USD',30,20,10,5,true,true,true,false,false,'Global','{}','Based on Cloudflare R2 Standard storage economics; free Internet egress is an important cost advantage.', 'v1')
on conflict (service_key,pricebook_version) do update set
 display_name=excluded.display_name,category=excluded.category,unit=excluded.unit,pricing_mode=excluded.pricing_mode,price_free=excluded.price_free,price_pro=excluded.price_pro,price_premium=excluded.price_premium,currency=excluded.currency,target_markup_free=excluded.target_markup_free,target_markup_pro=excluded.target_markup_pro,target_markup_premium=excluded.target_markup_premium,minimum_margin_percent=excluded.minimum_margin_percent,requires_live_cost_check=excluded.requires_live_cost_check,preapproval_required=excluded.preapproval_required,standing_budget_allowed=excluded.standing_budget_allowed,customer_visible_provider=excluded.customer_visible_provider,benchmark_required=excluded.benchmark_required,global_scope=excluded.global_scope,exclusions=excluded.exclusions,notes=excluded.notes,effective_from=now(),active=true,updated_at=now();