# LISTIA — CANONICAL BUILD RULES

These are active project rules unless explicitly changed later.

## Product / UX
1. `listiaapp.com` is the commercial website. `app.listiaapp.com` must not repeat the landing page, marketing pitch, download-page copy, pricing-page copy or commercial explanations.
2. The app opens directly into authentication, onboarding, Office/dashboard or the user’s active session.
3. Installation/download is promoted primarily from `listiaapp.com`; inside the app it is secondary.
4. Mobile-first. Keep flows short, clear and low-friction. The complete user workflow must be practical from a phone; internal infrastructure complexity remains invisible.
5. Do not expose internal architecture, provider names or developer language to end users when a simple LISTIA action/price can represent the same workflow.
6. Small explanatory text that carries a plan limit, price, consent, warning or next action must remain comfortably readable on a phone. Do not use ultra-small typography for material commercial or legal information.

## Brand / visual
7. Official assets must not carry accidental background plates.
8. Preserve official logo, icon and character identity/proportions; do not redraw or reinterpret them.
9. Functional app-icon safe areas are allowed when intentionally required.
10. The v0.8.6.1 top row rule: logo and language selector sit visually centered between the upper safe area and the panel; do not move the main form to accomplish this.

## Engineering / security
11. GitHub, CI/CD or tooling must never block MVP deployment.
12. Never commit service-role keys, API secrets, OAuth client secrets, database passwords, Stripe secrets or provider tokens.
13. Public Supabase URL + publishable client key may live in frontend configuration; privileged operations remain server-side.
14. Production isolation is enforced by Postgres/Supabase RLS, not by hidden UI.
15. Rate limiting, WAF/Turnstile where appropriate, input validation, XSS/script-injection controls and SQL-injection-safe database access are mandatory before open production traffic.
16. Do not claim a capability is functional until its real backend/integration is connected and tested.
17. Discovery is least-privilege by default. Google permissions expand incrementally only for concrete user-facing capabilities.
18. Business DNA starts from facts LISTIA already knows and enriches continuously; avoid long onboarding questionnaires.
19. Connected-provider state shown in UI must come from backend state.
20. Property creation is material-first. The user gives LISTIA available material; LISTIA creates the property workflow.
21. MVP intake may include PDF, photos, video, brochure/price list, description, price, sale/rent, commission, location and postal code. Only some usable material/context is required at intake.
22. Free-plan limits are enforced server-side. The current FREE entitlement is a maximum of **3 non-archived properties**. Adding a fourth property requires changing to a paid plan; LISTIA does not sell one-off extra properties on FREE unless a later explicit product decision changes this.
23. Office is the operational home after onboarding and surfaces appointments, opportunities/leads and active properties.
24. Every user-facing screen is internationalized from its first release. Current complete locales are es, en, fr, it, pt-BR, de and ar-AE; English is the fallback.
25. Locale priority is explicit ?lang=, shared .listiaapp.com cookie, local preference, browser languages, then English. Manual selection remains available and authenticated preferences sync to user metadata/profile when permitted.
26. Arabic UAE uses ar-AE with document-level RTL. Do not apply RTL to non-Arabic locales or mirror brand assets.

## Pricing / Gestiones
27. The customer buys a LISTIA **Gestión**, not a supplier/model/API call. The normal user-facing flow is: action -> final LISTIA quote/authorized maximum -> approval -> execution -> reconciliation.
28. Current ordinary Gestión target markups on real accepted-output/provider cost are: **FREE 50% / PRO 25% / PREMIUM 12.5%**. These are the active plan economics unless a later explicit decision changes them.
29. For ordinary variable-cost Gestiones, routing remains cost-first subject to quality/legal constraints. The general economic safety band is 5%-50% effective markup when standardized pricing or route variation requires flexibility; LISTIA must not intentionally execute at a loss and must not charge above an already approved ceiling.
30. Domains are a deliberate exception to the ordinary plan markup: **50%-100% markup in every plan**, dynamically decreasing as wholesale domain cost rises. Registration and renewal use the same markup policy; no teaser first-year price followed by a deliberately higher renewal markup.
31. Current domain markup bands are: wholesale <= US$10 -> 100%; >US$10 to US$20 -> 80%; >US$20 to US$50 -> 60%; >US$50 -> 50%. Premium/exceptional domains require a separate live quote.
32. Domain suggestions stay low-friction: requested domain plus at most 3 alternatives, drawn preferentially from `.com`, `.com.mx`, `.mx`, `.net`, `.us`, `.realestate`, `.uk`, `.it`, and `.web` when actually available. `.app` and `.ai` are not default suggestions.
33. Every billable Gestión requires preapproval unless the organization has explicitly approved a standing budget/campaign cap. Usage should grow progressively with demonstrated customer activity and value, not through sudden hidden bulk execution.
34. The optimization metric is **cost per accepted output**, not headline provider price. Rejected generations, retries, quality repairs, compute, storage and required validation count toward real cost.
35. Engineering estimates are not labeled as measured benchmarks. A benchmark-guarded Gestión remains blocked for automated paid release until LISTIA measures the actual route and confirms quality plus margin.
