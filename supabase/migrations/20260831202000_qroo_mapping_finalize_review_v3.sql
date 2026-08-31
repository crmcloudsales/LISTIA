update public.marketplace_qroo_places
set aliases = aliases || array['Buenavista','Wildlife lagoon'], updated_at=now()
where place_key='bacalar' and not ('Buenavista'=any(aliases));

create or replace view public.marketplace_qroo_mapping_review as
select q.*,
case
  when lower(coalesce(raw_place,'')) in (
    'el molino residencial','el campanario','fraccionamiento el campanario','punta tiburón','punta tiburon',
    'punta tiburón residencial marina & golf','querétaro','santiago de querétaro','valle real','abu dhabi','la espiga',
    'león de los aldama','arcos vallarta','boca del río','tapalpa','jardines del campestre',
    'camino real','los robles','riviera yucateca','vista bella'
  ) then 'out_of_state_quarantine'
  when location_review_required then 'manual_review'
  else 'mapped'
end as mapping_status
from public.marketplace_qroo_mapped_listings q;

create or replace view public.marketplace_qroo_clean_map as
select * from public.marketplace_qroo_mapping_review where mapping_status='mapped';

create or replace view public.marketplace_qroo_mapping_summary as
select municipality,canonical_place,map_precision,count(*)::bigint as listings,
       count(*) filter(where source_id is not null)::bigint as attributed_listings,
       count(distinct source_id)::bigint as sources
from public.marketplace_qroo_clean_map
group by municipality,canonical_place,map_precision;
