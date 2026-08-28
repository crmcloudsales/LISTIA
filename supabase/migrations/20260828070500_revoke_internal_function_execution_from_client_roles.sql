revoke execute on function public.set_property_processing_updated_at() from public, anon, authenticated;
revoke execute on function public.normalize_contact_email(text) from public, anon;
revoke execute on function public.normalize_contact_phone(text) from public, anon;
-- authenticated retains normalization helpers for existing contact workflows.
