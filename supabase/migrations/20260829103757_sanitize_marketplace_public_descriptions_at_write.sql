-- Public Marketplace descriptions are public content, not a provenance field.
-- Strip source-mechanism phrases on write and clean existing rows while preserving
-- legitimate development/property names.

begin;

create or replace function private.sanitize_marketplace_public_description(p_description text)
returns text
language sql
immutable
set search_path = pg_catalog, pg_temp
as $function$
  select nullif(btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    regexp_replace(
                      regexp_replace(
                        regexp_replace(
                          regexp_replace(
                            coalesce(p_description,''),
                            'https?://[^[:space:]<>"'']+', '', 'gi'
                          ),
                          'www\.[^[:space:]<>"'']+', '', 'gi'
                        ),
                        'Inventario público (?:enlazado )?de [^.]+\.[[:space:]]*', '', 'gi'
                      ),
                      'Oferta pública de [^;]+;[[:space:]]*', '', 'gi'
                    ),
                    'Clasificado por la fuente dentro del mercado [^;]+;[[:space:]]*', '', 'gi'
                  ),
                  'La fuente pública indica', 'La información disponible indica', 'gi'
                ),
                'La propia página pública muestra', 'La información disponible muestra', 'gi'
              ),
              'La página actual también muestra', 'La información disponible también muestra', 'gi'
            ),
            'por el cotizador público de [^.]+', 'según la disponibilidad consultada', 'gi'
          ),
          'Ficha visible en el inventario actual de [^.]+\.[[:space:]]*', '', 'gi'
        ),
        'El título público indica', 'La información disponible indica', 'gi'
      ),
      'Tarifa pública indicada', 'Tarifa indicada', 'gi'
    )
  ), '');
$function$;

revoke execute on function private.sanitize_marketplace_public_description(text) from public, anon, authenticated;
grant execute on function private.sanitize_marketplace_public_description(text) to service_role;

create or replace function private.sanitize_marketplace_listing_public_text()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $function$
begin
  new.description := private.sanitize_marketplace_public_description(new.description);
  return new;
end;
$function$;

revoke execute on function private.sanitize_marketplace_listing_public_text() from public, anon, authenticated;

drop trigger if exists trg_marketplace_listing_public_text_sanitize on public.marketplace_listings;
create trigger trg_marketplace_listing_public_text_sanitize
before insert or update of description on public.marketplace_listings
for each row execute function private.sanitize_marketplace_listing_public_text();

update public.marketplace_listings
set description = private.sanitize_marketplace_public_description(description),
    updated_at = now()
where description is distinct from private.sanitize_marketplace_public_description(description);

commit;
