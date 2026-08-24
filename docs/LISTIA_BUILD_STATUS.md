# LISTIA Build Status — Live Checkpoint

Last reconciled: 2026-08-24
Scope: LISTIA only.

This file is updated after substantive implementation blocks. It is a checkpoint, not a substitute for live verification.

## DONE
- PWA onboarding through Google connection, Discovery, Business DNA and Office.
- Seven UI/property locales: ES, EN, FR, IT, PT-BR, DE, AR-AE.
- Canonical LISTIA commercial catalog: FREE US$0, PRO US$97/mo, PREMIUM US$147/mo, Premium extra seat US$47/mo.
- Portable billing, effective entitlements, Gestiones markup model and Stripe webhook architecture.
- Property intake, private material storage, processing-state pipeline and provider-neutral AI job queue.
- Property draft contract, missing-field handling and owner/admin draft approval.
- Office property workflow status, Leads screen and Agenda screen.
- Canonical LISTIA execution protocol.
- Canonical multimodel LISTIA AI Engine architecture.
- Canonical cost-first technology map in `docs/LISTIA_TECHNOLOGY_STACK_CANONICAL.md`.
- Canonical global usage/channel pricing map in `docs/LISTIA_USAGE_PRICING_CHANNELS_CANONICAL.md`.
- Canonical content/communications legal engineering rules in `docs/LISTIA_LEGAL_CONTENT_COMMUNICATIONS_CANONICAL.md`.
- Public Terms of Service and Privacy Policy updated to Version 1.1 effective 2026-08-24, adding omnichannel communications, Telegram constraints, multi-property remarketing, connected-content rights, synthetic-person consent, dynamic Gestiones and communication/privacy controls.
- Canonical media/distribution map including Zernio, HyperFrames, Runway Aleph 2.0, Seedance, Gemini, Veo, Pika, Higgsfield and supporting media/voice tools.
- Private technology registry classifying software/models as zero-license-cost, free-tier, open-weight-requires-compute, pay-per-use, subscription or mixed.
- Technology map covers NVIDIA Nemotron, LiteLLM, LangGraph, OpenHands, OpenCode, Google Antigravity, Google Jules, Google AI Studio/Gemini free tier, Google Stitch, Google Opal, GitHub Copilot Free, Windsurf/Codeium, Ollama, vLLM, Qwen2.5-Coder, DeepSeek-Coder-V2, StarCoder2, Code Llama, Crawl4AI, Langfuse, Bifrost, Portkey, Dify, Open WebUI, Stirling PDF, OpenRouter, Abacus AI, Grok, Kimi, Claude, OpenAI, Gemini, DeepSeek, Midjourney, Runway, Nano Banana, Seedance 2.5/2.0, Seedream, Wan, Dola, Higgsfield, Veo, HyperFrames, FFmpeg, MuseTalk, EchoMimic, Modal, RunPod and Google Cloud Run.
- Private AI provider/model registry, benchmark cases, route policies, runtime configuration and telemetry/model-score tables.
- All active AI routes use `lowest_cost_passing_quality` as default optimization objective; benchmark-aware cost metric is `cost_per_accepted_output`.
- `ai-route-plan` Edge Function v6 is authenticated and benchmark/runtime aware.
- MuseTalk 1.5 is default low-cost lip-sync candidate; EchoMimicV2 is default photo-only avatar candidate; HeyGen is premium fallback.
- `services/ai-orchestrator` scaffold exists with FastAPI + LiteLLM + LangGraph + Langfuse-compatible dependencies and Cloud Run-ready Dockerfile.
- Private `external_rate_cards` provides versionable provider pricing instead of hard-coding permanent customer action prices.
- Communication channel policy is now WhatsApp priority 1, SMS 2, Telegram 3, email 4, voice 5, all subject to consent/reachability/legal rules.
- `public.lead_contact_channels` provides per-lead omnichannel reachability, consent, opt-out and verification state.
- Private communication templates and dispatch audit tables exist.
- Initial `wa_property_remarketing_carousel_es` template is defined as MARKETING, draft, up to 10 relevant property cards; email and Telegram property-remarketing templates are also draft.
- Rate catalog includes direct Meta WhatsApp dynamic rates, Telnyx SMS/voice/number references, Telegram normal Bot API zero message-cost route, Amazon SES à-la-carte, GPT Image, Nano Banana, Seedream, Veo, Runway and direct Seedance token-rate references.

