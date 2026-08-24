# LISTIA Legal Rules — Content, AI, Gestiones & Communications

Status: CANONICAL PRODUCT/ENGINEERING BASELINE
Last reconciled: 2026-08-24
Scope: LISTIA only.

This is an engineering/product compliance baseline, not jurisdiction-specific legal advice. Mandatory local law, platform rules and later professional legal review prevail where required.

## 1. Global design principle
Compliance and commercial authorization must be executable product state, not merely paragraphs in Terms.

LISTIA must record, where applicable:
- communication channel and destination;
- consent/lawful-basis status and source;
- consent text/version and timestamp;
- opt-out/revocation/block status;
- template/category/locale/provider approval identifiers;
- delivery/read/reply/failure state;
- property IDs included in remarketing;
- quoted Gestión/service, quantity, unit price and authorized ceiling;
- actual provider cost and linked realized Gestión;
- audit timestamps.

## 2. Gestión pricing and authorization
The customer buys a LISTIA Gestión, not a named provider call.

- Customer-facing prices are standardized in a versioned Price Book when technically and legally practical.
- FREE / PRO / PREMIUM 30% / 20% / 10% are internal target economics, not a promise that every Gestión always equals raw provider cost plus exactly that percentage.
- Effective supplier margin may vary by country, route and provider so LISTIA can keep simple prices while avoiding loss.
- A billable action must show a final price or maximum authorized amount before execution unless it is already covered by a clearly approved standing budget/rule.
- Provider/model identity and raw supplier cost may remain internal unless law requires disclosure.
- LISTIA must not increase an approved quote after execution. If current provider economics no longer fit, reroute, block or request new approval.
- Fixed billable routes use an internal minimum-margin/cost safety gate; intentionally free/included actions are separate.
- Price-book changes are prospective. Unexpired approved quotes remain subject to their stored terms/ceiling.
- Taxes or mandatory government/regulatory amounts must be handled according to applicable law and disclosed as part of the quote where required.

`private.gestion_price_book` is the canonical internal customer price book. `private.gestion_quotes` stores pre-execution authorization. `public.gestiones` records realized usage/accounting after execution.

## 3. Progressive-spend rule
LISTIA should grow usage with the customer's actual activity rather than create a large autonomous bill merely because automation is available.

Default behavior is progressive: perform/propose the next useful step, show value, then offer the next step. High-volume content, campaigns and autonomous communications require explicit action, an approved campaign/budget or another clear standing authorization. Low friction does not mean hidden spending.

## 4. Channel policy
Default outreach priority is WhatsApp -> SMS -> Telegram, with email as additional/parallel nurture and voice for high-intent or service workflows. Priority never overrides consent, legal restrictions, platform rules, reachability, do-not-contact state or expected user harm.

### WhatsApp
- Business-initiated/out-of-window messages use approved Meta templates where required.
- Marketing property recommendations are MARKETING. LISTIA must never intentionally misclassify marketing as Utility to reduce fees.
- Record opt-in source, template category, locale and opt-out.
- A multi-property carousel may include 2–10 relevant cards where supported and approved.
- Do not send after channel opt-out/block.

### SMS
- Country-specific A2P/sender-ID/registration/carrier rules apply.
- Record lawful basis/opt-in where required, suppression/STOP equivalent, local quiet hours and applicable do-not-call/do-not-text restrictions.
- Standard global LISTIA SMS pricing applies only where a compliant ordinary A2P route exists.

### Telegram
- A standard bot cannot cold-contact a person merely because LISTIA has their phone number.
- Use Telegram only after a reachable chat exists because the person initiated/connected the bot, or through an authorized Telegram Business connection with appropriate rights.
- Standard Bot API messages within ordinary limits may have zero provider-message cost, but consent/opt-out and privacy rules still apply.

### Email
- Marketing/nurture email requires a lawful basis or consent as applicable.
- Provide sender identity and unsubscribe mechanisms where required.
- Maintain suppression lists and honor unsubscribes promptly.

### Voice
- Outbound automated/AI calls require jurisdiction-aware telemarketing compliance, do-not-call screening where applicable, caller-ID rules, time-of-day/quiet-hour rules and required consent.
- Call recording/transcription requires jurisdiction-aware consent/notice.
- Where required or appropriate, disclose AI/automation.
- Global standard voice pricing applies only to ordinary geographic fixed/mobile destinations where a compliant route exists.
- Premium-rate, satellite, personal-number, special-service and other exceptional-cost classes are outside the standard flat rate and must be blocked or separately quoted.

## 5. Lead channel data model
`public.lead_contact_channels` is the canonical per-lead/channel registry. It stores address, normalized address, reachability, consent status/source/text version/timestamps, opt-out, verification and contact history.

The original `leads.whatsapp` and `leads.email` fields remain compatibility fields; new omnichannel logic should use `lead_contact_channels`.

