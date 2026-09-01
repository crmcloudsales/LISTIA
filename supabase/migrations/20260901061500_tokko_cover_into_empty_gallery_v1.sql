-- LISTIA Marketplace only.
-- Tokko may provide a valid cover while photos is empty. Keep the canonical gallery
-- contract coherent by mirroring that same verified cover as the single gallery item.

create or replace function private.normalize_tokko_gallery()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public','private'
as $$
begin
  if new.features->>'source'='tokko_broker' then
    if jsonb_typeof(coalesce(new.gallery,'[]'::jsonb))='array'
       and jsonb_array_length(coalesce(new.gallery,'[]'::jsonb))>0
       and jsonb_typeof(new.gallery->0)='object' then
      select coalesce(jsonb_agg(url order by ord),'[]'::jsonb)
        into new.gallery
      from (
        select distinct on (url) url,ord
        from (
          select coalesce(nullif(elem->>'original',''),nullif(elem->>'image','')) url,ord
          from jsonb_array_elements(new.gallery) with ordinality as g(elem,ord)
        ) s
        where url ~* '^https://'
        order by url,ord
      ) d;
    end if;
    if jsonb_array_length(coalesce(new.gallery,'[]'::jsonb))=0
       and coalesce(new.cover_image_url,'') ~* '^https://' then
      new.gallery:=jsonb_build_array(new.cover_image_url);
    end if;
    if jsonb_array_length(coalesce(new.gallery,'[]'::jsonb))>0 then
      new.cover_image_url:=coalesce(new.gallery->>0,new.cover_image_url);
    end if;
  end if;
  return new;
end;
$$;

update public.marketplace_listings
set gallery=jsonb_build_array(cover_image_url),updated_at=now()
where features->>'source'='tokko_broker'
  and status='published' and visibility='public'
  and jsonb_array_length(coalesce(gallery,'[]'::jsonb))=0
  and coalesce(cover_image_url,'') ~* '^https://';
