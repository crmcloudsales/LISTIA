# LISTIA Build Status — Live Checkpoint

Last reconciled: 2026-08-24
Scope: LISTIA only.

This file is updated after substantive implementation blocks. It is a checkpoint, not a substitute for live verification.

## DONE
- PWA onboarding through Google connection, Discovery, Business DNA and Office.
- Seven UI/property locales: ES, EN, FR, IT, PT-BR, DE, AR-AE.
- Canonical LISTIA subscriptions remain FREE US$0, PRO US$97/mo, PREMIUM US$147/mo, Premium extra seat US$47/mo.
- FREE entitlement is now **up to 3 non-archived properties**. The fourth requires a paid plan.
- FREE property limit is enforced server-side in `property-intake-start` v8, not merely through UI copy.
- Small plan/property-limit copy in the PWA is now intentionally more readable on phones via `public/pricing-policy.js`: plan descriptions 12px, `/month` 11px, FREE property-limit note 12px with higher contrast.
- FREE copy now says up to 3 properties in all seven LISTIA locales.
- Ordinary Gestión target markups changed to **FREE 50% / PRO 25% / PREMIUM 12.5%**.
- `organization_billing` is normalized server-side by database trigger so stale integration code cannot silently restore old 30/20/10 values.
- New organizations automatically receive a canonical FREE billing row.
- `private.plan_entitlements` is the server-side plan-limit registry: FREE property limit 3; PRO/PREMIUM property limit currently unlimited/null.
- Domain pricing is now a special rule independent of plan: **50%-100% markup in every plan**, decreasing as wholesale cost rises.
- Domain registration and renewal use the same markup policy; no deliberate teaser first-year markup.
- Canonical dynamic domain bands: <=$10 wholesale -> 100%; >$10-$20 -> 80%; >$20-$50 -> 60%; >$50 -> 50%.
- `private.domain_markup_percent()` implements the domain markup bands.
- Domain suggestion pool remains `.com`, `.com.mx`, `.mx`, `.net`, `.us`, `.realestate`, `.uk`, `.it`, `.web` when available; requested domain + max 3 alternatives; `.app`/`.ai` are not default suggestions.
- Price Book v2 now stores generic min/max markup controls and reference cost/status fields.
- HyperFrames, MuseTalk and EchoMimic customer rows were repriced from conservative engineering accepted-output cost estimates and remain benchmark guarded.
- Media engineering benchmark v0 documented in `docs/LISTIA_MEDIA_COST_BENCHMARK_V0.md`.
- Existing standardized Gestión quote-before-execution architecture remains: `private.gestion_price_book` -> `private.gestion_quotes` -> user approval -> execution -> `public.gestiones`.
- Twilio, Telnyx, Cloudflare and Amazon SES remain registered as internal providers/candidates; provider names stay hidden from normal customer pricing UX.
- Omnichannel architecture remains WhatsApp first, SMS/RCS second, Telegram third, email nurture and voice where appropriate, subject to consent/reachability/law.
- Content/AI routing remains `lowest_cost_passing_quality`; optimization metric is `cost_per_accepted_output`.

