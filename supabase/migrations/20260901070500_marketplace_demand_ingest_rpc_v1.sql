-- LISTIA Marketplace only: hardened event ingestion behind Edge proof.
create or replace function public.ingest_marketplace_demand_event_internal(
  p_event_name text,
  p_listing_id uuid,
  p_session_hash text,
  p_client_hash text,
  p_query_text text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_is_test boolean default false
) returns uuid
language plpgsql security definer
set search_path='pg_catalog','public','private'
as $$
declare
  v_id uuid;
  v_source_id uuid;
  v_city text;
  v_recent integer;
  v_event text:=lower(btrim(coalesce(p_event_name,'')));
begin
  if v_event not in ('listing_view','search','voice_search','map_view','property_open','save','share','contact_click','whatsapp_click','inquiry') then
    raise exception 'invalid_event';
  end if;
  if char_length(coalesce(p_session_hash,'')) not between 16 and 128 or char_length(coalesce(p_client_hash,'')) not between 16 and 128 then
    raise exception 'invalid_identity_hash';
  end if;
  if octet_length(coalesce(p_query_text,''))>400 or pg_column_size(coalesce(p_metadata,'{}'::jsonb))>4096 then
    raise exception 'payload_too_large';
  end if;
  if p_listing_id is not null then
    select l.source_id,l.city into v_source_id,v_city
    from public.marketplace_listings l
    where l.id=p_listing_id and l.status='published' and l.visibility='public';
    if not found then raise exception 'listing_not_found'; end if;
  end if;
  select count(*) into v_recent
  from private.marketplace_demand_events e
  where e.client_hash=p_client_hash and e.created_at>=now()-interval '1 minute';
  if v_recent>=90 then raise exception 'rate_limited'; end if;
  insert into private.marketplace_demand_events(event_name,listing_id,source_id,city,session_hash,client_hash,query_text,metadata,is_test)
  values(v_event,p_listing_id,v_source_id,v_city,p_session_hash,p_client_hash,nullif(left(btrim(coalesce(p_query_text,'')),400),''),coalesce(p_metadata,'{}'::jsonb),coalesce(p_is_test,false))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.ingest_marketplace_demand_event_internal(text,uuid,text,text,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.ingest_marketplace_demand_event_internal(text,uuid,text,text,text,jsonb,boolean) to service_role;
