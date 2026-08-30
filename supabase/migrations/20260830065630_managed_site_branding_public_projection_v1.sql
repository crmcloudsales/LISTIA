do $$
begin
  if to_regprocedure('public.resolve_listia_public_site(text)') is not null
     and to_regprocedure('private.resolve_listia_public_site_core(text)') is null then
    alter function public.resolve_listia_public_site(text) set schema private;
    alter function private.resolve_listia_public_site(text) rename to resolve_listia_public_site_core;
  end if;
end
$$;

revoke all on function private.resolve_listia_public_site_core(text) from public, anon, authenticated;

create or replace function public.resolve_listia_public_site(p_host text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_host text := lower(split_part(coalesce(p_host,''), ':', 1));
  v_label text;
  v_base jsonb;
  v_cfg jsonb := '{}'::jsonb;
  v_brand jsonb := '{}'::jsonb;
  v_primary text := '#7c3cff';
  v_secondary text := '#a982ff';
  v_font text := 'Inter';
  v_logo text := '';
  v_name text := '';
begin
  if v_host = '' or length(v_host) > 253 then return null; end if;
  if v_host !~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.listiaapp\.com$' then return null; end if;
  v_label := split_part(v_host,'.',1);
  if v_label = any(array['app','www','api','admin','mail','smtp','ftp','marketplace','web','brain','ai']) then return null; end if;

  v_base := private.resolve_listia_public_site_core(v_host);
  if v_base is null then return null; end if;

  select coalesce(w.configuration,'{}'::jsonb)
    into v_cfg
  from public.organization_websites w
  where w.mode='listia_subdomain' and w.status='active' and lower(w.subdomain)=v_label
  limit 1;

  v_brand := coalesce(v_cfg->'branding','{}'::jsonb);
  v_primary := coalesce(nullif(v_brand->>'primary_color',''),'#7c3cff');
  v_secondary := coalesce(nullif(v_brand->>'secondary_color',''),'#a982ff');
  v_font := coalesce(nullif(v_brand->>'font_family',''),'Inter');
  v_logo := coalesce(nullif(v_brand->>'logo_url',''),'');
  v_name := coalesce(nullif(v_brand->>'business_name',''),v_base#>>'{organization,name}','');
  if v_primary !~* '^#[0-9a-f]{6}$' then v_primary := '#7c3cff'; end if;
  if v_secondary !~* '^#[0-9a-f]{6}$' then v_secondary := '#a982ff'; end if;
  if v_font !~ '^[A-Za-z0-9 _-]{1,50}$' then v_font := 'Inter'; end if;
  if v_logo <> '' and (v_logo !~* '^https://' or length(v_logo)>1200) then v_logo := ''; end if;

  return jsonb_set(
    v_base,
    '{website,configuration}',
    coalesce(v_base#>'{website,configuration}','{}'::jsonb)
      || jsonb_build_object(
        'branding', jsonb_build_object(
          'business_name',left(v_name,120),
          'primary_color',v_primary,
          'secondary_color',v_secondary,
          'font_family',v_font,
          'logo_url',v_logo
        ),
        'security_profile','pennyworth_v1',
        'lead_quality_gate',true
      ),
    true
  );
end
$$;

revoke all on function public.resolve_listia_public_site(text) from public, authenticated;
grant execute on function public.resolve_listia_public_site(text) to anon, service_role;
