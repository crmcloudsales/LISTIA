create or replace function public.submit_marketplace_interest_click_verified(
  p_user_id uuid,
  p_listing_id uuid,
  p_locale text default 'es'
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'authentication_required';
  end if;
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  return public.submit_marketplace_interest_click(p_listing_id, p_locale);
end;
$$;

revoke all on function public.submit_marketplace_interest_click_verified(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.submit_marketplace_interest_click_verified(uuid,uuid,text) to service_role;

comment on function public.submit_marketplace_interest_click_verified(uuid,uuid,text) is 'Service-role-only wrapper for human-verified Marketplace interest clicks. The originating authenticated user is supplied only by the verified Edge gateway.';
