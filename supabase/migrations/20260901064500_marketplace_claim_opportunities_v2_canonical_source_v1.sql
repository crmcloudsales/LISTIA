-- LISTIA Marketplace only.
-- Keep historical parties/evidence intact, but expose one canonical commercial opportunity
-- per marketplace source in V2 so claim queues do not visually duplicate a project.

create or replace view public.marketplace_claim_opportunities_v2 as
with ranked as (
  select o.*,
         row_number() over (
           partition by o.source_id
           order by
             o.claim_score desc,
             case when o.contact_status='verified' then 0 when o.contact_status='partially_verified' then 1 else 2 end,
             o.confidence desc nulls last,
             case when o.party_type='source_publisher' then 0 when o.party_type='developer' then 1 else 2 end,
             o.party_id
         ) as rn
  from public.marketplace_claim_opportunities o
), canonical as (
  select * from ranked where rn=1
)
select o.party_id,o.display_name,o.party_type,o.city,o.state_region,o.country_code,o.website_url,o.email,o.phone,o.whatsapp,
       o.contact_status,o.is_claimable,o.listia_organization_id,o.confidence,o.last_verified_at,o.source_id,o.source_name,o.source_url,
       o.rights_basis,o.public_listings,o.valid_cover,o.rich5,o.rich10,o.claim_score,o.opportunity_tier,
       coalesce(d.listing_views,0) as listing_views_30d,
       coalesce(d.property_opens,0) as property_opens_30d,
       coalesce(d.saves,0) as saves_30d,
       coalesce(d.shares,0) as shares_30d,
       coalesce(d.contact_actions,0) as contact_actions_30d,
       coalesce(d.inquiries,0) as inquiries_30d,
       coalesce(d.unique_sessions,0) as unique_sessions_30d,
       d.last_demand_at,
       (o.claim_score
        + least(coalesce(d.unique_sessions,0),10)
        + least(coalesce(d.contact_actions,0)*3,15)
        + least(coalesce(d.inquiries,0)*5,20))::integer as demand_claim_score,
       case
         when (o.claim_score + least(coalesce(d.unique_sessions,0),10) + least(coalesce(d.contact_actions,0)*3,15) + least(coalesce(d.inquiries,0)*5,20)) >= 80 then 'hot'
         when (o.claim_score + least(coalesce(d.unique_sessions,0),10) + least(coalesce(d.contact_actions,0)*3,15) + least(coalesce(d.inquiries,0)*5,20)) >= 60 then 'warm'
         else 'develop'
       end as demand_opportunity_tier
from canonical o
left join private.marketplace_demand_source_30d d on d.source_id=o.source_id;
