-- Trigger-only function: prevent direct client invocation while preserving trigger behavior.
revoke execute on function public.block_seeker_property_writes() from public;
revoke execute on function public.block_seeker_property_writes() from anon;
revoke execute on function public.block_seeker_property_writes() from authenticated;
