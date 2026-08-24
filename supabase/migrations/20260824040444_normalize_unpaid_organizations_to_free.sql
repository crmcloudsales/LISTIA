update public.organization_billing
set plan_key = 'free',
    billing_status = 'free',
    access_state = 'active',
    included_seats = 0,
    extra_seats = 0,
    usage_markup_percent = 30,
    current_period_start = null,
    current_period_end = null,
    cancel_at_period_end = false,
    updated_at = now()
where not exists (
  select 1
  from public.billing_provider_state bps
  where bps.organization_id = organization_billing.organization_id
    and bps.provider = 'stripe'
    and bps.provider_subscription_id is not null
);
