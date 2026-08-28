create or replace function private.marketplace_alert_delivery_health()
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'generated_at', now(),
    'push_subscriptions_active', (select count(*) from public.marketplace_push_subscriptions where active is true),
    'users_push_enabled', (select count(*) from public.marketplace_notification_preferences where push_enabled is true),
    'users_email_enabled', (select count(*) from public.marketplace_notification_preferences where email_enabled is true),
    'outbox', coalesce((
      select jsonb_object_agg(channel, statuses)
      from (
        select channel, jsonb_object_agg(status, n) as statuses
        from (
          select channel, status, count(*) as n
          from private.marketplace_alert_outbox
          group by channel, status
        ) c
        group by channel
      ) q
    ), '{}'::jsonb),
    'oldest_pending_at', (
      select min(created_at)
      from private.marketplace_alert_outbox
      where status in ('queued','failed','processing')
    ),
    'retry_due', (
      select count(*)
      from private.marketplace_alert_outbox
      where status in ('queued','failed') and next_attempt_at <= now()
    )
  );
$function$;

revoke all on function private.marketplace_alert_delivery_health() from public, anon, authenticated;
grant execute on function private.marketplace_alert_delivery_health() to service_role;
