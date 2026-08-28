drop policy if exists development_projects_member_read on public.development_projects;
create policy development_projects_member_read
on public.development_projects
for select
to authenticated
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = development_projects.organization_id
    and m.user_id = (select auth.uid())
    and m.status = 'active'
));

drop policy if exists development_projects_admin_insert on public.development_projects;
create policy development_projects_admin_insert
on public.development_projects
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.organization_members m
    where m.organization_id = development_projects.organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner','admin')
  )
);

drop policy if exists development_projects_admin_update on public.development_projects;
create policy development_projects_admin_update
on public.development_projects
for update
to authenticated
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = development_projects.organization_id
    and m.user_id = (select auth.uid())
    and m.status = 'active'
    and m.role in ('owner','admin')
))
with check (exists (
  select 1 from public.organization_members m
  where m.organization_id = development_projects.organization_id
    and m.user_id = (select auth.uid())
    and m.status = 'active'
    and m.role in ('owner','admin')
));

drop policy if exists development_projects_admin_delete on public.development_projects;
create policy development_projects_admin_delete
on public.development_projects
for delete
to authenticated
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = development_projects.organization_id
    and m.user_id = (select auth.uid())
    and m.status = 'active'
    and m.role in ('owner','admin')
));

drop policy if exists development_units_member_read on public.development_units;
create policy development_units_member_read
on public.development_units
for select
to authenticated
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = development_units.organization_id
    and m.user_id = (select auth.uid())
    and m.status = 'active'
));

drop policy if exists development_units_admin_manage on public.development_units;

create policy development_units_admin_insert
on public.development_units
for insert
to authenticated
with check (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = development_units.organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner','admin')
  )
  and exists (
    select 1 from public.development_projects p
    where p.id = development_units.project_id
      and p.organization_id = development_units.organization_id
  )
);

create policy development_units_admin_update
on public.development_units
for update
to authenticated
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = development_units.organization_id
    and m.user_id = (select auth.uid())
    and m.status = 'active'
    and m.role in ('owner','admin')
))
with check (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = development_units.organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner','admin')
  )
  and exists (
    select 1 from public.development_projects p
    where p.id = development_units.project_id
      and p.organization_id = development_units.organization_id
  )
);

create policy development_units_admin_delete
on public.development_units
for delete
to authenticated
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = development_units.organization_id
    and m.user_id = (select auth.uid())
    and m.status = 'active'
    and m.role in ('owner','admin')
));

create index if not exists development_projects_created_by_idx
  on public.development_projects(created_by);
create index if not exists development_units_organization_idx
  on public.development_units(organization_id);
create index if not exists development_units_property_idx
  on public.development_units(property_id)
  where property_id is not null;

create or replace function public.get_development_portfolio(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = v_uid
      and m.status = 'active'
  ) then
    raise exception 'forbidden' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(project_row order by project_row->>'name'), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'slug', p.slug,
      'location_text', p.location_text,
      'description', p.description,
      'status', p.status,
      'delivery_date', p.delivery_date,
      'created_at', p.created_at,
      'updated_at', p.updated_at,
      'unit_count', count(u.id),
      'available_units', count(u.id) filter (where lower(coalesce(u.status,'')) in ('available','active','ready')),
      'linked_properties', count(u.property_id),
      'min_price', min(u.price) filter (where u.price is not null),
      'max_price', max(u.price) filter (where u.price is not null),
      'currency', min(u.currency) filter (where u.currency is not null),
      'units', coalesce(jsonb_agg(
        jsonb_build_object(
          'id', u.id,
          'property_id', u.property_id,
          'unit_code', u.unit_code,
          'status', u.status,
          'floor', u.floor,
          'bedrooms', u.bedrooms,
          'bathrooms', u.bathrooms,
          'area_m2', u.area_m2,
          'price', u.price,
          'currency', u.currency,
          'metadata', u.metadata
        ) order by u.unit_code
      ) filter (where u.id is not null), '[]'::jsonb)
    ) as project_row
    from public.development_projects p
    left join public.development_units u
      on u.project_id = p.id and u.organization_id = p.organization_id
    where p.organization_id = p_organization_id
      and p.status <> 'archived'
    group by p.id
  ) q;

  return jsonb_build_object('organization_id',p_organization_id,'projects',v_result);
end;
$$;

revoke all on function public.get_development_portfolio(uuid) from public, anon;
grant execute on function public.get_development_portfolio(uuid) to authenticated, service_role;
