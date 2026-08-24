# LISTIA billing architecture

## Status

Billing is implemented in TEST mode and intentionally feature-gated in the public PWA until the remaining Stripe Checkout credentials are configured. No live Stripe catalog or live charges are enabled by this document.

## Canonical LISTIA catalog

LISTIA business logic uses portable keys and Stripe lookup keys, never hard-coded Stripe IDs as product identity.

| LISTIA key | Price | Stripe lookup key | Billing |
|---|---:|---|---|
| `listia_free` | US$0 | none | internal freemium entitlement |
| `listia_pro` | US$97 | `listia_pro_monthly_v1` | monthly |
| `listia_premium` | US$147 | `listia_premium_monthly_v1` | monthly |
| `listia_premium_extra_seat` | US$47 | `listia_premium_extra_seat_monthly_v1` | monthly, per extra seat |

Premium includes 2 users. Pro supports 1 user. Extra seats apply only to Premium.

## Gestiones

Variable third-party usage remains decoupled from Stripe product identity.

- FREE markup: 30%
- PRO markup: 20%
- PREMIUM markup: 10%
- Formula: `final_user_cost = provider_cost * (1 + markup_percent / 100)`

`public.gestiones` records provider cost, plan at time of use, markup, LISTIA revenue and final user cost. The browser may read its own organization records through RLS but cannot create or alter costs.

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

- Active/trialing paid subscription → paid plan active.
- Failed mid-cycle adjustment/proration → `payment_warning`, access remains available.
- Failed recurring renewal (`subscription_cycle`) → `payment_blocked`.
- Successful invoice → clears payment restriction for a paid plan.
- Canceled/incomplete/expired subscription → effective plan returns to FREE.

## Required secrets and public configuration

Never commit these values to GitHub.

For TEST Checkout, configure one server-side Stripe API credential in the Supabase Edge Functions environment. Prefer a Stripe restricted API key over a broad secret key:

- `STRIPE_RESTRICTED_KEY_TEST` — preferred
- `STRIPE_SECRET_KEY_TEST` — fallback only

The restricted key should have only the capabilities required by `billing-checkout-create`: create/read Customers, create Checkout Sessions, and read subscription state needed by the checkout workflow.

The TEST publishable key is safe for the browser and belongs in `public/config.js` as `STRIPE_PUBLISHABLE_KEY` only after the matching TEST server credential is configured.

Then set:

- `BILLING_ENABLED: true`
- `BILLING_ENV: "test"`

Do not enable LIVE by merely changing the feature flag. LIVE requires a separately created live catalog, live price bindings, live webhook destination/signing secret, and live restricted key.

## Taxes

Stripe automatic tax is deliberately OFF. Do not add `automatic_tax: { enabled: true }` until LISTIA has confirmed the legal entity, tax registrations and jurisdictions in which it is registered to collect tax.

## Legal

Global baseline legal pages are:

- `/terms.html`
- `/privacy.html`

The Terms define recurring plan pricing, Gestiones, Premium-seat proration, payment failure behavior, cancellations and Stripe processing. The Privacy Policy covers billing/subscription/payment metadata and payment processors. The PWA signup and embedded billing UI link to these pages.

## Security invariants

- Never put Stripe restricted/secret keys or webhook secrets in `public/`.
- Never grant paid access from onboarding plan selection.
- Never trust client-supplied prices or Stripe price IDs.
- Never let the browser insert `gestiones` cost records.
- Keep provider bindings/state/events in the `private` schema.
- Verify webhook signatures before JSON processing.
- Treat Stripe event IDs idempotently.
- Keep TEST and LIVE bindings separate.
