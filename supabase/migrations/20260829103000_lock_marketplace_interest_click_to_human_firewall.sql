revoke all on function public.submit_marketplace_interest_click(uuid,text) from public, anon, authenticated;

comment on function public.submit_marketplace_interest_click(uuid,text) is 'Internal implementation only. Public/authenticated direct execution is disabled; Marketplace interest creation must pass through the LISTIA human-verification Edge firewall.';
