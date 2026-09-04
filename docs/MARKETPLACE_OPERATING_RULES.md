# LISTIA Marketplace — Permanent Operating Rules

Last confirmed: 2026-09-04
Owner: LISTIA — MARKETPLACE
Operating version: PERMANENT OPERATING SYSTEM

## Mission
Operate LISTIA Marketplace as a continuously refreshed global real-estate knowledge graph: territory mapping, inventory, companies, professionals, developers, decision makers, verified business contacts, subscriber prospects, localization, Market Intelligence, opportunity intelligence and evidence-backed lead routing.

This workstream does not modify CloudSales and does not start unrelated LISTIA product work.

## Primary economic rule
Operate in `ZERO_INCREMENTAL_EXTERNAL_SPEND` mode unless the user explicitly approves otherwise.
Prefer existing LISTIA/Supabase/GitHub/Drive/Library data, official sites, public business profiles, public directories, permitted listings, sitemaps and structured data. Do not activate paid databases, proxies, crawling platforms, enrichment providers, verification services, external AI APIs or other paid services without approval.

Cache, reuse and incrementally refresh verified knowledge. Do not research a recently verified fact again and do not perform blind daily full-world crawls.

## Canonical graph and flywheel
Keep conceptually separate: global property, listing, source, party, professional, company, developer, project, account, lead, interest, evidence and territory.

A physical property can have multiple listings and sources. Syndication does not create additional physical supply. Resolve one global property to many listings and responsible parties using address, coordinates, project/tower/unit, price, rooms, area, media fingerprints, source identifiers, descriptions, advertiser and phone signals.

Every territory must produce localization + company map + professional map + source map + inventory + Market Intelligence. Every source visit should produce as many reusable assets as verifiably possible: provenance, company, decision makers, contacts, inventory, claim readiness and market signals.

## Mandatory geographic order
1. Quintana Roo — finish and checkpoint before advancing.
2. Yucatán.
3. Ciudad de México.
4. Guadalajara / Jalisco.
5. Monterrey / Nuevo León.
6. Puebla.
7. Querétaro.
8. Continue through the remaining Mexican states until nationwide coverage is as complete as practical.

Do not skip ahead without a clear checkpoint for the current territory.

## Sale + rent completeness rule
Each territory must cover both FOR SALE and FOR RENT inventory. Neither operation is secondary.
Include publicly verifiable houses, apartments, condos, land/lots, offices, retail/commercial, buildings, warehouses, hotels/hospitality, developments, villas, penthouses, studios and other real-estate categories that are actively marketed.
A state is not considered closed while material sale or rent source gaps remain.

## Permanent image rule
No published Marketplace property may exist without at least one valid image of that property.
NO PHOTO = NO PUBLISHED LISTING.
Never substitute placeholders, logos, unrelated images, generic stock, or another property's images.

## Parallel source-to-subscriber capture rule
Marketplace crawling and subscriber-prospect capture are ONE workflow.
Whenever LISTIA discovers, reviews, crawls, ingests, refreshes, or uses a website/source for Marketplace inventory, preserve a reusable internal source/prospect record at the same time.

Capture when publicly verifiable:
- website URL;
- company / brokerage / developer / agency name;
- CEO, owner, founder, principal, broker, listing agent, realtor, director, sales director or other responsible person;
- role;
- public professional email;
- public professional phone;
- public WhatsApp when available;
- inventory summary maximum 40 characters;
- state/territory;
- listing count attributable to that source;
- verification/provenance URL and confidence/status.

## Mandatory cross-web contact enrichment rule
The source page is only the starting point. A missing field on the source page does NOT end contact research.
For every source, advertiser, realtor, broker, brokerage, developer or project, use the exact public name to search the open web for additional verifiable professional contact data.
Mandatory enrichment path when needed:
1. listing/detail page and advertiser profile;
2. portal advertiser page, including public reveal controls such as Inmuebles24 "Ver teléfono" and WhatsApp when accessible without login;
3. official company/project website and contact/team/about/legal pages;
4. Google/web search using exact company and person names;
5. public Facebook Page/business profile;
6. public LinkedIn company and professional profiles;
7. Instagram/business profile and other public professional directories;
8. AMPI/RE/MAX/franchise/MLS or other professional-network pages;
9. press releases, interviews, business directories and public corporate pages for CEO, owner, founder and director identification.

