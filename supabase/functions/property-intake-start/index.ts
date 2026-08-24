import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_DB_URL = Deno.env.get('SUPABASE_DB_URL')!
const sql = postgres(SUPABASE_DB_URL, { prepare: false })

type RateLimitDecision = { allowed: boolean; retryAfter: number }

async function consumeSecurityRateLimit(
  principalId: string,
  organizationId: string,
  action: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<RateLimitDecision> {
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
            when private.security_rate_limits.window_started_at <= now() - (${windowSeconds} * interval '1 second')
              then now()
            else private.security_rate_limits.window_started_at
          end,
          request_count = case
            when private.security_rate_limits.window_started_at <= now() - (${windowSeconds} * interval '1 second')
              then 1
            else private.security_rate_limits.request_count + 1
          end,
          updated_at = now()
      returning request_count,
        greatest(
          1,
          ceil(extract(epoch from (
            window_started_at + (${windowSeconds} * interval '1 second') - now()
          )))
        )::int as retry_after
    `
    const requestCount = Number(bucket?.request_count || 1)
    return {
      allowed: requestCount <= maxRequests,
      retryAfter: Math.max(1, Number(bucket?.retry_after || windowSeconds)),
    }
  })
}

const allowedOrigins = new Set([
  'https://listia-pwa.pages.dev',
  'https://app.listiaapp.com',
  'https://listiaapp.com',
  'https://www.listiaapp.com',
])

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
function clean(value: unknown, max = 2000) {
  if (typeof value !== 'string') return null
  const v = value.trim()
  return v ? v.slice(0, max) : null
}

function normalizeLocale(value: unknown) {
  const raw = String(value || '').trim().toLowerCase()
  const aliases: Record<string,string> = {
    es: 'es', 'es-mx': 'es', en: 'en', 'en-us': 'en', 'en-gb': 'en',
    fr: 'fr', 'fr-fr': 'fr', 'fr-ca': 'fr', it: 'it', 'it-it': 'it',
    pt: 'pt-BR', 'pt-br': 'pt-BR', 'pt-pt': 'pt-BR', de: 'de', 'de-de': 'de',
    ar: 'ar-AE', 'ar-ae': 'ar-AE',
  }
  return aliases[raw] || 'es'
}

function fallbackTitle(locale: string) {
  if (locale === 'en') return 'Property in preparation'
  if (locale === 'fr') return 'Bien en préparation'
  if (locale === 'it') return 'Proprietà in preparazione'
  if (locale === 'pt-BR') return 'Imóvel em preparação'
  if (locale === 'de') return 'Immobilie in Vorbereitung'
  if (locale === 'ar-AE') return 'عقار قيد التجهيز'
  return 'Propiedad en preparación'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) })
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405)

  try {
    const origin = req.headers.get('origin') || ''
    if (origin && !allowedOrigins.has(origin)) return json(req, { error: 'origin_not_allowed' }, 403)

    const authHeader = req.headers.get('authorization') || ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    if (!jwt) return json(req, { error: 'unauthorized' }, 401)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: userData, error: userError } = await admin.auth.getUser(jwt)
    const user = userData?.user
    if (userError || !user) return json(req, { error: 'unauthorized' }, 401)

    const body = await req.json().catch(() => ({})) as {
      organization_id?: string
      operation_type?: string
      description?: string
      price?: string | number | null
      currency?: string
      commission_text?: string
      location_text?: string
      postal_code?: string
      locale?: string
      has_files?: boolean
    }
    if (!body.organization_id) return json(req, { error: 'organization_id_required' }, 400)

    const { data: member } = await admin.from('organization_members')
      .select('organization_id,role,status')
      .eq('organization_id', body.organization_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (!member) return json(req, { error: 'organization_access_denied' }, 403)

    const rateLimit = await consumeSecurityRateLimit(user.id, body.organization_id, 'property_intake_start', 5, 60)
    if (!rateLimit.allowed) {
      return json(req, { error: 'rate_limited', retry_after: rateLimit.retryAfter }, 429)
    }

    const [org] = await sql`
      select id,name,onboarding_completed
      from public.organizations where id=${body.organization_id}::uuid limit 1
    `
    if (!org) return json(req, { error: 'organization_not_found' }, 404)
    if (!org.onboarding_completed) return json(req, { error: 'onboarding_not_completed' }, 409)

    const [billing] = await sql`
      select plan_key, access_state
      from public.organization_billing
      where organization_id=${body.organization_id}::uuid
      limit 1
    `
    const plan = String(billing?.plan_key || 'free').toLowerCase()
    const accessState = String(billing?.access_state || 'active').toLowerCase()
    if (accessState === 'payment_blocked') {
      return json(req, { error: 'billing_payment_blocked', plan }, 402)
    }

    const [counts] = await sql`
      select count(*)::int as total
      from public.properties
      where organization_id=${body.organization_id}::uuid and status <> 'archived'
    `
    if (plan === 'free' && Number(counts?.total || 0) >= 1) {
      return json(req, { error: 'free_property_limit', limit: 1 }, 409)
    }

    const operation = ['sale','rent'].includes(String(body.operation_type || '')) ? String(body.operation_type) : null
    const description = clean(body.description, 12000)
    const location = clean(body.location_text, 300)
    const postal = clean(body.postal_code, 30)
    const commission = clean(body.commission_text, 120)
    const currency = clean(body.currency, 8)?.toUpperCase() || null
    const locale = normalizeLocale(body.locale)
    const rawPrice = body.price === '' || body.price === null || body.price === undefined ? null : Number(body.price)
    const price = rawPrice !== null && Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : null

    if (!body.has_files && !description && !location && price === null) {
      return json(req, { error: 'material_required' }, 400)
    }

    const baseTitle = fallbackTitle(locale)
    const title = location ? `${baseTitle} · ${location}`.slice(0, 220) : baseTitle

    const [property] = await sql`
      insert into public.properties
        (organization_id,created_by,title,operation_type,description,price,currency,commission_text,location_text,postal_code,status,processing_state,locale)
      values
        (${body.organization_id}::uuid,${user.id}::uuid,${title},${operation},${description},${price},${currency},${commission},${location},${postal},'material_received',${JSON.stringify({stage:'material_intake', received_at:new Date().toISOString()})}::jsonb,${locale})
      returning id,title,status,operation_type,description,price,currency,commission_text,location_text,postal_code,locale,created_at
    `

    return json(req, { ok: true, property, plan, access_state: accessState })
  } catch (error) {
    console.error('property-intake-start', error)
    return json(req, { error: 'internal_error' }, 500)
  }
})