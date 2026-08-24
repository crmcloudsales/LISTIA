import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'

const SUPABASE_DB_URL = Deno.env.get('SUPABASE_DB_URL')!
const BILLING_ENV = String(Deno.env.get('LISTIA_BILLING_ENV') || 'test').toLowerCase()
const sql = postgres(SUPABASE_DB_URL, { prepare: false })

const portableByLookupKey = new Map([
  ['listia_pro_monthly_usd', 'listia_pro'],
  ['listia_premium_monthly_usd', 'listia_premium'],
  ['listia_premium_extra_seat_monthly_usd', 'listia_premium_extra_seat'],
])

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function idOf(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id?: unknown }).id || '') || null
  }
  return null
}

function unixToIso(value: unknown): string | null {
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null
}

async function getWebhookSecret() {
  const envName = BILLING_ENV === 'live' ? 'STRIPE_WEBHOOK_SECRET_LIVE' : 'STRIPE_WEBHOOK_SECRET_TEST'
  const direct = String(Deno.env.get(envName) || '')
  if (direct) return direct

  const vaultName = BILLING_ENV === 'live' ? 'stripe_webhook_secret_live' : 'stripe_webhook_secret_test'
  try {
    const [row] = await sql`
      select decrypted_secret
      from vault.decrypted_secrets
      where name=${vaultName}
      limit 1
    `
    return String(row?.decrypted_secret || '')
  } catch {
    return ''
  }
}

function constantTimeHexEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function verifyStripeSignature(payload: string, header: string, secret: string) {
  const fields = header.split(',').map((part) => part.trim())
  const timestamp = fields.find((part) => part.startsWith('t='))?.slice(2) || ''
  const signatures = fields.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3))
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || signatures.length === 0) return false
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return false

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)))
  const expected = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return signatures.some((signature) => constantTimeHexEqual(signature, expected))
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

async function syncCheckoutSession(session: any, eventId: string) {
  const organizationId = String(session?.metadata?.organization_id || session?.client_reference_id || '').trim()
  if (!organizationId) return { applied: false, reason: 'organization_not_found' }
  const customerId = idOf(session?.customer)
  const subscriptionId = idOf(session?.subscription)

  await sql`
    insert into private.billing_provider_state (
      organization_id, provider, environment, provider_customer_id,
      provider_subscription_id, provider_status, last_provider_event_id, updated_at
    ) values (
      ${organizationId}::uuid, 'stripe', ${BILLING_ENV}, ${customerId},
      ${subscriptionId}, 'checkout_complete', ${eventId}, now()
    )
    on conflict (organization_id, provider, environment) do update set
      provider_customer_id=coalesce(excluded.provider_customer_id, private.billing_provider_state.provider_customer_id),
      provider_subscription_id=coalesce(excluded.provider_subscription_id, private.billing_provider_state.provider_subscription_id),
      last_provider_event_id=excluded.last_provider_event_id,
      updated_at=now()
  `
  return { applied: true, organizationId, reason: 'checkout_recorded' }
}

async function loadBindingMap() {
  const bindings = await sql`
    select portable_key, provider_price_id
    from private.billing_price_bindings
    where provider='stripe' and environment=${BILLING_ENV} and active=true
  `
  return new Map(bindings.map((binding: any) => [String(binding.provider_price_id), String(binding.portable_key)]))
}

function portableKeyForPrice(price: any, priceId: string, bindingByPrice: Map<string, string>) {
  const metadataPortable = String(price?.metadata?.portable_key || '')
  if (['listia_pro','listia_premium','listia_premium_extra_seat'].includes(metadataPortable)) return metadataPortable

  const lookupKey = String(price?.lookup_key || '')
  const lookupPortable = portableByLookupKey.get(lookupKey)
  if (lookupPortable) return lookupPortable

  return bindingByPrice.get(priceId) || null
}

