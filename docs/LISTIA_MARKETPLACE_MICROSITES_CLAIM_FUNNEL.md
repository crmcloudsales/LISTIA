# LISTIA — Marketplace Microsites + Claim Funnel

Last updated: 2026-08-31

## Objective
Turn each attributable real-estate source in LISTIA Marketplace into a tangible, ready-to-claim digital asset before commercial outreach.

Core proposition:

`Marketplace source -> portfolio microsite -> lead assigned -> claim email -> account/site claim -> activation -> subscription`

Primary CTA:

**RECLAMA TU NUEVO SITIO WEB Y RECIBE MÁS LEADS**

## Template direction
The reusable design system is based on the existing PENNYWORTH managed-site experience: premium dark presentation, large property imagery, strong portfolio cards, optional video, direct contact, and a high-visibility conversion section. PENNYWORTH brand assets are not copied to third parties; only the reusable layout/experience pattern is used. Each source must receive its own verified branding/assets when available.

## Stage 1 — Database + renderer — COMPLETE

Production Supabase now contains `public.marketplace_microsites` and the service-only payload view `public.marketplace_microsite_public_payload`.

Quintana Roo seed at implementation checkpoint:
- 103 microsite records created;
- 103 have a hero image derived from their attributable listing inventory;
- 95 have at least one email, telephone or WhatsApp contact available in the canonical prospect graph;
- all initial records are `unclaimed`;
- all initial records are `robots_index=false` until claim/review;
- the claim CTA defaults to `RECLAMA TU NUEVO SITIO WEB Y RECIBE MÁS LEADS`.

The Edge Function `marketplace-microsite-render` is deployed in the LISTIA Supabase project and its source is versioned at:

`supabase/functions/marketplace-microsite-render/index.ts`

The renderer supports:
- company name / professional identity;
- hero image;
- source-specific color configuration through `brand`;
- source logo through `logo_url`;
- one primary source video through `video_urls`;
- direct contact button;
- up to 40 current attributable property cards;
- claim CTA and unclaimed-profile disclosure;
- `noindex,follow` by default before claim.

## Stage 2 — Branding enrichment + safe hostname routing — NEXT

A database hostname is not the same as a published DNS hostname. Do not report the 103 sites as live on `*.listiaapp.com` until Cloudflare routing is actually attached and verified.

Stage 2 must:
1. clean machine-generated slugs into human-friendly brand slugs while retaining aliases/redirects;
2. extract only publicly verifiable brand assets from each source: logo, primary/accent colors, hero/portfolio imagery and, when available, one official video;
3. never reuse PENNYWORTH logos, imagery or videos on another company's site;
4. create routing that does not intercept existing LISTIA hosts such as `app`, `www` or commercial/system hosts;
5. verify each published hostname with HTTP, TLS and content smoke tests;
6. preserve source/provenance for every extracted branding field.

## Stage 3 — Claim and onboarding

The claim destination is designed as:

`https://listiaapp.com/claim?site=<slug>`

Claiming must verify control/identity before changing `unclaimed -> claimed`. The claimant then enters an already-populated account instead of an empty onboarding flow.

Target first-session experience:
- properties already loaded;
- contact profile already populated;
- website already generated;
- assigned/new leads visible;
- analytics available as evidence accumulates;
- editable brand/contact data after verification.

## Stage 4 — Commercial automation

The lead email should combine urgency from a real opportunity with the tangible site asset.

Recommended hierarchy:
- `Tienes un nuevo lead interesado en una de tus propiedades.`
- show site preview / property count;
- `Tu nuevo sitio inmobiliario ya está listo.`
- primary CTA: `RECLAMA TU NUEVO SITIO WEB Y RECIBE MÁS LEADS`;
- the lead becomes available inside the claimed LISTIA account.

Do not fabricate leads, traffic, scarcity, ownership or performance metrics.

## Rights / publication boundary
Marketplace intelligence and a ready-to-claim profile do not automatically create republication rights. Existing Marketplace rights governance remains authoritative. Public-link-only inventory can be used for controlled internal intelligence and attribution, while automatic public publication requires the applicable authorized/licensed rights state.

Brand assets must be source-attributed and used conservatively. When a logo/video/asset cannot be verified or safely reused, the microsite falls back to company-name typography and attributable listing imagery rather than inventing or misattributing brand material.
