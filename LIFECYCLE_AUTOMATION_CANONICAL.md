# LISTIA — Canonical Subscription Lifecycle Automation

Status: **canonical** unless explicitly superseded by a later product decision.

This document defines the permanent business lifecycle model for LISTIA. Campaigns, landing pages, emails, webchat, downloads, lead claims, billing, onboarding, support, retention and reactivation must feed the **same customer lifecycle**. Do not create a new pipeline for each campaign, project, channel or feature.

## 1. Canonical lifecycle stages

Use these stage keys everywhere:

1. `prospect`
2. `engaged`
3. `qualified`
4. `conversion_started`
5. `subscriber`
6. `onboarding`
7. `activated`
8. `retained`
9. `expansion`
10. `at_risk`
11. `churned`
12. `reactivation`

Events are **signals**, not new stages. Examples: email delivered/open-reported/clicked, landing viewed, chat opened, download/install, lead claim started, signup completed, checkout started, payment succeeded/failed, lead opened/contacted, appointment booked, support opened/resolved, renewal, cancellation and reactivation.

## 2. One person / one lifecycle history

A person must have one canonical identity/profile whenever identity resolution allows it. The same person opening an email, visiting a landing page, using AI chat, downloading the app, starting checkout and later paying must remain one lifecycle history rather than becoming separate contacts.

All source/campaign/project/property attribution must be preserved as event metadata without creating parallel pipelines.

## 3. Subscription-business operating model

LISTIA is a subscription-based business. The operating goal is maximum useful automation and self-service while preserving human escalation for exceptions.

The default operating loop is:

`acquire -> engage -> qualify -> convert -> onboard -> activate -> retain -> expand -> detect risk -> recover/reactivate`

Every automated action should optimize for customer value and business outcomes, not vanity metrics.

## 4. AI-first sales, onboarding, support and customer service

AI should be the first-line operating layer for routine work when safe and appropriate:

- answer product, pricing and onboarding questions;
- guide lead-claim and subscription conversion;
- handle onboarding and activation guidance;
- provide 24/7 support and customer service;
- detect friction, inactivity, payment risk and churn signals;
- recommend the next best action, follow-up, upgrade or recovery path;
- create tickets/cases automatically when the issue cannot be resolved safely;
- collect reproduction steps, context, logs/evidence available to the system and user impact;
- prepare a technical brief for `LISTIA — DESARROLLO` when engineering is required;
- coding assistance may propose patches or implementation guidance, but production code changes remain subject to the development workflow and its controls;
- after resolution, communicate the result to the customer and close the case when appropriate.

## 5. Canonical event families

### Acquisition / communication
- `email_delivered`
- `email_open_reported` (weak signal; privacy/proxy behavior can inflate it)
- `email_clicked`
- `landing_viewed`
- `webchat_opened`
- `webchat_engaged`
- `content_downloaded`
- `app_install_or_download`

### Conversion
- `lead_claim_started`
- `signup_completed`
- `pricing_viewed`
- `checkout_started`
- `payment_succeeded`
- `payment_failed`

### Activation / value
- `lead_opened`
- `lead_contacted`
- `appointment_booked`
- `first_property_claimed_or_published`
- `activation_completed`

### Retention / expansion
- `renewal_succeeded`
- `upgrade_started`
- `upgrade_completed`
- `additional_seat_added`
- `referral_created`

### Support / risk / recovery
- `support_opened`
- `support_resolved`
- `risk_detected`
- `cancellation_requested`
- `subscription_churned`
- `reactivation_started`
- `reactivation_completed`

## 6. Automation principles

1. Prefer event-driven automation over manual task creation.
2. Do not create duplicate contacts or duplicate lifecycle records for channel activity.
3. Every important event should update activity history, scores and next-best-action logic.
4. High-intent actions (claim, signup, checkout, payment) outweigh weak signals such as email opens.
5. A successful payment immediately ends prospect-style selling and begins subscriber onboarding/activation.
6. Support should be AI-first, but must escalate uncertainty, security-sensitive cases, legal/privacy issues, billing exceptions and engineering defects.
7. Automation must never fabricate a lead, fake urgency, fake a countdown, or claim an outcome that is not real.
8. Consent, suppression/unsubscribe and privacy rules override campaign automation.
9. The system should reduce human operational work while increasing useful outcomes: qualified leads, appointments, activation, retention and recurring revenue.
10. If a capability is not actually connected and tested, do not represent it as operational.

## 7. Canonical pipeline versus operational sub-statuses

Features may maintain their own operational statuses (for example a lead-claim offer may be `pending`, `accepted`, `expired`, or `rejected`; a support case may be `open` or `resolved`). Those statuses do **not** replace the canonical customer lifecycle stage.

## 8. Database source of truth

The production database contains a private reference catalog for the canonical pipeline and lifecycle event keys. Application code and automations should use those canonical keys rather than inventing new stage names.

Do not add a new lifecycle stage without an explicit product decision and corresponding database/documentation update.

## 9. Commercial operating objective

**WORK LESS. CLOSE MORE. SPEND LESS. GENERATE MORE.**

The lifecycle exists to move real users toward real value:

`use -> lead/opportunity -> appointment -> conversion -> recurring value`
