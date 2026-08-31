create table if not exists private.marketplace_search_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  seed_ref text,
  channel text not null default 'real_estate_search',
  status text not null default 'running' check (status in ('queued','running','completed','partial','failed')),
  payload_count integer not null default 0,
  imported_count integer not null default 0,
  updated_count integer not null default 0,
  review_count integer not null default 0,
  invalid_count integer not null default 0,
  contact_count integer not null default 0,
  observation_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table private.marketplace_search_ingestion_runs enable row level security;
revoke all on private.marketplace_search_ingestion_runs from public, anon, authenticated;

create table if not exists private.marketplace_search_ingestion_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references private.marketplace_search_ingestion_runs(id) on delete cascade,
  fingerprint text not null,
  source_url text,
  page_url text,
  listing_id uuid references public.marketplace_listings(id) on delete set null,
  source_id uuid references public.marketplace_sources(id) on delete set null,
  primary_party_id uuid references public.marketplace_parties(id) on delete set null,
  status text not null check (status in ('imported','updated','needs_review','invalid','error')),
  raw_payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  error_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, fingerprint)
);
alter table private.marketplace_search_ingestion_items enable row level security;
revoke all on private.marketplace_search_ingestion_items from public, anon, authenticated;
create index if not exists marketplace_search_ingestion_items_listing_idx on private.marketplace_search_ingestion_items(listing_id);
create index if not exists marketplace_search_ingestion_items_status_idx on private.marketplace_search_ingestion_items(run_id,status);

