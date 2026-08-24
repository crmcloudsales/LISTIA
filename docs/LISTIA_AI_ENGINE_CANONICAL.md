# LISTIA AI Engine — Canonical Architecture

Status: CANONICAL BASELINE
Objective: build a provider-portable multimodel engine that maximizes quality, consistency, cost efficiency, speed, and user simplicity.

## Core principle
LISTIA sells outcomes, not model names. Providers can be added, removed, upgraded, benchmarked, or replaced without changing LISTIA's product contract.

The engine may connect to many providers, but it must not call every model on every request. It uses routing, specialist pools, deterministic validators, cross-model review, and escalation.

## Architecture
1. Task Classifier — identifies task type, risk, required modalities and fidelity constraints.
2. AI Router — chooses the smallest qualified provider set using quality, cost, latency, locale, availability and historical success.
3. Provider Adapters — one stable internal contract per provider/gateway.
4. Generation/Reasoning Specialists — execute the task.
5. Deterministic Validators — schema, facts, spelling, dimensions, asset hashes, prices, phones, URLs, brand rules and other machine-checkable requirements.
6. AI Review Council — independent model review for ambiguous/creative/high-risk outputs.
7. Repair Loop — targeted correction, never blind regeneration of an already-correct asset.
8. Final Quality Gate — release only when mandatory checks pass.
9. Cost & Telemetry Engine — logs provider/model/version, latency, cost, retries, validation scores and failure reason.
10. Learning Layer — benchmark history informs future routing without coupling business logic to one vendor.

## Non-negotiable preservation rule
Generative models cannot truthfully guarantee pixel-perfect identity or architecture after regeneration. Therefore LISTIA's 100% preservation requirement is implemented deterministically:
- original advisor/property images remain immutable canonical assets;
- when exact identity or property geometry must remain unchanged, preserve original pixels and compose/generate around them rather than regenerating them;
- masks/crops/compositing may alter only explicitly authorized regions;
- post-generation comparison detects unauthorized changes;
- failure means repair/retry/fallback, never silent release.

## Exact-text rule for flyers and ads
Do not rely on image generators to spell critical text.
- Copy is generated/reviewed as structured text.
- Names, prices, phones, addresses, CTAs and legal text come from verified structured data.
- Final typography is rendered with HTML/CSS/SVG/Canvas/PDF or another deterministic renderer.
- OCR/text extraction validates the rendered result against the source string.
- A second validator checks language, punctuation, numbers and layout overflow.
- Creative image models generate backgrounds/visual elements, not the authoritative text layer.

## Provider registry — initial canonical pool
### Reasoning, orchestration, coding, review
- OpenAI — frontier reasoning/tool use; GPT family; GPT Image 2 for image generation/editing.
- Anthropic — Claude family for long-horizon reasoning, coding, review and arbitration.
- Google — Gemini for multimodal understanding, documents, Google-native workflows and agentic tools.
- xAI — Grok for reasoning, image/video/voice APIs and real-time/X-oriented tasks where useful.
- DeepSeek — cost-efficient reasoning/coding fallback and large-context workloads.
- Alibaba/Qwen — multimodal understanding, structured extraction, open-model options and cost-sensitive routing.
- BytePlus Dola Seed — multimodal reasoning/agent tasks where benchmarks justify it.
- Microsoft Foundry/Phi/open-model catalog — optional gateway and edge/local candidates; not a reason to duplicate paid calls when direct providers are superior.
- Open-source/self-hosted pool — Qwen, DeepSeek open weights, Wan, Phi, Llama, Mistral and task-specific models when local/self-hosted economics or privacy justify them.

### Image generation/editing
- OpenAI GPT Image 2.
- Google Nano Banana / current Gemini image models.
- BytePlus Seedream 5.x.
- xAI Grok Imagine Image.
- Black Forest Labs FLUX family.
- Recraft for vector/logo/brand utility where appropriate.
- Higgsfield image layer as a multi-provider execution surface and specialist source.
- Midjourney may be used manually for creative benchmarking/reference only while no official automation API is available; unauthorized automation is prohibited.

