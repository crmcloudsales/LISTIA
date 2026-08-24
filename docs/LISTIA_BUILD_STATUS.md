# LISTIA Build Status — Live Checkpoint

Last reconciled: 2026-08-24
Scope: LISTIA only.

This file is updated after substantive implementation blocks. It is a checkpoint, not a substitute for live verification.

## DONE
- PWA onboarding through Google connection, Discovery, Business DNA and Office.
- Seven UI/property locales: ES, EN, FR, IT, PT-BR, DE, AR-AE.
- LISTIA Stripe LIVE catalog: FREE internal, PRO US$97/mo, PREMIUM US$147/mo, Premium extra seat US$47/mo.
- Portable billing, effective entitlements, Gestiones markup model and Stripe webhook handling.
- Property intake, private material storage, processing-state pipeline and provider-neutral AI job queue.
- Property draft contract, missing-field handling and owner/admin draft approval.
- Office property workflow status, Leads screen and Agenda screen.
- Canonical LISTIA execution protocol.
- Canonical multimodel LISTIA AI Engine architecture.
- Canonical media/distribution companion map including Zernio, Runway Aleph 2.0, HeyGen, Seedance, Gemini Omni, Veo, Pika, Higgsfield and voice/media supporting tools.
- Private AI provider/model registry, benchmark cases, route policies, runtime configuration and telemetry/model-score tables.
- Dedicated routes for property extraction, flyer copy/render, protected advisor/property fidelity, video generation, video editing, avatar video, video translation, lip-sync, TTS and quality review.
- Runway Aleph registry normalized to `Aleph 2.0` / API model id `aleph2`.
- Pika API registered as candidate media gateway with runtime disabled until credentials/health checks exist.
- HeyGen registered as avatar/localization specialist with Avatar V, Avatar IV, Video Agent, Video Translation Precision, Precision Lipsync and Starfish Voice candidate entries.
- `ai-route-plan` Edge Function v5: authenticated route planning, organization/property authorization, runtime credentials/health gating and routing for `video_edit`, `avatar_video`, `video_translate`, `lip_sync` and `tts`.

## VERIFIED
- LISTIA Supabase project: `zvzafiarwerbuoaccnoz` is the live backend used by this workstream.
- HeyGen current API surface was verified against current official developer documentation before registration.
- HeyGen is deliberately assigned to advisor/avatar/localization workflows, not as the primary editor for protected property footage.
- Real-person advisor Digital Twins require explicit authorization/consent in LISTIA's route policy.
- HeyGen runtime is disabled and `not_configured` until a real LISTIA server-side `HEYGEN_API_KEY` and health check exist.
- AI runs and benchmark scores remain intentionally empty until actual provider execution starts.
- AI tables remain private/server-only.
- Supabase and GitHub are synchronized through migration 38 (`20260824065950_add_heygen_avatar_translation_stack`).
- `ai-route-plan` v5 is ACTIVE with JWT verification enabled.

## PENDING
- ProviderAdapter execution implementations and provider health-check function.
- HeyGen direct API adapter + `HEYGEN_API_KEY` before any HeyGen route can become runtime-ready.
- Runway API credential for Aleph 2.0 before `video_edit` can become runtime-ready.
- Pika API credential/benchmark before choosing it over direct providers.
- Zernio DistributionAdapter and `ZERNIO_API_KEY`.
- Reproducible benchmark datasets and actual benchmark runs.
- Property extraction worker consuming `private.property_ai_jobs`, executing the Router route, validating output, writing drafts and recording Gestiones/telemetry.
- Deterministic protected-region image/compositing service and flyer typography/text validator.
- Video post-validation and locale-native voice benchmarks.

## NEXT
1. Build the stable ProviderAdapter execution contract and health checks without storing secrets in GitHub.
2. Implement `property_extract` first to unlock the existing property queue/draft workflow.
3. Connect/benchmark Runway Aleph for protected video editing.
4. Connect/benchmark HeyGen for advisor avatar, translation, lip-sync and voice.
5. Add Zernio after the Final Quality Gate as DistributionAdapter.
6. Benchmark Pika/Higgsfield gateways against direct-provider accepted-output cost.
7. Mark runtimes configured/healthy only after real server-side calls succeed; mark models benchmarked/active only after reproducible quality tests pass.

## Standing release rule
No provider output is published merely because generation succeeded. Required validators and the task-specific Final Quality Gate must pass. When exact advisor/property preservation is required, protected original pixels remain canonical and generative replacement of protected content is not accepted as proof of fidelity.
