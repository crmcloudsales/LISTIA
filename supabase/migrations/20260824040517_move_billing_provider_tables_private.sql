alter table public.billing_price_bindings set schema private;
alter table public.billing_provider_state set schema private;
alter table public.billing_provider_events set schema private;

revoke all on private.billing_price_bindings from anon, authenticated;
revoke all on private.billing_provider_state from anon, authenticated;
revoke all on private.billing_provider_events from anon, authenticated;
