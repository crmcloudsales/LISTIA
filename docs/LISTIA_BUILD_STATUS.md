# LISTIA Build Status — Live Checkpoint

Last reconciled: 2026-08-24
Scope: LISTIA only.

This file is updated after substantive implementation blocks. It is a checkpoint, not a substitute for live verification.

## DONE
- PWA onboarding through Google connection, Discovery, Business DNA and Office.
- Seven UI/property locales: ES, EN, FR, IT, PT-BR, DE, AR-AE.
- Canonical LISTIA commercial subscriptions: FREE US$0, PRO US$97/mo, PREMIUM US$147/mo, Premium extra seat US$47/mo.
- Portable subscription billing architecture and Stripe TEST bindings.
- Gestiones commercial model upgraded from rigid provider-cost markup to **standardized customer-visible Gestión pricing with flexible internal margin**.
- `private.gestion_price_book` stores versioned per-plan customer prices, scope, exclusions, margin floor, preapproval rule and benchmark guard.
- `private.gestion_quotes` stores pre-execution commercial authorization/ceiling before a paid action occurs.
- FREE/PRO/PREMIUM 30%/20%/10% are now internal target economics rather than rigid contractual markup per provider call.
- Billable fixed-price Gestiones use a 5% default internal minimum-margin safety floor; intentionally free/included routes are exempt.
- Provider/model names are hidden from the normal customer price experience.
- If no compliant supplier route fits an approved quote/margin floor, LISTIA must reroute, block or request new approval rather than execute at a loss or surprise-charge.
- Canonical progressive-spend rule: LISTIA grows paid usage gradually with demonstrated customer activity/value; high-volume automation requires explicit action or an approved standing budget/cap.
- Price Book v1 currently contains 23 standardized Gestión types across content, video, communications and infrastructure.
- Twilio is formally registered as an internal fallback/benchmark provider for Voice, SMS, WhatsApp, phone numbers, Verify and live pricing discovery.
- Telnyx is formally registered as a core cost-first communications provider candidate.
- Cloudflare is formally registered as both LISTIA core infrastructure and a behind-the-scenes user infrastructure provider: Registrar, Pages, Workers, R2, DNS, CDN, SSL/TLS, WAF, Turnstile and Images.
- Amazon SES is formally registered as a cost-first email candidate.
- Cloudflare/Twilio reference rate cards were added to the private versioned rate catalog.
- Canonical domain UX rule is defined: one desired-domain input, requested result plus at most three alternatives, one all-in first-year price + renewal price, one approval action. UI is not built yet.
- Domain pricing uses live Cloudflare Registrar registration/renewal quote plus a small LISTIA service fee rather than pretending every TLD has the same wholesale price.
- Static website hosting is currently priced as included/$0 while the site stays within Cloudflare Pages static/free economics; measurable paid infrastructure remains separate.
- Global flat voice/SMS prices apply only to ordinary compliant geographic/A2P destinations. Premium-rate, satellite, personal-number and special-service classes are excluded/blocked or separately quoted.
- Canonical global usage/channel pricing map updated in `docs/LISTIA_USAGE_PRICING_CHANNELS_CANONICAL.md`.
- Canonical technology map updated with Twilio/Cloudflare/Telnyx/SES roles and customer invisibility.
- Canonical legal engineering rules updated for standardized pricing, quote-before-execution, flexible internal margin, global flat-rate scope and domain economics.
- Public Terms of Service updated to Version 1.2 effective 2026-08-24 for standardized Gestiones and preapproval.
- Public Privacy Policy updated to Version 1.2 effective 2026-08-24 for quote, spending-authorization and provider-routing data.
- Existing omnichannel architecture remains: WhatsApp priority 1, SMS 2, Telegram 3, email 4, voice 5, subject to consent/reachability/law.
- `public.lead_contact_channels`, private communication templates and dispatch audit tables remain in place.
- Property intake, private material storage, processing-state pipeline and provider-neutral AI job queue remain in place.
- Canonical multimodel LISTIA AI Engine and cost-first technology architecture remain in place.
- All active AI routes use `lowest_cost_passing_quality`; benchmark-aware metric is `cost_per_accepted_output`.
- MuseTalk 1.5 remains default low-cost lip-sync candidate; EchoMimicV2 default photo-only avatar candidate; HeyGen premium fallback.
- `services/ai-orchestrator` scaffold exists with FastAPI + LiteLLM + LangGraph + Langfuse-compatible dependencies and Cloud Run-ready Dockerfile.

