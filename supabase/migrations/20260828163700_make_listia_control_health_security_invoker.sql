create or replace function public.get_listia_control_health()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_mode text;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select p.account_mode into v_mode
  from public.profiles p
  where p.id = v_uid;

  select om.organization_id into v_org
  from public.organization_members om
  where om.user_id = v_uid and om.status = 'active'
  order by om.created_at asc
  limit 1;

  select jsonb_build_object(
    'generated_at', now(),
    'account_mode', coalesce(v_mode, 'professional'),
    'organization_id', v_org,
    'marketplace', jsonb_build_object(
      'saved_searches_total', (select count(*) from public.marketplace_saved_searches s where s.user_id = v_uid),
      'saved_searches_alert_enabled', (select count(*) from public.marketplace_saved_searches s where s.user_id = v_uid and s.alert_enabled is true),
      'push_subscriptions_active', (select count(*) from public.marketplace_push_subscriptions p where p.user_id = v_uid and p.active is true),
      'push_preference_enabled', coalesce((select n.push_enabled from public.marketplace_notification_preferences n where n.user_id = v_uid limit 1), false),
      'email_preference_enabled', coalesce((select n.email_enabled from public.marketplace_notification_preferences n where n.user_id = v_uid limit 1), false)
    ),
    'website', case when v_org is null then null else (
      select jsonb_build_object(
        'mode', w.mode,
        'domain', w.domain,
        'subdomain', w.subdomain,
        'status', w.status,
        'updated_at', w.updated_at
      )
      from public.organization_websites w
      where w.organization_id = v_org
      limit 1
    ) end,
    'signals', case when v_org is null then jsonb_build_object('web_events_24h',0,'conversion_pending',0,'conversion_sent',0) else jsonb_build_object(
      'web_events_24h', (select count(*) from public.web_events e where e.organization_id = v_org and e.occurred_at >= now() - interval '24 hours'),
      'conversion_pending', (select count(*) from public.conversion_signals s where s.organization_id = v_org and s.delivery_status in ('pending','processing','failed')),
      'conversion_sent', (select count(*) from public.conversion_signals s where s.organization_id = v_org and s.delivery_status in ('sent','partial'))
    ) end,
    'capabilities', jsonb_build_object(
      'native_web_push_backend', true,
      'saved_search_email_delivery', false,
      'listia_subdomains', true,
      'external_custom_domains', false,
      'external_custom_domains_blocker', 'cloudflare_ssl_for_saas_unavailable_codes_1404_1456'
    )
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.get_listia_control_health() from public, anon;
grant execute on function public.get_listia_control_health() to authenticated;