## VERIFIED
- LISTIA Supabase project: `zvzafiarwerbuoaccnoz` is the live backend used by this workstream.
- Current AI/technology registry: 51 technologies, 19 AI providers, 35 model entries and 27 active cost-first route policies.
- Current communication state: 41 active rate-card entries, 5 enabled channel policies and 3 active draft remarketing templates.
- No communication dispatch has been sent by this new engine yet; no lead channel rows have been backfilled yet. The new communication layer therefore creates no provider cost by itself.
- Current Stripe price-binding table contains 3 `test` bindings. No LIVE price binding was returned by the live database verification in this checkpoint; documentation must not claim production billing is live until LIVE bindings/credentials/webhook are verified.
- AI runs and benchmark scores remain intentionally 0 because no paid/provider execution has been activated yet.
- Provider runtimes remain disabled/not configured until real server-side credentials, adapters and health checks exist.
- `ai-route-plan` v6 is ACTIVE with JWT verification enabled.
- Supabase and GitHub are synchronized through migration 46 (`20260824092015_index_communication_dispatch_foreign_keys`).
- New private communications/rate tables are server-only. `lead_contact_channels` has authenticated organization-member SELECT RLS and service-role write access.
- New communication foreign-key indexes found by the performance advisor were fixed in migration 46.
- Security advisor shows expected INFO notices for intentionally policy-less private tables. Pre-existing Supabase Auth leaked-password-protection warning remains pending hardening.

## PENDING
- Backfill existing leads into `lead_contact_channels` after normalization/consent rules are finalized; never infer marketing consent merely from possession of a phone/email.
- Meta Cloud API/WhatsApp Business adapter and approved templates; current carousel remains draft until provider/WABA approval.
- Telnyx SMS/voice adapter and country-specific messaging/number registration profiles.
- Telegram Bot/Business adapter plus user-initiated reachability/connection flow.
- Amazon SES sending-domain verification, unsubscribe/suppression workflow and à-la-carte configuration.
- Country-level legal communication policy profiles before automated outbound campaigns scale globally.
- Build/test/deploy the AI orchestrator and stable ProviderAdapters.
- GPU serverless benchmark Cloud Run GPU vs Modal vs RunPod; MuseTalk/EchoMimic/HyperFrames accepted-output cost benchmarks.
- Content Engine full execution path from connected Drive/uploads to approved images/video/copy/distribution.
- Property extraction worker consuming `private.property_ai_jobs` and recording Gestiones/telemetry.
- Supabase Auth leaked-password protection hardening.
- Stripe LIVE bindings/credentials/webhook verification before claiming LIVE billing.

## NEXT
1. Build the communication-cost resolver: destination/country/category/provider -> current external rate -> actual Gestión -> markup.
2. Build omnichannel lead reachability/consent normalization without treating existing contact data as automatic marketing consent.
3. Build WhatsApp first because it is channel priority #1: Meta direct adapter, template approval state, multi-property carousel, inbound 24h/service-window handling and opt-out.
4. Add SMS via Telnyx, then Telegram reachable-chat flow, then SES email nurture/suppression.
5. Continue Content Engine cost benchmarks: HyperFrames/MuseTalk/EchoMimic first, premium generation only when required.
6. Continue AI orchestrator/ProviderAdapter/property-extraction work without allowing the communications branch to replace the existing roadmap.

## Standing release rule
No AI/provider output or outbound marketing communication is released merely because generation/routing succeeded. Required quality, consent, legal/platform, factual and cost gates must pass. When exact advisor/property preservation is required, protected original source content remains canonical.
