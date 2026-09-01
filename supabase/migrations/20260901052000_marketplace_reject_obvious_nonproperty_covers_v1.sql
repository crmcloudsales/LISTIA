-- LISTIA Marketplace only.
-- Repair obvious non-property covers from each listing's own gallery, then prevent
-- the same known classes (logos, CTA buttons, default images, language flags and map pins)
-- from being considered valid public Marketplace imagery.

with bad as (
  select ml.id,
    (select g.url
     from jsonb_array_elements_text(coalesce(ml.gallery,'[]'::jsonb)) with ordinality g(url,ord)
     where private.marketplace_image_url_is_valid(g.url)
       and g.url !~* '(imexicoblanco|boton-e-mail|defaultproperty|translatepress.*/flags/|bandera-de-mexico|request-more-info|pointer-location)'
       and g.url !~* '/Mo,Tu,We,Th,Fr'
     order by g.ord
     limit 1) as replacement
  from public.marketplace_listings ml
  where ml.visibility='public' and ml.status='published'
    and (
      ml.cover_image_url ~* '(imexicoblanco|boton-e-mail|defaultproperty|translatepress.*/flags/|bandera-de-mexico|request-more-info|pointer-location)'
      or ml.cover_image_url ~* '/Mo,Tu,We,Th,Fr'
    )
)
update public.marketplace_listings ml
set cover_image_url=bad.replacement,updated_at=now()
from bad
where ml.id=bad.id and bad.replacement is not null;

create or replace function private.marketplace_image_url_is_valid(p_url text)
returns boolean
language sql immutable
set search_path to 'pg_catalog','pg_temp'
as $function$
  select
    nullif(btrim(coalesce(p_url,'')),'') is not null
    and length(p_url) <= 2048
    and p_url ~* '^https://'
    and p_url !~* '^https://[^/]*@'
    and p_url !~* '^https://(localhost|localhost[.:]|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|\[?::1\]?([/:]|$)|[^/]+\.local([/:]|$))'
    and p_url !~* '(background[-_]?card|empty[-_]?card|fallback[-_]?image|placeholder|default[-_]?image|no[-_]?image|no[-_]?photo|sin[-_]?imagen|sin[-_]?foto|image[-_]?not[-_]?available|missing[-_]?image|favicon|avatar|gravatar|sprite|tracking[-_]?pixel)'
    and p_url !~* '(imexicoblanco|boton-e-mail|defaultproperty|translatepress.*/flags/|bandera-de-mexico|request-more-info|pointer-location)'
    and p_url !~* '/Mo,Tu,We,Th,Fr';
$function$;
