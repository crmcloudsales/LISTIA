# LISTIA Technology Stack — Canonical Cost-First Map

Status: CANONICAL
Scope: LISTIA only
Operating principle: **lowest cost that passes the required Quality Gate**.

## Product rule
The user operates LISTIA from the phone/PWA. Infrastructure, APIs, models, GPU runtimes, queues, compositors and provider selection remain invisible. Mobile-first does not mean inference runs on the phone; it means the phone is the complete control surface while LISTIA executes server-side work with minimum user friction.

## Cost rule
1. Deterministic/no-model solution first when it can satisfy the task.
2. Free/open-source/open-weight route next when its real operating cost and complexity are lower.
3. Low-cost pay-per-use API next.
4. Premium provider only when cheaper routes fail the required quality threshold.
5. Parallel expensive generation is reserved for Q3/Q4 or failed validation, never the default.
6. Optimize by **cost per accepted output**, not headline token/second price.
7. Avoid fixed subscriptions and always-on GPU infrastructure until measured volume proves them cheaper.
8. Third-party costs flow through Gestiones and plan markup.

## Core production architecture
### LISTIA Router
Owns task classification, plan/quality/privacy constraints, cost ceilings, provider independence and escalation.

### LiteLLM
Provider-normalization/gateway layer beneath LISTIA Router. It does not replace LISTIA business routing.

### LangGraph
Durable workflow/state/multi-agent orchestration. Preferred core orchestrator over ad-hoc chains.

### HyperFrames + FFmpeg
Deterministic media composition. Critical for preserving original property/advisor pixels and producing final formats without regenerating correct content.

### Langfuse + LISTIA ai_runs
Tracing, evaluation and benchmark observability. The Router learns from accepted-output quality/cost rather than vendor claims.

### vLLM
Production serving candidate for open-weight models when serverless/self-hosted economics beat API routes.

## Open/open-weight model pool
- NVIDIA Nemotron — reasoning, agents, review, coding candidate.
- Qwen2.5-Coder — coding/structured generation candidate.
- DeepSeek-Coder-V2 / DeepSeek open weights — coding/reasoning/cost candidate.
- StarCoder2 — fallback coding specialist.
- Wan — open-weight media/video cost-optimization candidate.
- Code Llama — historical/deferred only; not a priority production dependency.
- Ollama — development/local model runner; not automatically the production serving layer.

## Frontier/API reasoning and multimodal pool
- OpenAI API / GPT — core reasoning, structured output, tools, vision, review, image/audio specialists. Use cost-sensitive models before premium escalation.
- Google Gemini — core multimodal/documents/vision/Google ecosystem; free tier only for appropriate non-sensitive development/benchmark use.
- Anthropic Claude — independent review, arbitration, long-context and sensitive coding specialist; avoid routine premium use when cheaper models pass.
- DeepSeek API — cost-first text/reasoning/coding candidate.
- Kimi / Moonshot AI — benchmark candidate for agents, research, long context and coding; activate only after current API/cost/privacy benchmark.
- xAI Grok — benchmark/specialist for tasks where realtime/X/media value materially improves outcome.
- BytePlus Dola / Dola Seed — multimodal reasoning/agent candidate.

## Image / design pool
- LISTIA Design Engine — authoritative final text rendered with HTML/CSS/SVG/components.
- Nano Banana — Google image/edit candidate.
- Seedream — precision image/edit candidate.
- GPT Image — image generation/edit candidate.
- FLUX — prompt-adherence/edit candidate.
- Recraft — vector/logo/brand specialist.
- Midjourney — creative/manual benchmark only unless a supported official automation API is available and approved.

Critical rule: names, prices, phone numbers, addresses, CTAs and legal copy are structured data and deterministic typography, never trusted to rasterized generative text as final authority.

## Video pool
### Exact/preservation route — default when fidelity matters
Original property media + original/canonical advisor media -> HyperFrames/FFmpeg -> targeted lip-sync/animation only where authorized -> Quality Gate.

