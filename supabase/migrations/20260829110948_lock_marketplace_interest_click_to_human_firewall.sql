-- Reconstructed from verified live Supabase state on 2026-08-29.
-- Direct execution of the underlying click function is disabled for every API role.
-- Only the service-role verified wrapper can reach it after JWT/proof/rate-limit checks.

begin;

revoke execute on function public.submit_marketplace_interest_click(uuid,text)
  from public, anon, authenticated, service_role;

revoke execute on function public.submit_marketplace_interest_click_verified(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.submit_marketplace_interest_click_verified(uuid,uuid,text)
  to service_role;

commit;
