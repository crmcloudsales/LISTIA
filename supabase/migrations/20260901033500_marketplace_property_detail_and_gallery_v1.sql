create or replace function public.marketplace_public_listing_detail(p_slug text default null, p_id uuid default null)
returns table(
  id uuid, slug text, title text, description text, operation_type text, property_type text,
  price numeric, currency text, location_text text, city text, state_region text, country_code text,
  bedrooms numeric, bathrooms numeric, parking_spaces numeric, area_m2 numeric,
  latitude numeric, longitude numeric, map_precision text,
  cover_image_url text, gallery jsonb, features jsonb, locale text, published_at timestamptz
)
language sql stable security definer
set search_path='pg_catalog','public','private'
as $$
select ml.id,ml.slug,ml.title,
       nullif(btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
         coalesce(ml.description,''),'https?://[^[:space:]<>\\\"'']+','','gi'),'www\\.[^[:space:]<>\\\"'']+','','gi'),
         'Inventario público de [^.]+\\.[[:space:]]*','','gi'),'Oferta pública de [^;]+;[[:space:]]*','','gi'),
         'Verificar disponibilidad y precio vigente directamente con la fuente antes de cerrar una operación\\.?',
         'Precio y disponibilidad sujetos a cambios. Confirma las condiciones antes de realizar una operación.','gi'),
         '(con|directamente con) la fuente','antes de la operación','gi')),'') as description,
       ml.operation_type,ml.property_type,ml.price,ml.currency,ml.location_text,ml.city,ml.state_region,ml.country_code,
       ml.bedrooms,ml.bathrooms,ml.parking_spaces,ml.area_m2,
       coalesce(ml.latitude,q.map_latitude) as latitude,
       coalesce(ml.longitude,q.map_longitude) as longitude,
       case when ml.latitude is not null and ml.longitude is not null then 'exact' else coalesce(q.map_precision,'unknown') end as map_precision,
       case when private.marketplace_image_url_is_valid(ml.cover_image_url) then ml.cover_image_url else null end as cover_image_url,
       coalesce((select jsonb_agg(g.url order by g.ord)
         from jsonb_array_elements_text(coalesce(ml.gallery,'[]'::jsonb)) with ordinality as g(url,ord)
         where private.marketplace_image_url_is_valid(g.url)),'[]'::jsonb) as gallery,
       ml.features,ml.locale,ml.published_at
from public.marketplace_listings ml
left join public.marketplace_qroo_mapped_listings q on q.id=ml.id
where ml.visibility='public' and ml.status='published'
  and ((p_id is not null and ml.id=p_id) or (p_id is null and nullif(btrim(coalesce(p_slug,'')),'') is not null and ml.slug=btrim(p_slug)))
limit 1;
$$;
revoke all on function public.marketplace_public_listing_detail(text,uuid) from public,anon,authenticated;
grant execute on function public.marketplace_public_listing_detail(text,uuid) to service_role;

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
order by jsonb_array_length(coalesce(ml.gallery,'[]'::jsonb)) asc,
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
