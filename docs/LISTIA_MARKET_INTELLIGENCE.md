# LISTIA Market Intelligence

## Purpose
Turn LISTIA marketplace ingestion, research, inventory enrichment and user behavior into a paid real-estate intelligence product. This is a permanent product capability, not a one-off report.

LISTIA must reuse the same data collected for marketplace inventory to help agents, brokers, developers and investors understand observed supply, pricing, market mix, competition and—once enough behavioral data exists—demand and opportunity.

## Product principle
Never confuse low observed supply with high demand. Supply comes from published LISTIA marketplace inventory. Demand must come from actual LISTIA behavior such as listing views, favorites, inquiries, saved-search matches, contact actions and leads. Recommendations must disclose data freshness, coverage and methodology.

Never mix MXN and USD in a price median. Price charts and price-per-m2 metrics must be calculated per currency unless an explicit dated FX conversion is applied.

## Backend already deployed in Supabase
Project: LISTIA production.

Objects:
- `analytics.market_supply_live` — live supply aggregation by geography, operation, type, bedrooms and currency.
- `analytics.market_demand_live_30d` — 30-day listing-linked engagement aggregation using favorites, inquiries, saved-search matches and web events.
- `public.market_intelligence_daily_snapshots` — daily historical snapshots for trends.
- `public.refresh_market_intelligence_daily_snapshot()` — service-only snapshot refresh.
- `public.get_market_intelligence(organization_id, country_code, state_region, city, operation_type)` — authenticated plan-gated JSON RPC for UI consumption.

Indexes were added for marketplace-listing market dimensions and demand-event joins.

## Subscription behavior
### FREE
No full intelligence dashboard. Show an attractive preview and upgrade CTA.

### PRO
Unlock live core market intelligence:
- Inventory total.
- Sale vs rent mix.
- Inventory by city/municipality.
- Inventory by property type.
- Inventory by bedroom count.
- Median price by city and currency.
- Median price/m2 by currency.
- Source count and data freshness.
- Filters by country, state, city, operation.

### PREMIUM
Includes PRO plus developer/investor intelligence:
- Segment Intelligence matrix: city x property type x operation x currency.
- Observed supply classification: low / balanced / high.
- 30-day engagement per listing.
- Opportunity/build signal only when demand evidence exists.
- High-competition signals.
- Potential-gap signals.
- Historical trends from daily snapshots.
- Comparative market views across cities/states.
- Data-quality and coverage indicators.
- Developer Mode with product mix, pricing and competitive-supply analysis.

A `potential_gap` signal must require both comparatively low observed supply and above-median engagement per listing. If there is insufficient behavioral evidence, the system must return `data_insufficient`, not a recommendation.

## Recommended UI
Navigation entry: `Market Intelligence` or `Market Data`.

### Market Pulse
Top cards:
- Active observed inventory.
- Sale inventory.
- Rental inventory.
- Cities covered.
- Sources represented.
- Last data update.

### Supply Mix
Charts:
- Horizontal bar: inventory by city.
- Donut/bar: property type mix.
- Bar: bedroom mix.
- Sale/rent mix.
- Map/heatmap when geocoding coverage is sufficient.

### Pricing
Charts:
- Median asking price by city, always separated by currency.
- Median asking price/m2 by city and property type, always separated by currency.
- Price distribution / ranges.
- Historical price trend from daily snapshots.

### Premium Opportunity Matrix
Rows: city/market.
Columns: property types or unit profiles.
Cells should show:
- Observed inventory.
- Share of local inventory.
- Engagement per listing.
- Supply signal.
- Build signal.
- Median asking price/m2 by currency.

Use labels such as `Potential gap`, `High competition`, `Watch`, `Insufficient demand data`. Do not label a segment `Build this` based only on inventory.

### Developer Mode
For a selected market, answer questions such as:
- What property types have the most observed competing supply?
- What types have the least observed supply?
- What bedroom configurations dominate inventory?
- Which price bands dominate?
- Which segments receive disproportionate favorites/inquiries relative to inventory?
- Where is engagement per listing high relative to competing supply?
- How has supply changed over 7/30/90 days?

Future advanced metrics after enough history:
- Listing age / days observed.
- New inventory velocity.
- Removal velocity / proxy absorption.
- Supply growth rate.
- Inquiry-to-inventory ratio.
- Favorite-to-inventory ratio.
- Search-to-inventory mismatch.
- Lead-quality-adjusted demand score.

## Demand instrumentation required in the LISTIA app
The developer chat should ensure marketplace UX emits normalized events into `web_events` / existing analytics plumbing. Suggested canonical names:
- `marketplace_search`
- `listing_view`
- `listing_contact_click`
- `listing_whatsapp_click`
- `listing_phone_click`
- `favorite_add`
- `favorite_remove`
- `saved_search_create`
- `inquiry_submit`
- `lead_created`

Events should include `listing_id` when applicable and metadata for search filters when applicable. Do not store unnecessary personal data in market-intelligence aggregates.

## Data-quality requirements
Every dashboard must expose or internally track:
- Data timestamp.
- Observed inventory count.
- Image coverage.
- Source coverage/count.
- Currency coverage.
- Known geographic coverage gaps.
- Deduplication status.
- Contact/provenance status where relevant.

Marketplace ingestion rules remain strict: no fake listings, no generic placeholders, no pretending a portal benchmark is LISTIA inventory, and no claiming complete-market coverage before it is demonstrated.

## Current Quintana Roo baseline — 2026-08-30
Production query at the time of this handoff:
- Total Q.Roo marketplace rows: 7,140.
- Public published inventory: 7,089.
- Public published inventory with cover photo: 7,089 / 7,089.
- Sale: 5,814.
- Rent: 1,275.
- Currency mix: 6,675 MXN listings and 414 USD listings in public Q.Roo inventory.

Largest observed public inventory markets:
- Tulum: 1,707.
- Benito Juárez: 1,509.
- Playa del Carmen: 1,049.
- Cancún: 950.
- Solidaridad: 757.
- Puerto Morelos: 248.
- Cozumel: 193.
- Puerto Aventuras: 159.
- Bacalar: 132.
- Akumal: 102.
- Isla Mujeres: 71.
- Chetumal: 57.
- Mahahual: 43.
- Holbox: 38.

Observed sale supply by normalized property type:
- Apartment: 2,790.
- House: 1,395.
- Land: 1,009.
- Condo: 162.
- Building: 117.
- Commercial: 113.
- Development: 108.
- Villa: 49.
- Penthouse: 30.

Observed sale bedroom mix where known:
- 1 bedroom: 1,001.
- 2 bedrooms: 1,285.
- 3 bedrooms: 1,117.
- 4 bedrooms: 463.
- 5+ bedrooms: 225.
- Unknown bedroom count: 1,718, so bedroom conclusions must display a completeness warning.

The largest observed sale category is apartments. The smallest categories should NOT automatically be presented as development opportunities until LISTIA demand signals support that conclusion.

## Cross-chat handoff rule
The LISTIA development chat should treat this document and the deployed Supabase objects as authoritative inputs whenever the user says `sigue desarrollando LISTIA`.

The commercial/subscriber-acquisition workstream should use the product value described here to sell Premium/Pro, but must avoid overstating market completeness or presenting statistical signals as guaranteed investment advice.

The marketplace-research workstream owns continued inventory ingestion, source/contact enrichment, market benchmarks, data-quality improvement and market-intelligence data coverage.
