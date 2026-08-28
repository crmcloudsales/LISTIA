create or replace function public.submit_marketplace_interest(
  p_listing_id uuid,
  p_name text,
  p_email text default null,
  p_whatsapp text default null,
  p_message text default null,
  p_locale text default 'es',
  p_website text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_listing public.marketplace_listings%rowtype;
  v_inquiry_id uuid;
  v_email text := nullif(lower(btrim(coalesce(p_email,''))), '');
  v_whatsapp text := nullif(regexp_replace(coalesce(p_whatsapp,''), '[^0-9+]', '', 'g'), '');
  v_name text := btrim(coalesce(p_name,''));
  v_message text := nullif(btrim(coalesce(p_message,'')), '');
begin
  if nullif(btrim(coalesce(p_website,'')),'') is not null then raise exception 'invalid_request'; end if;
  if length(v_name) < 2 or length(v_name) > 120 then raise exception 'invalid_name'; end if;
  if v_email is null and v_whatsapp is null then raise exception 'contact_required'; end if;
  if v_email is not null and (length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'invalid_email'; end if;
  if v_whatsapp is not null and (length(regexp_replace(v_whatsapp,'[^0-9]','','g')) < 7 or length(v_whatsapp) > 40) then raise exception 'invalid_whatsapp'; end if;
  if length(coalesce(v_message,'')) > 2000 then raise exception 'invalid_request'; end if;
  select * into v_listing from public.marketplace_listings where id=p_listing_id and visibility='public' and status='published' and rights_confirmed_at is not null;
  if not found then raise exception 'listing_not_available'; end if;
  select i.id into v_inquiry_id from public.marketplace_inquiries i
  where i.listing_id=v_listing.id and i.created_at >= now() - interval '15 minutes'
    and ((v_email is not null and lower(coalesce(i.email,''))=v_email)
      or (v_whatsapp is not null and regexp_replace(coalesce(i.whatsapp,''),'[^0-9+]','','g')=v_whatsapp))
  order by i.created_at desc limit 1;
  if v_inquiry_id is not null then return v_inquiry_id; end if;
  insert into public.marketplace_inquiries(listing_id,organization_id,name,email,whatsapp,message,locale)
  values(v_listing.id,v_listing.organization_id,v_name,v_email,v_whatsapp,v_message,left(coalesce(p_locale,'es'),20)) returning id into v_inquiry_id;
  if v_listing.organization_id is not null then
    insert into public.leads(organization_id,property_id,name,whatsapp,email,message,status,source)
    values(v_listing.organization_id,v_listing.property_id,v_name,v_whatsapp,v_email,v_message,'new','listia_marketplace');
  end if;
  return v_inquiry_id;
end;
$$;
