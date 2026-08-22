# LISTIA — CANONICAL BUILD RULES

These are active project rules unless explicitly changed later.

## Product / UX
1. `listiaapp.com` is the commercial website. `app.listiaapp.com` must not repeat the landing page, marketing pitch, download-page copy, pricing-page copy or commercial explanations.
2. The app opens directly into authentication, onboarding, Office/dashboard or the user’s active session.
3. Installation/download is promoted primarily from `listiaapp.com`; inside the app it is secondary.
4. Mobile-first. Keep flows short, clear and low-friction.
5. Do not expose internal architecture or developer language to end users.

## Brand / visual
6. Official assets must not carry accidental background plates.
7. Preserve official logo, icon and character identity/proportions; do not redraw or reinterpret them.
8. Functional app-icon safe areas are allowed when intentionally required.
9. The v0.8.6.1 top row rule: logo and language selector sit visually centered between the upper safe area and the panel; do not move the main form to accomplish this.

## Engineering / security
10. GitHub, CI/CD or tooling must never block MVP deployment.
11. Never commit service-role keys, API secrets, OAuth client secrets, database passwords, Stripe secrets or provider tokens.
12. Public Supabase URL + publishable client key may live in frontend configuration; privileged operations remain server-side.
13. Production isolation is enforced by Postgres/Supabase RLS, not by hidden UI.
14. Rate limiting, WAF/Turnstile where appropriate, input validation, XSS/script-injection controls and SQL-injection-safe database access are mandatory before open production traffic.
15. Do not claim a capability is functional until its real backend/integration is connected and tested.
16. Discovery is least-privilege by default. Google permissions expand incrementally only for concrete user-facing capabilities.
17. Business DNA starts from facts LISTIA already knows and enriches continuously; avoid long onboarding questionnaires.
18. Connected-provider state shown in UI must come from backend state.
19. Property creation is material-first. The user gives LISTIA available material; LISTIA creates the property workflow.
20. MVP intake may include PDF, photos, video, brochure/price list, description, price, sale/rent, commission, location and postal code. Only some usable material/context is required at intake.
21. Free-plan limits are enforced server-side. Current QA rule: one non-archived property.
22. Office is the operational home after onboarding and surfaces appointments, opportunities/leads and active properties.
23. Every user-facing screen is internationalized from its first release. Current complete locales are es, en, fr, it, pt-BR, de and ar-AE; English is the fallback.
24. Locale priority is explicit ?lang=, shared .listiaapp.com cookie, local preference, browser languages, then English. Manual selection remains available and authenticated preferences sync to user metadata/profile when permitted.
25. Arabic UAE uses ar-AE with document-level RTL. Do not apply RTL to non-Arabic locales or mirror brand assets.
