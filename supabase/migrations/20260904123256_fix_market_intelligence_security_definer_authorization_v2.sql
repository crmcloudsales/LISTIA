-- Fix SECURITY DEFINER authorization semantics for LISTIA Market Intelligence.
-- The original guard used current_user, which resolves to the function owner
-- inside SECURITY DEFINER and therefore bypassed organization membership checks.

do $$
declare
  fn text;
  old_guard text := $old$if current_user not in ('postgres','service_role','supabase_admin') then
    if auth.uid() is null or not exists (select 1 from public.organization_members m where m.organization_id=p_organization_id and m.user_id=auth.uid() and m.status='active') then raise exception 'organization access denied'; end if;
  end if;$old$;
  new_guard text := $new$if session_user not in ('postgres','supabase_admin') and coalesce(auth.role(),'') <> 'service_role' then
    if auth.uid() is null or not exists (
      select 1
      from public.organization_members m
      where m.organization_id = p_organization_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    ) then
      raise exception 'organization access denied';
    end if;
  end if;$new$;
begin
  select pg_get_functiondef(p.oid)
    into fn
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='get_market_intelligence'
    and pg_get_function_identity_arguments(p.oid)='p_organization_id uuid, p_country_code text, p_state_region text, p_city text, p_operation_type text';

  if fn is null then
    raise exception 'get_market_intelligence function not found';
  end if;
  if position(old_guard in fn)=0 then
    raise exception 'expected vulnerable authorization guard not found; refusing blind rewrite';
  end if;

  fn := replace(fn, old_guard, new_guard);
  execute fn;
end
$$;

alter function public.get_market_intelligence(uuid,text,text,text,text)
  set search_path = pg_catalog, public, analytics;

revoke execute on function public.get_market_intelligence(uuid,text,text,text,text) from anon, public;
grant execute on function public.get_market_intelligence(uuid,text,text,text,text) to authenticated, service_role;
