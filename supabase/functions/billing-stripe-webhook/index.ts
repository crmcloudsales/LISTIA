import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import Stripe from 'npm:stripe@22.4.0'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'

const SUPABASE_DB_URL = Deno.env.get('SUPABASE_DB_URL')!
const BILLING_ENV = String(Deno.env.get('LISTIA_BILLING_ENV') || 'test').toLowerCase()
const STRIPE_SECRET_KEY = BILLING_ENV === 'live'
  ? Deno.env.get('STRIPE_SECRET_KEY_LIVE') || ''
  : Deno.env.get('STRIPE_SECRET_KEY_TEST') || ''
const STRIPE_WEBHOOK_SECRET = BILLING_ENV === 'live'
  ? Deno.env.get('STRIPE_WEBHOOK_SECRET_LIVE') || ''
  : Deno.env.get('STRIPE_WEBHOOK_SECRET_TEST') || ''

const sql = postgres(SUPABASE_DB_URL, { prepare: false })
const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2026-07-29.dahlia' })
  : null

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function idOf(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) return String((value as { id?: unknown }).id || '') || null
  return null
}

function unixToIso(value: unknown): string | null {
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null
}

async function organizationForProvider(subscriptionId: string | null, customerId: string | null) {
  if (subscriptionId) {
    const [row] = await sql`
      select organization_id
      from private.billing_provider_state
      where provider='stripe' and environment=${BILLING_ENV}
        and provider_subscription_id=${subscriptionId}
      limit 1
    `
    if (row?.organization_id) return String(row.organization_id)
  }
  if (customerId) {
    const [row] = await sql`
      select organization_id
      from private.billing_provider_state
      where provider='stripe' and environment=${BILLING_ENV}
        and provider_customer_id=${customerId}
      limit 1
    `
    if (row?.organization_id) return String(row.organization_id)
  }
  return null
}

async function syncSubscription(subscription: Stripe.Subscription, eventId: string) {
  const subscriptionId = subscription.id
  const customerId = idOf(subscription.customer)
  const metadataOrg = String(subscription.metadata?.organization_id || '').trim() || null
  const organizationId = metadataOrg || await organizationForProvider(subscriptionId, customerId)
  if (!organizationId) return { applied: false, reason: 'organization_not_found' }

  const bindings = await sql`
    select portable_key, plan_key, provider_price_id
    from private.billing_price_bindings
    where provider='stripe' and environment=${BILLING_ENV} and active=true
  `
  const bindingByPrice = new Map(bindings.map((b: any) => [String(b.provider_price_id), b]))

  let planKey: 'free' | 'pro' | 'premium' = 'free'
  let basePortableKey: string | null = null
  let basePriceId: string | null = null
  let seatPriceId: string | null = null
  let extraSeats = 0
  let periodStart: string | null = null
  let periodEnd: string | null = null

  for (const item of subscription.items?.data || []) {
    const priceId = idOf(item.price)
    if (!priceId) continue
    const binding = bindingByPrice.get(priceId)
    if (!binding) continue

    if (binding.portable_key === 'listia_pro' || binding.portable_key === 'listia_premium') {
      planKey = binding.portable_key === 'listia_pro' ? 'pro' : 'premium'
      basePortableKey = String(binding.portable_key)
      basePriceId = priceId
      periodStart = unixToIso((item as any).current_period_start) || periodStart
      periodEnd = unixToIso((item as any).current_period_end) || periodEnd
    } else if (binding.portable_key === 'listia_premium_extra_seat') {
      seatPriceId = priceId
      extraSeats = Math.max(0, Number(item.quantity || 0))
    }
  }

  periodStart = periodStart || unixToIso((subscription as any).current_period_start)
  periodEnd = periodEnd || unixToIso((subscription as any).current_period_end)

  const status = String(subscription.status || '')
  let accessState: 'active' | 'payment_warning' | 'payment_blocked' = 'active'
  let effectivePlan = planKey

  if (status === 'past_due') accessState = 'payment_warning'
  if (status === 'unpaid' || status === 'paused') accessState = 'payment_blocked'
  if (status === 'canceled' || status === 'incomplete' || status === 'incomplete_expired' || planKey === 'free') {
    effectivePlan = 'free'
    accessState = 'active'
    extraSeats = 0
  }

  const includedSeats = effectivePlan === 'pro' ? 1 : effectivePlan === 'premium' ? 2 : 0
  const markup = effectivePlan === 'pro' ? 20 : effectivePlan === 'premium' ? 10 : 30

  await sql.begin(async (tx) => {
    await tx`
      insert into private.billing_provider_state (
        organization_id, provider, environment, provider_customer_id,
        provider_subscription_id, base_portable_key, base_provider_price_id,
        extra_seat_provider_price_id, provider_status, last_provider_event_id, updated_at
      ) values (
        ${organizationId}::uuid, 'stripe', ${BILLING_ENV}, ${customerId},
        ${subscriptionId}, ${basePortableKey}, ${basePriceId}, ${seatPriceId},
        ${status}, ${eventId}, now()
      )
      on conflict (organization_id, provider, environment) do update set
        provider_customer_id=excluded.provider_customer_id,
        provider_subscription_id=excluded.provider_subscription_id,
        base_portable_key=excluded.base_portable_key,
        base_provider_price_id=excluded.base_provider_price_id,
        extra_seat_provider_price_id=excluded.extra_seat_provider_price_id,
        provider_status=excluded.provider_status,
        last_provider_event_id=excluded.last_provider_event_id,
        updated_at=now()
    `

    await tx`
      insert into public.organization_billing (
        organization_id, plan_key, billing_status, access_state,
        included_seats, extra_seats, usage_markup_percent,
        current_period_start, current_period_end, cancel_at_period_end, updated_at
      ) values (
        ${organizationId}::uuid, ${effectivePlan}, ${status}, ${accessState},
        ${includedSeats}, ${extraSeats}, ${markup},
        ${periodStart}::timestamptz, ${periodEnd}::timestamptz,
        ${Boolean(subscription.cancel_at_period_end)}, now()
      )
      on conflict (organization_id) do update set
        plan_key=excluded.plan_key,
        billing_status=excluded.billing_status,
        access_state=excluded.access_state,
        included_seats=excluded.included_seats,
        extra_seats=excluded.extra_seats,
        usage_markup_percent=excluded.usage_markup_percent,
        current_period_start=excluded.current_period_start,
        current_period_end=excluded.current_period_end,
        cancel_at_period_end=excluded.cancel_at_period_end,
        updated_at=now()
    `
  })

  return { applied: true, organizationId, planKey: effectivePlan, status }
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice) {
  const modern = idOf((invoice as any).parent?.subscription_details?.subscription)
  return modern || idOf((invoice as any).subscription)
}

