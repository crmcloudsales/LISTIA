-- LISTIA absolute media rule: a real photo from another property is still invalid.
-- Enforce source-listing binding for Q.Roo payloads and reject ambiguous image reuse.

begin;

create or replace function private.qroo_image_belongs_to_listing(p_url text, p_external_id text)
returns boolean
language sql
immutable
set search_path = pg_catalog, pg_temp
as $function$
  select private.marketplace_image_url_is_valid(p_url)
     and nullif(btrim(coalesce(p_external_id,'')),'') is not null
     and (
       p_url !~ '[0-9]{6,}'
       or p_url ~ ('(^|[^0-9])' || p_external_id || '([^0-9]|$)')
     );
$function$;

revoke execute on function private.qroo_image_belongs_to_listing(text,text) from public, anon, authenticated;
grant execute on function private.qroo_image_belongs_to_listing(text,text) to service_role;

create or replace function public.ingest_qroo_payload(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $function$
declare
  src uuid;
  payload_count integer := 0;
  valid_count integer := 0;
  inserted_count integer := 0;
  duplicate_or_existing_count integer := 0;
  invalid_count integer := 0;
begin
  if jsonb_typeof(p_payload) <> 'array' then raise exception 'qroo_payload_not_array'; end if;
  payload_count := jsonb_array_length(p_payload);
  if payload_count < 1 or payload_count > 250 then raise exception 'qroo_payload_size_invalid'; end if;

  select id into src
  from public.marketplace_sources
  where source_url='https://propiedades.com/quintana-roo/'
  order by created_at asc limit 1;
  if src is null then raise exception 'qroo_source_missing'; end if;

  with raw as (
    select x from jsonb_array_elements(p_payload) x
  ), parsed as (
    select
      nullif(x->>'external_id','') external_id,
      left(nullif(x->>'slug',''),220) slug,
      left(coalesce(nullif(x->>'title',''),'Propiedad en Quintana Roo'),500) title,
      left(coalesce(nullif(x->>'description',''),'Propiedad en Quintana Roo. Precio y disponibilidad sujetos a cambios.'),5000) description,
      case when x->>'operation_type' in ('sale','rent') then x->>'operation_type' else 'sale' end operation_type,
      left(coalesce(nullif(x->>'property_type',''),'property'),120) property_type,
      case when (x->>'price')~'^[0-9]+(\.[0-9]+)?$' then (x->>'price')::numeric else null end price,
      case when upper(coalesce(x->>'currency','MXN')) in ('MXN','USD','CAD','EUR') then upper(coalesce(x->>'currency','MXN')) else 'MXN' end currency,
      left(coalesce(nullif(x->>'location_text',''),'Quintana Roo'),1000) location_text,
      left(nullif(x->>'city',''),200) city,
      'Quintana Roo'::text state_region,
      'MX'::text country_code,
      case when (x->>'bedrooms')~'^[0-9]+(\.[0-9]+)?$' and (x->>'bedrooms')::numeric between 0 and 50 then (x->>'bedrooms')::numeric else null end bedrooms,
      case when (x->>'bathrooms')~'^[0-9]+(\.[0-9]+)?$' and (x->>'bathrooms')::numeric between 0 and 50 then (x->>'bathrooms')::numeric else null end bathrooms,
      case when (x->>'area_m2')~'^[0-9]+(\.[0-9]+)?$' and (x->>'area_m2')::numeric between 0 and 100000000 then (x->>'area_m2')::numeric else null end area_m2,
      left(nullif(x->>'page_url',''),2000) page_url,
      left(nullif(x->>'cover_image_url',''),2000) raw_cover,
      case when jsonb_typeof(x->'gallery')='array' then x->'gallery' else '[]'::jsonb end raw_gallery,
      x
    from raw
  ), normalized as (
    select p.*,
      coalesce((
        select jsonb_agg(g.url order by g.ord)
        from jsonb_array_elements_text(p.raw_gallery) with ordinality as g(url,ord)
        where private.marketplace_image_url_is_valid(g.url)
      ), '[]'::jsonb) as gallery,
      case when private.marketplace_image_url_is_valid(p.raw_cover) then p.raw_cover else (
        select g.url from jsonb_array_elements_text(p.raw_gallery) with ordinality as g(url,ord)
        where private.marketplace_image_url_is_valid(g.url)
        order by g.ord limit 1
      ) end as cover_image_url
    from parsed p
  ), candidates as (
    select n.*,count(*) over(partition by n.cover_image_url) as cover_reuse_in_payload
    from normalized n
  ), valid as (
    select *,regexp_replace(translate(lower(location_text),'áéíóúüñ','aeiouun'),'[^a-z0-9]+','','g') loc_key
    from candidates
    where external_id~'^[0-9]+$'
      and slug~'^qroo-[0-9]+$'
      and private.qroo_image_belongs_to_listing(cover_image_url,external_id)
      and jsonb_array_length(gallery)>0
      and (cover_reuse_in_payload=1 or cover_image_url ~ ('(^|[^0-9])'||external_id||'([^0-9]|$)'))
  ), counted as (
    select count(*)::integer c from valid
  ), to_insert as (
    select v.* from valid v
    where not exists(select 1 from public.marketplace_listings ml where ml.slug=v.slug)
      and not exists(
        select 1 from public.marketplace_listings ml
        where ml.source_id=src and ml.slug<>v.slug and ml.cover_image_url=v.cover_image_url
          and ml.status='published' and ml.visibility='public'
      )
      and not exists(
        select 1 from public.marketplace_listings ml
        where ml.status='published' and ml.visibility='public'
          and lower(coalesce(ml.state_region,''))='quintana roo'
          and coalesce(ml.price,-1)=coalesce(v.price,-1)
          and coalesce(ml.bedrooms,-1)=coalesce(v.bedrooms,-1)
          and coalesce(ml.bathrooms,-1)=coalesce(v.bathrooms,-1)
          and coalesce(ml.area_m2,-1)=coalesce(v.area_m2,-1)
          and regexp_replace(translate(lower(coalesce(ml.location_text,'')),'áéíóúüñ','aeiouun'),'[^a-z0-9]+','','g')=v.loc_key
      )
  ), ins as (
    insert into public.marketplace_listings(
      source_id,slug,title,description,operation_type,property_type,price,currency,
      location_text,city,state_region,country_code,bedrooms,bathrooms,area_m2,
      cover_image_url,gallery,features,locale,visibility,status,rights_basis,
      rights_confirmed_at,external_url,published_at,created_at,updated_at
    )
    select src,slug,title,description,operation_type,property_type,price,currency,
      location_text,city,state_region,country_code,bedrooms,bathrooms,area_m2,
      cover_image_url,gallery,
      jsonb_build_object('internal_external_id',external_id,'internal_municipality',x->>'municipality','internal_ingestion','qroo_private_oidc_v2'),
      'es','public','published','public_link_only',null,page_url,now(),now(),now()
    from to_insert
    on conflict(slug) do nothing
    returning 1
  )
  select (select c from counted),(select count(*)::integer from ins)
  into valid_count,inserted_count;

  invalid_count:=greatest(payload_count-valid_count,0);
  duplicate_or_existing_count:=greatest(valid_count-inserted_count,0);
  update public.marketplace_sources set last_synced_at=now(),updated_at=now() where id=src;

  return jsonb_build_object(
    'payload',payload_count,'valid',valid_count,'invalid',invalid_count,'inserted',inserted_count,
    'duplicate_or_existing',duplicate_or_existing_count,'image_required',true,
    'generic_placeholders_rejected',true,'image_listing_binding_enforced',true,
    'transport','github_oidc_edge_v2'
  );
end;
$function$;

revoke execute on function public.ingest_qroo_payload(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_qroo_payload(jsonb) to service_role;

commit;
