-- LISTIA only: the canonical Managed Sites runtime uses managed-site-data behind
-- the private LISTIA edge proof. Keep the legacy resolver callable by service_role
-- for controlled compatibility, but remove direct public REST execution.
revoke execute on function public.resolve_listia_public_site(text) from public;
revoke execute on function public.resolve_listia_public_site(text) from anon;
revoke execute on function public.resolve_listia_public_site(text) from authenticated;
grant execute on function public.resolve_listia_public_site(text) to service_role;
