# LISTIA Marketplace — Permanent Operating Rules

Last confirmed: 2026-08-30
Owner: LISTIA — MARKETPLACE

## Mission
Expand the LISTIA Marketplace to achieve the broadest practical inventory coverage in Mexico, state by state, without interfering with LISTIA — DESARROLLO, CLOUDSALES — DESARROLLO, or LISTIA — LANZAMIENTO.

## Mandatory geographic order
1. Quintana Roo — finish and checkpoint before advancing.
2. Yucatán.
3. Ciudad de México.
4. Guadalajara / Jalisco.
5. Monterrey / Nuevo León.
6. Puebla.
7. Continue through the remaining Mexican states until nationwide coverage is as complete as practical.

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
- CEO, owner, founder, principal, broker, listing agent, or responsible person;
- role;
- public professional email;
- public professional phone;
- public WhatsApp when available;
- inventory summary maximum 40 characters;
- state/territory;
- listing count attributable to that source;
- verification/provenance URL and confidence/status.

Purpose: build the future LISTIA/CloudCo subscriber base in parallel with Marketplace expansion. LISTIA — MARKETPLACE only collects, verifies, preserves, and maps this data. Campaigns, email automation, billing, and subscription offers belong to their own workstreams.

Routing priority: listing-specific contact > branch > company/developer > direct source. Generic portals are provenance, not automatic lead recipients. If an aggregator does not publicly expose the advertiser, the listing may remain useful for inventory/market data but is not lead-routeable until a verifiable commercial responsible party or original source is resolved.
Never invent CEO/owner/contact data. If legal ownership is not proven, store the commercial responsible party and label the role accurately.

Canonical storage: Supabase marketplace_parties, marketplace_source_parties, marketplace_listing_parties, marketplace_source_prospect_backup.
Drive backup: LISTIA Marketplace — Fuentes y Prospectos and LISTIA Marketplace — Backup Fuentes Quintana Roo while Q.Roo is active.
Persistent rule mirrors: TAREAS, GitHub docs/MARKETPLACE_OPERATING_RULES.md, ChatGPT Library /LISTIA/LISTIA_MARKETPLACE_OPERATING_RULES.md.

## Market Intelligence reuse rule
Every inventory pass should also preserve data useful for LISTIA Market Intelligence: geography, operation (sale/rent), property type, price/currency, bedrooms, bathrooms, area, price/m² when valid, source freshness, contact coverage and data-quality coverage. Observed supply must never be mislabeled as demand. Demand/opportunity signals require user-engagement evidence.

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
