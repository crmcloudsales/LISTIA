-- LISTIA native Web Push backend.
-- Required Vault secrets are provisioned out-of-band and must never be committed:
--   listia_marketplace_vapid_private_key
--   listia_marketplace_push_dispatch_secret

create extension if not exists pg_net with schema extensions;

create table if not exists public.marketplace_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  expiration_time bigint,
  user_agent text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_failure_at timestamptz
);

alter table public.marketplace_push_subscriptions enable row level security;
revoke all on public.marketplace_push_subscriptions from anon,authenticated;
grant select,insert,update,delete on public.marketplace_push_subscriptions to authenticated;

drop policy if exists marketplace_push_subscriptions_select_own on public.marketplace_push_subscriptions;
create policy marketplace_push_subscriptions_select_own on public.marketplace_push_subscriptions for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists marketplace_push_subscriptions_insert_own on public.marketplace_push_subscriptions;
create policy marketplace_push_subscriptions_insert_own on public.marketplace_push_subscriptions for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists marketplace_push_subscriptions_update_own on public.marketplace_push_subscriptions;
create policy marketplace_push_subscriptions_update_own on public.marketplace_push_subscriptions for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
drop policy if exists marketplace_push_subscriptions_delete_own on public.marketplace_push_subscriptions;
create policy marketplace_push_subscriptions_delete_own on public.marketplace_push_subscriptions for delete to authenticated using (user_id=(select auth.uid()));

create index if not exists marketplace_push_subscriptions_user_active_idx on public.marketplace_push_subscriptions(user_id,active) where active is true;

create or replace function public.marketplace_push_vapid_private_key() returns text language sql stable security definer set search_path='' as $function$
  select decrypted_secret from vault.decrypted_secrets where name='listia_marketplace_vapid_private_key' limit 1;
$function$;
revoke all on function public.marketplace_push_vapid_private_key() from public,anon,authenticated;
grant execute on function public.marketplace_push_vapid_private_key() to service_role;

create or replace function public.marketplace_push_dispatch_secret() returns text language sql stable security definer set search_path='' as $function$
  select decrypted_secret from vault.decrypted_secrets where name='listia_marketplace_push_dispatch_secret' limit 1;
$function$;
revoke all on function public.marketplace_push_dispatch_secret() from public,anon,authenticated;
grant execute on function public.marketplace_push_dispatch_secret() to service_role;

create or replace function public.marketplace_push_claim(p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_result jsonb;
begin
  update private.marketplace_alert_outbox o set status='skipped',updated_at=now(),last_error='no_active_push_subscription'
  where o.channel='push' and o.status in ('queued','failed') and o.next_attempt_at<=now()
    and not exists (select 1 from public.marketplace_push_subscriptions s where s.user_id=o.user_id and s.active is true);

  with candidates as (
    select o.id from private.marketplace_alert_outbox o
    where o.channel='push'
      and ((o.status in ('queued','failed') and o.next_attempt_at<=now()) or (o.status='processing' and o.updated_at<now()-interval '10 minutes'))
      and exists (select 1 from public.marketplace_push_subscriptions s where s.user_id=o.user_id and s.active is true)
    order by o.created_at for update skip locked limit least(greatest(coalesce(p_limit,20),1),100)
  ), claimed as (
    update private.marketplace_alert_outbox o set status='processing',attempts=o.attempts+1,updated_at=now(),last_error=null
    from candidates c where o.id=c.id returning o.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'outbox_id',c.id,'user_id',c.user_id,'listing_id',c.listing_id,'attempts',c.attempts,
    'locale',coalesce(p.locale,'es'),'search_name',coalesce(ss.name,''),'listing_title',coalesce(l.title,'LISTIA'),
    'location_text',coalesce(l.location_text,l.city,''),'url','/?marketplace=1',
    'subscriptions',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'endpoint',s.endpoint,'p256dh',s.p256dh,'auth',s.auth_key)),'[]'::jsonb) from public.marketplace_push_subscriptions s where s.user_id=c.user_id and s.active is true)
  )),'[]'::jsonb) into v_result
  from claimed c left join public.profiles p on p.id=c.user_id left join public.marketplace_saved_searches ss on ss.id=c.saved_search_id left join public.marketplace_listings l on l.id=c.listing_id;
  return v_result;
end;
$function$;
revoke all on function public.marketplace_push_claim(integer) from public,anon,authenticated;
grant execute on function public.marketplace_push_claim(integer) to service_role;

create or replace function public.marketplace_push_complete(p_outbox_id uuid,p_success boolean,p_error text default null,p_deactivate_endpoints text[] default '{}'::text[])
returns void language plpgsql security definer set search_path='' as $function$
declare v_user uuid;v_attempts integer;
begin
  select user_id,attempts into v_user,v_attempts from private.marketplace_alert_outbox where id=p_outbox_id and channel='push';
  if v_user is null then return; end if;
  if cardinality(coalesce(p_deactivate_endpoints,'{}'::text[]))>0 then
    update public.marketplace_push_subscriptions set active=false,last_failure_at=now(),updated_at=now() where user_id=v_user and endpoint=any(p_deactivate_endpoints);
  end if;
  if p_success then
    update private.marketplace_alert_outbox set status='delivered',delivered_at=now(),updated_at=now(),last_error=null where id=p_outbox_id;
    update public.marketplace_push_subscriptions set last_success_at=now(),updated_at=now() where user_id=v_user and active is true;
  else
    update private.marketplace_alert_outbox set status=case when v_attempts>=5 then 'skipped' else 'failed' end,next_attempt_at=now()+make_interval(mins=>least(60,greatest(5,v_attempts*5))),updated_at=now(),last_error=left(coalesce(p_error,'push_failed'),1000) where id=p_outbox_id;
  end if;
end;
$function$;
revoke all on function public.marketplace_push_complete(uuid,boolean,text,text[]) from public,anon,authenticated;
grant execute on function public.marketplace_push_complete(uuid,boolean,text,text[]) to service_role;

create or replace function private.dispatch_marketplace_push_alerts() returns bigint language plpgsql security definer set search_path='' as $function$
declare v_ts text:=floor(extract(epoch from now()))::bigint::text;v_secret text;v_signature text;v_request_id bigint;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='listia_marketplace_push_dispatch_secret' limit 1;
  if v_secret is null then raise exception 'push_dispatch_secret_missing'; end if;
  v_signature:=encode(extensions.hmac(v_ts,v_secret,'sha256'),'hex');
  select net.http_post(url:='https://zvzafiarwerbuoaccnoz.supabase.co/functions/v1/marketplace-alert-dispatch',headers:=jsonb_build_object('Content-Type','application/json','x-listia-ts',v_ts,'x-listia-signature',v_signature),body:='{"limit":50}'::jsonb,timeout_milliseconds:=10000) into v_request_id;
  return v_request_id;
end;
$function$;
revoke all on function private.dispatch_marketplace_push_alerts() from public,anon,authenticated;
grant execute on function private.dispatch_marketplace_push_alerts() to service_role;

do $$ declare j bigint; begin
  select jobid into j from cron.job where jobname='listia_marketplace_push_dispatch_v1' limit 1;
  if j is not null then perform cron.unschedule(j); end if;
  perform cron.schedule('listia_marketplace_push_dispatch_v1','*/5 * * * *',$cron$select private.dispatch_marketplace_push_alerts();$cron$);
end $$;