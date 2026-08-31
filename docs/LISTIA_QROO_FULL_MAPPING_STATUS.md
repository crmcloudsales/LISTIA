# LISTIA — Quintana Roo Full Mapping Status

Last updated: 2026-08-31

## Scope
This document records the current clean mapping layer for the LISTIA Marketplace in Quintana Roo.

## Current clean inventory
- 7,539 listings are mapped to verified Quintana Roo localities/municipalities.
- 44 out-of-state or contaminated records are quarantined from the clean Quintana Roo map.
- 0 records remain in manual-review status.
- Current listing-level precision is locality centroid unless exact latitude/longitude becomes available.

## Canonical place layer
The map currently includes canonical coordinates for:
- Cancún
- Playa del Carmen
- Tulum
- Puerto Morelos
- Cozumel
- Puerto Aventuras
- Bacalar
- Chetumal
- Akumal
- Isla Mujeres
- Holbox
- Mahahual
- Felipe Carrillo Puerto
- Kantunilkín
- Costa Mujeres
- José María Morelos
- Xpu-Ha
- Xul-Ha

The municipality formerly named Solidaridad is normalized under the current official name Playa del Carmen while retaining historical aliases for ingestion compatibility.

## Data products
`public.marketplace_qroo_mapped_listings`
- clean listing-level geography;
- canonical locality;
- municipality;
- map latitude/longitude;
- precision marker;
- quarantined records excluded from usable map points.

`public.marketplace_qroo_map_clusters`
- locality/zone cluster coordinates;
- listing count;
- source count;
- contact coverage;
- sale/rent counts;
- median price;
- median price per m2;
- average area.

`public.marketplace_qroo_map_summary`
- municipality-level inventory/source and pricing summaries.

Edge Function: `marketplace-map-qroo`
- authenticated API for clusters, municipality summaries and filtered listing pins;
- maximum 500 results per listing request;
- filters for municipality, canonical place, operation, property type, price and bedrooms.

## Precision policy
Never present a locality centroid as an exact property location.

Priority order:
1. exact verified property coordinates;
2. verified street/address geocode;
3. neighborhood/zone centroid;
4. locality centroid.

Every map result keeps a `map_precision` value so the frontend can visually distinguish approximate from exact pins.

## Next layer
Connect this API to the LISTIA Marketplace frontend with:
- cluster-first state view;
- zoom/drill into municipality/locality;
- filter drawer;
- property cards synchronized with visible map bounds;
- explicit approximate-location treatment for centroid-based listings;
- later exact-geocode enrichment when public source data provides sufficient address evidence.
