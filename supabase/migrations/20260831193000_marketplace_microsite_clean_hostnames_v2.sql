create table if not exists public.marketplace_microsite_aliases (
  id uuid primary key default gen_random_uuid(),
  microsite_id uuid not null references public.marketplace_microsites(id) on delete cascade,
  hostname text not null unique,
  created_at timestamptz not null default now()
);

alter table public.marketplace_microsite_aliases enable row level security;
revoke all on public.marketplace_microsite_aliases from anon, authenticated;
grant select,insert,update,delete on public.marketplace_microsite_aliases to service_role;

insert into public.marketplace_microsite_aliases(microsite_id,hostname)
select id,hostname from public.marketplace_microsites
on conflict(hostname) do nothing;

update public.marketplace_microsites
set status='paused', updated_at=now()
where primary_state='Quintana Roo' and principal_role='portal';

with base as (
  select m.id,
    lower(trim(both '-' from regexp_replace(
      case
        when m.company_name ilike 'AMORAMAR Real Estate%' then 'amoramar'
        when m.company_name ilike 'Christie%International Real Estate Mexico%' then 'christies-mexico'
        else coalesce(
          nullif(split_part(split_part(regexp_replace(coalesce(m.website_url,''),'^https?://(www\.)?','','i'),'/',1),'.',1),''),
          m.company_name
        )
      end,
      '[^a-zA-Z0-9]+','-','g'
    ))) as stem
  from public.marketplace_microsites m
  where m.primary_state='Quintana Roo' and m.status<>'paused'
), ranked as (
  select b.*,
    row_number() over(partition by stem order by id) rn,
    count(*) over(partition by stem) cnt
  from base b
), final as (
  select id,
    case
      when stem='' then 'inmobiliaria-'||left(replace(id::text,'-',''),8)
      when cnt=1 then left(stem,56)
      else left(stem,50)||'-'||rn::text
    end as new_slug
  from ranked
)
update public.marketplace_microsites m
set slug=f.new_slug,
    hostname=f.new_slug||'.listiaapp.com',
    updated_at=now()
from final f
where m.id=f.id;

insert into public.marketplace_microsite_aliases(microsite_id,hostname)
select id,hostname from public.marketplace_microsites
on conflict(hostname) do nothing;