### Low-cost avatar/lip-sync candidates
- MuseTalk 1.5 — primary low-cost lip-sync candidate; GPU/serverless execution.
- EchoMimicV2 — photo-to-talking-advisor candidate when only photographs exist.

### Generative/cinematic candidates
- Seedance 2.5 — primary reference-heavy premium generation candidate.
- Seedance 2.0 — retained only if materially cheaper and still passes benchmarks.
- Wan — open-weight cost route.
- Runway — generation plus Aleph localized video edit/repair.
- Veo — premium cinematic escalation.
- Kling / MiniMax / Higgsfield routes — benchmark/fallback specialists.
- Grok Imagine Video — benchmark/specialist route.

### Repair
Runway Aleph 2.0 is especially valuable for localized repair/editing of existing video; it should not be the automatic first generator when a cheaper deterministic route works.

## Compute strategy
- Mobile user sees none of this.
- Google Cloud Run CPU is the first deployment candidate for the LiteLLM/LangGraph orchestration service because it can scale to zero and has a recurring free tier; keep minimum instances at zero while latency is acceptable.
- GPU execution remains benchmark-driven: compare Google Cloud Run GPU vs Modal vs RunPod by **cost per accepted output + cold-start latency**, not headline GPU price.
- Serverless/scale-to-zero GPU first for open media models while volume is low.
- Move to persistent vLLM/GPU infrastructure only after utilization proves lower total cost.

## Research / enrichment
- Crawl4AI — public-web research, SEO, structured extraction and comparables, isolated behind a browser/crawler service and subject to site terms/robots rules.

## Development Engine — not production dependencies
- OpenHands — autonomous/sandboxed coding work.
- OpenCode — provider-agnostic coding agent/CLI; controlled permissions required.
- Google Antigravity — free-tier development acceleration.
- Google Jules — asynchronous GitHub development agent.
- Google AI Studio / Gemini API Free — prototyping/benchmarks for appropriate non-sensitive material.
- Google Stitch — UI/design workflow.
- Google Opal — workflow/mini-app prototyping.
- GitHub Copilot Free — coding assistant.
- Windsurf / Codeium — optional coding assistant.

These tools help build LISTIA but are not required for a LISTIA end user to operate the PWA.

## Gateway / platform evaluation
- Bifrost — benchmark against LiteLLM; do not run duplicate gateways without measured benefit.
- Portkey — fallback/guardrail candidate.
- OpenRouter — convenient pay-per-use benchmark/model marketplace; direct provider wins when cheaper/better.
- Higgsfield — media gateway/specialist; direct providers remain when they give better economics/control.
- Dify — internal workflow/RAG prototyping only unless licensing is explicitly approved for the intended multi-tenant use.
- Open WebUI — internal model/testing UI only, not LISTIA product UI.
- Stirling PDF — do not embed the full engine assuming production use is free; use permissive PDF components instead.
- Abacus AI / ChatLLM — competitor/external benchmark, not core dependency.

## Naming normalization
User shorthand mapped to canonical names:
- Light LLM -> LiteLLM
- Langcraft -> LangGraph
- Quan -> Qwen
- CodeYama -> Code Llama
- Porky -> Portkey
- DeFi -> Dify
- Sterling PDF -> Stirling PDF
- ChatGPT in the backend -> OpenAI API/GPT models

## Quality levels
- Q0: deterministic only.
- Q1: cheapest qualified specialist + deterministic validation.
- Q2: primary + validators; reviewer only where policy requires it.
- Q3: stronger specialist + independent review + targeted repair.
- Q4: multiple independent checks/paths, protected assets and human approval if fidelity cannot be demonstrated.

## Video fidelity rule
A generative model cannot be assumed to preserve a property or advisor 100%. When 100% preservation is required, original pixels/assets are canonical. LISTIA must generate or modify only authorized regions and reject unauthorized changes.

## Activation lifecycle
A technology/model moves through:
`discovered -> verified -> adapter_ready -> benchmarked -> active -> fallback/deprecated`.

Mentioning or registering a technology never makes it runtime-ready. Credentials, adapter, health check and benchmark must all pass first.