async function syncSubscription(subscription: any, eventId: string) {
  const subscriptionId = String(subscription?.id || '')
  const customerId = idOf(subscription?.customer)
  const metadataOrg = String(subscription?.metadata?.organization_id || '').trim() || null
  const organizationId = metadataOrg || await organizationForProvider(subscriptionId || null, customerId)
  if (!organizationId) return { applied: false, reason: 'organization_not_found' }

  const bindingByPrice = await loadBindingMap()

  let planKey: 'free' | 'pro' | 'premium' = 'free'
  let basePortableKey: string | null = null
  let basePriceId: string | null = null
  let seatPriceId: string | null = null
  let extraSeats = 0
  let periodStart: string | null = null
  let periodEnd: string | null = null

  for (const item of subscription?.items?.data || []) {
    const priceId = idOf(item?.price)
    if (!priceId) continue
    const portableKey = portableKeyForPrice(item?.price, priceId, bindingByPrice)
    if (!portableKey) continue

    if (portableKey === 'listia_pro' || portableKey === 'listia_premium') {
      planKey = portableKey === 'listia_pro' ? 'pro' : 'premium'
      basePortableKey = portableKey
      basePriceId = priceId
      periodStart = unixToIso(item?.current_period_start) || periodStart
      periodEnd = unixToIso(item?.current_period_end) || periodEnd
    } else if (portableKey === 'listia_premium_extra_seat') {
      seatPriceId = priceId
      extraSeats = Math.max(0, Number(item?.quantity || 0))
    }
  }

  periodStart = periodStart || unixToIso(subscription?.current_period_start)
  periodEnd = periodEnd || unixToIso(subscription?.current_period_end)

  const status = String(subscription?.status || '')
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
        provider_customer_id=coalesce(excluded.provider_customer_id, private.billing_provider_state.provider_customer_id),
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
        ${Boolean(subscription?.cancel_at_period_end)}, now()
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

function subscriptionIdFromInvoice(invoice: any) {
  return idOf(invoice?.parent?.subscription_details?.subscription) || idOf(invoice?.subscription)
}

async function handleInvoice(invoice: any, failed: boolean) {
  const subscriptionId = subscriptionIdFromInvoice(invoice)
  const customerId = idOf(invoice?.customer)
  const metadataOrg = String(invoice?.parent?.subscription_details?.metadata?.organization_id || '').trim() || null
  const organizationId = metadataOrg || await organizationForProvider(subscriptionId, customerId)
  if (!organizationId) return { applied: false, reason: 'organization_not_found' }

  if (!failed) {
    await sql`
      update public.organization_billing
      set access_state='active', billing_status=case when plan_key='free' then billing_status else 'active' end, updated_at=now()
      where organization_id=${organizationId}::uuid
    `
    return { applied: true, organizationId, invoiceState: 'paid' }
  }

  const billingReason = String(invoice?.billing_reason || '')
  if (billingReason === 'subscription_cycle') {
    await sql`
      update public.organization_billing
      set access_state='payment_blocked', billing_status='past_due', updated_at=now()
      where organization_id=${organizationId}::uuid and plan_key <> 'free'
    `
    return { applied: true, organizationId, invoiceState: 'renewal_failed', accessState: 'payment_blocked' }
  }

  await sql`
    update public.organization_billing
    set access_state='payment_warning', updated_at=now()
    where organization_id=${organizationId}::uuid and plan_key <> 'free'
  `
  return { applied: true, organizationId, invoiceState: 'adjustment_failed', accessState: 'payment_warning' }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const signature = req.headers.get('stripe-signature') || ''
  if (!signature) return json({ error: 'stripe_signature_required' }, 400)

  const payload = await req.text()
  const webhookSecret = await getWebhookSecret()
  if (!webhookSecret) return json({ error: 'stripe_webhook_not_configured' }, 503)
  if (!(await verifyStripeSignature(payload, signature, webhookSecret))) {
    return json({ error: 'invalid_signature' }, 400)
  }

  let event: any
  try {
    event = JSON.parse(payload)
  } catch {
    return json({ error: 'invalid_payload' }, 400)
  }

  const eventId = String(event?.id || '')
  const eventType = String(event?.type || '')
  const objectId = idOf(event?.data?.object)
  if (!eventId || !eventType) return json({ error: 'invalid_event' }, 400)

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
      result = await syncCheckoutSession(event.data.object, eventId)
    } else if (
      eventType === 'customer.subscription.created' ||
      eventType === 'customer.subscription.updated' ||
      eventType === 'customer.subscription.deleted'
    ) {
      result = await syncSubscription(event.data.object, eventId)
    } else if (eventType === 'invoice.paid') {
      result = await handleInvoice(event.data.object, false)
    } else if (eventType === 'invoice.payment_failed') {
      result = await handleInvoice(event.data.object, true)
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
