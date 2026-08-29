-- Reconstructed from verified live Supabase state on 2026-08-29.
-- Service-role-only wrapper used by marketplace-interest-auth after JWT validation.

begin;

create or replace function public.submit_marketplace_interest_click_verified(
  p_user_id uuid,
  p_listing_id uuid,
  p_locale text default 'es'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
begin
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'authentication_required';
  end if;

  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  return public.submit_marketplace_interest_click(p_listing_id, p_locale);
end;
$function$;

revoke execute on function public.submit_marketplace_interest_click_verified(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.submit_marketplace_interest_click_verified(uuid,uuid,text)
  to service_role;

commit;
