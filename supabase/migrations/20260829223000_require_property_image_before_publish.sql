create or replace function private.enforce_property_image_before_publish()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $function$
begin
  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    if not exists (
      select 1
      from public.property_assets pa
      where pa.property_id = new.id
        and pa.organization_id = new.organization_id
        and pa.asset_type = 'image'
        and coalesce(pa.mime_type,'') like 'image/%'
        and nullif(btrim(coalesce(pa.storage_path,'')),'') is not null
    ) then
      raise exception using
        errcode = '23514',
        message = 'image_required',
        detail = 'A property cannot be published without at least one image.';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_require_property_image_before_publish on public.properties;
create trigger trg_require_property_image_before_publish
before insert or update of status on public.properties
for each row
execute function private.enforce_property_image_before_publish();
