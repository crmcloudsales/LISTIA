# LISTIA — Marketplace Microsites + Claim Funnel

Last updated: 2026-08-31

## Objective
Turn each attributable real-estate source in LISTIA Marketplace into a tangible, ready-to-claim digital asset before commercial outreach.

Core proposition:

`Marketplace source -> portfolio microsite -> real lead assigned -> claim lead -> account/site claim -> activation -> future subscription decision`

Primary commercial CTA when a real lead exists:

**RECLAMA TU LEAD**

Supporting promise:

**¡LEADS DE CALIDAD, SIEMPRE!**

The website is a tangible secondary benefit showing the prospect that LISTIA has already prepared the account, properties and digital presence. It is not the primary CTA when a real lead is waiting.

## Pricing
LISTIA pricing, free/trial policy, seat pricing and usage markups are intentionally UNDECIDED. Do not display, quote or infer prices from legacy/test data. A dedicated pricing analysis will be performed later.

## Template direction
The reusable design system is based on the existing PENNYWORTH managed-site experience: premium presentation, large property imagery, strong portfolio cards, optional video, direct contact, and a high-visibility conversion section. PENNYWORTH brand assets are not copied to third parties; only the reusable layout/experience pattern is used. Each source must receive its own verified branding/assets when available.

## Quintana Roo Marketplace mapping
The current Quintana Roo marketplace mapping layer normalizes the inventory to the state's 11 current municipalities and key localities/zones. The official municipality name Playa del Carmen is used while legacy `Solidaridad` values are normalized into it.

Current classification checkpoint:
- 7,539 records classified as valid Quintana Roo mapped inventory;
- 44 records quarantined as out-of-state contamination;
- 0 records left in manual-review status at this checkpoint;
- mapping uses listing coordinates when available and locality/zone centroids as the fallback;
- raw source location is retained for provenance and later precision upgrades.

Important: the source inventory currently lacks exact latitude/longitude at listing level. The map layer is therefore geographically complete for the normalized current inventory, but many pins are locality/zone centroid precision until address/property-level geocoding becomes available.

## Microsite state
Production Supabase contains `public.marketplace_microsites` and the service-only payload view `public.marketplace_microsite_public_payload`.

Quintana Roo claimable-site checkpoint:
- 102 claimable real-estate source microsites;
- 1 portal/aggregator separated from the claim funnel;
- hero imagery available from attributable listing inventory;
- profiles stay `unclaimed` and `noindex` until claim/review;
- site hostnames are human-readable LISTIA subdomain candidates.

The Edge Function `marketplace-microsite-render` is deployed in the LISTIA Supabase project and its source is versioned at:

`supabase/functions/marketplace-microsite-render/index.ts`

## Claim and onboarding
The prospect must not start from an empty dashboard. After identity/control verification, the account should open with:
- the real lead that triggered the claim message;
- attributable properties already loaded;
- contact profile already populated;
- website already generated;
- available market/portfolio analytics;
- editable brand/contact data after verification.

Never fabricate a lead. `RECLAMA TU LEAD` is used only when an actual lead is assigned and waiting.

## Commercial message hierarchy
When a real lead exists:
1. `Tienes un nuevo lead esperando en LISTIA.`
2. `Entra a tu cuenta y reclama tu nuevo lead.`
3. CTA: `RECLAMA TU LEAD`.
4. `¡LEADS DE CALIDAD, SIEMPRE!`
5. `Además, con LISTIA obtienes tu sitio web. Ya lo preparamos con tus propiedades.`
6. Show the actual LISTIA subdomain as tangible proof.

The intended feeling is: **no empiezas desde cero; LISTIA ya hizo el trabajo inicial y ya hay una oportunidad real esperando.**

## Rights / publication boundary
Marketplace intelligence and a ready-to-claim profile do not automatically create republication rights. Existing Marketplace rights governance remains authoritative. Public-link-only inventory can be used for controlled internal intelligence and attribution, while automatic public publication requires the applicable authorized/licensed rights state.

Brand assets must be source-attributed and used conservatively. When a logo/video/asset cannot be verified or safely reused, the microsite falls back to company-name typography and attributable listing imagery rather than inventing or misattributing brand material.