Once a realtor/broker/person name is known, search that person separately, combined with the company/project name and location, for professional email, phone, WhatsApp and role.
Once a company/developer name is known, separately search for CEO, owner, founder, broker, commercial director, sales director and other responsible principals.
Preserve multiple contacts when verified; do not collapse a brokerage to one generic inbox if agent-level or executive contacts are public.
Record provenance and freshness. Historical contacts may be preserved but must be labeled historical rather than represented as current.
Never infer an email address from a naming pattern and never invent a phone/WhatsApp number.
A public phone or WhatsApp is a valid verified contact even if no email is found; continue searching for the missing channels rather than downgrading the verified channel.

Purpose: build the future LISTIA subscriber base in parallel with Marketplace expansion. LISTIA — MARKETPLACE owns claim-opportunity preparation, routing evidence and notification readiness. General billing, unrelated campaigns and unrelated product modules remain outside this workstream.

Routing priority: listing-specific contact > agent/realtor > branch > company/developer > direct source. Generic portals are provenance, not automatic lead recipients. If an aggregator does not initially expose the advertiser, attempt to resolve it from the listing/profile and cross-web enrichment before classifying the listing as not lead-routeable.
Never invent CEO/owner/contact data. If legal ownership is not proven, store the commercial responsible party and label the role accurately.

Canonical storage: Supabase marketplace_parties, marketplace_source_parties, marketplace_listing_parties, marketplace_source_prospect_backup.
Drive backup: LISTIA Marketplace — Fuentes y Prospectos and LISTIA Marketplace — Backup Fuentes Quintana Roo while Q.Roo is active.
Persistent rule mirrors: TAREAS, GitHub docs/MARKETPLACE_OPERATING_RULES.md, ChatGPT Library /LISTIA/LISTIA_MARKETPLACE_OPERATING_RULES.md.

## `ME INTERESA`, interest and lead rule
`ME INTERESA` is the only commercial property CTA. Functional navigation such as search, map, filters and favorites is allowed.

The click must immediately and idempotently:
1. create an Interest Event or `PENDING_INTEREST` with the known visitor/session, property, listing, global property, source, party, account, territory, attribution and permitted device metadata;
2. open the detailed property page without additional friction.

When identity becomes known, enrich the same interest into one identified lead. Repeated clicks and click + form submission must not create duplicate leads.

Lead-recipient priority is: explicitly associated LISTIA account; uploader/publisher; verified listing-specific agent; verified commercial office; verified brokerage; verified developer; verified commercial source of truth. A portal is provenance unless evidence proves the commercial relationship.

## Canonical form and anti-bot rule
Use one canonical form per LISTIA account/subscription, embedded across that account's properties and approved surfaces. Canonical fields: Nombre y apellido, Correo, Phone o WhatsApp, Fecha de entrega. Delivery options: inmediata, 3–6 meses, 6 meses o más.

Reuse the canonical Cloudflare/Turnstile, server verification, rate limit, honeypot, idempotency, spam/junk/duplicate detection and origin protection architecture. Rejected traffic must never become a valid lead or pollute demand/conversion analytics.

## Claim and WhatsApp rule
Subscriber leads are delivered according to entitlement. A verified responsible non-subscriber produces a claimable lead opportunity and a masked preview; do not claim a profile/account is ready unless it actually exists.

WhatsApp mapping is mandatory when a public professional business number is verifiable, but mapping and messaging permission are separate facts. Preserve raw/normalized number, evidence, verification time, business status, contact status, opt-in source/time and opt-out state where supported.