## VERIFIED
- LISTIA Supabase project: `zvzafiarwerbuoaccnoz`.
- Migration 48 (`20260824113420_pricing_v2_markups_domains_free_three_properties`) applied successfully.
- Migration 49 (`20260824114346_lock_pricing_helper_search_paths`) hardened the two pricing helper functions after the security adviser flagged mutable search paths.
- Supabase and GitHub migration history are synchronized through migration 49.
- Security adviser no longer reports the two pricing-helper search-path warnings. Remaining private-table `RLS enabled no policy` INFO notices are intentional server-only lockdown. The pre-existing Supabase Auth leaked-password-protection warning remains pending hardening.
- Performance adviser introduced no new pricing-v2 missing-index issue; its remaining unindexed-FK notices predate this block.
- `property-intake-start` v8 is ACTIVE with JWT verification and the FREE `>=3` server-side limit.
- Current organization billing row was normalized to the new plan markup target.
- Price Book domain rows use `provider_quote_plus_markup`, 50%-100% bounds and live-cost checking.
- HyperFrames reference cost target stored: US$0.005 / accepted <=10s exact-source composition.
- MuseTalk reference cost target stored: US$0.025 / accepted <=10s lip-sync.
- EchoMimicV2 reference cost target stored: US$0.16 / accepted <=10s avatar-from-photo.
- Those three media figures are **engineering estimates**, not measured LISTIA production results, and remain `benchmark_required=true`.
- No external media generation, domain purchase or telecom send was executed by this pricing change; no external usage cost was created.
- The PWA readability/property-copy change is committed to `main`; the deployed Cloudflare Pages visual state has not yet been independently verified from this chat, so it must not be described as visually confirmed production behavior yet.

## MEDIA PRICE BOOK v2 — BENCHMARK-GUARDED
| Gestión | Reference internal cost | FREE | PRO | PREMIUM |
|---|---:|---:|---:|---:|
| Exact-source HyperFrames/FFmpeg <=10s | $0.005 | $0.0075 | $0.00625 | $0.005625 |
| MuseTalk lip-sync <=10s | $0.025 | $0.0375 | $0.03125 | $0.028125 |
| EchoMimicV2 avatar from photo <=10s | $0.16 | $0.24 | $0.20 | $0.18 |

These are stored reference prices and remain blocked from automated paid release until measured LISTIA clips prove quality and accepted-output cost.

## DOMAIN ECONOMICS v2
Domain price is a live wholesale quote plus the same dynamic markup logic regardless of FREE/PRO/PREMIUM. Registration and renewal use the same rule.

Examples using the current bands only (illustrative wholesale inputs, not live registrar quotes):
- $6.50 wholesale -> 100% markup -> $13.00 customer price.
- $10.46 wholesale -> 80% markup -> $18.83.
- $16.75 wholesale -> 80% markup -> $30.15.
- $30.70 wholesale -> 60% markup -> $49.12.
- $72.95 wholesale -> 50% markup -> $109.43.

Premium/exceptional domains remain separately live-quoted.

## PENDING — DO NOT RUSH
- Run the first measured LISTIA media benchmark: minimum 5 real representative clips per HyperFrames/MuseTalk/EchoMimic route, with actual billed seconds, retries, Quality-Gate results and accepted-output cost.
- After measured media benchmark, decide whether to round micro-Gestión display prices for customer simplicity while preserving the approved maximum and internal accounting precision.
- Visually verify the new FREE plan text size/copy on the deployed mobile PWA after Cloudflare Pages deploys the `main` changes.
- Build the server-side Gestión Cost Resolver/Quote endpoint only after the pricing/legal rules are fully accepted.
- Build domain search/purchase UI only after the domain ownership/registrar account architecture is finalized.
- Build Twilio/Telnyx/Meta/RCS live routing after communication pricing/legal country profiles are finalized.
- Professional jurisdiction-specific legal review before high-volume automated outbound campaigns.
- Define tax/legal-entity handling before automatic tax activation.
- Supabase Auth leaked-password protection hardening remains pending.
- Stripe production billing still requires explicit end-to-end verification; frontend LIVE flags alone are not proof of a complete LIVE billing path.

## NEXT
Do not jump to dozens of integrations yet. The next economic/quality step is the **measured media benchmark** so LISTIA can replace the three engineering estimates with real `cost_per_accepted_output`. In parallel, the new FREE 3-property rule and PWA readability patch should be visually verified on the deployed mobile PWA.

## Standing release rule
No AI/provider output, paid Gestión or outbound marketing communication is released merely because generation/routing succeeded. Required quality, consent, legal/platform, factual, cost and authorization gates must pass. When exact advisor/property preservation is required, protected original source content remains canonical.
