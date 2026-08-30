create or replace function public.ingest_qroo_direct_payload(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  payload_count integer := 0;
  valid_count integer := 0;
  inserted_count integer := 0;
  invalid_count integer := 0;
  duplicate_or_existing_count integer := 0;
begin
  if jsonb_typeof(p_payload) <> 'array' then
    raise exception 'qroo_direct_payload_not_array';
  end if;
  payload_count := jsonb_array_length(p_payload);
  if payload_count < 1 or payload_count > 200 then
    raise exception 'qroo_direct_payload_size_invalid';
  end if;

  with raw as (
    select x from jsonb_array_elements(p_payload) x
  ), parsed as (
    select
      left(nullif(x->>'source_url',''),2000) source_url,
      left(nullif(x->>'slug',''),220) slug,
      left(coalesce(nullif(x->>'title',''),'Propiedad en Quintana Roo'),500) title,
      left(coalesce(nullif(x->>'description',''),'Propiedad disponible en Quintana Roo.'),1200) description,
      case when x->>'operation_type' in ('sale','rent') then x->>'operation_type' else 'sale' end operation_type,
      left(coalesce(nullif(x->>'property_type',''),'property'),120) property_type,
      case when (x->>'price')~'^[0-9]+(\.[0-9]+)?$' then (x->>'price')::numeric else null end price,
      case when upper(coalesce(x->>'currency','MXN')) in ('MXN','USD','CAD','EUR') then upper(coalesce(x->>'currency','MXN')) else 'MXN' end currency,
      left(coalesce(nullif(x->>'location_text',''),'Quintana Roo'),1000) location_text,
      left(nullif(x->>'city',''),200) city,
      case when (x->>'bedrooms')~'^[0-9]+(\.[0-9]+)?$' and (x->>'bedrooms')::numeric between 0 and 50 then (x->>'bedrooms')::numeric else null end bedrooms,
      case when (x->>'bathrooms')~'^[0-9]+(\.[0-9]+)?$' and (x->>'bathrooms')::numeric between 0 and 50 then (x->>'bathrooms')::numeric else null end bathrooms,
      case when (x->>'area_m2')~'^[0-9]+(\.[0-9]+)?$' and (x->>'area_m2')::numeric between 0 and 100000000 then (x->>'area_m2')::numeric else null end area_m2,
      left(nullif(x->>'page_url',''),2000) page_url,
      left(nullif(x->>'cover_image_url',''),2000) raw_cover,
      case when jsonb_typeof(x->'gallery')='array' then x->'gallery' else '[]'::jsonb end raw_gallery,
      x
    from raw
  ), sourced as (
    select p.*, s.id source_id
    from parsed p
    left join public.marketplace_sources s
      on s.source_url=p.source_url
     and s.active=true
     and s.rights_basis='public_link_only'
     and exists (
       select 1
       from public.marketplace_source_parties sp
       join public.marketplace_parties mp on mp.id=sp.party_id
       where sp.source_id=s.id
         and mp.contact_status='verified'
         and (nullif(mp.email,'') is not null or nullif(mp.phone,'') is not null or nullif(mp.whatsapp,'') is not null)
     )
  ), normalized as (
    select s.*,
      coalesce((
        select jsonb_agg(g.url order by g.ord)
        from jsonb_array_elements_text(s.raw_gallery) with ordinality as g(url,ord)
        where private.marketplace_image_url_is_valid(g.url)
      ), '[]'::jsonb) as gallery,
      case
        when private.marketplace_image_url_is_valid(s.raw_cover) then s.raw_cover
        else (
          select g.url
          from jsonb_array_elements_text(s.raw_gallery) with ordinality as g(url,ord)
          where private.marketplace_image_url_is_valid(g.url)
          order by g.ord limit 1
        )
      end as cover_image_url
    from sourced s
  ), candidates as (
    select n.*, count(*) over(partition by n.cover_image_url) as cover_reuse_in_payload
    from normalized n
  ), valid as (
    select c.*,
      regexp_replace(translate(lower(location_text),'áéíóúüñ','aeiouun'),'[^a-z0-9]+','','g') loc_key
    from candidates c
    where source_id is not null
      and slug ~ '^qroo-direct-[a-z0-9-]+-[a-f0-9]{20}$'
      and page_url ~ '^https?://'
      and private.marketplace_image_url_is_valid(cover_image_url)
      and jsonb_array_length(gallery)>0
      and cover_reuse_in_payload=1
  ), counted as (
    select count(*)::integer c from valid
  ), to_insert as (
    select v.*
    from valid v
    where not exists(select 1 from public.marketplace_listings ml where ml.slug=v.slug)
      and not exists(select 1 from public.marketplace_listings ml where ml.external_url=v.page_url)
      and not exists(
        select 1 from public.marketplace_listings ml
        where ml.source_id=v.source_id and ml.cover_image_url=v.cover_image_url
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
    select
      source_id,slug,title,description,operation_type,property_type,price,currency,
      location_text,city,'Quintana Roo','MX',bedrooms,bathrooms,area_m2,
      cover_image_url,gallery,
      jsonb_build_object('internal_ingestion','qroo_direct_oidc_v1','internal_source_url',source_url),
      'es','public','published','public_link_only',null,page_url,now(),now(),now()
    from to_insert
    on conflict(slug) do nothing
    returning 1
  )
  select (select c from counted),(select count(*)::integer from ins)
  into valid_count,inserted_count;

  invalid_count := greatest(payload_count-valid_count,0);
  duplicate_or_existing_count := greatest(valid_count-inserted_count,0);

  update public.marketplace_sources s
  set last_synced_at=now(), updated_at=now()
  where s.id in (
    select distinct ms.id
    from public.marketplace_sources ms
    join jsonb_array_elements(p_payload) x on x->>'source_url'=ms.source_url
  );

  return jsonb_build_object(
    'payload',payload_count,
    'valid',valid_count,
    'invalid',invalid_count,
    'inserted',inserted_count,
    'duplicate_or_existing',duplicate_or_existing_count,
    'image_required',true,
    'verified_source_contact_required',true,
    'transport','github_oidc_qroo_direct_v1'
  );
end;
$function$;

revoke all on function public.ingest_qroo_direct_payload(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_qroo_direct_payload(jsonb) to service_role;
