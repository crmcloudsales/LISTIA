create or replace function public.marketplace_public_feed_v2(
  p_limit integer default 24,
  p_offset integer default 0,
  p_q text default null,
  p_operation text default null,
  p_property_type text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_bedrooms numeric default null
)
returns table(
  id uuid,
  slug text,
  title text,
  description text,
  operation_type text,
  property_type text,
  price numeric,
  currency text,
  location_text text,
  city text,
  state_region text,
  country_code text,
  bedrooms numeric,
  bathrooms numeric,
  parking_spaces numeric,
  area_m2 numeric,
  latitude numeric,
  longitude numeric,
  cover_image_url text,
  locale text,
  published_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = 'public','pg_temp'
as $function$
  with filtered as (
    select ml.*
    from public.marketplace_listings ml
    where ml.visibility = 'public'
      and ml.status = 'published'
      and ml.rights_confirmed_at is not null
      and (nullif(btrim(coalesce(p_operation,'')),'') is null or lower(ml.operation_type) = lower(btrim(p_operation)))
      and (nullif(btrim(coalesce(p_property_type,'')),'') is null or lower(coalesce(ml.property_type,'')) like '%' || lower(btrim(p_property_type)) || '%')
      and (p_min_price is null or ml.price >= p_min_price)
      and (p_max_price is null or ml.price <= p_max_price)
      and (p_bedrooms is null or ml.bedrooms = p_bedrooms)
      and (
        nullif(btrim(coalesce(p_q,'')),'') is null
        or concat_ws(' ',ml.title,ml.description,ml.location_text,ml.city,ml.state_region,ml.country_code,ml.property_type)
           ilike '%' || replace(replace(btrim(p_q),'\\','\\\\'),'%','\\%') || '%' escape '\\'
      )
  )
  select
    ml.id,
    ml.slug,
    ml.title,
    nullif(
      btrim(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    coalesce(ml.description, ''),
                    'https?://[^[:space:]<>"'']+', '', 'gi'
                  ),
                  'www\\.[^[:space:]<>"'']+', '', 'gi'
                ),
                'Inventario público de [^.]+\\.[[:space:]]*', '', 'gi'
              ),
              'Oferta pública de [^;]+;[[:space:]]*', '', 'gi'
            ),
            'Verificar disponibilidad y precio vigente directamente con la fuente antes de cerrar una operación\\.?',
            'Precio y disponibilidad sujetos a cambios. Confirma las condiciones antes de realizar una operación.',
            'gi'
          ),
          '(con|directamente con) la fuente', 'antes de la operación', 'gi'
        )
      ),
      ''
    ) as description,
    ml.operation_type,
    ml.property_type,
    ml.price,
    ml.currency,
    ml.location_text,
    ml.city,
    ml.state_region,
    ml.country_code,
    ml.bedrooms,
    ml.bathrooms,
    ml.parking_spaces,
    ml.area_m2,
    ml.latitude,
    ml.longitude,
    ml.cover_image_url,
    ml.locale,
    ml.published_at,
    count(*) over() as total_count
  from filtered ml
  order by ml.published_at desc nulls last, ml.created_at desc, ml.id
  limit least(greatest(coalesce(p_limit,24),1),60)
  offset least(greatest(coalesce(p_offset,0),0),10000);
$function$;

revoke all on function public.marketplace_public_feed_v2(integer,integer,text,text,text,numeric,numeric,numeric) from public;
grant execute on function public.marketplace_public_feed_v2(integer,integer,text,text,text,numeric,numeric,numeric) to anon, authenticated;

create index if not exists marketplace_listings_public_filter_idx
  on public.marketplace_listings (operation_type, property_type, price, bedrooms, published_at desc)
  where visibility='public' and status='published' and rights_confirmed_at is not null;
