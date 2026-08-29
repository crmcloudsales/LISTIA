-- Improve public presentation for already-published Marketplace inventory.
-- 1) Link legacy listings without an individual URL to their known source URL so
--    the media enricher can resolve the individual property page when possible.
-- 2) Fill high-confidence approximate location metadata already stated in listing text.

update public.marketplace_listings ml
set external_url = ms.source_url,
    updated_at = now()
from public.marketplace_sources ms
where ms.id = ml.source_id
  and ml.visibility = 'public'
  and ml.status = 'published'
  and (ml.cover_image_url is null or btrim(ml.cover_image_url) = '')
  and ml.external_url is null
  and nullif(btrim(ms.source_url),'') is not null;

update public.marketplace_listings
set city = 'Mérida',
    state_region = coalesce(nullif(state_region,''),'Yucatán'),
    country_code = coalesce(nullif(country_code,''),'MX'),
    location_text = coalesce(nullif(location_text,''),'Mérida, Yucatán, México'),
    updated_at = now()
where visibility = 'public'
  and status = 'published'
  and city is null
  and (title || ' ' || coalesce(description,'')) ~* 'm[eé]rida';

update public.marketplace_listings
set state_region = 'Yucatán',
    country_code = coalesce(nullif(country_code,''),'MX'),
    location_text = coalesce(nullif(location_text,''),'Yucatán, México'),
    updated_at = now()
where visibility = 'public'
  and status = 'published'
  and coalesce(state_region,'') = ''
  and (title || ' ' || coalesce(description,'')) ~* 'yucat[aá]n';
