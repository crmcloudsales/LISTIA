# LISTIA Media Cost Benchmark v0 — Engineering Estimate

Status: ENGINEERING ESTIMATE, NOT YET A MEASURED LISTIA PRODUCTION BENCHMARK
Date: 2026-08-24
Scope: LISTIA only

## Purpose
Establish conservative cost ceilings for the low-cost video path before deploying paid automation. These numbers combine published upstream throughput with current serverless compute pricing and explicit overhead/quality buffers.

LISTIA must replace these estimates with measured `cost_per_accepted_output` after real benchmark runs.

## Current Gestión markup targets
- FREE: +50%
- PRO: +25%
- PREMIUM: +12.5%
- Ordinary variable-cost safety range: 5%-50% where routing/standardization requires flexibility.
- Domains are separate: 50%-100% in every plan.

## Route A — HyperFrames + FFmpeg exact-source composition
Role: deterministic composition of real property/advisor assets without generatively rebuilding protected source content.

Upstream published rendering example:
- 240 frames / 8 seconds / 30fps
- capture: 8.2 seconds
- encode: 8.0 seconds
- total: about 16.2 seconds

A 10-second extrapolation is about 20.25 seconds of render time before container/storage overhead.

Current Cloud Run request-based reference pricing used for CPU estimate:
- CPU: US$0.000018 per vCPU-second
- memory: US$0.000002 per GiB-second

At a simple 2-vCPU / 4-GiB reference shape, 20.25 seconds is roughly US$0.000891 of raw CPU+memory compute. LISTIA intentionally budgets substantially above raw compute for container startup, media transfer/storage, FFmpeg variance and validation.

**Conservative accepted-output internal target: US$0.005 per <=10-second clip.**

Customer reference at plan targets:
- FREE: US$0.0075
- PRO: US$0.00625
- PREMIUM: US$0.005625

Quality expectation: highest fidelity path because original pixels/assets can remain authoritative. Any transform intended to preserve a protected source region must be verified deterministically.

## Route B — MuseTalk 1.5 lip-sync
Role: economical lip-sync/dubbing on existing advisor footage. Not a license to regenerate the entire advisor/property scene.

Upstream reports:
- real-time 30fps+ inference on NVIDIA Tesla V100
- MuseTalk 1.5 improves clarity, identity consistency and lip-speech synchronization
- reusable avatar preparation supports faster repeated generation for the same advisor

Current Modal reference:
- NVIDIA L4: US$0.000222/sec GPU

Even a deliberately conservative 60 seconds of L4 time is about US$0.01332 of raw GPU time before CPU, storage, startup and QA.

**Conservative accepted-output internal target: US$0.025 per <=10-second clip.**

Customer reference at plan targets:
- FREE: US$0.0375
- PRO: US$0.03125
- PREMIUM: US$0.028125

Quality expectation: strong lip-sync at low cost, but identity is not mathematically guaranteed. Must pass face/identity, protected-region and lip-sync validation before release.

## Route C — EchoMimicV2 avatar from a still photo
Role: fallback when LISTIA has no canonical advisor video and must animate a still image into a semi-body talking sequence.

Upstream accelerated benchmark:
- about 50 seconds for 120 frames on A100, improved from about 7 minutes
- if 120 frames represent roughly 5 seconds at ~24fps, a 10-second sequence is roughly 100 seconds of A100 inference before overhead

Current Modal reference:
- NVIDIA A100 80GB: US$0.000694/sec
- 100 seconds raw GPU time: about US$0.0694

LISTIA applies a much larger buffer because this path is more generative and therefore more likely to require preprocessing, cold-start, retries or Quality-Gate rejection.

**Conservative accepted-output internal target: US$0.16 per <=10-second clip.**

Customer reference at plan targets:
- FREE: US$0.24
- PRO: US$0.20
- PREMIUM: US$0.18

Quality expectation: useful fallback, but higher identity risk than using canonical real advisor footage. It must not be the default when a real reusable advisor video exists.

## Preferred economic order
1. HyperFrames/FFmpeg deterministic composition when generation is unnecessary.
2. MuseTalk on reusable canonical advisor footage when speech/lip-sync is needed.
3. EchoMimicV2 only when the advisor supplied still images but no canonical video.
4. Paid premium generation/editing providers only when the lower-cost route cannot satisfy the requested creative result or Quality Gate.

## What must happen before benchmark_guarded rows become production-billable
For each route, run a reproducible set of real LISTIA clips and record:
- actual startup time
- model/download/preparation time
- inference/render time
- CPU/GPU billed seconds
- storage/network cost
- validation/reviewer cost
- retries and rejected outputs
- advisor identity score
- property fidelity score
- lip-sync score where applicable
- accepted/rejected decision
- total `cost_per_accepted_output`

Minimum first benchmark: 5 representative clips per route; use more if variance is high.

## Sources checked 2026-08-24
- HyperFrames rendering guide: https://github.com/heygen-com/hyperframes/blob/main/docs/guides/rendering.mdx
- MuseTalk repository: https://github.com/jjt997/musetalk
- EchoMimicV2 repository: https://github.com/antgroup/echomimic_v2
- Modal pricing: https://modal.com/pricing
- Google Cloud Run pricing: https://cloud.google.com/run/pricing

## Release rule
These estimates establish economic feasibility, not final quality certification. `benchmark_required=true` remains in the LISTIA Price Book until measured LISTIA test outputs confirm both quality and margin.
