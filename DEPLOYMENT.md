# LISTIA deployment

## Target architecture

- Source control: GitHub `crmcloudsales/LISTIA`, branch `main`
- Static frontend directory: `public`
- QA host: Cloudflare Pages `listia-pwa.pages.dev`
- Backend: Supabase project `zvzafiarwerbuoaccnoz`

## Cloudflare Pages Git settings

Use the GitHub repository `crmcloudsales/LISTIA` and branch `main`.

For this static PWA:

- Framework preset: None
- Build command: leave empty
- Build output directory: `public`
- Root directory: repository root

Do not add Supabase service-role, database, OAuth client-secret, provider-token, or other server-side secrets to Cloudflare frontend environment variables.

## Release policy

1. Changes are committed to GitHub first.
2. Cloudflare deploys `main` automatically.
3. Supabase migrations and Edge Functions are versioned under `supabase/` and are deployed deliberately through the backend control plane.
4. Direct Upload remains emergency/QA fallback, not the normal source-of-truth workflow.
