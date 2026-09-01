-- LISTIA Marketplace only.
-- Add verified zone reference points and prefer the most specific locality/zone alias
-- found inside listing location text. These are approximate zone markers, never exact
-- property coordinates.

insert into public.marketplace_qroo_places
  (place_key,canonical_place,municipality,place_type,latitude,longitude,aliases,coordinate_source_url)
values
  ('tulum-aldea-zama','Aldea Zamá','Tulum','zone',20.199460,-87.460990,array['Aldea Zama','Aldea Zamá'],'https://maps.apple.com/place?auid=15892187339070159898'),
  ('tulum-la-veleta','La Veleta','Tulum','zone',20.201720,-87.473720,array['La Veleta'],'https://maps.apple.com/place?auid=12769559789342383227'),
  ('tulum-region-15','Región 15','Tulum','zone',20.187000,-87.474000,array['Region 15','Región 15','Region 15 Kukulcan','Región 15 Kukulcan'],'https://es.scribd.com/document/586617619/EMS-UNION-TULUM'),
  ('tulum-centro','Tulum Centro','Tulum','zone',20.212514,-87.452890,array['Tulum Centro'],'https://mx.micodigopostal.info/codigo-postal/quintana-roo-tulum-tulum-centro'),
  ('playa-del-carmen-centro','Playa del Carmen Centro','Playa del Carmen','zone',20.642746,-87.076604,array['Playa del Carmen Centro','Centro Playa del Carmen'],'https://mx.micodigopostal.info/codigo-postal/quintana-roo-solidaridad-playa-del-carmen-playa-del-carmen-centro')
on conflict(place_key) do update set
  canonical_place=excluded.canonical_place,
  municipality=excluded.municipality,
  place_type=excluded.place_type,
  latitude=excluded.latitude,
  longitude=excluded.longitude,
  aliases=excluded.aliases,
  coordinate_source_url=excluded.coordinate_source_url,
  updated_at=now();

create or replace view public.marketplace_qroo_mapped_listings as
with candidates as (
  select l.*,
         nullif(btrim(concat_ws(' ',nullif(btrim(l.location_text),''),nullif(btrim(l.city),''))),'') as raw_place
  from public.marketplace_listings l
  where lower(coalesce(l.state_region,''))='quintana roo'
     or lower(coalesce(l.location_text,'')) like '%quintana roo%'
), resolved as (
  select c.*,p.place_key,p.canonical_place,p.municipality,p.place_type,
         coalesce(c.latitude,p.latitude) as map_latitude,
         coalesce(c.longitude,p.longitude) as map_longitude,
         case
           when c.latitude is not null and c.longitude is not null then 'listing_exact'
           when p.place_key is not null and p.place_type='zone' then 'zone_reference'
           when p.place_key is not null then 'locality_centroid'
           else 'unmapped'
         end as map_precision
  from candidates c
  left join lateral (
    select qp.*
    from public.marketplace_qroo_places qp
    cross join lateral (
      select max(length(a.alias)) as matched_len
      from unnest(array_append(qp.aliases,qp.canonical_place)) as a(alias)
      where lower(c.raw_place)=lower(a.alias)
         or position(lower(a.alias) in lower(c.raw_place))>0
    ) match
    where match.matched_len is not null
    order by match.matched_len desc,
             case when qp.place_type='zone' then 0 else 1 end,
             qp.place_key
    limit 1
  ) p on true
)
select *, (place_key is null) as location_review_required
from resolved;

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
         coalesce(ml.latitude,qp.latitude) latitude,coalesce(ml.longitude,qp.longitude) longitude,
         case when private.marketplace_image_url_is_valid(ml.cover_image_url) then ml.cover_image_url else null end cover_image_url,
         coalesce((select jsonb_agg(g.url order by g.ord)
                   from jsonb_array_elements_text(coalesce(ml.gallery,'[]'::jsonb)) with ordinality g(url,ord)
                   where private.marketplace_image_url_is_valid(g.url)),'[]'::jsonb) gallery,
         ml.locale,ml.published_at,ml.created_at
  from public.marketplace_listings ml
  left join lateral (
    select p.latitude,p.longitude
    from public.marketplace_qroo_places p
    cross join lateral (
      select max(length(a.alias)) as matched_len
      from unnest(array_append(p.aliases,p.canonical_place)) as a(alias)
      where lower(concat_ws(' ',coalesce(ml.location_text,''),coalesce(ml.city,'')))=lower(a.alias)
         or position(lower(a.alias) in lower(concat_ws(' ',coalesce(ml.location_text,''),coalesce(ml.city,''))))>0
    ) match
    where lower(btrim(coalesce(ml.state_region,'')))='quintana roo'
      and match.matched_len is not null
    order by match.matched_len desc,
             case when p.place_type='zone' then 0 else 1 end,
             p.place_key
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
              then 6371*acos(least(1::numeric,greatest(-1::numeric,
                   cos(radians(p_lat))*cos(radians(f.latitude))*cos(radians(f.longitude)-radians(p_lng))+
                   sin(radians(p_lat))*sin(radians(f.latitude)))))
              else null end distance_calc
  from filtered f
)
select f.id,f.slug,f.title,
       nullif(btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
         coalesce(f.description,''),'https?://[^[:space:]<>\\\"'']+','','gi'),'www\\.[^[:space:]<>\\\"'']+','','gi'),
         'Inventario público de [^.]+\\.[[:space:]]*','','gi'),'Oferta pública de [^;]+;[[:space:]]*','','gi'),
         'Verificar disponibilidad y precio vigente directamente con la fuente antes de cerrar una operación\\.?',
         'Precio y disponibilidad sujetos a cambios. Confirma las condiciones antes de realizar una operación.','gi'),
         '(con|directamente con) la fuente','antes de la operación','gi')),'') description,
       f.operation_type,f.property_type,f.price,f.currency,f.location_text,f.city,f.state_region,f.country_code,
       f.bedrooms,f.bathrooms,f.parking_spaces,f.area_m2,f.latitude,f.longitude,f.cover_image_url,f.gallery,f.locale,
       f.published_at,round(f.distance_calc::numeric,2),count(*) over() total_count
from scored f
order by f.distance_calc asc nulls last,f.published_at desc nulls last,f.created_at desc,f.id
limit least(greatest(coalesce(p_limit,24),1),60)
offset least(greatest(coalesce(p_offset,0),0),20000);
$function$;
