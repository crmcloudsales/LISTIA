begin;

drop policy if exists affiliate_accounts_select_own on public.affiliate_accounts;
create policy affiliate_accounts_select_own
on public.affiliate_accounts for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists affiliate_accounts_update_own on public.affiliate_accounts;
create policy affiliate_accounts_update_own
on public.affiliate_accounts for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists affiliate_referrals_select_own on public.affiliate_referrals;
create policy affiliate_referrals_select_own
on public.affiliate_referrals for select to authenticated
using (exists (
  select 1 from public.affiliate_accounts a
  where a.id = affiliate_referrals.affiliate_id
    and a.user_id = (select auth.uid())
));

drop policy if exists affiliate_commissions_select_own on public.affiliate_commissions;
create policy affiliate_commissions_select_own
on public.affiliate_commissions for select to authenticated
using (exists (
  select 1 from public.affiliate_accounts a
  where a.id = affiliate_commissions.affiliate_id
    and a.user_id = (select auth.uid())
));

drop policy if exists affiliate_payouts_select_own on public.affiliate_payouts;
create policy affiliate_payouts_select_own
on public.affiliate_payouts for select to authenticated
using (exists (
  select 1 from public.affiliate_accounts a
  where a.id = affiliate_payouts.affiliate_id
    and a.user_id = (select auth.uid())
));

drop policy if exists web_events_member_select on public.web_events;
create policy web_events_member_select
on public.web_events for select to authenticated
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = web_events.organization_id
    and m.user_id = (select auth.uid())
    and m.status = 'active'
));

drop policy if exists attribution_member_select on public.attribution_touchpoints;
create policy attribution_member_select
on public.attribution_touchpoints for select to authenticated
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = attribution_touchpoints.organization_id
    and m.user_id = (select auth.uid())
    and m.status = 'active'
));

drop policy if exists conversion_signals_member_select on public.conversion_signals;
create policy conversion_signals_member_select
on public.conversion_signals for select to authenticated
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = conversion_signals.organization_id
    and m.user_id = (select auth.uid())
    and m.status = 'active'
));

drop policy if exists lead_notifications_select_own on public.lead_notifications;
create policy lead_notifications_select_own
on public.lead_notifications for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists lead_notifications_update_own on public.lead_notifications;
create policy lead_notifications_update_own
on public.lead_notifications for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

commit;
