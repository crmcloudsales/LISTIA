alter table public.marketplace_saved_searches add column if not exists alert_enabled boolean not null default true;
alter table public.marketplace_saved_searches add column if not exists last_checked_at timestamptz;
alter table public.marketplace_saved_searches add column if not exists last_match_at timestamptz;

create table if not exists public.marketplace_saved_search_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_search_id uuid not null references public.marketplace_saved_searches(id) on delete cascade,
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  matched_at timestamptz not null default now(),
  seen_at timestamptz,
  unique(saved_search_id, listing_id)
);

alter table public.marketplace_saved_search_matches enable row level security;
drop policy if exists "saved search matches own read" on public.marketplace_saved_search_matches;
create policy "saved search matches own read" on public.marketplace_saved_search_matches for select to authenticated using (auth.uid() = user_id);
drop policy if exists "saved search matches own update" on public.marketplace_saved_search_matches;
create policy "saved search matches own update" on public.marketplace_saved_search_matches for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.marketplace_saved_search_matches from anon;
grant select, update on public.marketplace_saved_search_matches to authenticated;
grant all on public.marketplace_saved_search_matches to service_role;
create index if not exists marketplace_saved_search_matches_user_seen_idx on public.marketplace_saved_search_matches(user_id, seen_at, matched_at desc);
create index if not exists marketplace_saved_search_matches_search_idx on public.marketplace_saved_search_matches(saved_search_id, matched_at desc);
