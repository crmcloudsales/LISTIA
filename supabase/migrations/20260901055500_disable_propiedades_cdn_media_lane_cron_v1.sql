-- LISTIA Marketplace only.
-- The verified CDN probe lane was tested in production on 20 records. The CDN did
-- not expose usable numbered sibling images, so keep the experimental lane dormant.
-- The generic continuous media enricher remains active.
select cron.unschedule(jobid)
from cron.job
where jobname='marketplace-propiedades-cdn-media-enrichment';
