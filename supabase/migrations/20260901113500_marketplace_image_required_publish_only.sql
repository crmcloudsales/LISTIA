-- LISTIA Marketplace: require valid media only for public published listings so bad rows can be safely archived/unlisted.
create or replace function private.enforce_marketplace_listing_image_required()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  cleaned_gallery jsonb := '[]'::jsonb;
  fallback_cover text;
begin
  select coalesce(jsonb_agg(v), '[]'::jsonb), min(v)
    into cleaned_gallery, fallback_cover
  from jsonb_array_elements_text(coalesce(new.gallery,'[]'::jsonb)) as g(v)
  where private.marketplace_image_url_is_valid(v);

  new.gallery := cleaned_gallery;

  if not private.marketplace_image_url_is_valid(new.cover_image_url) then
    new.cover_image_url := fallback_cover;
  end if;

  if new.status='published' and new.visibility='public'
     and not private.marketplace_image_url_is_valid(new.cover_image_url)
     and coalesce(jsonb_array_length(new.gallery),0)=0 then
    raise exception using
      errcode='23514',
      message='valid_image_required',
      detail='LISTIA public marketplace listings require at least one valid property image; generic placeholders do not qualify.';
  end if;

  return new;
end;
$function$;
