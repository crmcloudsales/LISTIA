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
- Canonical cost-first technology map in `docs/LISTIA_TECHNOLOGY_STACK_CANONICAL.md`.
- Canonical media/distribution map including Zernio, HyperFrames, Runway Aleph 2.0, Seedance, Gemini, Veo, Pika, Higgsfield and supporting media/voice tools.
- Private technology registry classifying software/models as zero-license-cost, free-tier, open-weight-requires-compute, pay-per-use, subscription or mixed.
- Technology map covers NVIDIA Nemotron, LiteLLM, LangGraph, OpenHands, OpenCode, Google Antigravity, Google Jules, Google AI Studio/Gemini free tier, Google Stitch, Google Opal, GitHub Copilot Free, Windsurf/Codeium, Ollama, vLLM, Qwen2.5-Coder, DeepSeek-Coder-V2, StarCoder2, Code Llama, Crawl4AI, Langfuse, Bifrost, Portkey, Dify, Open WebUI, Stirling PDF, OpenRouter, Abacus AI, Grok, Kimi, Claude, OpenAI, Gemini, DeepSeek, Midjourney, Runway, Nano Banana, Seedance 2.5/2.0, Seedream, Wan, Dola, Higgsfield, Veo, HyperFrames, FFmpeg, MuseTalk, EchoMimic, Modal, RunPod and Google Cloud Run.
- Private AI provider/model registry, benchmark cases, route policies, runtime configuration and telemetry/model-score tables.
- Dedicated routes for property extraction, flyer copy/render, protected advisor/property fidelity, video generation, video editing, avatar video, video translation, lip-sync, TTS and quality review.
- All active AI routes use `lowest_cost_passing_quality` as the default optimization objective.
- `ai-route-plan` Edge Function v6 performs authenticated route planning, runtime credential/health gating and benchmark-aware selection by `cost_per_accepted_output` when benchmark data exists.
- When no benchmark exists, the Router does not invent a cheaper winner; it preserves explicit policy order until real measurements exist.
- MuseTalk 1.5 is the default lip-sync candidate; HeyGen Precision is premium fallback only.
- EchoMimicV2 is the default photo-only advisor-avatar candidate; HeyGen is premium fallback only.
- Open-source media models are mapped to a disabled `listia_gpu` serverless runtime.
- Kimi/Moonshot is registered as a candidate but remains disabled until current API, cost, privacy and quality are revalidated.
- Google Cloud Run CPU is registered as the first deployment candidate for the CPU orchestrator because of scale-to-zero/free-tier economics; Cloud Run GPU joins Modal and RunPod as a benchmark candidate for open media models.
- `services/ai-orchestrator` scaffold now exists with FastAPI + LiteLLM + LangGraph + Langfuse-compatible dependencies, internal-token protection and a Cloud Run-ready Dockerfile.
- Current dependency majors were revalidated before checkpoint: LangGraph 1.x and Langfuse Python 4.x are used in the scaffold rather than obsolete ranges.

## VERIFIED
- LISTIA Supabase project: `zvzafiarwerbuoaccnoz` is the live backend used by this workstream.
- Current registry: 51 technologies, 19 AI providers, 35 model entries and 27 active cost-first route policies.
- Current `avatar_video` Q2/Q3/Q4 primary is `open_source_local:echomimic-v2`; HeyGen is fallback.
- Current `lip_sync` Q2/Q3 primary is `open_source_local:musetalk-1.5`; HeyGen is fallback.
- AI runs and benchmark scores remain intentionally 0 because no paid/provider execution has been activated yet.
- Provider runtimes remain disabled/not configured until a real server-side credential, adapter and health check exist.
- `ai-route-plan` v6 is ACTIVE with JWT verification enabled.
- Supabase and GitHub are synchronized through migration 42 (`20260824090050_add_google_cloud_run_cost_routes`).
- New AI/technology tables remain private/server-only. Security advisor shows expected INFO notices for intentionally policy-less private tables. The pre-existing Supabase Auth leaked-password-protection warning remains pending hardening.
- The AI orchestrator is intentionally scaffold-only and is NOT described as deployed or runtime-ready yet.

## PENDING
- Build/test the `services/ai-orchestrator` container and deploy it to the cheapest acceptable scale-to-zero CPU host; Cloud Run is first candidate.
- Stable ProviderAdapter execution implementations and provider health checks.
- Langfuse tracing wiring from actual executions into LISTIA telemetry.
- Reproducible benchmark execution. `ai_model_scores` remains empty until real test runs exist.
- GPU serverless execution adapter for `listia_gpu`, benchmarking Cloud Run GPU vs Modal vs RunPod by accepted-output cost and cold-start latency.
- MuseTalk/EchoMimic container/runtime benchmark using real advisor/property test assets.
- HyperFrames + FFmpeg deterministic media composer service.
- Video post-validation pipeline for property fidelity, advisor identity, lip-sync and temporal consistency.
- Property extraction worker consuming `private.property_ai_jobs`, executing Router routes, validating output, writing drafts and recording Gestiones/telemetry.
- Low-cost composite route for video translation/TTS so HeyGen is not the default there either.
- Deterministic protected-region image/compositing service and flyer typography/text validator.
- Zernio DistributionAdapter and `ZERNIO_API_KEY` after the Final Quality Gate.
- Cloudflare direct administrative connection remains separate from GitHub-triggered Pages deployment.

## NEXT
1. Build and smoke-test the orchestrator container locally/CI without provider secrets.
2. Deploy CPU orchestrator with scale-to-zero, preferably Cloud Run if account setup permits without introducing fixed cost.
3. Build the `listia_gpu` adapter and benchmark Cloud Run GPU vs Modal vs RunPod.
4. Run first MuseTalk vs paid-fallback lip-sync benchmark and EchoMimic avatar benchmark; populate `ai_model_scores` with accepted-output cost.
5. Build HyperFrames/FFmpeg composer so original property/advisor media remain canonical while LISTIA creates finished videos.
6. Implement `property_extract` execution path using the same cost-first Router.
7. Keep premium providers (Claude, OpenAI high-end models, Veo, Runway, HeyGen, etc.) as escalation unless benchmark data proves a better cost-quality outcome.

## Standing release rule
No provider output is published merely because generation succeeded. Required validators and the task-specific Final Quality Gate must pass. When exact advisor/property preservation is required, protected original pixels remain canonical and generative replacement of protected content is not accepted as proof of fidelity.
