# LISTIA billing architecture

## Status
Billing implementation exists, but production billing must not be declared fully verified merely from frontend flags. LIVE operation requires matching LIVE price bindings, credentials, webhook and successful end-to-end verification.

## Canonical LISTIA subscription catalog
LISTIA business logic uses portable keys and Stripe lookup keys, never hard-coded Stripe IDs as product identity.

| LISTIA key | Price | Stripe lookup key | Billing |
|---|---:|---|---|
| `listia_free` | US$0 | none | internal freemium entitlement |
| `listia_pro` | US$97 | `listia_pro_monthly_v1` | monthly |
| `listia_premium` | US$147 | `listia_premium_monthly_v1` | monthly |
| `listia_premium_extra_seat` | US$47 | `listia_premium_extra_seat_monthly_v1` | monthly, per extra seat |

FREE supports up to **3 non-archived properties**. A fourth property requires upgrading to a paid plan. Premium includes 2 users. Pro supports 1 user. Extra seats apply only to Premium.

## Gestiones — standardized customer price, flexible internal margin
A customer buys a **Gestión**, not a raw provider call.

Current ordinary plan markup targets on real provider/accepted-output cost are:
- FREE: **50%**
- PRO: **25%**
- PREMIUM: **12.5%**

These are active target economics. For variable routes, effective markup can flex inside the applicable safety bounds so LISTIA can preserve simple pricing, quality and profitability. The ordinary safety band remains 5%-50% unless a specific Gestión has a different canonical rule.

**Domains are the deliberate exception:** domain registration and renewal use a **50%-100% markup in every plan**, dynamically decreasing as wholesale domain cost increases. Registration and renewal use the same policy; there is no intentional teaser first-year markup followed by a higher renewal markup.

Customer-facing source of truth: `private.gestion_price_book`.

Plan entitlement source: `private.plan_entitlements` plus `public.organization_billing` for the organization's effective paid plan.

Pre-execution authorization: `private.gestion_quotes`.

Post-execution usage/accounting: `public.gestiones`.

Canonical billable flow:

`request -> price-book service -> current route cost check -> quote -> user approval -> execute -> record realized Gestión`

Rules:
- Show the user a final Gestión price or authorized maximum before a billable action runs.
- Hide provider/model complexity by default.
- A fixed-price route must pass the internal live-cost/margin gate before execution.
- If no compliant provider route fits the approved customer price, do not execute. Try another provider, block, or request new approval.
- Never surprise-charge above the amount the user approved.
- New price-book versions may change future prices; an unexpired stored quote preserves its authorized ceiling.
- High-volume automation may later use explicit standing budgets/caps; low friction must not become hidden spending.
- Provider actual cost is recorded internally for economics, routing, accounting and audit.
- Optimize for **cost per accepted output**, including rejected generations/retries and required quality validation.

## Domain pricing v2
Domain price = current compliant wholesale quote × (1 + dynamic domain markup).

Current markup bands, identical across FREE/PRO/PREMIUM:
- wholesale <= US$10 -> 100%
- >US$10 and <=US$20 -> 80%
- >US$20 and <=US$50 -> 60%
- >US$50 -> 50%

The database function `private.domain_markup_percent()` is the current canonical calculator. Premium or exceptional domains require a separate live quote.

LISTIA's preferred suggestion pool is `.com`, `.com.mx`, `.mx`, `.net`, `.us`, `.realestate`, `.uk`, `.it`, and `.web` when commercially available. The UI shows the requested domain plus at most 3 useful alternatives. `.app` and `.ai` are not default suggestions.

## Benchmark-guarded media economics
The following v2 figures are **engineering estimates based on published model/render throughput and current compute pricing, not yet measured LISTIA production benchmarks**:

| Gestión / route | Reference internal accepted-output cost <=10s | FREE +50% | PRO +25% | PREMIUM +12.5% |
|---|---:|---:|---:|---:|
| HyperFrames/FFmpeg exact-source composition | US$0.005 | US$0.0075 | US$0.00625 | US$0.005625 |
| MuseTalk 1.5 lip-sync | US$0.025 | US$0.0375 | US$0.03125 | US$0.028125 |
| EchoMimicV2 avatar-from-photo | US$0.16 | US$0.24 | US$0.20 | US$0.18 |

