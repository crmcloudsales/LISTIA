delete from public.listia_plan_catalog;
alter table public.organization_billing alter column usage_markup_percent drop default;
alter table public.organization_billing alter column usage_markup_percent drop not null;
update public.organization_billing set usage_markup_percent=null where usage_markup_percent is not null;
