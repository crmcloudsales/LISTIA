begin;

alter function public.get_my_workspace_context() security invoker;
alter function public.set_my_active_organization(uuid) security invoker;

revoke execute on function public.get_my_workspace_context() from public, anon;
revoke execute on function public.set_my_active_organization(uuid) from public, anon;
grant execute on function public.get_my_workspace_context() to authenticated, service_role;
grant execute on function public.set_my_active_organization(uuid) to authenticated, service_role;

drop policy if exists organization_websites_select on public.organization_websites;
drop policy if exists organization_websites_write on public.organization_websites;
drop policy if exists organization_websites_insert_admin on public.organization_websites;
drop policy if exists organization_websites_update_admin on public.organization_websites;
drop policy if exists organization_websites_delete_admin on public.organization_websites;

create policy organization_websites_select
on public.organization_websites
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = organization_websites.organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

create policy organization_websites_insert_admin
on public.organization_websites
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = organization_websites.organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any (array['owner'::text,'admin'::text])
  )
);

create policy organization_websites_update_admin
on public.organization_websites
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = organization_websites.organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any (array['owner'::text,'admin'::text])
  )
)
with check (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = organization_websites.organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any (array['owner'::text,'admin'::text])
  )
);

create policy organization_websites_delete_admin
on public.organization_websites
for delete
to authenticated
using (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = organization_websites.organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any (array['owner'::text,'admin'::text])
  )
);

commit;
