-- Tighten LISTIA Market Intelligence further: only service_role may bypass
-- organization membership. Authenticated browser callers must always present
-- auth.uid() and be active members of the requested organization.

do $$
declare
  fn text;
  old_guard text := 'if session_user not in (''postgres'',''supabase_admin'') and coalesce(auth.role(),'''') <> ''service_role'' then';
  new_guard text := 'if coalesce(auth.role(),'''') <> ''service_role'' then';
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
    raise exception 'expected authorization guard not found; refusing blind rewrite';
  end if;

  fn := replace(fn, old_guard, new_guard);
  execute fn;
end
$$;

alter function public.get_market_intelligence(uuid,text,text,text,text)
  set search_path = pg_catalog, public, analytics;
revoke execute on function public.get_market_intelligence(uuid,text,text,text,text) from anon, public;
grant execute on function public.get_market_intelligence(uuid,text,text,text,text) to authenticated, service_role;