### Video generation/editing
- BytePlus Dreamina Seedance 2.5 / current Seedance family.
- Google Veo 3.1/current Veo family.
- Runway Gen-4.5 / Aleph/current Runway family.
- Alibaba Wan current family, including open-weight options where appropriate.
- xAI Grok Imagine Video.
- Kling current family.
- MiniMax/Hailuo current family.
- Higgsfield Cinema Studio and Higgsfield's multi-provider video surface.
- Other providers enter only through benchmark + adapter + quality-gate process.

### Voice/audio
- Prefer local/device voices when they satisfy locale and commercial requirements at near-zero marginal cost.
- BytePlus Seed Speech is a candidate for TTS/STT and voice replication.
- OpenAI realtime/audio/transcription models are candidates for conversational voice and transcription.
- xAI Voice API is a candidate.
- ElevenLabs can remain a specialist option where its quality justifies usage cost.
- Higgsfield audio routing can expose multiple engines through one surface.

### Supporting media quality tools
- deterministic compositing/HTML/CSS/SVG/Canvas/PDF;
- FFmpeg for video assembly/transcoding;
- ImageMagick/sharp for deterministic image processing;
- Topaz/upscaling/deflicker/background removal where benchmarked;
- OCR/text validators only as verification, not as source-of-truth authoring;
- perceptual/image-difference validation for protected regions;
- asset hashes and immutable originals for auditability.

## Higgsfield role
Higgsfield is both a specialist provider and a useful multi-provider execution surface. Current connected capabilities include models from Higgsfield, OpenAI, Google, ByteDance/Seedance/Seedream, xAI, Kling, Wan, MiniMax, FLUX and others. LISTIA should still preserve direct-provider adapters where direct access gives lower cost, better controls, higher quotas or less vendor dependency.

## Direct provider vs gateway rule
Use direct provider when it is materially better for price, feature completeness, fidelity, latency, quota or contractual stability. Use a gateway such as Higgsfield, Runway model routing, Microsoft Foundry or another aggregator when it reduces integration cost or unlocks models without sacrificing quality/economics. The same internal task contract must work either way.

## Quality routing levels
- Q0 deterministic: no model needed.
- Q1 economy: one low-cost specialist + deterministic validators.
- Q2 standard: primary specialist + validator model + deterministic checks.
- Q3 premium: best specialist + independent reviewer + targeted repair loop.
- Q4 critical: multiple independent specialists/reviewers, deterministic preservation, human approval when facts/identity/legal/financial actions cannot be safely automated.

## Benchmark dimensions
Each provider/model/version must be benchmarked on relevant tasks using a reproducible dataset:
- factual accuracy;
- structured-output validity;
- text/spelling accuracy;
- advisor identity preservation;
- property/architecture preservation;
- prompt adherence;
- visual quality;
- temporal/video consistency;
- native audio quality;
- multilingual performance;
- latency;
- failure/retry rate;
- cost per accepted output;
- commercial/API availability;
- portability/deprecation risk.

The winner is not the model with the prettiest single demo. It is the route with the best accepted-output quality per unit of cost, latency and risk.

## Release policy
No output is published merely because one model says it is good. Publication requires the task-specific Final Quality Gate. Critical failures block release. Repeated failure on one provider triggers fallback or escalation.

## Provider lifecycle
Every provider/model has states: discovered -> verified -> adapter-ready -> benchmarked -> active -> fallback -> deprecated -> removed.
A model name in a conversation does not make it active. Only the registry + benchmark + configured credentials + working adapter do.

## Immediate implementation order
1. Provider registry schema + telemetry.
2. Stable adapter interface.
3. Text/reasoning adapters first.
4. Image pipeline with deterministic text composition and protected-region fidelity checks.
5. Video pipeline with reference assets, frame/identity checks and post-processing.
6. Voice router.
7. Cross-model Review Council and repair loop.
8. Cost-based dynamic routing and continuous benchmarks.

This file is the single canonical model/provider architecture for LISTIA and must be updated when a provider/model decision changes.