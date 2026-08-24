revoke execute on function public.initialize_property_processing_state() from public, anon, authenticated;
revoke execute on function public.refresh_property_processing_assets() from public, anon, authenticated;
grant execute on function public.initialize_property_processing_state() to service_role;
grant execute on function public.refresh_property_processing_assets() to service_role;