create table if not exists private.marketplace_listing_identity (
  fingerprint text primary key,
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  canonical_url text,
  source_id uuid references public.marketplace_sources(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
alter table private.marketplace_listing_identity enable row level security;
revoke all on private.marketplace_listing_identity from public, anon, authenticated;
create index if not exists marketplace_listing_identity_listing_idx on private.marketplace_listing_identity(listing_id);

create table if not exists private.marketplace_listing_observations (
  id uuid primary key default gen_random_uuid(),
  observation_key text not null unique,
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  source_id uuid references public.marketplace_sources(id) on delete set null,
  run_id uuid references private.marketplace_search_ingestion_runs(id) on delete set null,
  observed_at timestamptz not null default now(),
  observed_on date not null default ((now() at time zone 'America/Cancun')::date),
  price numeric,
  currency text,
  operation_type text,
  property_type text,
  area_m2 numeric,
  bedrooms numeric,
  bathrooms numeric,
  city text,
  state_region text,
  country_code text,
  source_url text,
  contact_coverage boolean not null default false,
  internal_listing_status text,
  internal_listing_visibility text,
  metadata jsonb not null default '{}'::jsonb
);
alter table private.marketplace_listing_observations enable row level security;
revoke all on private.marketplace_listing_observations from public, anon, authenticated;
create index if not exists marketplace_listing_observations_listing_time_idx on private.marketplace_listing_observations(listing_id,observed_at desc);
create index if not exists marketplace_listing_observations_market_idx on private.marketplace_listing_observations(country_code,state_region,city,operation_type,property_type,observed_on desc);

create table if not exists private.market_observed_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  country_code text,
  state_region text,
  city text,
  operation_type text,
  property_type text,
  bedrooms_bucket integer,
  currency text,
  inventory_count bigint not null default 0,
  source_count bigint not null default 0,
  median_price numeric,
  median_price_m2 numeric,
  avg_area_m2 numeric,
  contact_coverage_count bigint not null default 0,
  contact_coverage_pct numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (snapshot_date,country_code,state_region,city,operation_type,property_type,bedrooms_bucket,currency)
);
alter table private.market_observed_daily_snapshots enable row level security;
revoke all on private.market_observed_daily_snapshots from public, anon, authenticated;

create or replace view analytics.market_observed_supply_live as
with latest as (
  select distinct on (o.listing_id)
    o.listing_id,o.source_id,o.observed_at,o.price,o.currency,o.operation_type,o.property_type,
    o.area_m2,o.bedrooms,o.bathrooms,o.city,o.state_region,o.country_code,o.contact_coverage
  from private.marketplace_listing_observations o
  where o.observed_at >= now() - interval '120 days'
  order by o.listing_id,o.observed_at desc
), base as (
  select *,
    case when bedrooms is null then null else least(greatest(floor(bedrooms)::int,0),10) end as bedrooms_bucket,
    case when price is not null and area_m2 is not null and area_m2 > 0 then price / area_m2 else null end as price_m2
  from latest
)
select
  country_code,state_region,city,operation_type,property_type,bedrooms_bucket,currency,
  count(*)::bigint as inventory_count,
  count(distinct source_id)::bigint as source_count,
  percentile_cont(0.5) within group (order by price) filter (where price is not null) as median_price,
  percentile_cont(0.5) within group (order by price_m2) filter (where price_m2 is not null) as median_price_m2,
  avg(area_m2) filter (where area_m2 is not null and area_m2 > 0) as avg_area_m2,
  count(*) filter (where contact_coverage)::bigint as contact_coverage_count,
  round((100.0 * count(*) filter (where contact_coverage) / nullif(count(*),0))::numeric,2) as contact_coverage_pct
from base
group by country_code,state_region,city,operation_type,property_type,bedrooms_bucket,currency;
revoke all on analytics.market_observed_supply_live from public, anon, authenticated;

create or replace function private.refresh_market_observed_daily_snapshot()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_date date := (now() at time zone 'America/Cancun')::date;
  v_count bigint := 0;
begin
  insert into private.market_observed_daily_snapshots(
    snapshot_date,country_code,state_region,city,operation_type,property_type,bedrooms_bucket,currency,
    inventory_count,source_count,median_price,median_price_m2,avg_area_m2,contact_coverage_count,contact_coverage_pct,updated_at
  )
  select v_date,country_code,state_region,city,operation_type,property_type,bedrooms_bucket,currency,
         inventory_count,source_count,median_price,median_price_m2,avg_area_m2,contact_coverage_count,contact_coverage_pct,now()
  from analytics.market_observed_supply_live
  on conflict (snapshot_date,country_code,state_region,city,operation_type,property_type,bedrooms_bucket,currency)
  do update set inventory_count=excluded.inventory_count,source_count=excluded.source_count,
                median_price=excluded.median_price,median_price_m2=excluded.median_price_m2,
                avg_area_m2=excluded.avg_area_m2,contact_coverage_count=excluded.contact_coverage_count,
                contact_coverage_pct=excluded.contact_coverage_pct,updated_at=now();
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok',true,'snapshot_date',v_date,'rows',v_count);
end;
$function$;
revoke all on function private.refresh_market_observed_daily_snapshot() from public,anon,authenticated;
grant execute on function private.refresh_market_observed_daily_snapshot() to service_role;

-- Service-only batch ingestion. Detailed normalization/deduplication is kept in the function
-- so GitHub OIDC callers never receive direct table write privileges.
create or replace function public.ingest_marketplace_search_batch(p_seed_ref text,p_channel text,p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_run uuid; v_item jsonb; v_source jsonb; v_listing jsonb; v_contacts jsonb; v_contact jsonb;
  v_source_id uuid; v_listing_id uuid; v_party_id uuid; v_primary_party_id uuid;
  v_source_url text; v_source_name text; v_page_url text; v_title text; v_summary text; v_operation text; v_property_type text;
  v_currency text; v_location text; v_city text; v_state text; v_country text; v_cover text; v_rights_basis text; v_rights_reference text;
  v_fingerprint text; v_slug text; v_external_key text; v_party_type text; v_role text; v_display_name text; v_evidence_url text;
  v_email text; v_phone text; v_whatsapp text; v_website text; v_person text; v_company text;
  v_price numeric; v_area numeric; v_bedrooms numeric; v_bathrooms numeric; v_parking numeric; v_lat numeric; v_lng numeric; v_conf numeric;
  v_publish boolean; v_rights_confirmed boolean; v_contact_coverage boolean; v_status text; v_is_new boolean; v_obs_key text;
  v_payload_count int:=0; v_imported int:=0; v_updated int:=0; v_review int:=0; v_invalid int:=0; v_contact_count int:=0; v_observation_count int:=0;
  v_norm_source text; v_norm_page text;
begin
  if jsonb_typeof(p_items)<>'array' then raise exception 'p_items_must_be_array'; end if;
  v_payload_count:=jsonb_array_length(p_items);
  if v_payload_count<1 or v_payload_count>250 then raise exception 'invalid_batch_size_%',v_payload_count; end if;
  insert into private.marketplace_search_ingestion_runs(seed_ref,channel,payload_count,metadata)
  values(nullif(btrim(p_seed_ref),''),coalesce(nullif(btrim(p_channel),''),'real_estate_search'),v_payload_count,jsonb_build_object('workflow','marketplace-search-v1')) returning id into v_run;

  for v_item in select value from jsonb_array_elements(p_items) loop
    begin
      v_source:=coalesce(v_item->'source','{}'::jsonb); v_listing:=coalesce(v_item->'listing',v_item); v_contacts:=coalesce(v_item->'contacts','[]'::jsonb);
      if jsonb_typeof(v_contacts)<>'array' then v_contacts:='[]'::jsonb; end if;
      v_source_url:=nullif(btrim(coalesce(v_source->>'url',v_listing->>'source_url','')),'');
      v_page_url:=nullif(btrim(coalesce(v_listing->>'page_url',v_listing->>'external_url','')),'');
      v_title:=nullif(btrim(v_listing->>'title'),''); v_cover:=nullif(btrim(v_listing->>'cover_image_url'),'');
      if v_page_url is null or v_page_url !~* '^https://' or v_title is null then
        v_fingerprint:=md5(coalesce(v_page_url,'')||'|'||coalesce(v_title,'')||'|'||v_item::text);
        insert into private.marketplace_search_ingestion_items(run_id,fingerprint,source_url,page_url,status,raw_payload,error_text)
        values(v_run,v_fingerprint,v_source_url,v_page_url,'invalid',v_item,'listing_requires_https_page_url_and_title') on conflict(run_id,fingerprint) do nothing;
        v_invalid:=v_invalid+1; continue;
      end if;
      v_source_url:=coalesce(v_source_url,(regexp_match(v_page_url,'^(https://[^/]+)'))[1]);
      v_source_name:=nullif(btrim(coalesce(v_source->>'name','')),'');
      if v_source_name is null then v_source_name:=regexp_replace(regexp_replace(v_source_url,'^https://(www\.)?','','i'),'/.*$','',''); end if;
      v_rights_basis:=lower(coalesce(nullif(v_listing->>'rights_basis',''),nullif(v_source->>'rights_basis',''),'public_link_only'));
      if v_rights_basis not in ('organization_owned','authorized_feed','licensed_partner','public_link_only') then v_rights_basis:='public_link_only'; end if;
      v_rights_reference:=nullif(btrim(coalesce(v_listing->>'rights_reference',v_source->>'rights_reference','')),'');
      v_norm_source:=lower(regexp_replace(btrim(v_source_url),'/+$',''));
      select s.id into v_source_id from public.marketplace_sources s where s.source_url is not null and lower(regexp_replace(btrim(s.source_url),'/+$',''))=v_norm_source order by s.created_at asc limit 1;
      if v_source_id is null then
        insert into public.marketplace_sources(scope,source_type,name,source_url,rights_basis,rights_reference,active,last_synced_at)
        values('platform','url',left(v_source_name,200),v_source_url,v_rights_basis,v_rights_reference,true,now()) returning id into v_source_id;
      else update public.marketplace_sources set last_synced_at=now(),updated_at=now(),rights_reference=coalesce(rights_reference,v_rights_reference) where id=v_source_id; end if;

      v_price:=case when coalesce(v_listing->>'price','')~'^[0-9]+([.][0-9]+)?$' then (v_listing->>'price')::numeric else null end;
      v_area:=case when coalesce(v_listing->>'area_m2','')~'^[0-9]+([.][0-9]+)?$' then (v_listing->>'area_m2')::numeric else null end;
      v_bedrooms:=case when coalesce(v_listing->>'bedrooms','')~'^[0-9]+([.][0-9]+)?$' then (v_listing->>'bedrooms')::numeric else null end;
      v_bathrooms:=case when coalesce(v_listing->>'bathrooms','')~'^[0-9]+([.][0-9]+)?$' then (v_listing->>'bathrooms')::numeric else null end;
      v_parking:=case when coalesce(v_listing->>'parking_spaces','')~'^[0-9]+([.][0-9]+)?$' then (v_listing->>'parking_spaces')::numeric else null end;
      v_lat:=case when coalesce(v_listing->>'latitude','')~'^-?[0-9]+([.][0-9]+)?$' then (v_listing->>'latitude')::numeric else null end;
      v_lng:=case when coalesce(v_listing->>'longitude','')~'^-?[0-9]+([.][0-9]+)?$' then (v_listing->>'longitude')::numeric else null end;
      if v_lat is not null and abs(v_lat)>90 then v_lat:=null; end if; if v_lng is not null and abs(v_lng)>180 then v_lng:=null; end if;
      v_operation:=lower(nullif(btrim(v_listing->>'operation_type'),'')); if v_operation not in ('sale','rent') then v_operation:=null; end if;
      v_property_type:=nullif(btrim(v_listing->>'property_type'),''); v_currency:=upper(coalesce(nullif(btrim(v_listing->>'currency'),''),'MXN'));
      v_location:=nullif(btrim(v_listing->>'location_text'),''); v_city:=nullif(btrim(v_listing->>'city'),''); v_state:=nullif(btrim(v_listing->>'state_region'),'');
      v_country:=upper(coalesce(nullif(btrim(v_listing->>'country_code'),''),'MX')); v_summary:=left(nullif(btrim(coalesce(v_listing->>'summary',v_listing->>'description','')),''),1200);
      v_norm_page:=lower(regexp_replace(btrim(v_page_url),'[?#].*$','')); v_external_key:=nullif(btrim(v_listing->>'external_key'),'');
      v_fingerprint:=md5(coalesce(v_external_key,'')||'|'||v_norm_page||'|'||lower(v_title)||'|'||coalesce(v_location,'')||'|'||coalesce(v_price::text,''));
      select i.listing_id into v_listing_id from private.marketplace_listing_identity i where i.fingerprint=v_fingerprint;
      v_is_new:=v_listing_id is null; v_rights_confirmed:=lower(coalesce(v_listing->>'rights_confirmed','false')) in ('true','1','yes');
      v_publish:=lower(coalesce(v_listing->>'publish_authorized','false')) in ('true','1','yes') and v_rights_confirmed and v_rights_basis in ('authorized_feed','licensed_partner') and v_cover~*'^https?://';
      if v_listing_id is null then
        v_slug:='search-'||substr(v_fingerprint,1,24); select id into v_listing_id from public.marketplace_listings where slug=v_slug limit 1;
        if v_listing_id is null then
          insert into public.marketplace_listings(source_id,slug,title,description,operation_type,property_type,price,currency,location_text,city,state_region,country_code,postal_code,bedrooms,bathrooms,parking_spaces,area_m2,latitude,longitude,cover_image_url,gallery,features,locale,visibility,status,rights_basis,rights_confirmed_at,external_url,published_at)
          values(v_source_id,v_slug,left(v_title,300),v_summary,v_operation,v_property_type,v_price,v_currency,v_location,v_city,v_state,v_country,nullif(btrim(v_listing->>'postal_code'),''),v_bedrooms,v_bathrooms,v_parking,v_area,v_lat,v_lng,v_cover,
            case when jsonb_typeof(v_listing->'gallery')='array' then v_listing->'gallery' when v_cover is not null then jsonb_build_array(v_cover) else '[]'::jsonb end,
            case when jsonb_typeof(v_listing->'features')='array' then v_listing->'features' else '[]'::jsonb end,
            coalesce(nullif(v_listing->>'locale',''),'es'),case when v_publish then 'public' else 'private' end,case when v_publish then 'published' else 'draft' end,v_rights_basis,case when v_publish then now() else null end,v_page_url,case when v_publish then now() else null end) returning id into v_listing_id;
        end if;
        insert into private.marketplace_listing_identity(fingerprint,listing_id,canonical_url,source_id,metadata) values(v_fingerprint,v_listing_id,v_norm_page,v_source_id,jsonb_build_object('seed_ref',p_seed_ref,'external_key',v_external_key)) on conflict(fingerprint) do update set last_seen_at=now(),canonical_url=excluded.canonical_url,source_id=excluded.source_id;
        v_imported:=v_imported+1;
      else
        update public.marketplace_listings set source_id=coalesce(source_id,v_source_id),title=coalesce(left(v_title,300),title),description=coalesce(v_summary,description),operation_type=coalesce(v_operation,operation_type),property_type=coalesce(v_property_type,property_type),price=coalesce(v_price,price),currency=coalesce(v_currency,currency),location_text=coalesce(v_location,location_text),city=coalesce(v_city,city),state_region=coalesce(v_state,state_region),country_code=coalesce(v_country,country_code),bedrooms=coalesce(v_bedrooms,bedrooms),bathrooms=coalesce(v_bathrooms,bathrooms),parking_spaces=coalesce(v_parking,parking_spaces),area_m2=coalesce(v_area,area_m2),latitude=coalesce(v_lat,latitude),longitude=coalesce(v_lng,longitude),cover_image_url=coalesce(v_cover,cover_image_url),gallery=case when jsonb_typeof(v_listing->'gallery')='array' and jsonb_array_length(v_listing->'gallery')>0 then v_listing->'gallery' else gallery end,external_url=coalesce(v_page_url,external_url),visibility=case when v_publish then 'public' else visibility end,status=case when v_publish then 'published' else status end,rights_basis=case when v_publish then v_rights_basis else rights_basis end,rights_confirmed_at=case when v_publish then coalesce(rights_confirmed_at,now()) else rights_confirmed_at end,published_at=case when v_publish then coalesce(published_at,now()) else published_at end,updated_at=now() where id=v_listing_id;
        update private.marketplace_listing_identity set last_seen_at=now(),canonical_url=v_norm_page,source_id=coalesce(source_id,v_source_id) where fingerprint=v_fingerprint; v_updated:=v_updated+1;
      end if;

      v_primary_party_id:=null; v_contact_coverage:=false;
      for v_contact in select value from jsonb_array_elements(v_contacts) loop
        v_email:=nullif(lower(btrim(v_contact->>'email')),''); v_phone:=nullif(btrim(v_contact->>'phone'),''); v_whatsapp:=nullif(btrim(v_contact->>'whatsapp'),'');
        v_website:=nullif(btrim(v_contact->>'website_url'),''); v_person:=nullif(btrim(v_contact->>'person_name'),''); v_company:=nullif(btrim(v_contact->>'company_name'),'');
        v_display_name:=coalesce(nullif(btrim(v_contact->>'display_name'),''),v_person,v_company,'Public listing contact'); v_party_type:=lower(coalesce(nullif(v_contact->>'party_type',''),'unknown'));
        if v_party_type not in ('legal_owner','developer','brokerage','agency','realtor','advisor','sales_office','source_publisher','portal','unknown') then v_party_type:='unknown'; end if;
        v_role:=lower(coalesce(nullif(v_contact->>'role',''),'listing_contact')); if v_role not in ('legal_owner','developer','brokerage','agency','realtor','advisor','sales_office','listing_contact','source_publisher','portal','unknown') then v_role:='listing_contact'; end if;
        v_evidence_url:=nullif(btrim(coalesce(v_contact->>'evidence_url',v_page_url)),''); v_conf:=case when coalesce(v_contact->>'confidence','')~'^[0-9]+([.][0-9]+)?$' then least(greatest((v_contact->>'confidence')::numeric,0),1) else 0.65 end;
        v_external_key:=nullif(btrim(v_contact->>'external_party_key'),'');
        if v_external_key is null then v_external_key:='search:'||md5(coalesce(v_email,'')||'|'||regexp_replace(coalesce(v_phone,v_whatsapp,''),'\D','','g')||'|'||lower(coalesce(v_company,''))||'|'||lower(coalesce(v_person,''))||'|'||lower(coalesce(v_website,''))); end if;
        if v_external_key='search:'||md5('||||') then continue; end if;
        insert into public.marketplace_parties(external_party_key,party_type,company_name,person_name,display_name,website_url,email,phone,alternative_phone,whatsapp,country_code,state_region,city,source_network,contact_status,is_claimable,confidence,provenance_url,provenance_type,last_verified_at,metadata)
        values(v_external_key,v_party_type,v_company,v_person,left(v_display_name,240),v_website,v_email,v_phone,nullif(btrim(v_contact->>'alternative_phone'),''),v_whatsapp,coalesce(nullif(upper(v_contact->>'country_code'),''),v_country),coalesce(nullif(v_contact->>'state_region',''),v_state),coalesce(nullif(v_contact->>'city',''),v_city),coalesce(nullif(v_contact->>'source_network',''),'real_estate_search'),case when v_evidence_url is not null and (v_email is not null or v_phone is not null or v_whatsapp is not null) then 'verified' else 'discovered' end,true,v_conf,v_evidence_url,coalesce(nullif(v_contact->>'evidence_type',''),'public_source'),case when v_evidence_url is not null then now() else null end,jsonb_build_object('seed_ref',p_seed_ref,'channel',p_channel))
        on conflict(external_party_key) do update set party_type=case when public.marketplace_parties.party_type='unknown' then excluded.party_type else public.marketplace_parties.party_type end,company_name=coalesce(excluded.company_name,public.marketplace_parties.company_name),person_name=coalesce(excluded.person_name,public.marketplace_parties.person_name),display_name=coalesce(excluded.display_name,public.marketplace_parties.display_name),website_url=coalesce(excluded.website_url,public.marketplace_parties.website_url),email=coalesce(excluded.email,public.marketplace_parties.email),phone=coalesce(excluded.phone,public.marketplace_parties.phone),whatsapp=coalesce(excluded.whatsapp,public.marketplace_parties.whatsapp),confidence=greatest(public.marketplace_parties.confidence,excluded.confidence),provenance_url=coalesce(excluded.provenance_url,public.marketplace_parties.provenance_url),last_verified_at=coalesce(excluded.last_verified_at,public.marketplace_parties.last_verified_at),updated_at=now() returning id into v_party_id;
        if v_primary_party_id is null then v_primary_party_id:=v_party_id; end if; if v_email is not null or v_phone is not null or v_whatsapp is not null then v_contact_coverage:=true; end if;
        insert into public.marketplace_source_parties(source_id,party_id,role,is_primary,confidence) values(v_source_id,v_party_id,v_role,v_primary_party_id=v_party_id,v_conf) on conflict(source_id,party_id,role) do update set confidence=greatest(public.marketplace_source_parties.confidence,excluded.confidence),updated_at=now();
        insert into public.marketplace_listing_parties(listing_id,party_id,role,is_primary,confidence,evidence_url) values(v_listing_id,v_party_id,v_role,v_primary_party_id=v_party_id,v_conf,v_evidence_url) on conflict(listing_id,party_id,role) do update set confidence=greatest(public.marketplace_listing_parties.confidence,excluded.confidence),evidence_url=coalesce(excluded.evidence_url,public.marketplace_listing_parties.evidence_url),updated_at=now();
        if v_evidence_url is not null then
          if v_email is not null and not exists(select 1 from public.marketplace_party_evidence e where e.party_id=v_party_id and e.listing_id=v_listing_id and e.field_name='email' and e.observed_value=v_email and e.evidence_url=v_evidence_url) then insert into public.marketplace_party_evidence(party_id,listing_id,source_id,field_name,observed_value,evidence_url,evidence_type,confidence,metadata) values(v_party_id,v_listing_id,v_source_id,'email',v_email,v_evidence_url,'public_source',v_conf,jsonb_build_object('seed_ref',p_seed_ref)); end if;
          if v_phone is not null and not exists(select 1 from public.marketplace_party_evidence e where e.party_id=v_party_id and e.listing_id=v_listing_id and e.field_name='phone' and e.observed_value=v_phone and e.evidence_url=v_evidence_url) then insert into public.marketplace_party_evidence(party_id,listing_id,source_id,field_name,observed_value,evidence_url,evidence_type,confidence,metadata) values(v_party_id,v_listing_id,v_source_id,'phone',v_phone,v_evidence_url,'public_source',v_conf,jsonb_build_object('seed_ref',p_seed_ref)); end if;
          if v_whatsapp is not null and not exists(select 1 from public.marketplace_party_evidence e where e.party_id=v_party_id and e.listing_id=v_listing_id and e.field_name='whatsapp' and e.observed_value=v_whatsapp and e.evidence_url=v_evidence_url) then insert into public.marketplace_party_evidence(party_id,listing_id,source_id,field_name,observed_value,evidence_url,evidence_type,confidence,metadata) values(v_party_id,v_listing_id,v_source_id,'whatsapp',v_whatsapp,v_evidence_url,'public_source',v_conf,jsonb_build_object('seed_ref',p_seed_ref)); end if;
        end if; v_contact_count:=v_contact_count+1;
      end loop;

      v_obs_key:=md5(v_listing_id::text||'|'||((now() at time zone 'America/Cancun')::date)::text||'|'||coalesce(v_price::text,'')||'|'||coalesce(v_currency,'')||'|'||coalesce(v_page_url,''));
      insert into private.marketplace_listing_observations(observation_key,listing_id,source_id,run_id,price,currency,operation_type,property_type,area_m2,bedrooms,bathrooms,city,state_region,country_code,source_url,contact_coverage,internal_listing_status,internal_listing_visibility,metadata)
      select v_obs_key,l.id,v_source_id,v_run,coalesce(v_price,l.price),coalesce(v_currency,l.currency),coalesce(v_operation,l.operation_type),coalesce(v_property_type,l.property_type),coalesce(v_area,l.area_m2),coalesce(v_bedrooms,l.bedrooms),coalesce(v_bathrooms,l.bathrooms),coalesce(v_city,l.city),coalesce(v_state,l.state_region),coalesce(v_country,l.country_code),v_page_url,v_contact_coverage,l.status,l.visibility,jsonb_build_object('seed_ref',p_seed_ref,'channel',p_channel) from public.marketplace_listings l where l.id=v_listing_id on conflict(observation_key) do update set observed_at=now(),contact_coverage=excluded.contact_coverage,metadata=excluded.metadata; v_observation_count:=v_observation_count+1;
      v_status:=case when v_publish then case when v_is_new then 'imported' else 'updated' end when v_operation is null or v_cover is null then 'needs_review' else case when v_is_new then 'imported' else 'updated' end end; if v_status='needs_review' then v_review:=v_review+1; end if;
      insert into private.marketplace_search_ingestion_items(run_id,fingerprint,source_url,page_url,listing_id,source_id,primary_party_id,status,raw_payload,normalized_payload) values(v_run,v_fingerprint,v_source_url,v_page_url,v_listing_id,v_source_id,v_primary_party_id,v_status,v_item,jsonb_build_object('rights_basis',v_rights_basis,'publish_authorized',v_publish,'operation_type',v_operation,'contact_coverage',v_contact_coverage)) on conflict(run_id,fingerprint) do update set listing_id=excluded.listing_id,source_id=excluded.source_id,primary_party_id=excluded.primary_party_id,status=excluded.status,normalized_payload=excluded.normalized_payload,updated_at=now();
    exception when others then
      v_fingerprint:=md5(coalesce(v_item::text,'{}')); insert into private.marketplace_search_ingestion_items(run_id,fingerprint,status,raw_payload,error_text) values(v_run,v_fingerprint,'error',v_item,left(sqlerrm,1000)) on conflict(run_id,fingerprint) do nothing; v_invalid:=v_invalid+1;
    end;
  end loop;
  perform public.refresh_marketplace_source_prospect_backup(); perform private.refresh_market_observed_daily_snapshot();
  update private.marketplace_search_ingestion_runs set status=case when v_invalid=0 then 'completed' when v_imported+v_updated+v_review>0 then 'partial' else 'failed' end,imported_count=v_imported,updated_count=v_updated,review_count=v_review,invalid_count=v_invalid,contact_count=v_contact_count,observation_count=v_observation_count,completed_at=now(),updated_at=now() where id=v_run;
  return jsonb_build_object('ok',true,'run_id',v_run,'payload',v_payload_count,'imported',v_imported,'updated',v_updated,'needs_review',v_review,'invalid',v_invalid,'contacts',v_contact_count,'observations',v_observation_count,'public_auto_publish_rule','authorized_feed_or_licensed_partner_plus_confirmed_rights_plus_real_image');
end;
$function$;
revoke all on function public.ingest_marketplace_search_batch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.ingest_marketplace_search_batch(text,text,jsonb) to service_role;

select cron.schedule('listia-market-observed-daily','20 6 * * *','select private.refresh_market_observed_daily_snapshot();')
where not exists(select 1 from cron.job where jobname='listia-market-observed-daily');
