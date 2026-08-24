# LISTIA billing architecture

## Status
Billing is implemented in TEST mode and intentionally feature-gated in the public PWA until the remaining Stripe Checkout credentials are configured. Current production verification must not claim LIVE billing until LIVE price bindings, credentials and webhook are present and tested.

## Canonical LISTIA subscription catalog
LISTIA business logic uses portable keys and Stripe lookup keys, never hard-coded Stripe IDs as product identity.

| LISTIA key | Price | Stripe lookup key | Billing |
|---|---:|---|---|
| `listia_free` | US$0 | none | internal freemium entitlement |
| `listia_pro` | US$97 | `listia_pro_monthly_v1` | monthly |
| `listia_premium` | US$147 | `listia_premium_monthly_v1` | monthly |
| `listia_premium_extra_seat` | US$47 | `listia_premium_extra_seat_monthly_v1` | monthly, per extra seat |

Premium includes 2 users. Pro supports 1 user. Extra seats apply only to Premium.

## Gestiones — standardized customer price, flexible internal margin
A customer buys a **Gestión**, not a raw provider call.

The old 30% FREE / 20% PRO / 10% PREMIUM percentages remain **target internal economics**, not a rigid formula that must be exposed or applied identically to every provider cost. The effective markup/margin can vary by route, geography and provider so LISTIA can offer a simple standardized price while remaining profitable.

Customer-facing source of truth: `private.gestion_price_book`.

Pre-execution authorization: `private.gestion_quotes`.

Post-execution usage/accounting: `public.gestiones`.

Canonical billable flow:

`request -> price-book service -> current route cost check -> quote -> user approval -> execute -> record realized Gestión`

Rules:
- Show the user a final Gestión price or authorized maximum before a billable action runs.
- Hide provider/model complexity by default.
- A fixed-price route must pass the internal live-cost/margin gate before execution.
- Current default minimum gross-margin floor is 5% for billable fixed-price routes; intentionally free/included routes are exempt.
- If no compliant provider route fits the approved customer price, do not execute. Try another provider, block, or request new approval.
- Never surprise-charge above the amount the user approved.
- New price-book versions may change future prices; an unexpired stored quote preserves its authorized ceiling.
- High-volume automation may later use explicit standing budgets/caps; low friction must not become hidden spending.
- Provider actual cost is still recorded internally for economics, routing, accounting and audit.

## Global standardized pricing
LISTIA can use one visible price for a Gestión across countries while internal effective margins vary. This is valid only where the route is within the defined service scope.

For voice/SMS, standard global pricing covers ordinary compliant geographic fixed/mobile/A2P destinations. Premium-rate, satellite, personal-number and special-service destinations are excluded, blocked or separately quoted rather than silently creating a loss.

For domains, TLD registry prices genuinely differ, so the standardized experience is a **live all-in quote**, not one universal domain price. Cloudflare Registrar is the primary candidate for current registration/renewal price discovery and purchase.

## Source of truth
Application entitlement is stored in `public.organization_billing`.

`organization_onboarding.selected_plan` is only plan intent. It MUST NOT be used to grant paid features.

Stripe-specific references are stored outside the public Data API:
- `private.billing_price_bindings`
- `private.billing_provider_state`
- `private.billing_provider_events`

This separation allows a future Stripe account migration by rebinding provider IDs without rewriting LISTIA plan logic.

## TEST Stripe catalog
The TEST catalog exists in the connected Stripe account named `Listia`. Provider product/price IDs are stored dynamically in `private.billing_price_bindings`; application code should resolve them by LISTIA portable key / Stripe lookup key instead of copying IDs into the frontend.

## Checkout
Server function: `billing-checkout-create`

- Requires a valid LISTIA JWT.
- Requires active organization membership with `owner` or `admin` role.
- Rate limited.
- Creates/reuses a Stripe Customer.
- Resolves price IDs from private bindings.
- Creates a subscription Checkout Session using Stripe 2026 `ui_mode: embedded_page`.
- Returns only the Checkout Session client secret to the authenticated browser.
- Never exposes Stripe secret/restricted keys to the PWA.

The PWA module is `public/billing.js`. It uses Stripe.js directly from `https://js.stripe.com/dahlia/stripe.js` and `createEmbeddedCheckoutPage()` when billing is enabled.

## Webhook
Server function: `billing-stripe-webhook`

Stripe TEST endpoint listens for:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

The signing secret is stored encrypted in Supabase Vault as `stripe_webhook_secret_test`. The webhook validates Stripe's HMAC signature before parsing or processing an event and stores event IDs for idempotency.

Entitlement rules:
- Active/trialing paid subscription -> paid plan active.
- Failed mid-cycle adjustment/proration -> `payment_warning`, access remains available.
- Failed recurring renewal (`subscription_cycle`) -> `payment_blocked`.
- Successful invoice -> clears payment restriction for a paid plan.
- Canceled/incomplete/expired subscription -> effective plan returns to FREE.

## Required secrets and public configuration
Never commit these values to GitHub.

For TEST Checkout, configure one server-side Stripe API credential in the Supabase Edge Functions environment. Prefer a Stripe restricted API key over a broad secret key:
- `STRIPE_RESTRICTED_KEY_TEST` — preferred
- `STRIPE_SECRET_KEY_TEST` — fallback only

The TEST publishable key is safe for the browser and belongs in `public/config.js` as `STRIPE_PUBLISHABLE_KEY` only after the matching TEST server credential is configured.

Then set:
- `BILLING_ENABLED: true`
- `BILLING_ENV: "test"`

Do not enable LIVE by merely changing the feature flag. LIVE requires a separately created live catalog, live price bindings, live webhook destination/signing secret, and live restricted key.

## Taxes
Stripe automatic tax is deliberately OFF. Do not add `automatic_tax: { enabled: true }` until LISTIA has confirmed the legal entity, tax registrations and jurisdictions in which it is registered to collect tax. Where taxes or mandatory government charges legally apply to a Gestión, the user-facing quote must handle them transparently as required by law.

## Legal
Global baseline legal pages are:
- `/terms.html`
- `/privacy.html`

Terms must define recurring plan pricing separately from standardized Gestiones, approval/quote behavior, provider variability, exceptional-route exclusions, seat proration, payment failure behavior, cancellations and payment processing. Privacy covers billing/subscription/payment metadata and processors.

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
