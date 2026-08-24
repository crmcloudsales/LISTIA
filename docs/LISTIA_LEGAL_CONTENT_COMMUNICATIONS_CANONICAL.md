# LISTIA Legal Rules — Content, AI & Communications

Status: CANONICAL PRODUCT/ENGINEERING BASELINE
Last reconciled: 2026-08-24
Scope: LISTIA only.

This is an engineering/product compliance baseline, not jurisdiction-specific legal advice. Mandatory local law, platform rules and later professional legal review prevail where required.

## 1. Global design principle
Compliance must be an executable product state, not merely a paragraph in Terms.

LISTIA must record, where applicable:
- communication channel and destination;
- consent/lawful-basis status and source;
- consent text/version and timestamp;
- opt-out/revocation/block status;
- template/category/locale/provider approval identifiers;
- delivery/read/reply/failure state;
- property IDs included in remarketing;
- actual provider cost and linked Gestión;
- audit timestamps.

## 2. Channel policy
Default outreach priority is WhatsApp -> SMS -> Telegram, with email as additional/parallel nurture and voice for high-intent or service workflows. Priority never overrides consent, legal restrictions, platform rules, reachability, do-not-contact state or expected user harm.

### WhatsApp
- Business-initiated/out-of-window messages use approved Meta templates where required.
- Marketing property recommendations are MARKETING. LISTIA must never intentionally misclassify marketing as Utility to reduce fees.
- Record opt-in source, template category, locale and opt-out.
- A multi-property carousel may include 2–10 relevant cards where supported and approved.
- User replies/service-window messaging follows current Meta rules and current rate card.
- Do not send after channel opt-out/block.

### SMS
- Country-specific A2P/sender-ID/registration/carrier rules apply.
- Record lawful basis/opt-in where required, suppression/STOP equivalent, local quiet hours and applicable do-not-call/do-not-text restrictions.
- Carrier/regulatory fees are provider costs and enter Gestiones at actual realized cost.

### Telegram
- A standard bot cannot cold-contact a person merely because LISTIA has their phone number.
- Use Telegram only after a reachable chat exists because the person initiated/connected the bot, or through an authorized Telegram Business connection with appropriate rights.
- Standard Bot API messages within ordinary limits may have zero provider-message cost, but consent/opt-out and privacy rules still apply.
- Store Telegram chat reachability independently from WhatsApp/SMS phone reachability.

### Email
- Marketing/nurture email requires a lawful basis or consent as applicable.
- Provide sender identity and unsubscribe mechanisms where required.
- Maintain suppression lists and honor unsubscribes promptly.
- Avoid purchased/scraped lists unless a lawful basis and applicable sending rules have been validated.

### Voice
- Outbound automated/AI calls require jurisdiction-aware telemarketing compliance, do-not-call screening where applicable, caller-ID rules, time-of-day/quiet-hour rules and required consent.
- Call recording/transcription requires jurisdiction-aware consent/notice.
- Where required or appropriate, disclose that the caller is interacting with AI/automation.
- Do not use deceptive caller-ID spoofing or impersonation.

## 3. Lead channel data model
`public.lead_contact_channels` is the canonical per-lead/channel registry. It stores address, normalized address, reachability, consent status/source/text version/timestamps, opt-out, verification and contact history.

The original `leads.whatsapp` and `leads.email` fields remain compatibility fields; new omnichannel logic should use `lead_contact_channels`.

## 4. Communications audit
`private.communication_dispatches` records each inbound/outbound communication or attempted dispatch, including channel, provider/template, consent snapshot, included property IDs, status, provider cost and linked Gestión.

Do not put raw provider secrets in communication logs.

## 5. Remarketing and multiple properties
LISTIA may recommend additional relevant properties beyond the property initially requested when allowed by consent/lawful basis and platform rules.

The selection engine should prioritize:
- current availability;
- lead budget;
- location/market fit;
- bedrooms/property-type fit;
- purchase/rental/investment intent;
- prior interactions and explicit preferences;
- diversity without misleading substitutions.

Every recommended card/listing must use verified current property data. Do not advertise an unavailable property as available merely to generate a response.

## 6. Uploaded/connected content rights
Organizations/users retain rights they hold in uploaded/connected content. They must represent that they have sufficient rights, licenses and permissions to provide and use property photos, videos, floorplans, brochures, logos, text, music, documents, personal images, voice recordings and other materials.

LISTIA receives the limited rights necessary to host, analyze, transform, edit, translate, compose, publish and transmit that material to provide requested LISTIA functionality, subject to the Terms, Privacy Policy and organization settings.

## 7. Advisor/person identity and voice
When LISTIA creates or edits realistic media depicting a real advisor/person:
- use only material the organization/user is authorized to use;
- obtain explicit authorization/consent for Digital Twin, avatar, voice clone or material synthetic alteration when required;
- store consent evidence/version where the workflow depends on it;
- prohibit deceptive impersonation, non-consensual sexual content, fraud or identity misuse;
- preserve source identity/property content according to the applicable Quality Gate.

## 8. Property fidelity
AI generation cannot be treated as proof that a property is accurate. Where factual visual fidelity is required, original source assets are canonical.

LISTIA should prefer deterministic composition, protected regions and localized editing. Generated changes that could materially misrepresent property condition, dimensions, finishes, views, included furniture, surroundings or availability require clear authorization and must not be represented as documentary reality if they are conceptual/staged.

## 9. Content Engine factual rules
Prices, dimensions, availability, addresses, phone numbers, fees, commissions, legal disclosures and other factual fields must originate from verified structured data or approved source material.

Marketing copy may be creative, but must not invent facts. If a material fact is missing, LISTIA requests/flags it rather than fabricating it.

## 10. AI output and human responsibility
LISTIA uses automated quality checks and may use multiple models, but does not guarantee every AI output is error-free. High-risk or unresolved outputs must be blocked, repaired or require review rather than automatically published.

## 11. Usage pricing and third parties
Third-party prices may vary by country, carrier, category, duration, resolution, model, taxes and provider policy. Terms must disclose:
- subscription prices separately from usage;
- Gestiones/usage-based charges;
- actual third-party cost plus plan markup;
- price changes and pass-through external fees;
- applicable taxes/currency/payment charges;
- that no fixed per-action price is guaranteed unless explicitly quoted.

## 12. Data protection
Only send the minimum data needed to each provider. Provider routing must consider data sensitivity, regional transfer restrictions, provider training/data-use terms and organization settings.

Consent records, communication history, transcripts and lead profiles are personal data and must be protected accordingly.

## 13. Suppression is global enough to be safe
A channel-specific opt-out suppresses that channel immediately. Where a person's request reasonably means “do not contact me,” LISTIA should apply an organization-wide do-not-contact state rather than trying another channel to evade the request.

The channel fallback sequence exists to improve service/reachability, not to circumvent consent or an opt-out.

## 14. Jurisdiction-aware enforcement
Before automatic outbound campaigns scale in a country, LISTIA must have a country policy profile covering at minimum:
- marketing consent/lawful basis;
- electronic-message rules;
- telemarketing/automated-call rules;
- call-recording consent;
- quiet hours/timezone;
- sender registration/identity;
- required disclosures;
- unsubscribe/opt-out behavior;
- data retention/transfer requirements.

If the country profile is missing for a high-risk action, default to the safer behavior or human review.

## 15. Terms/Privacy versioning
Changes that materially expand communication channels, AI processing, content reuse, provider categories or billing behavior require review of public Terms and Privacy Policy. Material versions should have an effective date and in-product notice/renewed consent where legally required.
