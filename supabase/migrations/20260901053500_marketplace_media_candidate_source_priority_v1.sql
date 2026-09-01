-- LISTIA Marketplace only.
-- propiedades.com currently dominates the generic HTML media enricher and has a high
-- fetch-error rate. Keep those listings eligible, but prioritize all other sources so
-- successful direct-source galleries are not starved.

create or replace function private.marketplace_media_enrichment_candidates(p_city text default null,p_limit integer default 40)
returns table(id uuid,title text,external_url text,cover_image_url text,gallery jsonb,city text,features jsonb)
language sql stable security definer
set search_path='pg_catalog','public','private'
as $$
select ml.id,ml.title,ml.external_url,ml.cover_image_url,coalesce(ml.gallery,'[]'::jsonb),ml.city,ml.features
from public.marketplace_listings ml
where ml.status='published' and ml.visibility='public' and ml.external_url is not null
  and (p_city is null or ml.city=p_city)
  and jsonb_array_length(coalesce(ml.gallery,'[]'::jsonb)) < 20
  and coalesce((ml.features->>'media_enrichment_attempts')::integer,0) < 5
order by
  case when lower(ml.external_url) ~ '^https?://(www\.)?propiedades\.com(/|$)' then 1 else 0 end asc,
  jsonb_array_length(coalesce(ml.gallery,'[]'::jsonb)) asc,
  coalesce((ml.features->>'media_enrichment_attempts')::integer,0) asc,
  ml.updated_at asc
limit least(greatest(coalesce(p_limit,40),1),40);
$$;

revoke all on function private.marketplace_media_enrichment_candidates(text,integer) from public,anon,authenticated;
grant execute on function private.marketplace_media_enrichment_candidates(text,integer) to service_role;

create or replace function public.marketplace_media_enrichment_candidates_internal(p_city text default null,p_limit integer default 40)
returns table(id uuid,title text,external_url text,cover_image_url text,gallery jsonb,city text,features jsonb)
language sql stable security definer
set search_path='pg_catalog','public','private'
as $$ select * from private.marketplace_media_enrichment_candidates(p_city,p_limit); $$;
revoke all on function public.marketplace_media_enrichment_candidates_internal(text,integer) from public,anon,authenticated;
grant execute on function public.marketplace_media_enrichment_candidates_internal(text,integer) to service_role;
