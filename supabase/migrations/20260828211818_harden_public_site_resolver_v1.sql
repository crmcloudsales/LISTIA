create or replace function public.resolve_listia_public_site(p_host text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_host text := lower(split_part(coalesce(p_host,''), ':', 1));
  v_label text;
  v_site public.organization_websites%rowtype;
  v_org public.organizations%rowtype;
  v_listings jsonb;
  v_normalized jsonb;
  v_public_configuration jsonb;
begin
  if v_host = '' or length(v_host) > 253 then return null; end if;
  if v_host !~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.listiaapp\.com$' then return null; end if;

  v_label := split_part(v_host,'.',1);
  if v_label = any(array['app','www','api','admin','mail','smtp','ftp','marketplace','web','brain','ai']) then return null; end if;

  select w.* into v_site
  from public.organization_websites w
  where w.mode='listia_subdomain'
    and w.status='active'
    and lower(coalesce(w.subdomain,''))=v_label
  limit 1;

  if not found then return null; end if;

  select * into v_org
  from public.organizations
  where id=v_site.organization_id;
  if not found then return null; end if;

  v_normalized := private.normalize_listia_site_locales(v_site.configuration);
  v_public_configuration := jsonb_build_object(
    'default_locale', coalesce(v_normalized->>'default_locale','es'),
    'enabled_locales', coalesce(v_normalized->'enabled_locales','["es"]'::jsonb)
  );

  select coalesce(jsonb_agg(jsonb_build_object(
      'id',m.id,'slug',m.slug,'title',m.title,'description',m.description,
      'operation_type',m.operation_type,'property_type',m.property_type,
      'price',m.price,'currency',m.currency,'location_text',m.location_text,
      'city',m.city,'state_region',m.state_region,'country_code',m.country_code,
      'bedrooms',m.bedrooms,'bathrooms',m.bathrooms,'parking_spaces',m.parking_spaces,
      'area_m2',m.area_m2,'cover_image_url',m.cover_image_url,'gallery',m.gallery,
      'features',m.features,'locale',m.locale,'published_at',m.published_at
    ) order by m.published_at desc),'[]'::jsonb)
  into v_listings
  from public.marketplace_listings m
  where m.organization_id=v_org.id
    and m.status='published'
    and m.visibility='public'
    and m.rights_confirmed_at is not null;

  return jsonb_build_object(
    'organization',jsonb_build_object(
      'id',v_org.id,'name',v_org.name,'slug',v_org.slug,
      'business_type',v_org.business_type,'primary_market',v_org.primary_market,
      'country_code',v_org.country_code
    ),
    'website',jsonb_build_object(
      'mode','listia_subdomain','domain',null,'subdomain',v_site.subdomain,
      'status','active','configuration',v_public_configuration
    ),
    'listings',v_listings
  );
end;
$function$;

revoke all on function public.resolve_listia_public_site(text) from public, authenticated;
grant execute on function public.resolve_listia_public_site(text) to anon, service_role;

revoke all on function private.ensure_default_organization_billing() from public, anon, authenticated;
revoke all on function private.normalize_organization_billing_markup() from public, anon, authenticated;
