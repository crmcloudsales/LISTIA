# LISTIA Global Gestión Pricing & Channel Economics

Status: CANONICAL CUSTOMER PRICING MODEL
Last verified: 2026-08-24
Currency: USD unless explicitly quoted otherwise.
Scope: LISTIA only.

## 1. Customer pricing principle
The LISTIA customer buys a **Gestión**, not a provider call.

The customer does not need to see the internal AI model, telecommunications carrier, infrastructure vendor, token count or raw provider price. LISTIA shows a simple final price for the requested action and obtains authorization **before** a billable action runs.

Canonical flow:

`user intent -> standardized Gestión -> live internal cost check -> final user quote -> user approval -> execution -> actual usage reconciliation`

FREE / PRO / PREMIUM retain 30% / 20% / 10% as **internal target economics**, not rigid contractual markups for every individual Gestión. Effective markup may be higher or lower so LISTIA can keep a simple standardized price while routing among lower-cost providers. LISTIA must not intentionally execute a billable action at a loss.

## 2. Economic safeguards
- Billable fixed-price Gestiones use a minimum gross-margin floor of 5% unless intentionally marked included/free.
- Provider route and provider raw cost remain internal unless disclosure is legally required.
- Before execution, LISTIA checks current provider/route cost when the service is variable by geography, carrier, model, resolution or other external factor.
- If the cheapest compliant route cannot fit inside the already displayed price and margin floor, LISTIA does not execute. It may try another provider, block the action, or present a new quote requiring new approval.
- LISTIA never increases an already approved quote after execution.
- Prices may be updated prospectively in a new price-book version; an unexpired approved quote keeps its quoted ceiling.
- High-frequency automation may later use an explicit standing budget/cap approved by the organization, rather than prompting for every individual message.
- The economic optimization metric remains **cost per accepted output**, not headline provider price.

## 3. Progressive-use rule
LISTIA should help customers grow gradually. It must not activate large amounts of paid automation merely because a feature exists.

Default product behavior is progressive: one useful action, visible result, next useful action. Paid usage should grow organically with actual business activity and demonstrated value. Bulk campaigns, high-volume content creation or autonomous communications require an explicit user action, approved budget/cap or another clearly authorized rule.

## 4. Standardized Price Book v1
These are the customer-facing prices currently stored in `private.gestion_price_book`.

### Content
| Gestión | FREE | PRO | PREMIUM | Unit |
|---|---:|---:|---:|---|
| Property content package / language | $0.05 | $0.04 | $0.03 | package |
| Create or edit 1 image | $0.10 | $0.09 | $0.08 | image |
| Finished flyer/story/social creative | $0.15 | $0.14 | $0.12 | creative |
| Brochure up to 10 pages | $0.75 | $0.65 | $0.55 | brochure |

### Video
| Gestión | FREE | PRO | PREMIUM | Unit / release rule |
|---|---:|---:|---:|---|
| Exact-source video clip | $0.30 | $0.25 | $0.20 | up to 10 sec; benchmark guarded |
| Lip-sync | $0.10 | $0.09 | $0.08 | up to 10 sec; benchmark guarded |
| Advisor avatar from photo | $0.30 | $0.25 | $0.20 | up to 10 sec; benchmark guarded |
| Standard cinematic clip | $0.75 | $0.65 | $0.60 | up to 10 sec |
| Premium cinematic clip | $1.75 | $1.55 | $1.35 | up to 10 sec |
| Localized high-fidelity repair | $3.90 | $3.50 | $3.20 | up to 10 sec |

The benchmark-guarded rows are price ceilings, not permission to charge immediately. They remain blocked for automated paid use until HyperFrames/FFmpeg/MuseTalk/EchoMimic real accepted-output costs prove the route can meet quality and margin requirements.

### Communications
| Gestión | FREE | PRO | PREMIUM | Unit |
|---|---:|---:|---:|---|
| WhatsApp Marketing template | $0.22 | $0.20 | $0.18 | delivered message |
| WhatsApp Utility/Authentication template | $0.09 | $0.08 | $0.07 | delivered message |
| WhatsApp service-window message | $0 | $0 | $0 | message while current direct-provider economics remain zero |
| SMS global standard | $0.55 | $0.52 | $0.50 | message part/segment |
| Telegram normal reachable-chat message | $0 | $0 | $0 | message under ordinary Bot/Business limits |
| Email delivery | $0.20 | $0.18 | $0.15 | 1,000 recipients |
| AI-assisted inbound call | $0.30 | $0.27 | $0.25 | minute |
| AI-assisted outbound call | $1.25 | $1.15 | $1.10 | minute |
| Local business number | $10.00 | $9.00 | $8.00 | number / month |

