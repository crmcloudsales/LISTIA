revoke all on public.cloudco_investment_leads from public, anon, authenticated;
revoke all on public.cloudco_form_rate_limits from public, anon, authenticated;

comment on table public.cloudco_investment_leads is 'LEGACY RETIRED. Historical CloudCo-named resource retained empty for migration history only. LISTIA canonical resource: public.listia_investment_leads. Do not use for new LISTIA development.';
comment on table public.cloudco_form_rate_limits is 'LEGACY RETIRED. Historical CloudCo-named resource retained empty for migration history only. LISTIA canonical resource: public.listia_form_rate_limits / listia_public_form_rate_limit_consume. Do not use for new LISTIA development.';