## VERIFIED
- LISTIA Supabase project: `zvzafiarwerbuoaccnoz` is the live backend used by this workstream.
- Migration 47 (`20260824095159_add_standardized_gestion_pricebook_twilio_cloudflare`) applied successfully.
- Supabase and GitHub migration SQL are synchronized through migration 47.
- The new Price Book/quote tables are private/server-only; browser users cannot alter the price book, provider costs or quotes directly.
- No domain purchase, communication dispatch or external provider execution was performed by this pricing/legal block; it created no new external usage charge.
- Exact-source/lip-sync/photo-avatar customer price rows are `benchmark_guarded`: automated paid use remains blocked until real accepted-output cost validates the advertised ceiling and quality.
- Current Stripe provider-binding verification remains TEST-only; do not describe production subscription billing as LIVE until LIVE bindings/credentials/webhook are verified.
- Security adviser continues to show expected INFO notices for intentionally policy-less private tables. The pre-existing Supabase Auth leaked-password-protection warning remains pending hardening.

## CURRENT PRICE BOOK v1 — CUSTOMER PRICES
### Content
- Property content package/language: FREE $0.05 / PRO $0.04 / PREMIUM $0.03.
- Image create/edit: $0.10 / $0.09 / $0.08.
- Finished flyer/story/social creative: $0.15 / $0.14 / $0.12.
- Brochure up to 10 pages: $0.75 / $0.65 / $0.55.

### Video
- Exact-source 10 sec: $0.30 / $0.25 / $0.20 — benchmark guarded.
- Lip-sync 10 sec: $0.10 / $0.09 / $0.08 — benchmark guarded.
- Avatar from photo 10 sec: $0.30 / $0.25 / $0.20 — benchmark guarded.
- Standard cinematic 10 sec: $0.75 / $0.65 / $0.60.
- Premium cinematic 10 sec: $1.75 / $1.55 / $1.35.
- Localized high-fidelity repair 10 sec: $3.90 / $3.50 / $3.20.

### Communications
- WhatsApp Marketing delivered: $0.22 / $0.20 / $0.18.
- WhatsApp Utility/Auth delivered: $0.09 / $0.08 / $0.07.
- WhatsApp service-window message: currently $0 where direct-provider economics remain zero.
- Global standard SMS part: $0.55 / $0.52 / $0.50.
- Telegram ordinary reachable-chat message: $0.
- 1,000 email recipients: $0.20 / $0.18 / $0.15.
- AI inbound call minute: $0.30 / $0.27 / $0.25.
- AI outbound global-standard call minute: $1.25 / $1.15 / $1.10.
- Local business number/month: $10 / $9 / $8 where inventory fits the standard scope.

### Cloudflare-backed infrastructure
- Domain registration: live Cloudflare first-year quote + LISTIA fee $1.00 / $0.75 / $0.50.
- Domain renewal: live Cloudflare renewal quote + LISTIA fee $0.50 / $0.40 / $0.30.
- Static website hosting: currently included/$0 within Pages static/free economics.
- R2-style content storage: $0.030 / $0.025 / $0.020 per GB-month.

## PENDING — ECONOMICS/LEGAL FIRST
- User review/approval of Price Book v1 values before building public quoting UI or automatic cost resolver.
- Professional jurisdiction-specific legal review before large automated outbound campaigns scale globally.
- Define country policy profiles for consent, telemarketing, call recording, quiet hours, sender registration and local privacy requirements.
- Define tax/legal-entity handling before automatic tax is activated.
- Build the quote/resolver Edge Function only after Price Book v1 is accepted.
- Build Cloudflare domain search/purchase UI only after pricing/legal model is accepted.
- Build Twilio/Telnyx live pricing adapters after price book acceptance; provider credentials are not implied by provider registration.
- Benchmark HyperFrames/MuseTalk/EchoMimic actual accepted-output cost before enabling benchmark-guarded video rows.
- Backfill existing leads into omnichannel contact records only after normalization/consent rules are finalized; never infer marketing consent from possession of contact data.
- Meta WhatsApp template approval, Telegram reachability flow, SES domain verification and voice/SMS adapters remain later implementation steps.
- Supabase Auth leaked-password protection hardening remains pending.
- Stripe LIVE bindings/credentials/webhook verification remains pending.

## NEXT — DO NOT RUSH
The next step is **review the Price Book v1 together and adjust any customer-facing Gestión price or scope that does not look commercially right**. Do not build the automatic resolver, domain UI or high-volume communications until the economics/legal model is accepted.

## Standing release rule
No AI/provider output, paid Gestión or outbound marketing communication is released merely because generation/routing succeeded. Required quality, consent, legal/platform, factual, cost and authorization gates must pass. When exact advisor/property preservation is required, protected original source content remains canonical.
