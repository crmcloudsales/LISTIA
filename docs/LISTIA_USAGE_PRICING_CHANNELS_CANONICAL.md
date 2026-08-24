# LISTIA Global Gestión Pricing & Channel Economics

Status: CANONICAL CUSTOMER PRICING MODEL — v2
Last reconciled: 2026-08-24
Currency: USD unless explicitly quoted otherwise.
Scope: LISTIA only.

## 1. Customer pricing principle
The LISTIA customer buys a **Gestión**, not a provider call.

Normal flow:
`user intent -> Gestión -> internal live/reference cost -> final quote/authorized maximum -> user approval -> execution -> actual usage reconciliation`

Provider/model/carrier names and raw supplier prices remain internal by default. LISTIA optimizes for lowest `cost_per_accepted_output` that passes quality, legal and reliability gates.

## 2. Subscription plans
- FREE: US$0/month; up to 3 non-archived properties.
- PRO: US$97/month; 1 user.
- PREMIUM: US$147/month; 2 users included.
- Premium extra seat: US$47/month.

Adding a fourth non-archived property on FREE requires changing to a paid plan.

## 3. Ordinary Gestión markup targets
- FREE: **50%**
- PRO: **25%**
- PREMIUM: **12.5%**

For ordinary variable-cost Gestiones, effective markup may flex when standardized pricing/routing requires it, with a general 5%-50% safety band. LISTIA must not intentionally execute at a loss and must never exceed an already approved user quote.

## 4. Domain exception — same in every plan
Domains do **not** use the 50/25/12.5 plan discount structure.

Registration and renewal use the same dynamic markup in FREE, PRO and PREMIUM:
- wholesale <= US$10 -> +100%
- >US$10 and <=US$20 -> +80%
- >US$20 and <=US$50 -> +60%
- >US$50 -> +50%

The objective is strong but reasonable domain margin without teaser first-year pricing. Renewal uses the same markup rule as registration. Registry/registrar wholesale changes may change the all-in future quote, but LISTIA does not intentionally raise the renewal markup simply because it is a renewal.

Premium/exceptional domains require a separate live quote.

Preferred suggestion pool: `.com`, `.com.mx`, `.mx`, `.net`, `.us`, `.realestate`, `.uk`, `.it`, `.web` when available. Show requested domain + at most 3 useful alternatives. `.app` and `.ai` are not default suggestions.

## 5. Media benchmark-guarded reference economics
These are engineering estimates, not measured LISTIA production results.

| Gestión | Reference internal accepted-output cost <=10s | FREE | PRO | PREMIUM |
|---|---:|---:|---:|---:|
| Exact-source composition — HyperFrames/FFmpeg | $0.005 | $0.0075 | $0.00625 | $0.005625 |
| Lip-sync — MuseTalk 1.5 | $0.025 | $0.0375 | $0.03125 | $0.028125 |
| Advisor avatar from still photo — EchoMimicV2 | $0.16 | $0.24 | $0.20 | $0.18 |

All three remain `benchmark_guarded` until real LISTIA clips replace estimates with measured compute, retry, validation and accepted-output cost.

Preferred order: original source + HyperFrames first; MuseTalk on canonical advisor video when speech is needed; EchoMimic only when no real advisor video exists; paid premium generators/editors are escalation paths.

## 6. Content Engine
Connected Drive/uploads are raw material, not permission to spend automatically. LISTIA extracts data/assets, proposes a useful next action, quotes it, obtains authorization when billable, executes the cheapest route that passes the Quality Gate, and then proposes the next step.

Original property/advisor content remains canonical where visual fidelity matters. Deterministic composition is preferred over unnecessary regeneration.

## 7. Communications
Default operational preference remains:
1. WhatsApp
2. SMS/RCS
3. Telegram
4. Email nurture/remarketing
5. Voice when appropriate

The hierarchy is subject to consent, reachability, opt-out, country law and provider/platform policy.

Classic SMS does not support a true interactive carousel. Rich property carousels belong to WhatsApp/RCS or another supported rich channel; LISTIA may fall back to MMS/SMS/plain links when needed.

Telegram normal reachable-chat messaging can remain included when provider-message cost is zero, but a bot cannot cold-message a person from a telephone number alone.

Email can be included/discounted in paid plans where real provider economics make that sustainable. Any included volume remains subject to consent, suppression, bounce/reputation and anti-abuse controls.

Voice, WhatsApp, SMS/RCS and phone numbers require live route/destination cost resolution because wholesale economics vary by country/carrier. The user sees the LISTIA quote, not the carrier pricing table.

## 8. Cloudflare-backed website/domain ecosystem
Every LISTIA workspace is designed around a LISTIA-native website capability so LISTIA can coordinate property pages, SEO/schema, analytics, conversion signals, forms, AI content, security and updates with minimal user friction.

If the customer already owns a compatible domain, LISTIA should provide a low-friction connect/manage path rather than force an unnecessary second domain. Domain ownership should remain attributable/transferable to the customer while LISTIA acts as the managing/orchestrating layer.

Domain UX: one desired-domain field -> requested result + max 3 alternatives -> first-year/renewal information -> one approval action. Do not expose registrar/DNS complexity unless advanced settings are deliberately opened.

## 9. Progressive-use rule
LISTIA grows usage progressively with the customer. It does not automatically create large campaigns or large media batches simply because tools exist.

Default: one useful action -> result -> next useful action. Bulk/autonomous spending requires an explicit user action or approved standing budget/cap.

## 10. Economic safeguards
- Every billable Gestión is preapproved unless covered by an explicit standing authorization/budget.
- If current compliant cost no longer fits the approved ceiling, reroute, block, or obtain a new approval.
- Never increase a quote after execution.
- Included/free actions may have zero markup because supplier cost is zero or covered by the subscription economics.
- Provider route/cost remains internal unless law requires disclosure.
- Price Book can be versioned prospectively; stored unexpired approved quotes keep their ceiling.

## 11. Legal/customer promise
The binding commercial promise is the final LISTIA quote/authorized maximum and the described Gestión scope, not disclosure of LISTIA's internal provider or exact supplier margin.

AI/media output remains subject to quality and factual limitations. Communications remain subject to consent and local law. Domains remain subject to registry/registrar availability, eligibility and live wholesale pricing. Taxes and mandatory governmental charges are handled as legally required.
