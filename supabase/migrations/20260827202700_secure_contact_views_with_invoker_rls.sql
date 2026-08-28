-- Ensure tenant-facing contact views respect the querying user's RLS context.
alter view public.contact_360 set (security_invoker = true);
alter view public.contact_engine_metrics set (security_invoker = true);
alter view public.marketable_contacts set (security_invoker = true);
