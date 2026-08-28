revoke execute on function public.submit_marketplace_interest(uuid,text,text,text,text,text,text) from public, anon;
grant execute on function public.submit_marketplace_interest(uuid,text,text,text,text,text,text) to authenticated, service_role;
