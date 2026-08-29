create or replace function public.notify_assigned_marketplace_lead()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_route text;
  v_intent text;
  v_body text;
begin
  if new.assigned_user_id is null or coalesce(new.source,'') <> 'listia_marketplace' then return new; end if;
  v_route := coalesce(new.source_detail->>'route_type','listing_owner');
  v_intent := coalesce(new.source_detail->'discovery'->>'intent','buy');
  v_body := case
    when v_route='geo_fallback' and v_intent='rent' then 'Alguien está interesado en rentar cerca de tu zona. ¡Contáctalo!'
    when v_route='geo_fallback' then 'Alguien está interesado en comprar cerca de tu zona. ¡Contáctalo!'
    else 'Tienes un nuevo lead interesado en una propiedad de Listia. ¡Contáctalo!'
  end;
  insert into public.lead_notifications(user_id,lead_id,organization_id,title,body,route_type)
  values(new.assigned_user_id,new.id,new.organization_id,'Nuevo lead en Listia',v_body,v_route)
  on conflict(user_id,lead_id) do nothing;
  return new;
end;
$$;
