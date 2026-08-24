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
- Private AI provider/model registry.
- Private benchmark-case registry.
- Private AI run telemetry/model score tables.
- AI route policies for property extraction, flyer copy/render, protected advisor/property fidelity, video generation and quality review.
- `ai-route-plan` Edge Function v2: authenticated route planning, organization/property authorization, candidate vs runtime-ready separation, validators/fallbacks/escalation metadata.

## VERIFIED
- LISTIA Supabase project: `zvzafiarwerbuoaccnoz` is the live backend used by this workstream.
- AI engine registry currently contains 16 providers, 26 model entries, 7 benchmark cases and 16 route policies.
- AI runs and benchmark scores are intentionally still 0 because no paid/provider execution has been activated yet.
- New AI tables are in the `private` schema, RLS-enabled, revoked from anon/authenticated and granted to service_role only.
- Security advisor reports only expected INFO notices for private RLS tables without client policies; these are intentionally server-only.
- Performance advisor found one new missing FK index on `ai_runs.provider_key`; migration `20260824060633_index_ai_runs_provider_key` fixed it.
- Supabase and GitHub are synchronized through migration 35 (`20260824060742_add_ai_route_policies`).
- `ai-route-plan` v2 is ACTIVE with JWT verification enabled.

## PENDING
- ProviderAdapter runtime layer. A model being registered/verified does not mean its API credential is configured in LISTIA.
- First production-capable AI adapter(s) and provider credentials stored server-side.
- Reproducible benchmark dataset assets and actual benchmark runs; `ai_model_scores` is empty until those run.
- Property extraction worker that consumes `private.property_ai_jobs`, calls the Router, executes the selected provider adapter, validates output, writes the draft contract and records Gestiones/telemetry.
- Deterministic protected-region image/compositing service for the 100% source-preservation requirement.
- Deterministic flyer typography renderer + exact-text validator.
- Video post-validation pipeline for identity/property/temporal consistency.
- Voice router and locale-native voice benchmark.
- Cloudflare direct administrative connection remains separate from GitHub-triggered Pages deployment.

## NEXT
1. Build the stable ProviderAdapter contract and runtime configuration registry without storing secrets in GitHub.
2. Implement the first `property_extract` execution path because it unlocks the existing property queue and drafts.
3. Start with a sparse benchmark pool, not all providers at once: one multimodal primary, one independent reviewer and one low-cost fallback; add providers behind the same adapter as credentials become available.
4. Record every provider call in `private.ai_runs` and every billable provider cost through Gestiones.
5. Only mark a model `adapter_ready` after a real server-side call succeeds; only mark it `benchmarked/active` after quality tests pass.

## Standing release rule
No provider output is published merely because generation succeeded. Required validators and the task-specific Final Quality Gate must pass. When exact advisor/property preservation is required, protected original pixels remain canonical and generative replacement of protected content is not accepted as proof of fidelity.
