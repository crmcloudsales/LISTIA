-- The private GitHub Actions OIDC -> Edge -> service-role payload transport is verified.
-- Retire the legacy raw.githubusercontent.com ingestion path without dropping the
-- function signature yet, so any stale caller fails explicitly instead of silently.

begin;

create or replace function public.ingest_qroo_crawl_chunk(p_chunk_url text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  raise exception using
    errcode='0A000',
    message='qroo_public_chunk_ingest_retired',
    detail='Use the GitHub-OIDC Edge transport and service-role-only ingest_qroo_payload(jsonb).';
end;
$function$;

revoke execute on function public.ingest_qroo_crawl_chunk(text)
  from public, anon, authenticated, service_role;

commit;
