drop view if exists public.marketplace_qroo_microzones_v3;
create view public.marketplace_qroo_microzones_v3 as
with clean as (
  select l.*,
         nullif(btrim((regexp_match(coalesce(l.location_text,''), '(?i)Col\.\s*([^,]+)'))[1]),'') as extracted_colonia,
         nullif((regexp_match(coalesce(l.location_text,''), '(?i)C\.P\.\s*([0-9]{5})'))[1],'') as extracted_postal_code,
         upper(coalesce(nullif(btrim(l.currency),''),'UNKNOWN')) as price_currency,
         lower(coalesce(nullif(btrim(l.operation_type),''),'unknown')) as normalized_operation,
         case
           when coalesce(l.title,'') ~* '(Quer[eé]taro|Zapopan|Jalisco|Tapalpa|La Barca|Boca del R[ií]o|Veracruz|Guanajuato|Abu Dhabi)'
                and coalesce(l.title,'') !~* '(Quintana Roo|Solidaridad|Playa del Carmen|Canc[uú]n|Tulum|Bacalar|Cozumel|Puerto Morelos|Isla Mujeres|Chetumal|Akumal)'
             then true
           else false
         end as obvious_out_of_state
  from public.marketplace_qroo_mapped_listings l
  where l.map_precision <> 'unmapped'
), metrics as (
  select
    canonical_place,
    municipality,
    coalesce(extracted_colonia, canonical_place) as microzone,
    extracted_postal_code as postal_code,
    price_currency as currency,
    normalized_operation as operation_type,
    count(*) filter (where not obvious_out_of_state)::bigint as listings,
    count(distinct source_id) filter (where not obvious_out_of_state)::bigint as sources,
    count(*) filter (where obvious_out_of_state)::bigint as quarantined_suspect_rows,
    count(*) filter(where price is not null and not obvious_out_of_state)::bigint as priced_listings,
    count(*) filter(where price is not null and area_m2 is not null and area_m2>0 and not obvious_out_of_state)::bigint as price_m2_samples,
    percentile_cont(0.5) within group(order by price) filter(where price is not null and not obvious_out_of_state)::numeric as median_price,
    percentile_cont(0.5) within group(order by (price/area_m2)) filter(where price is not null and area_m2 is not null and area_m2>0 and not obvious_out_of_state)::numeric as median_price_per_m2
  from clean
  group by canonical_place,municipality,coalesce(extracted_colonia, canonical_place),extracted_postal_code,price_currency,normalized_operation
  having count(*) filter(where not obvious_out_of_state)>0
)
select *,
  case
    when price_m2_samples >= 20 and sources >= 2 then 'high'
    when price_m2_samples >= 8 then 'medium'
    else 'low'
  end as metric_confidence
from metrics;

revoke all on public.marketplace_qroo_microzones_v3 from anon,authenticated;
grant select on public.marketplace_qroo_microzones_v3 to service_role;
