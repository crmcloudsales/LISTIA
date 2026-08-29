create or replace function private.dispatch_marketplace_media_enrichment(p_city text, p_limit integer default 40)
returns bigint
language plpgsql
security definer
set search_path = public, private, vault, net, pg_temp
as $function$
declare
  v_key text;
  v_request_id bigint;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'marketplace_media_enricher_20260829'
  limit 1;
  if coalesce(v_key,'') = '' then
    raise exception 'marketplace media enrichment key unavailable';
  end if;
  v_request_id := net.http_post(
    url := 'https://zvzafiarwerbuoaccnoz.supabase.co/functions/v1/marketplace-media-enrich',
    headers := jsonb_build_object('Content-Type','application/json','x-listia-enrichment-key',v_key),
    body := jsonb_build_object('city',p_city,'limit',least(greatest(coalesce(p_limit,40),1),40)),
    timeout_milliseconds := 120000
  );
  return v_request_id;
end;
$function$;

revoke all on function private.dispatch_marketplace_media_enrichment(text,integer) from public, anon, authenticated;
grant execute on function private.dispatch_marketplace_media_enrichment(text,integer) to service_role;
