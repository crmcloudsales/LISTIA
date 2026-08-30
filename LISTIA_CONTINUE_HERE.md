# LISTIA — CONTINUE HERE

This file is the cross-chat continuation entrypoint for LISTIA development and commercial work.

Before continuing LISTIA, read these files:

1. `ops/market-intelligence-state.json` — current live state, Supabase objects, backups and next actions.
2. `docs/LISTIA_MARKET_INTELLIGENCE.md` — product + engineering specification for Market Intelligence.
3. `docs/LISTIA_MARKET_INTELLIGENCE_COMMERCIAL_HANDOFF.md` — commercial/subscriber-acquisition use of the same intelligence.

## Active product direction
LISTIA marketplace research/inventory is now also a product-data engine. The same continuously collected inventory must power paid Market Intelligence dashboards.

- FREE: preview.
- PRO: live market supply/pricing charts.
- PREMIUM: segment intelligence, demand signals, trends and Developer Mode.

Backend is already deployed in Supabase. Do not rebuild it from scratch before inspecting the deployed objects and the state file.

## Critical statistical rules
- Observed supply is NOT demand.
- Never mix MXN and USD price medians without explicit dated FX conversion.
- Premium opportunity/build signals require actual demand/engagement evidence.
- If demand evidence is weak, show `data_insufficient`.
- Display data freshness and coverage quality.

## Workstream ownership
- Marketplace research/inventory workstream: ingestion, sources, contacts, benchmarks, data quality, market coverage.
- Development workstream: app UI, graphs, filters, event instrumentation, historical charts, Premium Developer Mode.
- Commercial workstream: subscriber acquisition and monetization using Market Intelligence value without overclaiming completeness or guaranteeing investment outcomes.

When the user says `sigue desarrollando LISTIA`, use these documents as active requirements.
