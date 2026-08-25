alter table public.profiles add column if not exists account_mode text not null default 'professional';
alter table public.profiles drop constraint if exists profiles_account_mode_check;
alter table public.profiles add constraint profiles_account_mode_check check (account_mode in ('professional','seeker'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, locale, account_mode)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    coalesce(nullif(trim(coalesce(new.raw_user_meta_data ->> 'locale', '')), ''), 'es'),
    case when lower(coalesce(new.raw_user_meta_data ->> 'account_mode','')) = 'seeker' then 'seeker' else 'professional' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create table if not exists public.marketplace_saved_searches (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text, criteria jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists marketplace_saved_searches_user_idx on public.marketplace_saved_searches(user_id, created_at desc);
alter table public.marketplace_saved_searches enable row level security;
create policy marketplace_saved_searches_select_self on public.marketplace_saved_searches for select to authenticated using (user_id=(select auth.uid()));
create policy marketplace_saved_searches_insert_self on public.marketplace_saved_searches for insert to authenticated with check (user_id=(select auth.uid()));
create policy marketplace_saved_searches_update_self on public.marketplace_saved_searches for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy marketplace_saved_searches_delete_self on public.marketplace_saved_searches for delete to authenticated using (user_id=(select auth.uid()));
revoke all on public.marketplace_saved_searches from anon;
grant select,insert,update,delete on public.marketplace_saved_searches to authenticated;
grant all on public.marketplace_saved_searches to service_role;

create table if not exists public.marketplace_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (user_id, listing_id)
);
create index if not exists marketplace_favorites_listing_idx on public.marketplace_favorites(listing_id);
alter table public.marketplace_favorites enable row level security;
create policy marketplace_favorites_select_self on public.marketplace_favorites for select to authenticated using (user_id=(select auth.uid()));
create policy marketplace_favorites_insert_self on public.marketplace_favorites for insert to authenticated with check (user_id=(select auth.uid()));
create policy marketplace_favorites_delete_self on public.marketplace_favorites for delete to authenticated using (user_id=(select auth.uid()));
revoke all on public.marketplace_favorites from anon;
grant select,insert,delete on public.marketplace_favorites to authenticated;
grant all on public.marketplace_favorites to service_role;
