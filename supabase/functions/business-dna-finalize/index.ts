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

const supportedLocales = new Set(['es','en','fr','it','pt-BR','de','ar-AE'])

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

    const body = await req.json().catch(() => ({})) as { organization_id?: string; locale?: string }
    if (!body.organization_id) return json(req, { error: 'organization_id_required' }, 400)

    const { data: member } = await admin.from('organization_members')
      .select('organization_id,role,status')
      .eq('organization_id', body.organization_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (!member || !['owner','admin'].includes(member.role)) return json(req, { error: 'organization_access_denied' }, 403)

    const rateLimit = await consumeSecurityRateLimit(user.id, body.organization_id, 'business_dna_finalize', 5, 60)
    if (!rateLimit.allowed) {
      return json(req, { error: 'rate_limited', retry_after: rateLimit.retryAfter }, 429)
    }

    const [org] = await sql`
      select id,name,business_type,primary_market,country_code,timezone,onboarding_completed
      from public.organizations where id=${body.organization_id}::uuid limit 1
    `
    if (!org) return json(req, { error: 'organization_not_found' }, 404)

    const [onboarding] = await sql`
      select selected_plan,discovery_inputs,business_dna,validation_state,completed_steps
      from public.organization_onboarding where organization_id=${body.organization_id}::uuid limit 1
    `
    if (!onboarding) return json(req, { error: 'onboarding_not_found' }, 404)

    const [billing] = await sql`
      select plan_key,billing_status,access_state,included_seats,extra_seats,usage_markup_percent
      from public.organization_billing
      where organization_id=${body.organization_id}::uuid
      limit 1
    `

    const [discovery] = await sql`
      select count(*)::int as total,
             count(*) filter (where selected)::int as selected,
             coalesce(jsonb_agg(distinct source_type) filter (where selected), '[]'::jsonb) as sources
      from public.discovery_items where organization_id=${body.organization_id}::uuid
    `
    const connections = await sql`
      select provider,status,external_account_email
      from public.integration_connections
      where organization_id=${body.organization_id}::uuid and status='connected'
      order by provider
    `

    const requestedLocale = String(body.locale || '')
    const locale = supportedLocales.has(requestedLocale) ? requestedLocale : 'es'
    const now = new Date().toISOString()
    const effectivePlan = String(billing?.plan_key || 'free')

    const baseline = {
      version: 2,
      status: 'baseline',
      generated_from: ['business_identity','effective_billing','connected_ecosystems','discovery'],
      business: {
        name: org.name,
        type: org.business_type,
        primary_market: org.primary_market,
        country_code: org.country_code || null,
        timezone: org.timezone || 'UTC',
      },
      language: locale,
      plan_intent: onboarding.selected_plan || 'free',
      effective_plan: effectivePlan,
      billing: {
        status: billing?.billing_status || 'free',
        access_state: billing?.access_state || 'active',
        included_seats: Number(billing?.included_seats || 0),
        extra_seats: Number(billing?.extra_seats || 0),
        usage_markup_percent: Number(billing?.usage_markup_percent ?? 30),
      },
      connected_ecosystems: connections.map((c: any) => c.provider),
      discovery: {
        total_items: discovery?.total || 0,
        selected_items: discovery?.selected || 0,
        sources: discovery?.sources || [],
      },
      enrichment_status: 'continuous',
      needs_enrichment: true,
      updated_at: now,
    }
    const validation = {
      ...(onboarding.validation_state || {}),
      business_dna_baseline_confirmed: true,
      confirmed_at: now,
      confirmed_by: user.id,
    }

    await sql.begin(async (tx) => {
      await tx`
        update public.organization_onboarding
        set current_step=5,
            completed_steps=(select array_agg(distinct x order by x) from unnest(completed_steps || array[4::smallint,5::smallint]) x),
            business_dna=coalesce(business_dna,'{}'::jsonb) || ${JSON.stringify(baseline)}::jsonb,
            validation_state=${JSON.stringify(validation)}::jsonb,
            updated_at=now()
        where organization_id=${body.organization_id}::uuid
      `
      await tx`
        update public.organizations
        set onboarding_completed=true, updated_at=now()
        where id=${body.organization_id}::uuid
      `
    })

    return json(req, { ok: true, onboarding_completed: true, business_dna: baseline })
  } catch (error) {
    console.error('business-dna-finalize', error)
    return json(req, { error: 'internal_error' }, 500)
  }
})