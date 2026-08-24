# LISTIA Global Usage Pricing & Channel Economics

Status: CANONICAL COST MODEL
Last verified: 2026-08-24
Currency: USD unless provider bills otherwise.
Scope: LISTIA only.

## Core commercial rule
LISTIA does not hard-code a permanent customer price for third-party-powered actions. The canonical formula is:

`provider_actual_cost -> LISTIA plan markup -> final_user_cost`

- FREE: +30%
- PRO: +20%
- PREMIUM: +10%

All billable third-party activity must create a Gestión/usage record with provider, service, actual provider cost, currency, plan at time of use, markup, LISTIA revenue, final user cost, organization/user and external reference.

Provider rates may change by country, carrier, sender type, destination, message category, model, resolution, duration, token use, taxes, regulatory fees or volume tier. `private.external_rate_cards` is the operational rate registry; the provider invoice/API response remains the final actual-cost source of truth.

## Contact priority
1. WhatsApp
2. SMS
3. Telegram
4. Email as additional/parallel nurture and remarketing channel
5. Voice for high-intent follow-up, inbound receptionist and escalation

The cheapest channel is not automatically used. LISTIA first checks reachability, consent/lawful basis, provider/platform rules, lead intent, delivery history and expected conversion value.

## Communications — current reference economics
| Service | Current LISTIA primary route | Provider cost reference | FREE | PRO | PREMIUM | Notes |
|---|---|---:|---:|---:|---:|---|
| WhatsApp marketing template | Meta Cloud API direct | Variable by recipient market/category | cost ×1.30 | cost ×1.20 | cost ×1.10 | Direct Meta avoids an extra BSP platform fee. |
| WhatsApp utility/auth template | Meta Cloud API direct | Variable by recipient market/category | cost ×1.30 | cost ×1.20 | cost ×1.10 | Category must be accurate; do not disguise marketing as utility. |
| WhatsApp via Telnyx fallback | Telnyx | Meta fee + $0.004/message | actual ×1.30 | actual ×1.20 | actual ×1.10 | Use as fallback/unified CPaaS where it provides operational benefit. |
| SMS US local/10DLC | Telnyx | from $0.004/message part + carrier/regulatory fees | actual ×1.30 | actual ×1.20 | actual ×1.10 | Global SMS is destination/sender/carrier specific. |
| Telegram normal Bot API | Telegram | $0/message within normal limits | $0 | $0 | $0 | User/chat must already be reachable; no cold outreach from a phone number. |
| Email marketing | Amazon SES à-la-carte | $0.10 / 1,000 recipients | $0.13 | $0.12 | $0.11 | Attachments/data and optional features can add cost. |
| US local DID/number | Telnyx | from $1/month | $1.30 | $1.20 | $1.10 | Actual country/number type may differ. |
| Mexico local DID/number | Telnyx | from $5/month | $6.50 | $6.00 | $5.50 | Actual inventory/number type may differ. |
| US inbound voice, telephony only | Telnyx | from ~$0.0052/min ($0.002 Voice API + $0.0032 SIP) | ~$0.00676 | ~$0.00624 | ~$0.00572 | Excludes AI, recording and other optional features. |
| US outbound voice, telephony only | Telnyx | from ~$0.007/min ($0.002 Voice API + $0.005 SIP) | ~$0.00910 | ~$0.00840 | ~$0.00770 | Destination-dependent globally. |
| AI voice inbound, US local reference | Telnyx | from ~$0.0552/min + LLM tokens | ~$0.07176 + token markup | ~$0.06624 + token markup | ~$0.06072 + token markup | $0.05 voice engine + telephony. |
| AI voice outbound, US local reference | Telnyx | from ~$0.057/min + LLM tokens | ~$0.07410 + token markup | ~$0.06840 + token markup | ~$0.06270 + token markup | Destination-dependent globally. |

### WhatsApp example — Mexico
Current public 2026 rate-card references show approximately $0.0305 per delivered Marketing template and $0.0085 per Utility/Authentication template in Mexico. These are examples only; LISTIA must resolve the current Meta rate for the recipient market at send time.

| Mexico example | Provider | FREE | PRO | PREMIUM |
|---|---:|---:|---:|---:|
| Marketing template | $0.0305 | $0.03965 | $0.03660 | $0.03355 |
| Utility/Auth template | $0.0085 | $0.01105 | $0.01020 | $0.00935 |

## WhatsApp multi-property remarketing template
LISTIA will maintain approved MARKETING templates rather than asking the user to design them.

Canonical Spanish template key: `wa_property_remarketing_carousel_es`.

Behavior:
- Trigger only when consent/reachability and applicable rules allow it.
- Present 2–10 relevant available properties in one carousel where supported.
- Rank cards by lead budget, requested location, bedrooms/typology, intent and availability.
- The requested property may be card 1; additional cards expand choice rather than blindly repeating the same listing.
- Each card uses verified property facts/media and a property/schedule CTA.
- Store template approval/category/locale/provider ID server-side.
- Marketing content must stay categorized as MARKETING; LISTIA must not attempt to lower cost by misclassifying it as Utility.
- Opt-outs immediately suppress future marketing on that channel.

