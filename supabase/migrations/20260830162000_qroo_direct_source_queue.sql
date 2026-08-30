create or replace function public.list_qroo_direct_sources(p_limit integer default 100)
returns jsonb
language sql
security definer
set search_path to 'public','pg_temp'
as $function$
  with eligible as (
    select
      s.id,
      s.name,
      s.source_url,
      coalesce((
        select ml.city
        from public.marketplace_listings ml
        where ml.source_id=s.id and nullif(ml.city,'') is not null
        group by ml.city
        order by count(*) desc, ml.city
        limit 1
      ), 'Quintana Roo') as city_hint,
      (select count(*) from public.marketplace_listings ml2 where ml2.source_id=s.id) as listings_count
    from public.marketplace_sources s
    where s.active=true
      and s.rights_basis='public_link_only'
      and s.source_type in ('url','sitemap','feed','partner')
      and s.source_url ~ '^https://'
      and exists (
        select 1
        from public.marketplace_source_parties sp
        join public.marketplace_parties p on p.id=sp.party_id
        where sp.source_id=s.id
          and p.contact_status='verified'
          and p.state_region='Quintana Roo'
          and (nullif(p.email,'') is not null or nullif(p.phone,'') is not null or nullif(p.whatsapp,'') is not null)
      )
  ), ranked as (
    select * from eligible
    order by listings_count desc, name
    limit greatest(1,least(coalesce(p_limit,100),200))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'name',name,
    'source_url',source_url,
    'crawl_roots',jsonb_build_array(source_url),
    'city_hint',city_hint,
    'existing_listings',listings_count
  ) order by listings_count desc,name),'[]'::jsonb)
  from ranked;
$function$;

revoke all on function public.list_qroo_direct_sources(integer) from public,anon,authenticated;
grant execute on function public.list_qroo_direct_sources(integer) to service_role;
