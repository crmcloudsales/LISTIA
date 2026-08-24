# LISTIA

AI-powered real-estate operating system.

## Current QA baseline

- PWA cache baseline: v0.9.6
- Cloudflare Pages QA project: `listia-pwa`
- Supabase project ref: `zvzafiarwerbuoaccnoz`
- Languages: ES / EN / FR / IT / PT-BR / DE / AR-AE
- Stripe billing: TEST catalog + webhook implemented; embedded Checkout feature-gated pending TEST Checkout credentials

## Source of truth

GitHub is the source-control target for frontend, migrations and Edge Function source. Supabase remains the live backend runtime and application-entitlement source of truth. Cloudflare Pages is the deployment/perimeter layer. Stripe is an external payment/subscription provider and must remain replaceable through provider bindings.

Target flow:

`ChatGPT -> GitHub main -> Cloudflare Pages`

and in parallel:

`ChatGPT -> Supabase`

Billing flow:

`PWA -> Supabase billing Edge Function -> Stripe`

and asynchronously:

`Stripe signed webhook -> Supabase -> organization_billing`

See `BILLING.md` for the portable billing contract and TEST/LIVE separation.

## Security

Never commit OAuth client secrets, service-role keys, database passwords, provider tokens, Stripe restricted/secret keys, API keys, webhook signing secrets or Vault secret values.

Paid entitlement must come from `organization_billing`, not from onboarding plan intent.

## Current product flow

Account -> Organization -> Plan intent -> Billing when a paid plan is activated -> Google Connect -> Discovery / Import -> Business DNA -> Office -> Give LISTIA property material -> automated property processing.

The Free plan currently enforces one non-archived property server-side.
