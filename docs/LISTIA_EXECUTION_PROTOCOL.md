# LISTIA Execution Protocol — Canonical

Status: MANDATORY
Scope: LISTIA only in this workstream.

## 1. Isolation rule
- Work only on LISTIA resources: LISTIA GitHub repository, LISTIA Supabase project, LISTIA Stripe catalog/webhooks, LISTIA Cloudflare resources, LISTIA Google/Drive assets and other LISTIA integrations.
- Do not read, modify, migrate, reuse, or deploy CloudSales resources from this workstream.

## 2. Mandatory preflight before substantive work
Before designing, coding, changing infrastructure, choosing a provider/model, or executing a material task:
1. Read the current conversation and the latest explicit user instruction.
2. Consult available LISTIA context from connected Drive/Library and prior canonical consolidations when relevant.
3. Check the current repository/source of truth for the component being changed.
4. Check live state in Supabase/Stripe/Cloudflare/other provider when the task depends on live configuration.
5. Resolve contradictions in favor of the newest explicit decision and record the resolution.
6. Define the smallest safe next change and its rollback boundary.

The goal is not to re-read every file blindly. The goal is to retrieve the relevant canonical material before acting so that decisions do not drift between chats.

## 3. Mandatory postflight after substantive work
After each completed block:
1. Verify the actual live/repository state instead of assuming deployment succeeded.
2. Run relevant security, data-integrity, billing, and functional checks.
3. Record exactly what changed.
4. Record what remains incomplete or unverified.
5. State the next recommended block.
6. Keep Supabase migrations/functions and GitHub synchronized when both changed.

## 4. Communication checkpoint
Every substantial progress report must communicate four things clearly:
- DONE — what is actually finished.
- VERIFIED — what was tested/confirmed and where.
- PENDING — what is still missing or blocked.
- NEXT — the next concrete action.

Never describe a commit as deployed, a configuration as active, a payment as verified, or an integration as connected unless it was actually checked.

## 5. Efficiency doctrine
LISTIA follows CloudCo's operating doctrine:
- maximum useful quality;
- minimum user friction;
- minimum unnecessary complexity;
- minimum avoidable cost;
- fastest safe path to production;
- provider portability;
- no repeated errors;
- no critical action without validation.

Connecting many providers is allowed. Calling every provider for every task is not the default. The router must select the smallest specialist set that can meet the quality target, then escalate only when confidence or validation fails.

## 6. Quality doctrine
- Target: zero known release errors and zero repeated known errors.
- No generative model is assumed infallible.
- Critical facts come from structured data or verified sources, never invention.
- Text shown to end users must be rendered deterministically when exact spelling matters.
- Original advisor/property assets are treated as immutable source assets unless the user explicitly requests modification.
- Any generative transformation that can alter identity, architecture, logos, legal text, prices, names, phone numbers, addresses, or other critical details must pass deterministic or cross-model validation before release.

## 7. Canonical-source hierarchy
When sources conflict, use this order unless the user explicitly overrides it:
1. newest explicit user instruction;
2. current live LISTIA state;
3. current LISTIA repository canonical docs/code;
4. newest LISTIA Drive/Library consolidation;
5. older project/chat material.

## 8. Change control
For every new engine/provider/integration:
- use a ProviderAdapter boundary;
- keep provider IDs/keys outside business logic;
- keep secrets server-side;
- log cost/latency/model/version/result/validation outcome;
- define fallback behavior;
- define quality thresholds;
- define deprecation/replacement path.

This file is the standing operational contract for LISTIA work.