These rows remain `benchmark_guarded`. Automated paid release is blocked until LISTIA runs real test clips, records compute/cold-start/retry/Quality-Gate cost, and confirms accepted-output quality and margin. HyperFrames is preferred when source fidelity must remain deterministic; MuseTalk is the economical lip-sync route; EchoMimicV2 is a fallback when a canonical advisor video is unavailable.

## Global standardized pricing
LISTIA can use a visible standardized price or pricing rule for a Gestión while internal effective margins vary. This is valid only where the route is within the defined service scope.

For voice/SMS/RCS/WhatsApp, current supplier cost varies materially by country/carrier. LISTIA therefore standardizes the user experience and markup policy while resolving the current all-in route before approval. Premium-rate, satellite, personal-number and special-service destinations are excluded, blocked or separately quoted rather than silently creating a loss.

For domains, TLD registry prices genuinely differ, so the standardized experience is a **live all-in quote** using the same 50%-100% markup logic in every plan.

## Source of truth
Application entitlement is stored in `public.organization_billing`. Canonical plan limits are stored server-side in `private.plan_entitlements`.

`organization_onboarding.selected_plan` is only plan intent. It MUST NOT be used to grant paid features.

Stripe-specific references are stored outside the public Data API:
- `private.billing_price_bindings`
- `private.billing_provider_state`
- `private.billing_provider_events`

This separation allows a future Stripe account migration by rebinding provider IDs without rewriting LISTIA plan logic.

## Checkout
Server function: `billing-checkout-create`

- Requires a valid LISTIA JWT.
- Requires active organization membership with `owner` or `admin` role.
- Rate limited.
- Creates/reuses a Stripe Customer.
- Resolves price IDs from private bindings.
- Creates a subscription Checkout Session using the configured embedded Stripe experience.
- Returns only the Checkout Session client secret to the authenticated browser.
- Never exposes Stripe secret/restricted keys to the PWA.

The PWA module is `public/billing.js`.

## Webhook
Server function: `billing-stripe-webhook`

Webhook processing validates Stripe's HMAC signature before applying billing state and stores event IDs for idempotency. A database normalization trigger enforces the canonical 50% / 25% / 12.5% `usage_markup_percent` whenever `organization_billing` is inserted or its plan changes, so stale provider-integration code cannot silently restore the old markup values.

Entitlement rules:
- Active/trialing paid subscription -> paid plan active.
- Failed mid-cycle adjustment/proration -> `payment_warning`, access remains available.
- Failed recurring renewal (`subscription_cycle`) -> `payment_blocked`.
- Successful invoice -> clears payment restriction for a paid plan.
- Canceled/incomplete/expired subscription -> effective plan returns to FREE.

## Taxes
Stripe automatic tax is deliberately OFF. Do not enable automatic tax until LISTIA has confirmed the legal entity, tax registrations and jurisdictions in which it is registered to collect tax. Where taxes or mandatory government charges legally apply to a Gestión, the user-facing quote must handle them transparently as required by law.

## Legal
Global baseline legal pages are:
- `/terms.html`
- `/privacy.html`

Terms define recurring plan pricing separately from standardized Gestiones, approval/quote behavior, provider variability, exceptional-route exclusions, seat proration, payment failure behavior, cancellations and payment processing. Internal supplier markup does not need to be exposed unless legally required; the binding customer commitment is the approved LISTIA quote/ceiling.

## Security invariants
- Never put Stripe restricted/secret keys or webhook secrets in `public/`.
- Never grant paid access from onboarding plan selection.
- Never trust client-supplied prices, quote totals or Stripe price IDs.
- Never let the browser insert/alter provider costs or realized `gestiones` records.
- Quotes and price-book calculation remain server-side.
- Keep provider bindings/state/events, price book and provider route economics in the `private` schema.
- Verify webhook signatures before JSON processing.
- Treat Stripe event IDs idempotently.
- Keep TEST and LIVE bindings separate.
