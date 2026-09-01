-- LISTIA Marketplace only.
-- Normalize Tokko authorized-feed galleries from arrays of photo objects to the
-- canonical Marketplace contract: JSON arrays of HTTPS URL strings.

create or replace function private.normalize_tokko_gallery()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public','private'
as $$
begin
  if new.features->>'source'='tokko_broker'
     and jsonb_typeof(coalesce(new.gallery,'[]'::jsonb))='array'
     and jsonb_array_length(coalesce(new.gallery,'[]'::jsonb))>0
     and jsonb_typeof(new.gallery->0)='object' then
    select coalesce(jsonb_agg(url order by ord),'[]'::jsonb)
      into new.gallery
    from (
      select distinct on (url) url, ord
      from (
        select coalesce(nullif(elem->>'original',''),nullif(elem->>'image','')) as url, ord
        from jsonb_array_elements(new.gallery) with ordinality as g(elem,ord)
      ) s
      where url ~* '^https://'
      order by url,ord
    ) d;
    if jsonb_array_length(coalesce(new.gallery,'[]'::jsonb))>0 then
      new.cover_image_url := coalesce(new.gallery->>0,new.cover_image_url);
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.normalize_tokko_gallery() from public,anon,authenticated;

drop trigger if exists trg_marketplace_normalize_tokko_gallery on public.marketplace_listings;
create trigger trg_marketplace_normalize_tokko_gallery
before insert or update of gallery,features on public.marketplace_listings
for each row execute function private.normalize_tokko_gallery();

-- Repair existing Tokko rows once.
update public.marketplace_listings ml
set gallery = x.urls,
    cover_image_url = coalesce(x.urls->>0,ml.cover_image_url),
    updated_at = now()
from (
  select id,
         coalesce(jsonb_agg(url order by ord),'[]'::jsonb) as urls
  from (
    select ml.id,
           coalesce(nullif(g.elem->>'original',''),nullif(g.elem->>'image','')) as url,
           g.ord
    from public.marketplace_listings ml
    cross join lateral jsonb_array_elements(coalesce(ml.gallery,'[]'::jsonb)) with ordinality as g(elem,ord)
    where ml.features->>'source'='tokko_broker'
      and jsonb_typeof(coalesce(ml.gallery,'[]'::jsonb))='array'
      and jsonb_array_length(coalesce(ml.gallery,'[]'::jsonb))>0
      and jsonb_typeof(ml.gallery->0)='object'
  ) q
  where url ~* '^https://'
  group by id
) x
where ml.id=x.id;
