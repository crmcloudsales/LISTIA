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

## State completion checkpoint
Before moving to the next state, record at minimum:
- sources reviewed;
- properties added;
- duplicates rejected;
- listings rejected for missing real property imagery;
- geographic/map coverage;
- responsible commercial parties/contact coverage;
- unresolved source gaps;
- current state status and next state.

## Permanent image rule
No published Marketplace property may exist without at least one valid image of that property.
NO PHOTO = NO PUBLISHED LISTING.
Never substitute placeholders, logos, unrelated images, generic stock, or another property's images.

## Parallel source-to-subscriber capture rule
Marketplace crawling and subscriber-prospect capture are ONE workflow, not two separate projects.

Whenever LISTIA discovers, reviews, crawls, ingests, refreshes, or uses a website/source for Marketplace inventory, preserve a reusable internal source/prospect record at the same time.

For every source website, capture and maintain when publicly verifiable:
- website URL;
- company / brokerage / developer / agency name;
- CEO, owner, founder, principal, broker, listing agent, or other responsible person when verifiable;
- role of that person/entity;
- public professional email;
- public professional phone;
- public WhatsApp when available;
- a very short inventory summary, maximum 40 characters;
- state/territory;
- count of Marketplace properties attributable to that source;
- verification/provenance URL and confidence/status.

This database exists so LISTIA/CloudCo can later identify potential subscribers and route Marketplace opportunities to the correct business. LISTIA — MARKETPLACE only collects, verifies, preserves, and maps this data. Email automation, subscription offers, billing flows, and launch messaging belong to their appropriate workstreams/chats.

Do not invent CEO/owner/contact data. If legal ownership is not proven, store the commercial responsible party instead and label the role accurately. Prefer listing-specific contact over branch/company contact, and branch/company contact over a generic portal. Generic portals are provenance, not automatically the lead recipient.

Canonical structured storage is Supabase (`marketplace_parties`, `marketplace_source_parties`, `marketplace_listing_parties`, `marketplace_source_prospect_backup`). Keep a Drive backup/snapshot in `LISTIA Marketplace — Fuentes y Prospectos`, and keep the persistent operating rule in TAREAS, GitHub, and the ChatGPT Library.

## Continuity / anti-freeze rule
Never leave a Marketplace execution running indefinitely without returning a user-visible checkpoint.
If an operation becomes too long, repetitive, blocked, unstable, or risks freezing:
1. stop at a safe boundary;
2. close the current execution cycle;
3. report immediately what was completed;
4. report what remains;
5. record the last verified state;
6. state the exact next action.
Do not continue tool calls for hours without delivering status. The user can say “sigue” and work resumes from the checkpoint without repeating completed work or asking the user to re-explain the project.

## User-memory operating rule
The user should not have to repeat established decisions, priorities, sequences, or constraints. Before asking them to repeat something, recover it from persistent project sources when available: TAREAS, GitHub, production, Supabase, Drive, Library, and available conversation/personal context.

## STOP rule
STOP / DETENTE / PARA / ALTO means immediate termination of execution.
After a stop command: zero additional searches, writes, deployments, database changes, or tool calls until the user gives a new instruction.

## Marketplace data-quality rules
- Deduplicate obvious duplicate listings across sources.
- Preserve best available location/map data; never invent exact coordinates.
- Preserve internal source/responsible-party provenance.
- Do not invent owner, broker, developer, advisor, phone, or email data.
- Distinguish legal owner from commercial listing contact/responsible party when evidence differs.
- Prefer listing-specific responsible contact over branch/company-level fallback when verified.

## Scope isolation
This workstream owns Marketplace inventory, ingestion, source discovery, normalization, deduplication, listing images, location/map enrichment, Marketplace feed/search/cards/details, source/contact mapping, source-prospect capture, and state-by-state expansion.
If work primarily belongs to another LISTIA module, log it in the master TAREAS document for LISTIA — DESARROLLO instead of modifying unrelated modules here.
