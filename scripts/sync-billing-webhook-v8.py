#!/usr/bin/env python3
from pathlib import Path

p = Path('supabase/functions/billing-stripe-webhook/index.ts')
s = p.read_text(encoding='utf-8')

s = s.replace(
    "const markup = effectivePlan === 'pro' ? 25 : effectivePlan === 'premium' ? 12.5 : 50",
    "const markup = effectivePlan === 'pro' ? 20 : effectivePlan === 'premium' ? 10 : 30",
)

if 'async function recordAffiliateCommission(' not in s:
    anchor = """function subscriptionIdFromInvoice(invoice: any) {
  return idOf(invoice?.parent?.subscription_details?.subscription) || idOf(invoice?.subscription)
}
"""
    affiliate = r'''
async function recordAffiliateCommission(invoice: any, organizationId: string, subscriptionId: string | null) {
  const invoiceId = String(invoice?.id || '')
  if (!invoiceId) return { recorded: false, reason: 'invoice_id_missing' }

  const [referral] = await sql`
    select r.id, r.affiliate_id, a.commission_percent
    from public.affiliate_referrals r
    join public.affiliate_accounts a on a.id=r.affiliate_id
    where r.organization_id=${organizationId}::uuid
      and r.status in ('attributed','active')
      and a.status='active'
    limit 1
  `
  if (!referral) return { recorded: false, reason: 'no_affiliate' }

  const bindingByPrice = await loadBindingMap()
  let eligibleCents = 0
  for (const line of invoice?.lines?.data || []) {
    const priceId = idOf(line?.pricing?.price_details?.price) || idOf(line?.price)
    let portableKey: string | null = null
    if (priceId) portableKey = bindingByPrice.get(priceId) || null
    const lookup = String(line?.price?.lookup_key || '')
    portableKey = portableKey || portableByLookupKey.get(lookup) || null
    const metadataPortable = String(line?.price?.metadata?.portable_key || '')
    if (['listia_pro','listia_premium','listia_premium_extra_seat'].includes(metadataPortable)) portableKey = metadataPortable
    if (['listia_pro','listia_premium','listia_premium_extra_seat'].includes(String(portableKey))) {
      eligibleCents += Math.max(0, Number(line?.amount || 0))
    }
  }
  if (eligibleCents <= 0) return { recorded: false, reason: 'no_subscription_amount' }

  const pct = Number(referral.commission_percent || 40)
  const commissionCents = Math.round(eligibleCents * (pct / 100))
  const gross = (eligibleCents / 100).toFixed(2)
  const commission = (commissionCents / 100).toFixed(2)
  const currency = String(invoice?.currency || 'usd').toLowerCase()

  const [row] = await sql`
    insert into public.affiliate_commissions(
      affiliate_id, referral_id, organization_id, stripe_invoice_id,
      stripe_subscription_id, gross_subscription_amount, currency,
      commission_percent, commission_amount, status, available_at
    ) values(
      ${referral.affiliate_id}::uuid, ${referral.id}::uuid, ${organizationId}::uuid, ${invoiceId},
      ${subscriptionId}, ${gross}, ${currency}, ${pct}, ${commission}, 'available', now()
    )
    on conflict (stripe_invoice_id) do nothing
    returning id
  `

  await sql`
    update public.affiliate_referrals
    set status='active', converted_at=coalesce(converted_at,now()), updated_at=now()
    where id=${referral.id}::uuid
  `

  return { recorded: Boolean(row), gross: Number(gross), commission: Number(commission), currency }
}
'''
    if anchor not in s:
        raise SystemExit('subscription invoice anchor missing')
    s = s.replace(anchor, anchor + affiliate, 1)

old = "    return { applied: true, organizationId, invoiceState: 'paid' }\n"
new = "    const affiliate = await recordAffiliateCommission(invoice, organizationId, subscriptionId)\n    return { applied: true, organizationId, invoiceState: 'paid', affiliate }\n"
if old in s:
    s = s.replace(old, new, 1)

required = [
    "effectivePlan === 'pro' ? 20 : effectivePlan === 'premium' ? 10 : 30",
    'async function recordAffiliateCommission(',
    'from public.affiliate_referrals r',
    'insert into public.affiliate_commissions(',
    "invoiceState: 'paid', affiliate",
]
missing = [x for x in required if x not in s]
if missing:
    raise SystemExit('webhook sync validation failed: ' + ', '.join(missing))

p.write_text(s, encoding='utf-8')
print('LISTIA billing webhook v8 repository source synchronized.')