Calls may be internally metered by seconds and reconciled against the approved maximum; the customer-facing unit is a minute. SMS is priced per message segment because long or non-GSM messages can consume multiple carrier segments.

### Cloudflare-backed infrastructure
| Gestión | FREE | PRO | PREMIUM | Rule |
|---|---:|---:|---:|---|
| Register domain for 1 year | live registrar quote + $1.00 | live quote + $0.75 | live quote + $0.50 | one all-in quote shown before purchase |
| Renew domain for 1 year | live renewal + $0.50 | live renewal + $0.40 | live renewal + $0.30 | one all-in quote shown before renewal |
| Static LISTIA website hosting | $0 | $0 | $0 | while the site remains within current Cloudflare Pages static/free economics |
| Content storage | $0.030 | $0.025 | $0.020 | GB-month |

## 5. Global communications scope
A global flat price does not mean every possible telephone number class is eligible.

`ai_call_outbound_minute` applies to ordinary geographic fixed/mobile destinations where LISTIA has a compliant route. Premium-rate, satellite, personal-number and special-service destinations are excluded from the standard flat price and should be blocked or separately quoted. The same principle applies to unusually surcharged toll-free or special inbound services.

`sms_global_part` applies to ordinary compliant A2P destinations where a provider/sender route exists. Premium/satellite/special services, required registrations and provider-specific restrictions may make a destination unavailable; LISTIA must not silently absorb a route that would violate the margin floor.

This lets the visible price stay globally simple while Twilio, Telnyx or future carriers compete internally on the route.

## 6. Provider strategy
### Twilio
Twilio is an approved internal fallback/benchmark provider for Voice, SMS, WhatsApp, numbers, Verify and pricing discovery. LISTIA should use Twilio's account-specific Pricing APIs before cost-sensitive international routing. Twilio is not automatically preferred merely because it is available.

### Telnyx
Telnyx remains a cost-first communications candidate. The router compares compliant routes using current destination/carrier economics and reliability.

### Meta Cloud API
Direct Meta remains preferred for WhatsApp when it reduces unnecessary BSP platform fees and operational requirements allow it.

### Telegram
Normal Bot API/authorized Business messaging can be zero provider-message cost within ordinary limits, but LISTIA still requires reachability and consent/lawful basis. A normal bot cannot cold-message a person using only a phone number.

### Amazon SES
SES remains a cost-first bulk/transactional email candidate, subject to domain verification, consent/lawful basis, unsubscribe and suppression rules.

### Cloudflare
Cloudflare is both LISTIA infrastructure and a user-facing infrastructure provider behind LISTIA. Relevant roles include Registrar, Pages, Workers, R2, DNS, CDN, SSL/TLS, WAF, Turnstile and Images. The user should see the LISTIA action and final price rather than Cloudflare product complexity.

## 7. Domain purchase UX — canonical rule
The future domain UI must remain deliberately small and mobile-first:

1. One text field: the domain the user wants.
2. LISTIA checks live availability and current registration/renewal price.
3. Show the requested domain plus **at most three** useful alternatives.
4. Each option shows one all-in first-year price and renewal price.
5. One clear approval/purchase action.

No registrar dashboard, DNS jargon or long search-results catalog should be exposed unless the user deliberately opens advanced settings. Cloudflare Registrar Search/Check is the first candidate because it can return registrability plus current `registration_cost` and `renewal_cost` and Cloudflare itself sells/renews at registry/ICANN cost. Premium domains not programmatically supported remain unavailable or require a separately designed flow.

## 8. Content Engine rule
Connected Drive/uploads are raw material, not automatic permission to spend. LISTIA extracts facts/assets, proposes the next useful content action, quotes the Gestión, obtains approval when billable, executes the cheapest route that passes the Quality Gate and then offers the next step.

Original property/advisor assets remain canonical where fidelity matters. HyperFrames/FFmpeg and protected-source composition are attempted before unnecessary regeneration. Paid premium models are escalation paths, not default spending.

## 9. Quote and execution data
`private.gestion_quotes` is the server-side authorization record. It stores the organization/user, service, plan, quantity, unit price, provider quote cost when known, service fee, total authorized amount, currency, expiry, approval, consumption and block reason.

`public.gestiones` records realized usage/cost after execution. The quote is the pre-execution commercial authorization; the Gestión is the post-execution accounting record.

## 10. Legal/customer promise
The customer-facing promise is the **final quoted Gestión price**, not a guaranteed disclosure of LISTIA's internal supplier markup. Supplier costs, routing and effective margin may vary. LISTIA may standardize prices across regions by earning more margin on cheaper routes and less margin on expensive routes, provided the route stays within the applicable margin/safety rules and the customer is not charged more than the amount they authorized.
