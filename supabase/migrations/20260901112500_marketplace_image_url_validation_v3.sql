-- LISTIA Marketplace: reject known generic/branding assets that are not property media.
create or replace function private.marketplace_image_url_is_valid(p_url text)
returns boolean
language sql
immutable
set search_path to 'pg_catalog','pg_temp'
as $function$
  select nullif(btrim(coalesce(p_url,'')),'') is not null
    and length(p_url)<=2048
    and p_url ~* '^https://'
    and p_url !~* '^https://[^/]*@'
    and p_url !~* '^https://(localhost|localhost[.:]|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|\[?::1\]?([/:]|$)|[^/]+\.local([/:]|$))'
    and p_url !~* '(background[-_]?card|empty[-_]?card|fallback[-_]?image|placeholder|default[-_]?image|no[-_]?image|no[-_]?photo|sin[-_]?imagen|sin[-_]?foto|image[-_]?not[-_]?available|missing[-_]?image|favicon|avatar|gravatar|sprite|tracking[-_]?pixel)'
    and p_url !~* '(imexicoblanco|boton-e-mail|defaultproperty|translatepress.*/flags/|bandera-de-mexico|request-more-info|pointer-location)'
    and p_url !~* '/Mo,Tu,We,Th,Fr'
    and p_url !~* '\.(gif|svg|webm|mov|mp4)([/?#]|$)'
    and p_url !~* '/(CollectionPage|WebPage|Organization)([/?#]|$)'
    and p_url !~* '/errors?/404\.'
    and p_url !~* '/ListingCentral/include/svg/Single\.jpg([?#]|$)'
    and p_url !~* 'contact_form_success'
    and p_url !~* '/polylang/(en_US|es_MX|es_ES)\.png([?#]|$)'
    and p_url !~* 'pennyworth[^/]*\.png([?#]|$)'
    and p_url !~* '/usflag\.jpg([?#]|$)'
    and p_url !~* '/Recurso-3EN\.png([?#]|$)'
    and p_url !~* '/Color\.png([?#]|$)'
    and p_url !~* '/Disen(%CC%83|%C3%B1|n)?o-sin-ti(%CC%81|%C3%AD|i)?tulo\.png([?#]|$)'
    and (
      lower(split_part(p_url,'?',1)) ~ '\.(jpg|jpeg|png|webp|avif)(/.*)?$'
      or p_url ~* '^https://images\.unsplash\.com/photo-'
      or p_url ~* '/_next/image\?[^#]*url=[^&#]*(\.(jpg|jpeg|png|webp|avif)|%2e(jpg|jpeg|png|webp|avif))'
    );
$function$;
