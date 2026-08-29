create or replace function public.ingest_qroo_crawl_chunk(p_chunk_url text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  resp http_response;
  payload jsonb;
  src uuid;
  inserted_count integer := 0;
  skipped_count integer := 0;
  payload_count integer := 0;
begin
  if p_chunk_url !~ '^https://raw\.githubusercontent\.com/crmcloudsales/LISTIA/main/data/qroo-crawl/chunk-[0-9]{4}\.json$' then
    raise exception 'invalid_qroo_chunk_url';
  end if;

  select id into src from public.marketplace_sources
  where source_url='https://propiedades.com/quintana-roo/' order by created_at asc limit 1;
  if src is null then raise exception 'qroo_source_missing'; end if;

  select * into resp from http_get(p_chunk_url);
  if resp.status<>200 then raise exception 'qroo_chunk_http_%',resp.status; end if;
  payload:=resp.content::jsonb;
  if jsonb_typeof(payload)<>'array' then raise exception 'qroo_chunk_not_array'; end if;
  payload_count:=jsonb_array_length(payload);

  with raw as (select x from jsonb_array_elements(payload) x), parsed as (
    select nullif(x->>'external_id','') external_id,left(nullif(x->>'slug',''),220) slug,
      left(coalesce(nullif(x->>'title',''),'Propiedad en Quintana Roo'),500) title,
      left(coalesce(nullif(x->>'description',''),'Propiedad en Quintana Roo. Precio y disponibilidad sujetos a cambios.'),5000) description,
      case when x->>'operation_type' in ('sale','rent') then x->>'operation_type' else 'sale' end operation_type,
      left(coalesce(nullif(x->>'property_type',''),'property'),120) property_type,
      case when (x->>'price')~'^[0-9]+(\.[0-9]+)?$' then (x->>'price')::numeric else null end price,
      case when upper(coalesce(x->>'currency','MXN')) in ('MXN','USD','CAD','EUR') then upper(coalesce(x->>'currency','MXN')) else 'MXN' end currency,
      left(coalesce(nullif(x->>'location_text',''),'Quintana Roo'),1000) location_text,
      left(nullif(x->>'city',''),200) city,'Quintana Roo'::text state_region,'MX'::text country_code,
      case when (x->>'bedrooms')~'^[0-9]+(\.[0-9]+)?$' and (x->>'bedrooms')::numeric between 0 and 50 then (x->>'bedrooms')::numeric else null end bedrooms,
      case when (x->>'bathrooms')~'^[0-9]+(\.[0-9]+)?$' and (x->>'bathrooms')::numeric between 0 and 50 then (x->>'bathrooms')::numeric else null end bathrooms,
      case when (x->>'area_m2')~'^[0-9]+(\.[0-9]+)?$' and (x->>'area_m2')::numeric between 0 and 100000000 then (x->>'area_m2')::numeric else null end area_m2,
      left(nullif(x->>'page_url',''),2000) page_url,left(nullif(x->>'cover_image_url',''),2000) cover_image_url,
      case when jsonb_typeof(x->'gallery')='array' and jsonb_array_length(x->'gallery')>0 then x->'gallery'
           when nullif(x->>'cover_image_url','') is not null then jsonb_build_array(x->>'cover_image_url') else '[]'::jsonb end gallery,x
    from raw
  ), valid as (
    select *,regexp_replace(translate(lower(location_text),'áéíóúüñ','aeiouun'),'[^a-z0-9]+','','g') loc_key
    from parsed where external_id~'^[0-9]+$' and slug~'^qroo-[0-9]+$' and cover_image_url~'^https?://' and jsonb_array_length(gallery)>0
  ), to_insert as (
    select v.* from valid v where not exists(select 1 from public.marketplace_listings ml where ml.slug=v.slug)
      and not exists(select 1 from public.marketplace_listings ml where ml.status='published' and ml.visibility='public'
        and lower(coalesce(ml.state_region,''))='quintana roo' and coalesce(ml.price,-1)=coalesce(v.price,-1)
        and coalesce(ml.bedrooms,-1)=coalesce(v.bedrooms,-1) and coalesce(ml.bathrooms,-1)=coalesce(v.bathrooms,-1)
        and coalesce(ml.area_m2,-1)=coalesce(v.area_m2,-1)
        and regexp_replace(translate(lower(coalesce(ml.location_text,'')),'áéíóúüñ','aeiouun'),'[^a-z0-9]+','','g')=v.loc_key)
  ), ins as (
    insert into public.marketplace_listings(source_id,slug,title,description,operation_type,property_type,price,currency,location_text,city,state_region,country_code,bedrooms,bathrooms,area_m2,cover_image_url,gallery,features,locale,visibility,status,rights_basis,rights_confirmed_at,external_url,published_at,created_at,updated_at)
    select src,slug,title,description,operation_type,property_type,price,currency,location_text,city,state_region,country_code,bedrooms,bathrooms,area_m2,cover_image_url,gallery,
      jsonb_build_object('internal_external_id',external_id,'internal_municipality',x->>'municipality','internal_ingestion','qroo_statewide_crawl_image_first'),
      'es','public','published','public_link_only',null,page_url,now(),now(),now() from to_insert on conflict(slug) do nothing returning 1
  ) select count(*) into inserted_count from ins;

  skipped_count:=greatest(payload_count-inserted_count,0);
  update public.marketplace_sources set last_synced_at=now(),updated_at=now() where id=src;
  return jsonb_build_object('payload',payload_count,'inserted',inserted_count,'skipped',skipped_count,'image_required',true,'chunk',p_chunk_url);
end;
$function$;
