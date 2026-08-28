create unique index if not exists organization_websites_subdomain_unique
on public.organization_websites (lower(subdomain))
where mode='listia_subdomain' and subdomain is not null;

create unique index if not exists organization_websites_domain_unique
on public.organization_websites (lower(domain))
where domain is not null;

alter table public.organization_websites
  drop constraint if exists organization_websites_subdomain_safe_check;
alter table public.organization_websites
  add constraint organization_websites_subdomain_safe_check check (
    mode <> 'listia_subdomain'
    or (
      subdomain is not null
      and subdomain ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
      and lower(subdomain) not in ('app','www','api','admin','mail','smtp','ftp','marketplace','web')
    )
  );

alter table public.organization_websites
  drop constraint if exists organization_websites_domain_safe_check;
alter table public.organization_websites
  add constraint organization_websites_domain_safe_check check (
    mode = 'listia_subdomain'
    or (
      domain is not null
      and length(domain) between 4 and 253
      and domain !~ '[/:\\s]'
    )
  );
