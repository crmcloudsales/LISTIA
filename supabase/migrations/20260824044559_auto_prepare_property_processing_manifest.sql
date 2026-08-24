create or replace function public.prepare_property_processing_manifest()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_property_id uuid;
  v_org_id uuid;
  v_property public.properties%rowtype;
  v_asset_count integer := 0;
  v_assets jsonb := '[]'::jsonb;
  v_plan text := 'free';
  v_markup numeric := 30;
  v_missing text[] := '{}'::text[];
  v_has_material boolean := false;
  v_manifest jsonb;
begin
  if TG_TABLE_NAME = 'properties' then
    v_property_id := new.id;
    v_org_id := new.organization_id;
  else
    v_property_id := coalesce(new.property_id, old.property_id);
    v_org_id := coalesce(new.organization_id, old.organization_id);
  end if;

  select * into v_property from public.properties where id=v_property_id and organization_id=v_org_id;
  if not found then return coalesce(new, old); end if;

  select count(*)::int,
         coalesce(jsonb_agg(jsonb_build_object(
           'id',a.id,
           'asset_type',a.asset_type,
           'original_name',a.original_name,
           'mime_type',a.mime_type,
           'size_bytes',a.size_bytes,
           'storage_bucket',a.storage_bucket,
           'storage_path',a.storage_path,
           'metadata',a.metadata
         ) order by a.created_at), '[]'::jsonb)
    into v_asset_count, v_assets
  from public.property_assets a
  where a.property_id=v_property_id and a.organization_id=v_org_id;

  select coalesce(plan_key,'free'), coalesce(usage_markup_percent,30)
    into v_plan, v_markup
  from public.organization_billing
  where organization_id=v_org_id;

  if v_property.operation_type is null then v_missing := array_append(v_missing,'operation_type'); end if;
  if v_property.property_type is null then v_missing := array_append(v_missing,'property_type'); end if;
  if v_property.location_text is null then v_missing := array_append(v_missing,'location_text'); end if;
  if v_property.description is null then v_missing := array_append(v_missing,'description'); end if;
  if v_property.price is null then v_missing := array_append(v_missing,'price'); end if;
  if v_property.currency is null then v_missing := array_append(v_missing,'currency'); end if;

  v_has_material := v_asset_count > 0
    or v_property.description is not null
    or v_property.location_text is not null
    or v_property.price is not null;

  v_manifest := jsonb_build_object(
    'schema_version',1,
    'property_id',v_property_id,
    'organization_id',v_org_id,
    'effective_plan',v_plan,
    'usage_markup_percent',v_markup,
    'source',v_property.source,
    'locale',v_property.locale,
    'submitted_fields',jsonb_strip_nulls(jsonb_build_object(
      'title',v_property.title,
      'operation_type',v_property.operation_type,
      'property_type',v_property.property_type,
      'description',v_property.description,
      'price',v_property.price,
      'currency',v_property.currency,
      'commission_text',v_property.commission_text,
      'location_text',v_property.location_text,
      'postal_code',v_property.postal_code
    )),
    'assets',v_assets,
    'prepared_at',now()
  );

  insert into public.property_processing_state(
    property_id,organization_id,stage,asset_count,input_manifest,detected_fields,missing_fields,
    last_material_at,processing_started_at,error_message,updated_at
  ) values (
    v_property_id,v_org_id,
    case when v_has_material then 'ready_for_ai' else 'needs_input' end,
    v_asset_count,v_manifest,
    jsonb_strip_nulls(jsonb_build_object(
      'title',v_property.title,
      'operation_type',v_property.operation_type,
      'property_type',v_property.property_type,
      'description',v_property.description,
      'price',v_property.price,
      'currency',v_property.currency,
      'commission_text',v_property.commission_text,
      'location_text',v_property.location_text,
      'postal_code',v_property.postal_code
    )),
    v_missing,now(),case when v_has_material then now() else null end,null,now()
  )
  on conflict (property_id) do update set
    stage=excluded.stage,
    asset_count=excluded.asset_count,
    input_manifest=excluded.input_manifest,
    detected_fields=excluded.detected_fields,
    missing_fields=excluded.missing_fields,
    last_material_at=excluded.last_material_at,
    processing_started_at=case when excluded.stage='ready_for_ai' then coalesce(public.property_processing_state.processing_started_at,now()) else public.property_processing_state.processing_started_at end,
    error_message=null,
    updated_at=now();

  update public.properties
  set status=case when v_has_material and status in ('material_received','error') then 'processing' else status end,
      processing_state=coalesce(processing_state,'{}'::jsonb) || jsonb_build_object(
        'stage',case when v_has_material then 'ready_for_ai' else 'needs_input' end,
        'asset_count',v_asset_count,
        'missing_fields',v_missing,
        'prepared_at',now(),
        'next_action',case when v_has_material then 'ai_extraction_pending' else 'request_more_material' end
      ),
      updated_at=now()
  where id=v_property_id;

  return coalesce(new, old);
end;
$$;

revoke execute on function public.prepare_property_processing_manifest() from public, anon, authenticated;
grant execute on function public.prepare_property_processing_manifest() to service_role;

drop trigger if exists z_properties_prepare_processing_after_insert on public.properties;
create trigger z_properties_prepare_processing_after_insert
after insert on public.properties
for each row execute function public.prepare_property_processing_manifest();

drop trigger if exists z_property_assets_prepare_processing_after_insert on public.property_assets;
create trigger z_property_assets_prepare_processing_after_insert
after insert on public.property_assets
for each row execute function public.prepare_property_processing_manifest();

drop trigger if exists z_property_assets_prepare_processing_after_delete on public.property_assets;
create trigger z_property_assets_prepare_processing_after_delete
after delete on public.property_assets
for each row execute function public.prepare_property_processing_manifest();
