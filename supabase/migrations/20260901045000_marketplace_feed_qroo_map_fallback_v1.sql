-- LISTIA Marketplace only.
-- Preserve exact listing coordinates when available. Otherwise expose the verified
-- Quintana Roo locality/zone centroid from marketplace_qroo_places.
-- No exact property coordinate is invented.

create or replace function public.marketplace_public_feed_edge_v3(
  p_limit integer default 24,
  p_offset integer default 0,
  p_q text default null,
  p_operation text default null,
  p_property_type text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_bedrooms numeric default null,
  p_lat numeric default null,
  p_lng numeric default null
)
returns table(
  id uuid, slug text, title text, description text, operation_type text, property_type text,
  price numeric, currency text, location_text text, city text, state_region text, country_code text,
  bedrooms numeric, bathrooms numeric, parking_spaces numeric, area_m2 numeric,
  latitude numeric, longitude numeric, cover_image_url text, gallery jsonb, locale text,
  published_at timestamptz, distance_km numeric, total_count bigint
)
language sql stable security definer
set search_path to 'pg_catalog','public','private'
as $function$
with filtered as (
  select ml.id,ml.slug,ml.title,ml.description,ml.operation_type,ml.property_type,ml.price,ml.currency,
         ml.location_text,ml.city,ml.state_region,ml.country_code,ml.bedrooms,ml.bathrooms,ml.parking_spaces,ml.area_m2,
         coalesce(ml.latitude,qp.latitude) as latitude,
         coalesce(ml.longitude,qp.longitude) as longitude,
         case when private.marketplace_image_url_is_valid(ml.cover_image_url) then ml.cover_image_url else null end as cover_image_url,
         coalesce((select jsonb_agg(g.url order by g.ord)
                   from jsonb_array_elements_text(coalesce(ml.gallery,'[]'::jsonb)) with ordinality as g(url,ord)
                   where private.marketplace_image_url_is_valid(g.url)),'[]'::jsonb) as gallery,
         ml.locale,ml.published_at,ml.created_at
  from public.marketplace_listings ml
  left join lateral (
    select p.latitude,p.longitude
    from public.marketplace_qroo_places p
    where lower(btrim(coalesce(ml.state_region,'')))='quintana roo'
      and (
        lower(btrim(coalesce(ml.city,'')))=lower(p.canonical_place)
        or lower(btrim(coalesce(ml.city,'')))=any(select lower(x) from unnest(p.aliases) x)
        or lower(btrim(coalesce(ml.location_text,'')))=lower(p.canonical_place)
      )
    order by case when lower(btrim(coalesce(ml.city,'')))=lower(p.canonical_place) then 0 else 1 end
    limit 1
  ) qp on ml.latitude is null or ml.longitude is null
  where ml.visibility='public' and ml.status='published'
    and private.marketplace_image_url_is_valid(ml.cover_image_url)
    and (nullif(btrim(coalesce(p_operation,'')),'') is null or lower(ml.operation_type)=lower(btrim(p_operation)))
    and (nullif(btrim(coalesce(p_property_type,'')),'') is null or lower(coalesce(ml.property_type,'')) like '%'||lower(btrim(p_property_type))||'%')
    and (p_min_price is null or ml.price>=p_min_price)
    and (p_max_price is null or ml.price<=p_max_price)
    and (p_bedrooms is null or ml.bedrooms=p_bedrooms)
    and (nullif(btrim(coalesce(p_q,'')),'') is null or position(lower(left(btrim(p_q),120)) in lower(concat_ws(' ',ml.title,ml.location_text,ml.city,ml.state_region,ml.country_code,ml.property_type)))>0)
), scored as (
  select f.*,
         case when p_lat between -90 and 90 and p_lng between -180 and 180
                    and f.latitude between -90 and 90 and f.longitude between -180 and 180
              then 6371 * acos(least(1::numeric,greatest(-1::numeric,
                   cos(radians(p_lat))*cos(radians(f.latitude))*cos(radians(f.longitude)-radians(p_lng))+
                   sin(radians(p_lat))*sin(radians(f.latitude)))))
              else null end as distance_calc
  from filtered f
)
select f.id,f.slug,f.title,
       nullif(btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
         coalesce(f.description,''),'https?://[^[:space:]<>\\\"'']+','','gi'),'www\\.[^[:space:]<>\\\"'']+','','gi'),
         'Inventario público de [^.]+\\.[[:space:]]*','','gi'),'Oferta pública de [^;]+;[[:space:]]*','','gi'),
         'Verificar disponibilidad y precio vigente directamente con la fuente antes de cerrar una operación\\.?',
         'Precio y disponibilidad sujetos a cambios. Confirma las condiciones antes de realizar una operación.','gi'),
         '(con|directamente con) la fuente','antes de la operación','gi')),'') as description,
       f.operation_type,f.property_type,f.price,f.currency,f.location_text,f.city,f.state_region,f.country_code,
       f.bedrooms,f.bathrooms,f.parking_spaces,f.area_m2,f.latitude,f.longitude,f.cover_image_url,f.gallery,f.locale,
       f.published_at,round(f.distance_calc::numeric,2),count(*) over() as total_count
from scored f
order by f.distance_calc asc nulls last,f.published_at desc nulls last,f.created_at desc,f.id
limit least(greatest(coalesce(p_limit,24),1),60)
offset least(greatest(coalesce(p_offset,0),0),20000);
$function$;

revoke all on function public.marketplace_public_feed_edge_v3(integer,integer,text,text,text,numeric,numeric,numeric,numeric,numeric) from public,anon,authenticated;
grant execute on function public.marketplace_public_feed_edge_v3(integer,integer,text,text,text,numeric,numeric,numeric,numeric,numeric) to service_role;
