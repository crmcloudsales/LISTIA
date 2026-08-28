create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  terms_url text not null default 'https://listiaapp.com/terms.html',
  privacy_url text not null default 'https://listiaapp.com/privacy.html',
  accepted_at timestamptz not null default now(),
  locale text,
  source text not null default 'pwa_signup_checkbox',
  acceptance_method text not null default 'explicit_checkbox',
  created_at timestamptz not null default now(),
  unique (user_id, terms_version, privacy_version)
);

alter table public.legal_acceptances enable row level security;

revoke all on public.legal_acceptances from anon;
revoke all on public.legal_acceptances from authenticated;
grant select on public.legal_acceptances to authenticated;

create policy legal_acceptances_select_own
on public.legal_acceptances
for select to authenticated
using (user_id = (select auth.uid()));

create or replace function private.record_signup_legal_acceptance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_terms text := nullif(btrim(v_meta->>'terms_version'), '');
  v_privacy text := nullif(btrim(v_meta->>'privacy_version'), '');
begin
  if coalesce((v_meta->>'legal_terms_accepted')::boolean, false) is not true then
    return new;
  end if;

  if v_terms is null or v_privacy is null then
    return new;
  end if;

  insert into public.legal_acceptances (
    user_id,
    terms_version,
    privacy_version,
    terms_url,
    privacy_url,
    accepted_at,
    locale,
    source,
    acceptance_method
  ) values (
    new.id,
    left(v_terms, 40),
    left(v_privacy, 40),
    'https://listiaapp.com/terms.html',
    'https://listiaapp.com/privacy.html',
    now(),
    nullif(left(btrim(coalesce(v_meta->>'locale','')), 20), ''),
    left(coalesce(nullif(btrim(v_meta->>'legal_acceptance_source'), ''), 'pwa_signup_checkbox'), 80),
    'explicit_checkbox'
  )
  on conflict (user_id, terms_version, privacy_version) do nothing;

  return new;
end;
$function$;

revoke all on function private.record_signup_legal_acceptance() from public, anon, authenticated;

drop trigger if exists on_auth_user_legal_acceptance on auth.users;
create trigger on_auth_user_legal_acceptance
after insert on auth.users
for each row execute function private.record_signup_legal_acceptance();