## Content Engine — image economics
Final property facts, prices, names, phone numbers, addresses, CTAs and legal text are rendered deterministically. Generative models are used for authorized visual creation/editing, not as the authoritative text renderer.

| Image route | Provider cost reference | FREE | PRO | PREMIUM | Role |
|---|---:|---:|---:|---:|---|
| GPT Image 1 mini Low 1024×1024 | $0.005/image | $0.0065 | $0.0060 | $0.0055 | Cheapest current API visual route when quality passes. |
| GPT Image 1 mini Medium | $0.011 | $0.0143 | $0.0132 | $0.0121 | Default candidate when Low fails quality. |
| Nano Banana 2 Lite 1K | ~$0.0336 | ~$0.04368 | ~$0.04032 | ~$0.03696 | Google editing/generation specialist. |
| Seedream 5 Lite | ~$0.035 | ~$0.0455 | ~$0.0420 | ~$0.0385 | Precision/subject-consistency candidate. |
| GPT Image 1 mini High | $0.036 | $0.0468 | $0.0432 | $0.0396 | Higher-quality cost-first OpenAI route. |
| Seedream 5 Pro <=2.36MP output | $0.045 | $0.0585 | $0.0540 | $0.0495 | Precision editing specialist. |
| Nano Banana 2 1K | ~$0.067 | ~$0.0871 | ~$0.0804 | ~$0.0737 | Use only when quality advantage justifies cost. |

Input tokens/images can add small provider costs for some models. Actual cost recorded in Gestiones controls final billing.

## Content Engine — video economics
LISTIA's first choice for fidelity-critical real estate content is not to regenerate correct source media. Original property/advisor pixels + HyperFrames/FFmpeg + targeted low-cost animation/lip-sync should be attempted first. Open-source/GPU routes remain `benchmark_pending` until real accepted-output tests are run.

| 10-second reference route | Provider cost | FREE | PRO | PREMIUM | Intended use |
|---|---:|---:|---:|---:|---|
| HyperFrames/FFmpeg exact composition | software $0; compute benchmark pending | actual ×1.30 | actual ×1.20 | actual ×1.10 | Default exact-property composition. |
| MuseTalk 1.5 lip-sync | GPU benchmark pending | actual ×1.30 | actual ×1.20 | actual ×1.10 | Low-cost default lip-sync. |
| EchoMimicV2 avatar from photo | GPU benchmark pending | actual ×1.30 | actual ×1.20 | actual ×1.10 | Only when canonical advisor video is unavailable. |
| Veo 3.1 Lite 720p | $0.50 | $0.65 | $0.60 | $0.55 | Premium generative video with audio. |
| Runway Gen-4 Turbo | $0.50 | $0.65 | $0.60 | $0.55 | Fast generative route. |
| Runway Gen-4.5 | $1.20 | $1.56 | $1.44 | $1.32 | Stronger cinematic generation. |
| Seedance 2 Mini via Runway | $1.60 | $2.08 | $1.92 | $1.76 | Reference-heavy candidate; direct BytePlus may price differently and must be benchmarked. |
| Runway Aleph 2 localized edit | $2.80 | $3.64 | $3.36 | $3.08 | Repair only when cheaper methods cannot preserve/fix footage. |

Veo 3.1 Lite 1080p is $0.08/sec; Fast is $0.10/sec 720p/$0.12/sec 1080p. BytePlus Seedance 2.5 and 2.0 use token/resolution/input-sensitive pricing on direct ModelArk, so LISTIA stores actual realized cost rather than pretending they have one universal per-second price.

## Content creation from Drive/uploads
When the organization connects Drive or uploads material, Content Engine may create or edit, subject to permissions and plan/usage:
- normalized property records and verified facts;
- listing descriptions and translations;
- flyers, stories, social posts, banners and brochures;
- deterministic text/layout variants by format and locale;
- property videos/reels using source media, composition, voice/lip-sync and premium generation only when needed;
- website/property-page copy, blogs and SEO content;
- email campaigns;
- WhatsApp/SMS/Telegram remarketing assets;
- ad creative and campaign variants.

Every paid provider call is a Gestión. Deterministic/local/open-source work may have no provider license fee but can still have measurable compute/storage/egress cost; when material, that actual infrastructure cost is treated like third-party usage under the same markup formula.

## Routing rule
For every content or communication task:
1. Validate rights/consent and source facts.
2. Try deterministic/free/open route when it can meet quality.
3. Try lowest-cost qualified provider.
4. Run Quality Gate.
5. Repair only failed regions/components.
6. Escalate to premium provider only if needed.
7. Bill only realized actual provider/infrastructure cost, plus plan markup.

The optimization metric is **cost per accepted output**, not headline price per token, image, second or minute.