## 6. Communications audit
`private.communication_dispatches` records each inbound/outbound communication or attempted dispatch, including channel, provider/template, consent snapshot, included property IDs, status, provider cost and linked Gestión.

Do not put raw provider secrets in communication logs.

## 7. Remarketing and multiple properties
LISTIA may recommend additional relevant properties beyond the property initially requested when allowed by consent/lawful basis and platform rules.

The selection engine should prioritize current availability, lead budget, location/market fit, bedrooms/property-type fit, purchase/rental/investment intent, prior interactions and explicit preferences. Every recommended property must use verified current data; an unavailable property must not be represented as available merely to generate a response.

## 8. Uploaded/connected content rights
Organizations/users retain rights they hold in uploaded/connected content. They must represent that they have sufficient rights, licenses and permissions to provide and use property photos, videos, floorplans, brochures, logos, text, music, documents, personal images, voice recordings and other materials.

LISTIA receives the limited rights necessary to host, analyze, transform, edit, translate, compose, publish and transmit that material to provide requested LISTIA functionality, subject to the Terms, Privacy Policy and organization settings.

## 9. Advisor/person identity and voice
When LISTIA creates or edits realistic media depicting a real advisor/person:
- use only material the organization/user is authorized to use;
- obtain explicit authorization/consent for Digital Twin, avatar, voice clone or material synthetic alteration when required;
- store consent evidence/version where the workflow depends on it;
- prohibit deceptive impersonation, fraud, unlawful identity misuse and non-consensual synthetic media;
- preserve source identity/property content according to the applicable Quality Gate.

## 10. Property fidelity
AI generation cannot be treated as proof that a property is accurate. Where factual visual fidelity is required, original source assets are canonical.

LISTIA should prefer deterministic composition, protected regions and localized editing. Generated changes that could materially misrepresent property condition, dimensions, finishes, views, included furniture, surroundings or availability require clear authorization and must not be represented as documentary reality if they are conceptual/staged.

## 11. Content Engine factual rules
Prices, dimensions, availability, addresses, phone numbers, fees, commissions, legal disclosures and other factual fields must originate from verified structured data or approved source material. Marketing copy may be creative, but missing facts must not be fabricated.

## 12. AI output and human responsibility
LISTIA uses automated quality checks and may use multiple models, but does not guarantee every AI output is error-free. High-risk or unresolved outputs must be blocked, repaired or require review rather than automatically published.

## 13. Global standard pricing vs exceptional routes
A globally standardized customer price is a product simplification, not a representation that underlying telecommunications/provider costs are identical worldwide.

LISTIA may cross-subsidize cheaper and more expensive ordinary routes through flexible internal margin. However, number/service classes with materially abnormal pricing — such as premium-rate, satellite or special-service termination — must not silently consume the standard price. They are excluded, blocked or separately quoted.

If a standard destination's live provider cost exceeds the internal safety threshold, LISTIA tries another compliant provider. If no route fits, the action is blocked before execution and the customer can receive a new quote if an alternative is appropriate.

## 14. Domain and website economics
Cloudflare may serve both as LISTIA infrastructure and as an internal provider used to deliver customer domain/website services.

Domain registration/renewal is dynamically quoted because TLD/registry prices differ. The customer should see one all-in annual price and renewal price before purchase, while the internal route can use Cloudflare Registrar's current registry/ICANN pricing plus the applicable LISTIA service fee.

The default domain-search UX should expose one requested domain plus at most three alternatives, not registrar complexity. Premium/unsupported domains require a separately supported flow rather than hidden surcharge.

Static website hosting may be included while current Cloudflare Pages static/free economics and LISTIA usage policy allow it. Paid Functions, storage or other measurable infrastructure that becomes material follows an approved Gestión/budget rule.

## 15. Data protection
Only send the minimum data needed to each provider. Provider routing must consider data sensitivity, regional transfer restrictions, provider training/data-use terms and organization settings. Consent records, communication history, transcripts and lead profiles are personal data and must be protected accordingly.

## 16. Suppression is global enough to be safe
A channel-specific opt-out suppresses that channel immediately. Where a person's request reasonably means “do not contact me,” LISTIA should apply an organization-wide do-not-contact state rather than trying another channel to evade the request.

## 17. Jurisdiction-aware enforcement
Before automatic outbound campaigns scale in a country, LISTIA must have a country policy profile covering at minimum marketing consent/lawful basis, electronic-message rules, telemarketing/automated-call rules, call-recording consent, quiet hours/timezone, sender registration/identity, required disclosures, unsubscribe/opt-out behavior, and data retention/transfer requirements.

If the country profile is missing for a high-risk action, default to the safer behavior or human review.

## 18. Terms/Privacy versioning
Changes that materially expand communication channels, AI processing, content reuse, provider categories or billing behavior require review of public Terms and Privacy Policy. Material versions should have an effective date and in-product notice/renewed consent where legally required.
