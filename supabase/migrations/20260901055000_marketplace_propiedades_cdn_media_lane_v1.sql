-- LISTIA Marketplace only.
-- Dedicated media lane for propiedades.com. It does not scrape blocked HTML pages;
-- it asks the existing media Edge Function to verify numbered images on the listing's
-- own cdn.propiedades.com cover-image family. Only verified image responses are stored.

create or replace function private.marketplace_propiedades_media_candidates(p_city text default null,p_limit integer default 20)
returns table(id uuid,title text,external_url text,cover_image_url text,gallery jsonb,city text,features jsonb)
language sql stable security definer
set search_path='pg_catalog','public','private'
as $$
select ml.id,ml.title,ml.external_url,ml.cover_image_url,coalesce(ml.gallery,'[]'::jsonb),ml.city,ml.features
from public.marketplace_listings ml
where ml.status='published' and ml.visibility='public'
  and ml.external_url ilike '%propiedades.com%'
  and ml.cover_image_url like 'https://cdn.propiedades.com/%'
  and ml.cover_image_url ~* '-foto-0?1\\.(jpe?g|png|webp)(\\?.*)?$'
  and jsonb_array_length(coalesce(ml.gallery,'[]'::jsonb)) < 10
  and coalesce((ml.features->>'propiedades_media_attempts')::integer,0) < 2
  and (p_city is null or ml.city=p_city)
order by jsonb_array_length(coalesce(ml.gallery,'[]'::jsonb)) asc,
         coalesce((ml.features->>'propiedades_media_attempts')::integer,0) asc,
         ml.updated_at asc
limit least(greatest(coalesce(p_limit,20),1),20);
$$;
revoke all on function private.marketplace_propiedades_media_candidates(text,integer) from public,anon,authenticated;
grant execute on function private.marketplace_propiedades_media_candidates(text,integer) to service_role;

create or replace function public.marketplace_propiedades_media_candidates_internal(p_city text default null,p_limit integer default 20)
returns table(id uuid,title text,external_url text,cover_image_url text,gallery jsonb,city text,features jsonb)
language sql stable security definer
set search_path='pg_catalog','public','private'
as $$ select * from private.marketplace_propiedades_media_candidates(p_city,p_limit); $$;
revoke all on function public.marketplace_propiedades_media_candidates_internal(text,integer) from public,anon,authenticated;
grant execute on function public.marketplace_propiedades_media_candidates_internal(text,integer) to service_role;

create or replace function private.dispatch_marketplace_propiedades_media(p_city text default null,p_limit integer default 20)
returns bigint
language plpgsql security definer
set search_path='public','private','vault','net','pg_temp'
as $$
declare v_key text; v_request_id bigint;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name='marketplace_media_enricher_20260829' limit 1;
  if coalesce(v_key,'')='' then raise exception 'marketplace media enrichment key unavailable'; end if;
  v_request_id:=net.http_post(
    url:='https://zvzafiarwerbuoaccnoz.supabase.co/functions/v1/marketplace-media-enrich',
    headers:=jsonb_build_object('Content-Type','application/json','x-listia-enrichment-key',v_key),
    body:=jsonb_build_object('city',p_city,'limit',least(greatest(coalesce(p_limit,20),1),20),'lane','propiedades'),
    timeout_milliseconds:=120000
  );
  return v_request_id;
end;
$$;
revoke all on function private.dispatch_marketplace_propiedades_media(text,integer) from public,anon,authenticated;
grant execute on function private.dispatch_marketplace_propiedades_media(text,integer) to service_role;

-- Store a separate attempt counter after each propiedades lane run by mirroring the
-- lane's timestamp. The Edge Function preserves this key once present.
create or replace function private.bump_propiedades_media_attempts()
returns trigger language plpgsql security definer set search_path='pg_catalog','public','private' as $$
begin
  if new.features->>'media_enrichment_lane'='propiedades' and (old.features->>'media_enrichment_at') is distinct from (new.features->>'media_enrichment_at') then
    new.features:=jsonb_set(new.features,'{propiedades_media_attempts}',to_jsonb(coalesce((old.features->>'propiedades_media_attempts')::integer,0)+1),true);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_marketplace_propiedades_media_attempts on public.marketplace_listings;
create trigger trg_marketplace_propiedades_media_attempts before update of features on public.marketplace_listings for each row execute function private.bump_propiedades_media_attempts();

select cron.unschedule(jobid) from cron.job where jobname='marketplace-propiedades-cdn-media-enrichment';
select cron.schedule('marketplace-propiedades-cdn-media-enrichment','* * * * *',$$select private.dispatch_marketplace_propiedades_media(null,20);$$);
