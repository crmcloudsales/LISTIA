-- LISTIA Marketplace only.
-- Prevent the continuous media enricher from being monopolized by sources that
-- repeatedly return no additional images. propiedades.com is excluded from the
-- generic HTML lane because its pages are blocked and its dedicated CDN probe was
-- tested separately and disabled.

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
  and coalesce((ml.features->>'media_enrichment_attempts')::integer,0) < 3
  and lower(ml.external_url) !~ '^https?://(www\.)?propiedades\.com(/|$)'
order by coalesce((ml.features->>'media_enrichment_attempts')::integer,0) asc,
         jsonb_array_length(coalesce(ml.gallery,'[]'::jsonb)) asc,
         ml.updated_at asc,
         ml.id
limit least(greatest(coalesce(p_limit,40),1),40);
$$;
