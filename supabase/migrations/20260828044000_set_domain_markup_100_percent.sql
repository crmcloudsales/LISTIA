create or replace function private.domain_markup_percent(p_provider_cost numeric)
returns numeric
language sql
immutable
as $$
  select case when p_provider_cost is null or p_provider_cost < 0 then null else 100::numeric end
$$;

update private.gestion_price_book
set target_markup_free=100,
    target_markup_pro=100,
    target_markup_premium=100,
    minimum_markup_percent=100,
    maximum_markup_percent=100,
    notes='Domain registration and renewal use a 100% markup over current provider wholesale cost. The customer sees only the final LISTIA price. Provider identity and wholesale cost remain internal. Premium domains require a live provider quote before authorization.',
    updated_at=now()
where service_key in ('domain_registration','domain_renewal') and active=true;
