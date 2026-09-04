# LISTIA Resource Isolation

LISTIA is an independent product ecosystem.

## Hard boundary

CloudSales and CloudCo may be inspected only as read-only implementation references. LISTIA may reimplement useful patterns, features, workflows, provider abstractions, security controls, automation ideas, and operational knowledge, but LISTIA must own the resulting implementation and resources.

LISTIA runtime must never consume, mutate, borrow, or depend on CloudSales/CloudCo:

- API keys, OAuth tokens, secrets, service accounts, or environment variables
- provider accounts, sending quotas, credits, phone numbers, or messaging identities
- sender domains or email identities
- databases, tables, queues, buckets, storage, caches, or analytics stores
- Cloudflare zones, Workers, routes, DNS records, or deployment resources
- repositories or build artifacts as runtime dependencies
- subscription entitlements, billing objects, webhooks, or automation jobs
- brand assets, copy, colors, logos, or UI identity

A feature learned from another product must be copied/reimplemented into LISTIA-owned code and LISTIA-owned infrastructure before use.

## Email boundary

LISTIA email infrastructure uses only LISTIA-owned identities and secrets. Current canonical sender identity is `info@listiaapp.com` once domain verification is complete.

Provider credentials must use LISTIA-scoped secret names such as:

- `LISTIA_RESEND_API_KEY`
- `LISTIA_BREVO_API_KEY`

Provider rows remain inactive until an independent LISTIA account/key and sender identity are verified. The dispatcher fails closed when no LISTIA provider is active.

## Provider onboarding rule

If a provider API permits creation of a new independent LISTIA account or sub-account without consuming another product's resources, automation may create it. Otherwise the integration is prepared up to the exact credential/domain/account step that requires an authorized LISTIA-owned account.

## Legacy migration rule

Legacy objects carrying CloudSales/CloudCo names are not reused as LISTIA infrastructure. They are replaced with LISTIA-owned equivalents. A legacy endpoint may remain temporarily only as a compatibility shim until dependency checks show it can be retired safely.

## CI enforcement

The resource-isolation gate scans production runtime paths for known CloudSales/CloudCo domains, secret prefixes, backend object names, and legacy endpoints. Documentation and migration notes are excluded so historical references can remain auditable.
