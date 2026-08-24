# LISTIA Media + Distribution Stack — Canonical Companion

Status: ACTIVE COMPANION MAP
Scope: LISTIA only.

This document prevents media/distribution tools from disappearing from the architecture merely because they are not all generative AI models.

## 1. Video editing — existing footage
### Runway Aleph 2.0 — PRIMARY CANDIDATE
Role: precise AI editing of existing video.
Why it matters to LISTIA:
- edits existing footage instead of regenerating the whole clip;
- localized changes with preservation of unaffected content;
- supports multi-shot edits;
- supports clips up to 30 seconds at up to 1080p;
- official API model id: `aleph2` through Runway video-to-video API;
- strongest current fit for LISTIA when property/advisor footage must stay intact except for explicitly authorized edits.

LISTIA route: `video_edit` Q2/Q3/Q4 uses `runway:aleph-2` as primary candidate, with deterministic protected-region validation.

### Seedance 2.5
Role: multimodal generation/edit/extension using image/video/audio references.
Best use: new cinematic clips, reference-driven generation, extension and alternate fallback when Aleph cannot satisfy an edit.

### Gemini Omni Flash
Role: conversational multimodal video generation/editing and visual reasoning.
Best use: review, interpretation, reference-driven video transformations and Google-native workflows.

### Runway Studio
Role: deterministic/non-generative assembly surface for trim, stitch, reorder and export after generated/edited clips pass QA.

## 2. Video generation specialists
- Seedance 2.5 — default reference-heavy generator candidate.
- Google Veo 3.1 — premium cinematic generation candidate.
- Runway Gen-4.5 — cinematic generation and Runway-native fallback.
- Kling 3.x — motion/multi-shot specialist.
- MiniMax/Hailuo — motion, expression, keyframe/reference specialist.
- Wan — open-model/cost-sensitive video candidate.
- Pika 2.5 — short social/ad clips and look-development specialist.
- Higgsfield Cinema Studio — cinematic specialist through Higgsfield surface.
- Grok Imagine Video — xAI video candidate.

## 3. Media gateways / aggregators
### Higgsfield
Role: connected multi-provider creative execution surface.
Current value: exposes multiple image/video/audio providers and reference-element workflows from one integration surface.
Policy: useful gateway, but direct adapters remain when they are cheaper, more capable, higher-quota or less dependent.

### Pika API Club
Role: current multi-model media gateway plus Pika's own models.
Current API covers video, image, audio, music and 3D, including third-party models behind one key/surface.
Policy: benchmark strongly for cost efficiency; never assume gateway price is best until measured against direct providers.
Runtime secret target: `PIKA_API_KEY`.

### Runway API
Role: both direct Runway provider and media model gateway. Current video-to-video surface supports Aleph 2.0 plus Seedance/Gemini Omni variants.
Policy: use direct Runway Aleph for video editing if benchmarks confirm preservation/cost advantage.

## 4. Image / flyer visual layer
- GPT Image 2 — strong typography/editing candidate, but authoritative LISTIA text remains deterministic.
- Nano Banana current family — fast Google image/editing candidate.
- Seedream 5.x — precise instruction/editing candidate.
- FLUX — prompt adherence/editing candidate.
- Recraft — vector/logo/brand/utility specialist.
- Higgsfield image surfaces — gateway/specialists.
- Pika API — alternative gateway for image models.

Critical rule: names, prices, phone numbers, addresses, CTAs and legal copy are never trusted to a generative image model as the final source. LISTIA renders them deterministically and validates exact text.

## 5. Voice/audio layer
- Native/device locale voices when quality is sufficient and marginal cost is near zero.
- BytePlus Seed Speech.
- OpenAI audio/realtime/transcription.
- xAI Voice.
- ElevenLabs as premium/specialist where its voice quality justifies cost.
- Higgsfield audio gateway.
- Pika API audio/music gateway candidates.

## 6. Social publishing / messaging / distribution
### Zernio — PRIORITY DISTRIBUTION ADAPTER
Zernio is NOT a video editor. It belongs after content creation/QA.
Role:
- one API for multi-platform social publishing/scheduling;
- video/image/carousel/Reels/Stories publishing;
- unified analytics;
- DMs/comments/inbox workflows;
- ads/boost workflows where supported;
- WhatsApp/SMS/calling/phone-number capabilities;
- webhooks;
- multi-tenant profiles/accounts;
- MCP/agent-friendly surface.

LISTIA use:
`Create/approve content -> Final Quality Gate -> Zernio adapter -> publish/schedule -> analytics -> feed results back to LISTIA`.

Zernio remains a priority integration candidate because it can replace many separate social platform integrations and reduce OAuth/maintenance friction. It must remain isolated behind a `DistributionAdapter`, not mixed into the generative AI Router.

## 7. Prior tools that remain on the map
The earlier LISTIA research explicitly included:
- Gemini Omni
- Veo
- Runway
- Pika
- Seedance
- ElevenLabs

None are deleted because a newer model is added. Each stays in the provider/tool registry until benchmarked, deprecated, replaced, or explicitly removed.

## 8. Architectural separation
LISTIA must keep these layers separate:
1. AI Engine — reasoning/generation/review.
2. Media Editor — precise edits and deterministic assembly.
3. Quality Engine — preservation, spelling, numbers, identity/property fidelity.
4. Distribution Engine — Zernio/social/email/messaging/ads.
5. Analytics/Learning — performance feedback changes future routing and creative decisions.

This separation lets LISTIA use many tools without turning the product into a tangle of vendor-specific code.
