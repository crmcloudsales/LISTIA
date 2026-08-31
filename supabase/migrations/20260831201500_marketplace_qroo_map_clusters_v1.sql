create or replace view public.marketplace_qroo_map_clusters as
with source_contact as (
  select source_id,
         bool_or(email is not null or phone is not null or whatsapp is not null) as has_contact
  from public.marketplace_source_prospect_backup
  group by source_id
), base as (
  select l.*,
         case when l.price is not null and l.area_m2 is not null and l.area_m2 > 0 then l.price/l.area_m2 end as price_per_m2,
         coalesce(sc.has_contact,false) as has_contact
  from public.marketplace_qroo_mapped_listings l
  left join source_contact sc on sc.source_id=l.source_id
  where l.map_precision <> 'unmapped'
)
select
  place_key,
  canonical_place,
  municipality,
  place_type,
  max(map_latitude)::numeric(10,6) as latitude,
  max(map_longitude)::numeric(10,6) as longitude,
  count(*)::bigint as listings,
  count(distinct source_id)::bigint as sources,
  count(*) filter (where has_contact)::bigint as listings_with_contact,
  round(100.0 * count(*) filter (where has_contact) / nullif(count(*),0),2) as contact_coverage_pct,
  count(*) filter (where lower(coalesce(operation_type,'')) in ('sale','venta'))::bigint as sale_listings,
  count(*) filter (where lower(coalesce(operation_type,'')) in ('rent','renta'))::bigint as rent_listings,
  percentile_cont(0.5) within group (order by price) filter (where price is not null)::numeric as median_price,
  percentile_cont(0.5) within group (order by price_per_m2) filter (where price_per_m2 is not null)::numeric as median_price_per_m2,
  avg(area_m2) filter (where area_m2 is not null)::numeric as avg_area_m2
from base
group by place_key,canonical_place,municipality,place_type;

revoke all on public.marketplace_qroo_map_clusters from anon, authenticated;
grant select on public.marketplace_qroo_map_clusters to service_role;

create or replace view public.marketplace_qroo_map_summary as
select
  municipality,
  count(*)::bigint as listings,
  count(distinct source_id)::bigint as sources,
  count(*) filter (where map_precision='locality_centroid')::bigint as centroid_mapped,
  count(*) filter (where map_precision='exact')::bigint as exact_mapped,
  percentile_cont(0.5) within group (order by price) filter (where price is not null)::numeric as median_price,
  percentile_cont(0.5) within group (order by (price/area_m2)) filter (where price is not null and area_m2 is not null and area_m2>0)::numeric as median_price_per_m2
from public.marketplace_qroo_mapped_listings
where map_precision <> 'unmapped'
group by municipality;

revoke all on public.marketplace_qroo_map_summary from anon, authenticated;
grant select on public.marketplace_qroo_map_summary to service_role;
