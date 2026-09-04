-- LISTIA email boundary: enqueue/dispatch RPCs are service-only.
-- This prevents browser clients or anonymous callers from injecting or dispatching email jobs.
revoke execute on function public.listia_email_enqueue(text,text,text,text,text,text,text,text,uuid,text,jsonb) from public;
revoke execute on function public.listia_email_enqueue(text,text,text,text,text,text,text,text,uuid,text,jsonb) from anon;
revoke execute on function public.listia_email_enqueue(text,text,text,text,text,text,text,text,uuid,text,jsonb) from authenticated;
grant execute on function public.listia_email_enqueue(text,text,text,text,text,text,text,text,uuid,text,jsonb) to service_role;

revoke execute on function public.listia_email_dispatch_claim(integer) from public;
revoke execute on function public.listia_email_dispatch_claim(integer) from anon;
revoke execute on function public.listia_email_dispatch_claim(integer) from authenticated;
grant execute on function public.listia_email_dispatch_claim(integer) to service_role;

revoke execute on function public.listia_email_dispatch_complete(uuid,boolean,text,text,text) from public;
revoke execute on function public.listia_email_dispatch_complete(uuid,boolean,text,text,text) from anon;
revoke execute on function public.listia_email_dispatch_complete(uuid,boolean,text,text,text) from authenticated;
grant execute on function public.listia_email_dispatch_complete(uuid,boolean,text,text,text) to service_role;

revoke execute on function public.listia_email_dispatch_providers() from public;
revoke execute on function public.listia_email_dispatch_providers() from anon;
revoke execute on function public.listia_email_dispatch_providers() from authenticated;
grant execute on function public.listia_email_dispatch_providers() to service_role;
