alter function public.get_development_portfolio(uuid) security invoker;
revoke all on function public.get_development_portfolio(uuid) from public, anon;
grant execute on function public.get_development_portfolio(uuid) to authenticated, service_role;
