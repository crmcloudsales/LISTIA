# LISTIA Marketplace — Operational Checkpoint

Timestamp: 2026-09-05 13:34 UTC  
Territory: Quintana Roo (`MX-ROO`)  
Status: active maintenance and completion  
Economic mode: `ZERO_INCREMENTAL_EXTERNAL_SPEND`

## Scope boundary

This run operated only LISTIA Marketplace and Real Estate Intelligence. CloudSales was not modified. No paid external service was activated, no login or CAPTCHA was bypassed, no contact was guessed, and supply was not interpreted as demand.

## Recovered source of truth

- Supabase production, GitHub `main`, Google Drive and ChatGPT Library were recovered before work began.
- Latest prior operational checkpoint: `LISTIA_MARKETPLACE_CHECKPOINT_2026-09-04.md`.
- Latest GitHub state was preserved; only Marketplace operations files were changed.

## Controlled adaptive refresh

GitHub Actions run: `33968705823`  
Trigger commit: `a4063839ace925b385775ac67e9c1dc0b523c4f2`

The queue leased exactly three due sources with a two-hour lease and processed at most 80 public detail candidates per source.

| Source | Candidates | Accepted | New rows | Result | Next check |
|---|---:|---:|---:|---|---|
| Astamar Realty | 80 | 43 | included in batch total | succeeded | 2026-09-10 13:31 UTC |
| Plalla Real Estate | 80 | 46 | included in batch total | succeeded | 2026-09-10 13:31 UTC |
| Quintana Roo Public Inventory / propiedades.com | 0 | 0 | 0 | failed: `no_accepted_property_pages` | 2026-09-07 13:31 UTC |

Batch totals:

- Sources processed: 3.
- Validated property pages: 89.
- Unique cover images: 89.
- New Marketplace rows inserted: 15.
- Existing/duplicate rows recognized: 74.
- Invalid payload rows: 0.
- Active leases after completion: 0.
- Due Q.Roo sources remaining: 102.

The no-photo/no-publish gate remained enforced. Ten Astamar candidates and eighteen Plalla candidates without a unique property image were rejected before publication. The generic portal source produced no acceptable property pages and was not forced into inventory.

## Evidence-backed enrichment

Plalla Real Estate was enriched source-first from its official team pages:

- Rogelio Piedra — CEO — recorded as a verified professional and decision maker.
- A separate professional party was linked to the Plalla source; the company party remained canonical and primary.
- Two evidence rows were added for public name and role.
- No personal email, phone or WhatsApp was inferred for Rogelio Piedra.

Evidence:

- https://plalla.com/en/about-us/
- https://plalla.com/en/real-estate-agent/rogelio-piedra/

## Deduplication and global-property review

One exact duplicate public listing was removed from visible supply while preserving history:

- `Casa Akau`, Buy Bacalar, Spanish and English source-URL variants.
- Exact agreement: source, title, price, currency, operation, property type, bedrooms, bathrooms, area and cover image.
- Canonical public listing: `7feedd6b-3ea8-4d7c-a083-46fa8b882a96`.
- Archived duplicate: `f56bd690-f7ef-433b-acc1-e3a61d6ce8e3`.
- Both source URLs and the resolution basis are retained in listing metadata.

The existing `public.properties` object was inspected and is organization/user-owned, so it was not misused as a global physical-property object. There is still no separate canonical global-property table or relation. Therefore no `property_id` was fabricated and global-property resolved remains 0. This is the current structural blocker to one-global-property/many-listings resolution.

## Production state after batch

| Metric | Verified value |
|---|---:|
| Q.Roo rows | 7,534 |
| Public published | 7,471 |
| Public with property photo | 7,471 |
| Sale | 5,984 |
| Rent | 1,487 |
| Sources used | 107 |
| Global property IDs resolved | 0 |
| Source/prospect backups | 108 |
| With email | 88 |
| With phone | 97 |
| With verified WhatsApp | 34 |
| With named principal | 30 |
| Party evidence rows | 32 |

## Lead-routing readiness

| Status | Listings |
|---|---:|
| Claimable | 1,106 |
| Ready by email | 1,012 |
| Ready by phone only | 59 |
| Needs contact enrichment | 35 |
| Do not contact | 6,365 |
| With mapped WhatsApp | 667 |

There are no identified leads or claim candidates. Demand remains `DATA_INSUFFICIENT`; these numbers describe observed supply and routing readiness, not market demand.

## Queue and Market Intelligence checkpoint

- Adaptive source refresh due: 102.
- Contact-enrichment sources: 92.
- Missing verified email: 20.
- Missing verified phone: 11.
- Missing verified WhatsApp: 74.
- Missing verified decision maker: 78.
- Inventory/global-property resolution queue: 7,471.
- Market Intelligence snapshot refreshed: 845 segments for 2026-09-05.
- Persistent snapshot segments: 5,779, covering 2026-08-30 through 2026-09-05.

## Errors and retry queue

- `Quintana Roo Public Inventory`: no accepted detail pages; adaptive retry at 2026-09-07 13:31 UTC.
- No leases remain to release.
- No paid, private, blocked or CAPTCHA-protected source was pursued.

## Exact next action

Create the missing canonical Marketplace global-property object and listing relation without reusing the organization-owned `public.properties` table, migrate the exact Casa Akau pair as the first evidence-backed one-global-property/many-listings example, and then process the next three due Q.Roo sources with the same lease and 80-detail limits. Keep Yucatán and CDMX in discovery only; do not begin Jalisco until the shared global entity-resolution path is proven.