Automation must use only the official WhatsApp Business Platform / Cloud API with approved templates, delivery/read/failure events, retries, localization, suppression and permission controls. Never use browser bots, WhatsApp Web simulation or personal accounts.

## Market Intelligence reuse rule
Every inventory pass should also preserve data useful for LISTIA Market Intelligence: geography, operation (sale/rent), property type, price/currency, bedrooms, bathrooms, area, price/m² when valid, source freshness, contact coverage and data-quality coverage. Observed supply must never be mislabeled as demand. Demand/opportunity signals require user-engagement evidence.

## Continuous operational queues
Maintain one shared source of truth with these reusable queues rather than separate prospect lists:
- territory expansion and maintenance queue;
- adaptive source refresh queue with volatility, business value, inventory size, last-change rate, next check, worker lease and checkpoint;
- contact enrichment queue;
- inventory/global-property resolution queue;
- claim-readiness queue using the canonical claim views.

Workers must claim source batches with a worker ID and lease. Expired leases may be retried; active leases must not be processed by a second worker. Global company/property deduplication remains shared.

Very active/high-value sources receive shorter checks. Stable or low-value sources receive longer checks. Use content hashes, source IDs, timestamps and prior fingerprints to process only changed content whenever possible. Preserve history and explicit lifecycle states: NEW, UPDATED, PRICE_CHANGED, SOLD, RENTED, RESERVED, REMOVED, INACTIVE and RESPONSIBLE_PARTY_CHANGED.

## Localization and evidence rule
Localization is semantic and commercial, not literal translation. Preserve local geography, address/ZIP conventions, timezone, languages, currency, phone prefix, area/distance units, terminology, property categories, portals, associations, MLS structure, developments, microzones and aliases.

Critical values and all professional contacts require value + source URL + observed/verified time + confidence. Use NULL for unknown, CONFLICT for contradictions, UNVERIFIED when unverified and DATA_INSUFFICIENT when evidence is insufficient. Never invent data to improve completeness metrics.

## State completion checkpoint
Before moving to the next state, record at minimum:
- sale inventory and rent inventory separately;
- sources reviewed;
- properties added;
- duplicates rejected;
- listings rejected for missing real property imagery;
- geographic/map coverage;
- responsible commercial parties/contact coverage;
- source/prospect backup coverage;
- Market Intelligence/data-quality coverage;
- unresolved source gaps;
- current state status and next state.

## Continuity / anti-freeze rule
Never leave a Marketplace execution running indefinitely without returning a user-visible checkpoint.
If an operation becomes too long, repetitive, blocked, unstable, or risks freezing:
1. stop at a safe boundary;
2. close the current execution cycle;
3. report what was completed;
4. report what remains;
5. record the last verified state;
6. state the exact next action.
Resume from the checkpoint without repeating completed work or asking the user to re-explain the project.

## User-memory operating rule
The user should not have to repeat established decisions, priorities, sequences, or constraints. Recover them from TAREAS, GitHub, production, Supabase, Drive, Library, and available context before asking for repetition.

## STOP rule
STOP / DETENTE / PARA / ALTO means immediate termination of execution. After a stop command: zero additional searches, writes, deployments, database changes, or tool calls until the user gives a new instruction.

## Marketplace data-quality rules
- Deduplicate obvious duplicate listings across sources.
- Preserve best available location/map data; never invent exact coordinates.
- Preserve internal source/responsible-party provenance.
- Do not invent owner, broker, developer, advisor, phone, email, or WhatsApp data.
- Distinguish legal owner from commercial listing contact/responsible party when evidence differs.
- Prefer listing-specific responsible contact over branch/company-level fallback when verified.
- Keep sale/rent operation classification accurate and measurable.

## Scope isolation
This workstream owns Marketplace inventory, ingestion, source discovery, normalization, deduplication, listing images, location/map enrichment, Marketplace feed/search/cards/details, source/contact mapping, source-prospect capture, Market Intelligence source data, and state-by-state expansion.
If work primarily belongs to another LISTIA module, log it in the master TAREAS document instead of modifying unrelated modules here.
