-- LISTIA-only data boundary.
-- Internal operational relations remain inaccessible to browser roles.
-- Pricing catalog stays closed while BILLING_ENV=hold; an approved pricing
-- release must explicitly grant/read-policy it later.

do $$
declare
  target text;
  kind "char";
begin
  foreach target in array array[
    'public._contact_edge_rate_limits',
    'public._listia_contact_import_staging',
    'public.bonavista_qroo_test_inventory',
    'public.listia_commercial_knowledge',
    'public.listia_form_rate_limits',
    'public.listia_investment_leads',
    'public.market_intelligence_daily_snapshots',
    'private.managed_site_firewall_attempts'
  ]
  loop
    if to_regclass(target) is not null then
      execute format('revoke all privileges on %s from anon, authenticated', target);
      select c.relkind into kind from pg_class c where c.oid=to_regclass(target);
      if kind in ('r','p') then
        execute format('alter table %s enable row level security', target);
      end if;
    end if;
  end loop;

  if to_regclass('public.listia_plan_catalog') is not null then
    revoke all privileges on table public.listia_plan_catalog from anon, authenticated;
    alter table public.listia_plan_catalog enable row level security;
  end if;
end
$$;

comment on table public.listia_plan_catalog is
  'LISTIA pricing catalog. Client access remains closed while billing is in HOLD; expose only through an approved pricing release migration.';
