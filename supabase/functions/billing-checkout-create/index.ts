import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@22.4.0'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_DB_URL = Deno.env.get('SUPABASE_DB_URL')!
const BILLING_ENV = String(Deno.env.get('LISTIA_BILLING_ENV') || 'test').toLowerCase()
const sql = postgres(SUPABASE_DB_URL, { prepare: false })

const allowedOrigins = new Set([
  'https://listia-pwa.pages.dev',
  'https://app.listiaapp.com',
  'https://listiaapp.com',
  'https://www.listiaapp.com',
])

const priceLookup = {
  listia_pro: 'listia_pro_monthly_usd',
  listia_premium: 'listia_premium_monthly_usd',
  listia_premium_extra_seat: 'listia_premium_extra_seat_monthly_usd',
} as const

function cors(req: Request) {
  const origin = req.headers.get('origin') || ''
  return {
    'access-control-allow-origin': allowedOrigins.has(origin) ? origin : 'https://listia-pwa.pages.dev',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'vary': 'Origin',
  }
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function activeStripeSecret() {
  if (BILLING_ENV === 'live') {
    return Deno.env.get('STRIPE_RESTRICTED_KEY_LIVE') || Deno.env.get('STRIPE_SECRET_KEY_LIVE') || ''
  }
  return Deno.env.get('STRIPE_RESTRICTED_KEY_TEST') || Deno.env.get('STRIPE_SECRET_KEY_TEST') || ''
}

function randomLetters(length = 8) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

async function consumeRateLimit(principalId: string, organizationId: string) {
  const action = 'billing_checkout_create'
  const maxRequests = 8
  const windowSeconds = 60
  const lockKey = `${principalId}:${organizationId}:${action}`
  return await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`
    const [bucket] = await tx`
      insert into private.security_rate_limits
        (principal_id, organization_id, action, window_started_at, request_count, updated_at)
      values
        (${principalId}::uuid, ${organizationId}::uuid, ${action}, now(), 1, now())
      on conflict (principal_id, organization_id, action) do update
      set window_started_at = case
            when private.security_rate_limits.window_started_at <= now() - (${windowSeconds} * interval '1 second') then now()
            else private.security_rate_limits.window_started_at
          end,
          request_count = case
            when private.security_rate_limits.window_started_at <= now() - (${windowSeconds} * interval '1 second') then 1
            else private.security_rate_limits.request_count + 1
          end,
          updated_at = now()
      returning request_count,
        greatest(1, ceil(extract(epoch from (window_started_at + (${windowSeconds} * interval '1 second') - now()))))::int as retry_after
    `
    return {
      allowed: Number(bucket?.request_count || 1) <= maxRequests,
      retryAfter: Math.max(1, Number(bucket?.retry_after || windowSeconds)),
    }
  })
}

async function resolvePriceId(
  stripe: Stripe,
  portableKey: keyof typeof priceLookup,
): Promise<string | null> {
  const [binding] = await sql`
    select provider_price_id
    from private.billing_price_bindings
    where provider='stripe'
      and environment=${BILLING_ENV}
      and portable_key=${portableKey}
      and active=true
    limit 1
  `
  if (binding?.provider_price_id) return String(binding.provider_price_id)

  const lookupKey = priceLookup[portableKey]
  const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 10 })
  const match = prices.data.find((price) => {
    const metadata = price.metadata || {}
    return price.lookup_key === lookupKey &&
      price.currency === 'usd' &&
      price.type === 'recurring' &&
      price.recurring?.interval === 'month' &&
      (metadata.product_family === 'listia' || metadata.portable_key === portableKey)
  })
  return match?.id || null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) })
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405)

  try {
    const origin = req.headers.get('origin') || ''
    if (origin && !allowedOrigins.has(origin)) return json(req, { error: 'origin_not_allowed' }, 403)
    if (!['test', 'live'].includes(BILLING_ENV)) return json(req, { error: 'billing_environment_invalid' }, 503)

    const stripeSecret = activeStripeSecret()
    if (!stripeSecret) return json(req, { error: 'stripe_not_configured', environment: BILLING_ENV }, 503)
    const stripe = new Stripe(stripeSecret, { apiVersion: '2026-07-29.dahlia' })

    const authHeader = req.headers.get('authorization') || ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    if (!jwt) return json(req, { error: 'unauthorized' }, 401)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: userError } = await admin.auth.getUser(jwt)
    const user = userData?.user
    if (userError || !user) return json(req, { error: 'unauthorized' }, 401)

    const body = await req.json().catch(() => ({})) as {
      organization_id?: string
      plan?: string
      extra_seats?: number
    }
    const organizationId = String(body.organization_id || '')
    const plan = String(body.plan || '').toLowerCase()
    const extraSeats = Number.isInteger(body.extra_seats) ? Number(body.extra_seats) : 0

    if (!organizationId) return json(req, { error: 'organization_id_required' }, 400)
    if (!['pro', 'premium'].includes(plan)) return json(req, { error: 'paid_plan_required' }, 400)
    if (extraSeats < 0 || extraSeats > 100) return json(req, { error: 'extra_seats_invalid' }, 400)
    if (plan === 'pro' && extraSeats !== 0) return json(req, { error: 'extra_seats_premium_only' }, 400)

    const { data: member } = await admin.from('organization_members')
      .select('role,status')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (!member || !['owner', 'admin'].includes(String(member.role))) {
      return json(req, { error: 'billing_admin_required' }, 403)
    }

    const rateLimit = await consumeRateLimit(user.id, organizationId)
    if (!rateLimit.allowed) return json(req, { error: 'rate_limited', retry_after: rateLimit.retryAfter }, 429)

    await sql`
      insert into public.organization_billing
        (organization_id, plan_key, billing_status, access_state, included_seats, extra_seats, usage_markup_percent)
      values
        (${organizationId}::uuid, 'free', 'free', 'active', 0, 0, 30)
      on conflict (organization_id) do nothing
    `

    const [providerState] = await sql`
      select provider_customer_id, provider_subscription_id, provider_status
      from private.billing_provider_state
      where organization_id=${organizationId}::uuid
        and provider='stripe'
        and environment=${BILLING_ENV}
      limit 1
    `
    if (providerState?.provider_subscription_id && ['active','trialing','past_due','unpaid'].includes(String(providerState?.provider_status || ''))) {
      return json(req, { error: 'subscription_already_exists' }, 409)
    }

    const basePortableKey = plan === 'pro' ? 'listia_pro' : 'listia_premium'
    const basePriceId = await resolvePriceId(stripe, basePortableKey)
    if (!basePriceId) return json(req, { error: 'billing_price_not_found', portable_key: basePortableKey }, 503)

    let seatPriceId: string | null = null
    if (plan === 'premium' && extraSeats > 0) {
      seatPriceId = await resolvePriceId(stripe, 'listia_premium_extra_seat')
      if (!seatPriceId) return json(req, { error: 'billing_price_not_found', portable_key: 'listia_premium_extra_seat' }, 503)
    }

    let customerId = providerState?.provider_customer_id || null
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: String(user.user_metadata?.full_name || '').slice(0, 120) || undefined,
        metadata: {
          product_family: 'listia',
          organization_id: organizationId,
          supabase_user_id: user.id,
        },
      })
      customerId = customer.id
      await sql`
        insert into private.billing_provider_state
          (organization_id, provider, environment, provider_customer_id, updated_at)
        values
          (${organizationId}::uuid, 'stripe', ${BILLING_ENV}, ${customerId}, now())
        on conflict (organization_id, provider, environment) do update
        set provider_customer_id=excluded.provider_customer_id,
            updated_at=now()
      `
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: basePriceId, quantity: 1 },
    ]
    if (seatPriceId && extraSeats > 0) lineItems.push({ price: seatPriceId, quantity: extraSeats })

    const returnOrigin = allowedOrigins.has(origin) ? origin : 'https://app.listiaapp.com'
    const integrationIdentifier = `listia_sub_${randomLetters(8)}`
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ui_mode: 'embedded_page',
      customer: customerId,
      client_reference_id: organizationId,
      line_items: lineItems,
      return_url: `${returnOrigin}/?billing=return&session_id={CHECKOUT_SESSION_ID}`,
      integration_identifier: integrationIdentifier,
      metadata: {
        product_family: 'listia',
        organization_id: organizationId,
        plan_key: plan,
        extra_seats: String(extraSeats),
      },
      subscription_data: {
        metadata: {
          product_family: 'listia',
          organization_id: organizationId,
          plan_key: plan,
        },
      },
    } as Stripe.Checkout.SessionCreateParams)

    if (!session.client_secret) return json(req, { error: 'checkout_client_secret_missing' }, 502)
    return json(req, {
      ok: true,
      environment: BILLING_ENV,
      client_secret: session.client_secret,
      session_id: session.id,
    })
  } catch (error) {
    console.error('billing-checkout-create', error)
    return json(req, { error: 'internal_error' }, 500)
  }
})
