# CloudCo Global Email Consent Policy

Effective: 2026-08-28
Policy ID: `CLOUDCO_EMAIL_DEFAULT_DENY`
Severity: CRITICAL / RELEASE BLOCKER

## Rule

Email sending is **DEFAULT DENY** across CloudCo and every product, tenant, user, customer, agent, workflow, integration, QA process and future product. This includes CloudSales, LISTIA, Outsales/UpSells and White Label.

Creating, editing and saving drafts is allowed. **Transmitting an email is prohibited unless the responsible user has given explicit, specific and auditable authorization before the send.** An agent, workflow, scheduler, model or integration may never infer consent or approve itself.

## Required authorization

Every future email send must be tied to an auditable approval containing the approving user, tenant/organization when applicable, recipient, purpose, approval timestamp, authorization ID, send ID and outcome. Authorization is single-use by default and may not be reused for another recipient or purpose unless the user explicitly approved that scope.

Authentication emails are included: signup confirmation, resend confirmation, password recovery, magic links, invitations, email changes, reauthentication and security emails must originate from an unmistakable user action authorizing that specific delivery. Automatic resends are prohibited.

## QA and development

Production must never send QA email to fictitious addresses, `example.com`, invented inboxes or unapproved third parties. Use local/sink email tooling or admin-created confirmed test users when delivery itself is not under test. A test must never trigger external email by default.

## Prohibited unattended operations

No code path may invoke email-producing operations such as `auth.signUp`, `auth.resend`, `signInWithOtp`, `resetPasswordForEmail`, `inviteUserByEmail`, SMTP/provider send APIs or equivalent delivery actions unless the explicit approval gate has already succeeded. Draft-only/read-only/search operations remain permitted.

## Enforcement

Database, backend and provider adapters must fail closed. `conversation.send` with Email cannot become executable without an approval record. Agent/workflow approval flags alone are insufficient unless they are backed by the user authorization record. Any bypass is a critical defect and blocks release.

## Incident 2026-08-28

Supabase warned of a high transactional-email bounce rate. Investigation confirmed that the production CloudSales project still used Supabase default SMTP and that the `auth-session` wrapper allowed signup and resend paths capable of producing confirmation/resend email without a dedicated explicit-send authorization gate. Production Auth logs also showed development/QA activity against production, test-address attempts and email-rate-limit errors. The evidence does not establish that every individual bounce came from one source, but it does establish that the prior design allowed unapproved email generation.

Emergency containment blocked email-producing signup/resend paths and outbound email dispatch, while preserving non-email channels. Supabase now also contains a durable database authorization gate and the `CLOUDCO_EMAIL_DEFAULT_DENY` policy record.

This policy overrides any older implementation or instruction that conflicts with it.
