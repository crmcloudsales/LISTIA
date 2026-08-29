alter table public.profiles
  add column if not exists active_organization_id uuid;

update public.profiles p
set active_organization_id = (
  select om.organization_id
  from public.organization_members om
  where om.user_id = p.id
    and om.status = 'active'
  order by om.created_at asc, om.organization_id asc
  limit 1
)
where p.active_organization_id is null
  and exists (
    select 1
    from public.organization_members om
    where om.user_id = p.id
      and om.status = 'active'
  );

create or replace function public.get_my_workspace_context()
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_active uuid;
  v_workspaces jsonb;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select p.active_organization_id
    into v_active
  from public.profiles p
  where p.id = v_uid;

  if v_active is null or not exists (
    select 1 from public.organization_members om
    where om.user_id=v_uid and om.organization_id=v_active and om.status='active'
  ) then
    select om.organization_id
      into v_active
    from public.organization_members om
    where om.user_id=v_uid and om.status='active'
    order by om.created_at asc, om.organization_id asc
    limit 1;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'organization_id', om.organization_id,
      'name', o.name,
      'slug', o.slug,
      'role', om.role,
      'primary_market', o.primary_market,
      'country_code', o.country_code,
      'timezone', o.timezone,
      'membership_created_at', om.created_at
    ) order by om.created_at asc, om.organization_id asc), '[]'::jsonb)
    into v_workspaces
  from public.organization_members om
  join public.organizations o on o.id=om.organization_id
  where om.user_id=v_uid and om.status='active';

  return jsonb_build_object(
    'active_organization_id', v_active,
    'workspaces', v_workspaces
  );
end;
$function$;

create or replace function public.set_my_active_organization(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_organization_id is null or not exists (
    select 1 from public.organization_members om
    where om.user_id=v_uid
      and om.organization_id=p_organization_id
      and om.status='active'
  ) then
    raise exception 'workspace_not_allowed' using errcode = '42501';
  end if;

  update public.profiles
  set active_organization_id=p_organization_id,
      updated_at=now()
  where id=v_uid;

  return public.get_my_workspace_context();
end;
$function$;

revoke all on function public.get_my_workspace_context() from public, anon;
revoke all on function public.set_my_active_organization(uuid) from public, anon;
grant execute on function public.get_my_workspace_context() to authenticated, service_role;
grant execute on function public.set_my_active_organization(uuid) to authenticated, service_role;
