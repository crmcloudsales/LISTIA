# LISTIA AI Orchestrator

Server-side execution layer for LISTIA's cost-first multimodel architecture.

## Purpose
The PWA never calls model providers directly. Supabase authenticates the user/organization and produces an approved route. This service executes only the approved provider/model route and returns usage, latency and provider cost telemetry.

## Stack
- FastAPI — internal HTTP service.
- LiteLLM — normalized text/model provider transport.
- LangGraph — durable workflow/state layer.
- Langfuse — observability/evals when credentials are configured.
- LISTIA `ai_runs` — canonical billing/quality telemetry in Supabase.

## Security
- No provider secrets are stored in GitHub.
- `/v1/execute` requires `X-LISTIA-INTERNAL-TOKEN` matching `LISTIA_INTERNAL_TOKEN`.
- Do not expose `/v1/execute` directly to the public PWA.
- Organization authorization remains enforced before execution by LISTIA/Supabase.
- Provider/model selection must come from LISTIA Router; clients cannot choose arbitrary premium models.

## Cost policy
This service does not decide business routing. LISTIA Router does.
The canonical objective is `lowest_cost_passing_quality` and the measured metric is `cost_per_accepted_output`.

## Deployment candidate
First CPU host candidate: Google Cloud Run with minimum instances = 0. This keeps the orchestrator scale-to-zero and can use Cloud Run's recurring free tier. GPU media workers remain separate and are benchmarked across Cloud Run GPU, Modal and RunPod.

## Required environment
- `LISTIA_INTERNAL_TOKEN`
- Provider API keys only for adapters that have been explicitly enabled.
- Optional Langfuse credentials when tracing is enabled.

## Current status
Scaffold only. Do not mark this runtime healthy/active until:
1. container build passes;
2. health endpoint passes;
3. one authorized test provider call succeeds;
4. telemetry reconciles with provider usage;
5. benchmark output passes the appropriate LISTIA Quality Gate.
