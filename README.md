# LISTIA

AI-powered real-estate operating system.

## Current QA baseline

- PWA: v0.8.6.1
- Cloudflare Pages QA project: `listia-pwa`
- Supabase project ref: `zvzafiarwerbuoaccnoz`
- Languages: ES / EN / FR

## Source of truth

GitHub is the source-control target for frontend, migrations and Edge Function source. Supabase remains the live backend runtime. Cloudflare Pages is the deployment/perimeter layer.

Target flow:

`ChatGPT -> GitHub main -> Cloudflare Pages`

and in parallel:

`ChatGPT -> Supabase`

## Security

Never commit OAuth client secrets, service-role keys, database passwords, provider tokens, API keys, or Vault secret values.

## Current product flow

Account -> Organization -> Plan intent -> Google Connect -> Discovery / Import -> Business DNA -> Office -> Give LISTIA property material -> automated property processing.

The Free plan currently enforces one non-archived property server-side.
