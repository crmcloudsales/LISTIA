import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'

const URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const DB = Deno.env.get('SUPABASE_DB_URL')!
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const sql = postgres(DB, { prepare: false })

const origins = new Set([
  'https://app.listiaapp.com',
  'https://listia-pwa.pages.dev',
  'http://localhost',
  'http://127.0.0.1',
])
const cors = (origin: string) => ({
  'access-control-allow-origin': origins.has(origin) ? origin : 'https://app.listiaapp.com',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'authorization,apikey,content-type',
  'vary': 'Origin',
})
const json = (origin: string, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...cors(origin),
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  },
})

const allowedTransitions: Record<string, string[]> = {
  new: ['active', 'qualified', 'cold', 'closed'],
  active: ['qualified', 'appointment', 'cold', 'closed'],
  qualified: ['appointment', 'cold', 'closed'],
  appointment: ['cold', 'closed'],
  cold: ['active', 'closed'],
  closed: [],
}

async function consumeRateLimit(principalId: string, organizationId: string) {
  const action = 'lead_stage_action'
  const maxRequests = 60
  const windowSeconds = 60
  const lockKey = `${principalId}:${organizationId}:${action}`
  return await sql.begin(async tx => {
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

Deno.serve(async req => {
  const origin = req.headers.get('origin') || ''
  if (req.method === 'OPTIONS') {
    return origins.has(origin)
      ? new Response(null, { status: 204, headers: cors(origin) })
      : new Response(null, { status: 403 })
  }
  if (req.method !== 'POST') return json(origin, { error: 'method_not_allowed' }, 405)
  if (origin && !origins.has(origin)) return json(origin, { error: 'origin_not_allowed' }, 403)

  const auth = req.headers.get('authorization') || ''
  const client = createClient(URL, ANON, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })
  const { data: { user } } = await client.auth.getUser()
  if (!user) return json(origin, { error: 'unauthorized' }, 401)

  const body = await req.json().catch(() => null)
  if (!body) return json(origin, { error: 'invalid_json' }, 400)

  const leadId = String(body.lead_id || '')
  const next = String(body.stage || '')
  if (!leadId || !['new', 'active', 'qualified', 'appointment', 'cold', 'closed'].includes(next)) {
    return json(origin, { error: 'invalid_stage' }, 400)
  }

  const { data: lead } = await admin.from('leads')
    .select('id,organization_id,contact_id,status,quality_score')
    .eq('id', leadId)
    .maybeSingle()
  if (!lead) return json(origin, { error: 'not_found' }, 404)

  const { data: member } = await admin.from('organization_members')
    .select('role,status')
    .eq('organization_id', lead.organization_id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (!member || !['owner', 'admin'].includes(String(member.role))) {
    return json(origin, { error: 'forbidden' }, 403)
  }

  const current = String(lead.status || 'new')
  if (current === next) return json(origin, { ok: true, status: next, unchanged: true })
  if (!(allowedTransitions[current] || []).includes(next)) {
    return json(origin, { error: 'invalid_transition', current, next }, 409)
  }

  const rate = await consumeRateLimit(user.id, lead.organization_id)
  if (!rate.allowed) return json(origin, { error: 'rate_limited', retry_after: rate.retryAfter }, 429)

  const now = new Date().toISOString()
  const { error } = await admin.from('leads')
    .update({ status: next, last_activity_at: now, updated_at: now })
    .eq('id', leadId)
    .eq('organization_id', lead.organization_id)
  if (error) return json(origin, { error: 'update_failed' }, 500)

  await admin.from('lead_events').insert({
    organization_id: lead.organization_id,
    lead_id: leadId,
    contact_id: lead.contact_id,
    event_type: 'stage_changed',
    from_stage: current,
    to_stage: next,
    quality_score: lead.quality_score,
    occurred_at: now,
    source: 'listia_office',
    metadata: { actor_user_id: user.id },
  })
  return json(origin, { ok: true, status: next })
})
