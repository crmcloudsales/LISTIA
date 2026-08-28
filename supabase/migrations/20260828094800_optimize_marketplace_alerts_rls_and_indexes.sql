drop policy if exists "saved search matches own read" on public.marketplace_saved_search_matches;
create policy "saved search matches own read"
on public.marketplace_saved_search_matches
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "saved search matches own update" on public.marketplace_saved_search_matches;
create policy "saved search matches own update"
on public.marketplace_saved_search_matches
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index if not exists marketplace_saved_search_matches_listing_idx
  on public.marketplace_saved_search_matches(listing_id);

create index if not exists marketplace_saved_searches_alert_check_idx
  on public.marketplace_saved_searches(last_checked_at, id)
  where alert_enabled is true;

create index if not exists marketplace_listings_organization_idx
  on public.marketplace_listings(organization_id)
  where organization_id is not null;

create index if not exists marketplace_listings_source_idx
  on public.marketplace_listings(source_id)
  where source_id is not null;
