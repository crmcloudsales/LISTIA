# LISTIA — Real Estate Search → Marketplace + Contacts + Market Intelligence

Last updated: 2026-08-31

## Purpose
Turn an external real-estate research result set into one controlled LISTIA pipeline:

1. preserve the original search/share reference (`seed_ref`);
2. normalize direct public listing results;
3. deduplicate listings with a stable fingerprint;
4. create/update LISTIA Marketplace records;
5. capture publicly verifiable commercial contacts and field-level evidence;
6. refresh `marketplace_source_prospect_backup` for future subscriber/prospect workflows;
7. preserve listing observations for price/inventory history;
8. maintain observed-market snapshots for future analytics/statistics.

This workflow does **not** scrape Google Search result HTML. Google/shared-search wrappers are research entry points only. Export the results to JSON/CSV or provide the direct public listing URLs. Direct listing pages are fetched only when public, HTTPS and allowed by `robots.txt`.

## Entry workflow
`.github/workflows/listia-real-estate-search-import.yml`

Manual inputs:
- `seed_ref`: original discovery/search reference. The current seed is `https://share.google/xjrJKOTyHn3XkugbN`.
- `input_ref`: repo JSON/CSV path or HTTPS JSON/CSV export.
- `channel`: default `real_estate_search`.
- `max_items`: hard bounded.
- `batch_size`: max 250.

GitHub Actions uses OIDC (`id-token: write`) with audience `listia-marketplace-search-ingest`. No Supabase service-role key is stored in GitHub.

## Supported JSON shapes
### Already normalized
```json
{
  "seed_ref": "https://share.google/...",
  "items": [
    {
      "source": {
        "name": "Brokerage or developer",
        "url": "https://example.com",
        "rights_basis": "public_link_only"
      },
      "listing": {
        "external_key": "optional-source-id",
        "page_url": "https://example.com/property/123",
        "title": "Property title",
        "operation_type": "sale",
        "property_type": "apartment",
        "price": "3500000",
        "currency": "MXN",
        "city": "Playa del Carmen",
        "state_region": "Quintana Roo",
        "country_code": "MX",
        "cover_image_url": "https://example.com/image.jpg",
        "rights_basis": "public_link_only",
        "rights_confirmed": false,
        "publish_authorized": false
      },
      "contacts": [
        {
          "party_type": "realtor",
          "person_name": "Public professional name",
          "company_name": "Public company",
          "email": "public-business@example.com",
          "phone": "+52...",
          "whatsapp": "+52...",
          "role": "realtor",
          "evidence_url": "https://example.com/property/123",
          "confidence": "0.90"
        }
      ]
    }
  ]
}
```

### Direct URLs
```json
{
  "seed_ref": "https://share.google/...",
  "urls": [
    "https://broker.example/property/1",
    "https://developer.example/project/unit-2"
  ]
}
```

The preparer extracts public JSON-LD/metadata, visible `mailto:`, `tel:` and WhatsApp links. It does not infer an email or phone number.

### CSV
The preparer accepts common columns including `source_name`, `source_url`, `page_url`, `title`, `operation_type`, `property_type`, `price`, `currency`, location/area/bed/bath fields and public-contact/evidence columns.

## Publication policy
Every discovered item may be preserved for internal Market Intelligence, but automatic public publication is intentionally stricter.

Automatic `public/published` requires all of:
- `rights_basis` = `authorized_feed` or `licensed_partner`;
- `rights_confirmed = true`;
- `publish_authorized = true`;
- a real image URL.

`public_link_only` discoveries are staged as `private/draft` by this workflow. They still produce observations and may be reviewed/promoted later. This prevents the ingestion workflow from increasing the existing rights-governance debt.

## Contact storage
Canonical contact graph:
- `marketplace_parties`
- `marketplace_source_parties`
- `marketplace_listing_parties`
- `marketplace_party_evidence`
- derived `marketplace_source_prospect_backup`

Contacts must be public/professional and evidence-backed. Never infer legal ownership. Never invent CEO, owner, email, phone or WhatsApp data.

## Audit / staging storage
Private service-only tables:
- `private.marketplace_search_ingestion_runs`
- `private.marketplace_search_ingestion_items`
- `private.marketplace_listing_identity`
- `private.marketplace_listing_observations`
- `private.market_observed_daily_snapshots`

These preserve run-level counts, raw payload, normalization, errors, dedupe identity and historical observations.

## Analytics
Existing LISTIA public-market snapshot remains scheduled at 06:10 America/Cancun context.

The new observed-market snapshot is scheduled at 06:20 and uses the latest observation per listing (up to 120 days) to calculate:
- observed inventory;
- source count;
- median price;
- median price/m²;
- average area;
- contact coverage count and percentage;
- dimensions for country/state/city, sale/rent, property type, bedrooms and currency.

Observed supply must never be mislabeled as demand. Demand/opportunity analytics require actual user engagement evidence.

## Security
- Edge Function: `marketplace-search-private-ingest`.
- GitHub OIDC validates repository, owner, main ref and exact workflow ref.
- Batch max: 250.
- Edge body max: 6 MB.
- Only HTTPS page/evidence URLs are accepted.
- Supabase RPC `public.ingest_marketplace_search_batch` is executable only by `service_role`.
- staging/observation tables are private with no anon/authenticated grants.

## Current Google share link
`https://share.google/xjrJKOTyHn3XkugbN` did not resolve from the current execution environment. It is preserved as the seed reference. To ingest the actual result set, provide/export its direct result URLs or a JSON/CSV export into `ops/real-estate-search-import.json` (or use an HTTPS export as `input_ref`) and run the workflow.
