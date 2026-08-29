-- Harden Marketplace raw-table visibility.
-- Public/seeker Marketplace traffic must use the sanitized SECURITY DEFINER feed RPCs.
-- Organization members keep their existing organization-scoped RLS access.

begin;

-- PostgreSQL RLS policies are OR-combined. This policy made every published/public
-- listing row readable to authenticated users, including internal provenance columns
-- such as source_id, external_url, rights_basis and fingerprint.
drop policy if exists marketplace_listings_public_select
  on public.marketplace_listings;

-- Defense in depth: these functions are trigger-only enforcement helpers in the
-- private schema. Trigger execution is unaffected by revoking client EXECUTE.
revoke execute on function private.enforce_marketplace_listing_image_required()
  from public, anon, authenticated;
revoke execute on function private.enforce_property_image_before_publish()
  from public, anon, authenticated;

commit;
