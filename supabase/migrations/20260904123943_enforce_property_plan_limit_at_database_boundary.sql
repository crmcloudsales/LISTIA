-- Canonical LISTIA property entitlement boundary.
-- Every property creation path is constrained at the database layer, not only
-- the browser/Edge Function that initiated the insert.

create or replace function private.enforce_property_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_plan text;
  v_limit integer;
  v_active_count integer;
begin
  -- Archived rows do not consume a plan slot.
  if new.status = 'archived' then
    return new;
  end if;

  -- An update only needs a new slot when an archived row is reactivated or
  -- an active row is moved to another organization.
  if tg_op = 'UPDATE'
     and old.status <> 'archived'
     and old.organization_id = new.organization_id then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('property-entitlement:' || new.organization_id::text, 0)
  );

  select lower(coalesce(b.plan_key, 'free'))
    into v_plan
  from public.organization_billing b
  where b.organization_id = new.organization_id
  limit 1;

  v_plan := coalesce(v_plan, 'free');

  select e.property_limit
    into v_limit
  from private.plan_entitlements e
  where e.plan_key = v_plan
  limit 1;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'plan_entitlement_unavailable',
      detail = format('plan=%s', v_plan);
  end if;

  if v_limit is null then
    return new;
  end if;

  select count(*)::integer
    into v_active_count
  from public.properties p
  where p.organization_id = new.organization_id
    and p.status <> 'archived';

  if v_active_count >= v_limit then
    raise exception using
      errcode = 'P0001',
      message = 'property_limit_reached',
      detail = format('plan=%s limit=%s active_count=%s', v_plan, v_limit, v_active_count);
  end if;

  return new;
end
$$;

revoke execute on function private.enforce_property_plan_limit() from public, anon, authenticated;
grant execute on function private.enforce_property_plan_limit() to service_role;

drop trigger if exists enforce_property_plan_limit on public.properties;
create trigger enforce_property_plan_limit
before insert or update of status, organization_id on public.properties
for each row execute function private.enforce_property_plan_limit();
