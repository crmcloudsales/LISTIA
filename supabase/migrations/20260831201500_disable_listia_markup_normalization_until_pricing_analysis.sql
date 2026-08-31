drop trigger if exists normalize_organization_billing_markup on public.organization_billing;
update public.organization_billing set usage_markup_percent=null where usage_markup_percent is not null;
