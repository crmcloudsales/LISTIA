-- Quarantine the 40 rows from the first private Q.Roo smoke batch that inherited
-- another property's photo. The shared filename contains property id 31434428,
-- so only qroo-31434428 is allowed to retain it.

begin;

update public.marketplace_listings
set status='archived',
    visibility='unlisted',
    updated_at=now(),
    features=coalesce(features,'{}'::jsonb) || jsonb_build_object(
      'internal_quarantine_reason','ambiguous_reused_cover_image',
      'internal_quarantined_at',now()
    )
where source_id=(
    select id from public.marketplace_sources
    where source_url='https://propiedades.com/quintana-roo/'
    order by created_at asc limit 1
  )
  and status='published'
  and visibility='public'
  and cover_image_url='https://cdn.propiedades.com/files/600x400/Quintana-Roo-Cancun-Centro-Avenida-Tulum-Benito-Juarez-0-31434428.jpeg'
  and slug<>'qroo-31434428';

commit;
