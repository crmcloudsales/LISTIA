begin;

create index if not exists oauth_connection_states_organization_fkey_idx on private.oauth_connection_states(organization_id);
create index if not exists oauth_connection_states_user_fkey_idx on private.oauth_connection_states(user_id);
create index if not exists pwa_product_events_user_fkey_idx on private.pwa_product_events(user_id);
create index if not exists security_rate_limits_organization_fkey_idx on private.security_rate_limits(organization_id);

create index if not exists affiliate_commissions_referral_fkey_idx on public.affiliate_commissions(referral_id);
create index if not exists affiliate_payouts_affiliate_fkey_idx on public.affiliate_payouts(affiliate_id);
create index if not exists audience_members_contact_fkey_idx on public.audience_members(contact_id);
create index if not exists audiences_created_by_fkey_idx on public.audiences(created_by);
create index if not exists audiences_organization_fkey_idx on public.audiences(organization_id);
create index if not exists campaign_recipients_contact_fkey_idx on public.campaign_recipients(contact_id);
create index if not exists campaigns_audience_fkey_idx on public.campaigns(audience_id);
create index if not exists campaigns_created_by_fkey_idx on public.campaigns(created_by);
create index if not exists campaigns_organization_fkey_idx on public.campaigns(organization_id);
create index if not exists communication_events_contact_fkey_idx on public.communication_events(contact_id);
create index if not exists communication_jobs_campaign_fkey_idx on public.communication_jobs(campaign_id);
create index if not exists communication_jobs_contact_fkey_idx on public.communication_jobs(contact_id);
create index if not exists communication_jobs_organization_fkey_idx on public.communication_jobs(organization_id);
create index if not exists communication_jobs_provider_account_fkey_idx on public.communication_jobs(provider_account_id);
create index if not exists contact_import_rows_contact_fkey_idx on public.contact_import_rows(contact_id);
create index if not exists contact_import_rows_organization_fkey_idx on public.contact_import_rows(organization_id);
create index if not exists contact_imports_created_by_fkey_idx on public.contact_imports(created_by);
create index if not exists contact_matches_property_fkey_idx on public.contact_matches(property_id);
create index if not exists contact_merge_log_organization_fkey_idx on public.contact_merge_log(organization_id);
create index if not exists contact_merge_log_survivor_fkey_idx on public.contact_merge_log(survivor_contact_id);
create index if not exists contacts_created_by_fkey_idx on public.contacts(created_by);
create index if not exists conversion_signals_lead_fkey_idx on public.conversion_signals(lead_id);
create index if not exists conversion_signals_property_fkey_idx on public.conversion_signals(property_id);
create index if not exists lead_events_contact_fkey_idx on public.lead_events(contact_id);
create index if not exists lead_notes_author_user_fkey_idx on public.lead_notes(author_user_id);
create index if not exists lead_notes_organization_fkey_idx on public.lead_notes(organization_id);
create index if not exists lead_tasks_assigned_user_fkey_idx on public.lead_tasks(assigned_user_id);
create index if not exists lead_tasks_created_by_fkey_idx on public.lead_tasks(created_by);
create index if not exists lead_tasks_organization_fkey_idx on public.lead_tasks(organization_id);
create index if not exists leads_assigned_user_fkey_idx on public.leads(assigned_user_id);

commit;
