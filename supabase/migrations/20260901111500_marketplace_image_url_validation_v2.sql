-- LISTIA Marketplace: tighten image URL validation without breaking common image CDNs.
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
    and (
      lower(split_part(p_url,'?',1)) ~ '\.(jpg|jpeg|png|webp|avif)(/.*)?$'
      or p_url ~* '^https://images\.unsplash\.com/photo-'
      or p_url ~* '/_next/image\?[^#]*url=[^&#]*(\.(jpg|jpeg|png|webp|avif)|%2e(jpg|jpeg|png|webp|avif))'
    );
$function$;

comment on function private.marketplace_image_url_is_valid(text) is
'Validates HTTPS marketplace property-image URLs; rejects pages, video, SVG/GIF/error assets, placeholders and private-network targets while allowing direct image files, Unsplash photo URLs and Next.js image optimizer URLs.';
