select cron.schedule(
  'marketplace-media-continuous-enrichment',
  '* * * * *',
  $$select private.dispatch_marketplace_media_enrichment(null,40);$$
);
