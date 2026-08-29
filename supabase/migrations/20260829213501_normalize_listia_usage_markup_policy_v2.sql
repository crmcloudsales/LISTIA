-- Mirrors the migration already applied to the live LISTIA Supabase project.
-- Canonical usage markup policy: Free 30%, Pro 20%, Premium 10%.

create or replace function private.plan_usage_markup_percent(p_plan text)
returns numeric
language sql
immutable
set search_path to 'pg_catalog'
as $function$
  select case lower(coalesce(p_plan,'free'))
    when 'pro' then 20::numeric
    when 'premium' then 10::numeric
    else 30::numeric
  end
$function$;

alter table public.organization_billing
  alter column usage_markup_percent set default 30;

update public.organization_billing
set usage_markup_percent = private.plan_usage_markup_percent(plan_key),
    updated_at = now();

alter table public.organization_billing
  drop constraint if exists organization_billing_usage_markup_plan_policy_check;

alter table public.organization_billing
  add constraint organization_billing_usage_markup_plan_policy_check
  check (usage_markup_percent = private.plan_usage_markup_percent(plan_key));