async function handleInvoice(invoice: Stripe.Invoice, eventId: string, failed: boolean) {
  if (!stripe) throw new Error('stripe_not_configured')
  const subscriptionId = subscriptionIdFromInvoice(invoice)
  if (!subscriptionId) return { applied: false, reason: 'non_subscription_invoice' }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const synced = await syncSubscription(subscription, eventId)
  if (!synced.applied) return synced

  const organizationId = synced.organizationId
  if (!failed) {
    if (synced.planKey !== 'free') {
      await sql`update public.organization_billing set access_state='active', updated_at=now() where organization_id=${organizationId}::uuid`
    }
    return { ...synced, invoiceState: 'paid' }
  }

  const billingReason = String(invoice.billing_reason || '')
  if (billingReason === 'subscription_cycle') {
    await sql`
      update public.organization_billing
      set access_state='payment_blocked', billing_status='past_due', updated_at=now()
      where organization_id=${organizationId}::uuid and plan_key <> 'free'
    `
    return { ...synced, invoiceState: 'renewal_failed', accessState: 'payment_blocked' }
  }

  await sql`
    update public.organization_billing
    set access_state='payment_warning', updated_at=now()
    where organization_id=${organizationId}::uuid and plan_key <> 'free'
  `
  return { ...synced, invoiceState: 'adjustment_failed', accessState: 'payment_warning' }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!stripe || !STRIPE_WEBHOOK_SECRET) return json({ error: 'stripe_webhook_not_configured' }, 503)

  const signature = req.headers.get('stripe-signature') || ''
  if (!signature) return json({ error: 'stripe_signature_required' }, 400)

  const payload = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, STRIPE_WEBHOOK_SECRET)
  } catch (error) {
    console.error('billing-stripe-webhook signature', error)
    return json({ error: 'invalid_signature' }, 400)
  }

  const eventId = event.id
  const eventType = event.type
  const objectId = idOf(event.data?.object)

  const [eventRow] = await sql`
    insert into private.billing_provider_events (
      provider, environment, provider_event_id, event_type,
      provider_object_id, processing_status, received_at
    ) values (
      'stripe', ${BILLING_ENV}, ${eventId}, ${eventType},
      ${objectId}, 'failed', now()
    )
    on conflict (provider, environment, provider_event_id) do update
      set received_at=excluded.received_at
    returning id, processing_status
  `
  if (eventRow?.processing_status === 'processed' || eventRow?.processing_status === 'ignored') {
    return json({ received: true, duplicate: true })
  }

  try {
    let result: any = { applied: false, reason: 'event_ignored' }

    if (eventType === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const subscriptionId = idOf(session.subscription)
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        result = await syncSubscription(subscription, eventId)
      }
    } else if (
      eventType === 'customer.subscription.created' ||
      eventType === 'customer.subscription.updated' ||
      eventType === 'customer.subscription.deleted'
    ) {
      result = await syncSubscription(event.data.object as Stripe.Subscription, eventId)
    } else if (eventType === 'invoice.paid') {
      result = await handleInvoice(event.data.object as Stripe.Invoice, eventId, false)
    } else if (eventType === 'invoice.payment_failed') {
      result = await handleInvoice(event.data.object as Stripe.Invoice, eventId, true)
    }

    const processingStatus = result?.reason === 'event_ignored' ? 'ignored' : 'processed'
    await sql`
      update private.billing_provider_events
      set processing_status=${processingStatus}, processed_at=now(), error_message=null
      where provider='stripe' and environment=${BILLING_ENV} and provider_event_id=${eventId}
    `
    return json({ received: true, ...result })
  } catch (error) {
    console.error('billing-stripe-webhook processing', eventId, eventType, error)
    await sql`
      update private.billing_provider_events
      set processing_status='failed', processed_at=now(), error_message=${String((error as Error)?.message || error).slice(0, 1000)}
      where provider='stripe' and environment=${BILLING_ENV} and provider_event_id=${eventId}
    `
    return json({ error: 'webhook_processing_failed' }, 500)
  }
})
