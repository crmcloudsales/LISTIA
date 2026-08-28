alter table public.organization_websites add column if not exists connect_fee_usd numeric(10,2);
alter table public.organization_websites add column if not exists domain_markup_percent numeric(8,2);
alter table public.organization_websites add column if not exists provider_cost_usd numeric(10,2);
alter table public.organization_websites add column if not exists final_price_usd numeric(10,2);
alter table public.organization_websites add column if not exists configuration jsonb not null default '{}'::jsonb;

update public.organization_websites
set connect_fee_usd=10
where mode='connect_existing' and connect_fee_usd is null;

update public.organization_websites
set domain_markup_percent=100
where mode='buy_website' and domain_markup_percent is null;