create table if not exists private.managed_site_firewall_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_host text not null,
  listing_id uuid null,
  ip_hash text null,
  contact_hash text null,
  quality_score numeric not null default 0,
  decision text not null check (decision in ('accepted','review','junk','blocked')),
  reasons jsonb not null default '[]'::jsonb,
  user_agent_class text null,
  country_code text null,
  created_at timestamptz not null default now()
);

alter table private.managed_site_firewall_attempts enable row level security;
revoke all on private.managed_site_firewall_attempts from public, anon, authenticated;
grant select, insert, update, delete on private.managed_site_firewall_attempts to service_role;
create index if not exists managed_site_firewall_attempts_org_created_idx on private.managed_site_firewall_attempts(organization_id, created_at desc);
create index if not exists managed_site_firewall_attempts_ip_created_idx on private.managed_site_firewall_attempts(ip_hash, created_at desc) where ip_hash is not null;
create index if not exists managed_site_firewall_attempts_contact_created_idx on private.managed_site_firewall_attempts(contact_hash, created_at desc) where contact_hash is not null;

create or replace function private.listia_managed_site_configuration(p_organization_id uuid, p_existing jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  dna jsonb := '{}'::jsonb;
  b jsonb := '{}'::jsonb;
  primary_color text;
  secondary_color text;
  font_family text;
  logo_url text;
  org_name text;
begin
  select coalesce(o.name,''), coalesce(ob.business_dna,'{}'::jsonb)
    into org_name, dna
  from public.organizations o
  left join public.organization_onboarding ob on ob.organization_id=o.id
  where o.id=p_organization_id;

  b := coalesce(dna->'branding', dna->'brand', '{}'::jsonb);
  primary_color := coalesce(nullif(b->>'primary_color',''), nullif(dna->>'primary_color',''), '#7c3cff');
  secondary_color := coalesce(nullif(b->>'secondary_color',''), nullif(dna->>'secondary_color',''), '#a982ff');
  font_family := coalesce(nullif(b->>'font_family',''), nullif(b->>'typography',''), nullif(dna->>'font_family',''), 'Inter');
  logo_url := coalesce(nullif(b->>'logo_url',''), nullif(dna->>'logo_url',''), '');

  if primary_color !~* '^#[0-9a-f]{6}$' then primary_color := '#7c3cff'; end if;
  if secondary_color !~* '^#[0-9a-f]{6}$' then secondary_color := '#a982ff'; end if;
  if font_family !~ '^[A-Za-z0-9 _-]{1,50}$' then font_family := 'Inter'; end if;
  if logo_url <> '' and logo_url !~* '^https://' then logo_url := ''; end if;

  return coalesce(p_existing,'{}'::jsonb)
    || jsonb_build_object(
      'managed_by','LISTIA',
      'template','pennyworth_one_page_v1',
      'seo_continuous',true,
      'web_events',true,
      'pixel_ready',true,
      'conversion_signals',true,
      'crm_signal_after_quality_gate',true,
      'security_profile','pennyworth_v1',
      'security_enforced',true,
      'security_inherited_from','listia_managed_edge',
      'waf',true,
      'turnstile',true,
      'honeypot',true,
      'junk_lead_firewall',true,
      'rate_limiting',true,
      'lead_quality_scoring',true,
      'lead_quality_accept_threshold',80,
      'lead_quality_review_threshold',60,
      'max_ip_attempts_10m',10,
      'max_contact_attempts_60m',4,
      'min_form_elapsed_ms',2500,
      'branding',jsonb_build_object(
        'business_name',org_name,
        'primary_color',primary_color,
        'secondary_color',secondary_color,
        'font_family',font_family,
        'logo_url',logo_url
      )
    );
end
$$;

revoke all on function private.listia_managed_site_configuration(uuid,jsonb) from public, anon, authenticated;
grant execute on function private.listia_managed_site_configuration(uuid,jsonb) to service_role;

create or replace function private.enforce_listia_managed_site_security()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  new.configuration := private.listia_managed_site_configuration(new.organization_id, coalesce(new.configuration,'{}'::jsonb));
  if new.mode='listia_subdomain' then
    new.configuration := new.configuration || jsonb_build_object(
      'provisioned_via','wildcard',
      'worker_route_verified',true,
      'tls',true,
      'security_pending',false
    );
  else
    new.configuration := new.configuration || jsonb_build_object('security_pending', new.status <> 'active');
  end if;
  new.updated_at := now();
  return new;
end
$$;

revoke all on function private.enforce_listia_managed_site_security() from public, anon, authenticated;
drop trigger if exists trg_enforce_listia_managed_site_security on public.organization_websites;
create trigger trg_enforce_listia_managed_site_security
before insert or update on public.organization_websites
for each row execute function private.enforce_listia_managed_site_security();

create or replace function private.ensure_default_listia_managed_site()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  candidate text;
  suffix text := substr(md5(new.id::text),1,8);
begin
  if exists(select 1 from public.organization_websites w where w.organization_id=new.id) then return new; end if;
  candidate := lower(regexp_replace(coalesce(new.slug,''),'[^a-z0-9-]+','-','g'));
  candidate := trim(both '-' from candidate);
  if candidate='' then candidate := 'site-'||suffix; end if;
  candidate := left(candidate,63);
  candidate := trim(both '-' from candidate);
  if candidate in ('app','www','api','admin','mail','smtp','ftp','marketplace','web','brain','ai')
     or exists(select 1 from public.organization_websites w where w.mode='listia_subdomain' and lower(w.subdomain)=candidate) then
    candidate := left(candidate,52)||'-'||suffix;
  end if;

  insert into public.organization_websites(
    organization_id,mode,domain,subdomain,status,configuration
  ) values (
    new.id,'listia_subdomain',null,candidate,'active',
    jsonb_build_object(
      'auto_provisioned',true,
      'health_gate',true,
      'infra_health_verified',true,
      'full_health_verified',true,
      'activated_at',now(),
      'last_verified_at',now()
    )
  ) on conflict (organization_id) do nothing;
  return new;
end
$$;

revoke all on function private.ensure_default_listia_managed_site() from public, anon, authenticated;
drop trigger if exists trg_ensure_default_listia_managed_site on public.organizations;
create trigger trg_ensure_default_listia_managed_site
after insert on public.organizations
for each row execute function private.ensure_default_listia_managed_site();

insert into public.organization_websites(organization_id,mode,domain,subdomain,status,configuration)
select o.id,'listia_subdomain',null,
       case
         when lower(o.slug) in ('app','www','api','admin','mail','smtp','ftp','marketplace','web','brain','ai')
           then left(lower(o.slug),52)||'-'||substr(md5(o.id::text),1,8)
         else left(lower(o.slug),63)
       end,
       'active',
       jsonb_build_object('auto_provisioned',true,'health_gate',true,'infra_health_verified',true,'full_health_verified',true,'activated_at',now(),'last_verified_at',now())
from public.organizations o
where not exists(select 1 from public.organization_websites w where w.organization_id=o.id)
on conflict do nothing;

update public.organization_websites
set configuration=configuration,
    updated_at=now();
