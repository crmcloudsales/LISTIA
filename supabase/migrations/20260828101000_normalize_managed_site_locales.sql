create or replace function private.normalize_listia_site_locales(p_configuration jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_allowed constant text[] := array['es','en','fr','it','pt-BR','de','ar-AE','ru','he','zh-CN','ja'];
  v_default text;
  v_enabled text[] := array[]::text[];
  v_item text;
begin
  v_default := coalesce(nullif(trim(p_configuration->>'default_locale'),''),'es');
  if not (v_default = any(v_allowed)) then v_default := 'es'; end if;
  if jsonb_typeof(p_configuration->'enabled_locales')='array' then
    for v_item in select jsonb_array_elements_text(p_configuration->'enabled_locales') loop
      if v_item = any(v_allowed) and not (v_item = any(v_enabled)) then v_enabled := array_append(v_enabled,v_item); end if;
    end loop;
  end if;
  if cardinality(v_enabled)=0 then v_enabled := array[v_default]; end if;
  if not (v_default = any(v_enabled)) then v_enabled := array_prepend(v_default,v_enabled); end if;
  return coalesce(p_configuration,'{}'::jsonb)||jsonb_build_object('default_locale',v_default,'enabled_locales',to_jsonb(v_enabled));
end;
$$;
revoke all on function private.normalize_listia_site_locales(jsonb) from public, anon, authenticated;
grant execute on function private.normalize_listia_site_locales(jsonb) to service_role;

update public.organization_websites
set configuration=private.normalize_listia_site_locales(configuration),updated_at=now()
where configuration is distinct from private.normalize_listia_site_locales(configuration);

create or replace function public.resolve_listia_public_site(p_host text)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
declare
  v_host text:=lower(split_part(coalesce(p_host,''),':',1));
  v_label text;
  v_site public.organization_websites%rowtype;
  v_org public.organizations%rowtype;
  v_listings jsonb;
  v_configuration jsonb;
begin
  if v_host='' then return null; end if;
  if v_host like '%.listiaapp.com' then v_label:=split_part(v_host,'.',1); end if;
  select w.* into v_site from public.organization_websites w
  where ((w.mode='listia_subdomain' and v_label is not null and lower(coalesce(w.subdomain,''))=v_label)
      or (w.mode in ('connect_existing','buy_website') and lower(coalesce(w.domain,''))=v_host))
    and w.status not in ('cancelled','blocked') limit 1;
  if not found then return null; end if;
  select * into v_org from public.organizations where id=v_site.organization_id;
  if not found then return null; end if;
  v_configuration:=private.normalize_listia_site_locales(v_site.configuration);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',m.id,'slug',m.slug,'title',m.title,'description',m.description,
    'operation_type',m.operation_type,'property_type',m.property_type,
    'price',m.price,'currency',m.currency,'location_text',m.location_text,
    'city',m.city,'state_region',m.state_region,'country_code',m.country_code,
    'bedrooms',m.bedrooms,'bathrooms',m.bathrooms,'parking_spaces',m.parking_spaces,
    'area_m2',m.area_m2,'cover_image_url',m.cover_image_url,'gallery',m.gallery,
    'features',m.features,'locale',m.locale,'published_at',m.published_at
  ) order by m.published_at desc),'[]'::jsonb) into v_listings
  from public.marketplace_listings m
  where m.organization_id=v_org.id and m.status='published' and m.visibility='public' and m.rights_confirmed_at is not null;
  return jsonb_build_object(
    'organization',jsonb_build_object('id',v_org.id,'name',v_org.name,'slug',v_org.slug,'business_type',v_org.business_type,'primary_market',v_org.primary_market,'country_code',v_org.country_code),
    'website',jsonb_build_object('mode',v_site.mode,'domain',v_site.domain,'subdomain',v_site.subdomain,'status',v_site.status,'configuration',v_configuration),
    'listings',v_listings
  );
end;
$$;
revoke execute on function public.resolve_listia_public_site(text) from public, anon, authenticated;
grant execute on function public.resolve_listia_public_site(text) to service_role;
