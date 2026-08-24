import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_DB_URL = Deno.env.get('SUPABASE_DB_URL')!
const sql = postgres(SUPABASE_DB_URL, { prepare: false })

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

const allowedTiers = new Set(['q0','q1','q2','q3','q4'])
const allowedTasks = new Set([
  'property_extract','flyer_copy','flyer_render','advisor_identity_preserve',
  'property_fidelity_preserve','video_generate','quality_review',
])

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) })
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405)

  try {
    const origin = req.headers.get('origin') || ''
    if (origin && !allowedOrigins.has(origin)) return json(req, { error: 'origin_not_allowed' }, 403)

    const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (!jwt) return json(req, { error: 'unauthorized' }, 401)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: userError } = await admin.auth.getUser(jwt)
    const user = userData?.user
    if (userError || !user) return json(req, { error: 'unauthorized' }, 401)

    const body = await req.json().catch(() => ({})) as {
      organization_id?: string
      property_id?: string
      task_type?: string
      quality_tier?: string
    }

    const organizationId = String(body.organization_id || '').trim()
    const propertyId = String(body.property_id || '').trim() || null
    const taskType = String(body.task_type || '').trim()
    const qualityTier = String(body.quality_tier || 'q2').trim().toLowerCase()

    if (!organizationId) return json(req, { error: 'organization_id_required' }, 400)
    if (!allowedTasks.has(taskType)) return json(req, { error: 'task_type_invalid' }, 400)
    if (!allowedTiers.has(qualityTier)) return json(req, { error: 'quality_tier_invalid' }, 400)

    const { data: member } = await admin.from('organization_members')
      .select('role,status')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (!member) return json(req, { error: 'organization_access_denied' }, 403)

    if (propertyId) {
      const [property] = await sql`
        select id from public.properties
        where id=${propertyId}::uuid and organization_id=${organizationId}::uuid
        limit 1
      `
      if (!property?.id) return json(req, { error: 'property_not_found' }, 404)
    }

    const [policy] = await sql`
      select task_type, quality_tier, strategy, primary_models, reviewer_models,
             fallback_models, required_validators, max_parallel, max_attempts,
             escalate_on_failure, cost_ceiling_usd, notes
      from private.ai_route_policies
      where task_type=${taskType} and quality_tier=${qualityTier} and active=true
      limit 1
    `
    if (!policy) return json(req, { error: 'route_policy_not_found', task_type: taskType, quality_tier: qualityTier }, 404)

    const primary = (policy.primary_models || []).map(String)
    const reviewers = (policy.reviewer_models || []).map(String)
    const fallbacks = (policy.fallback_models || []).map(String)
    const modelKeys = unique([...primary, ...reviewers, ...fallbacks])

    let modelRows: any[] = []
    if (modelKeys.length) {
      modelRows = await sql`
        select m.model_key, m.provider_key, m.provider_model_id, m.display_name,
               m.lifecycle_status, m.input_modalities, m.output_modalities,
               m.route_tags, m.capabilities, m.deprecation_risk,
               p.provider_type, p.lifecycle_status as provider_status,
               p.direct_api_available,
               p.capabilities as provider_capabilities
        from private.ai_models m
        join private.ai_providers p on p.provider_key=m.provider_key
        where m.model_key = any(${modelKeys}::text[])
      `
    }

    const scoreRows = modelKeys.length ? await sql`
      select distinct on (model_key) model_key, benchmark_version, sample_count,
             accepted_rate, quality_score, factual_score, text_accuracy_score,
             identity_fidelity_score, property_fidelity_score, latency_p50_ms,
             cost_per_accepted_output
      from private.ai_model_scores
      where task_type=${taskType} and model_key = any(${modelKeys}::text[])
      order by model_key, benchmark_version desc
    ` : []

    const scoreByModel = new Map(scoreRows.map((row: any) => [String(row.model_key), row]))
    const byKey = new Map(modelRows.map((row: any) => [String(row.model_key), row]))

    function routeEntry(modelKey: string, role: 'primary'|'reviewer'|'fallback') {
      const model = byKey.get(modelKey)
      if (!model) return { model_key: modelKey, role, eligible: false, reason: 'model_not_registered' }
      const modelStatus = String(model.lifecycle_status || '')
      const providerStatus = String(model.provider_status || '')
      const blocked = ['deprecated','removed'].includes(modelStatus) || ['deprecated','removed'].includes(providerStatus)
      const verifiedVia = String(model.capabilities?.verified_via || '') || null
      const executionSurface = model.direct_api_available ? String(model.provider_key) : verifiedVia
      const eligible = !blocked && Boolean(executionSurface || model.direct_api_available)
      return {
        model_key: modelKey,
        provider_key: model.provider_key,
        provider_model_id: model.provider_model_id,
        display_name: model.display_name,
        role,
        eligible,
        execution_surface: executionSurface,
        direct_api_available: Boolean(model.direct_api_available),
        lifecycle_status: modelStatus,
        deprecation_risk: model.deprecation_risk,
        benchmark: scoreByModel.get(modelKey) || null,
        reason: blocked ? 'deprecated_or_removed' : eligible ? 'policy_candidate' : 'execution_surface_not_ready',
      }
    }

    const plan = {
      primary: primary.map((key: string) => routeEntry(key, 'primary')),
      reviewers: reviewers.map((key: string) => routeEntry(key, 'reviewer')),
      fallbacks: fallbacks.map((key: string) => routeEntry(key, 'fallback')),
    }

    const strategy = String(policy.strategy)
    const deterministicOnly = strategy === 'deterministic_only'
    const eligiblePrimary = plan.primary.filter((entry: any) => entry.eligible)
    const routable = deterministicOnly || eligiblePrimary.length > 0

    return json(req, {
      ok: true,
      routable,
      organization_id: organizationId,
      property_id: propertyId,
      task_type: taskType,
      quality_tier: qualityTier,
      strategy,
      required_validators: policy.required_validators || [],
      max_parallel: Number(policy.max_parallel || 1),
      max_attempts: Number(policy.max_attempts || 1),
      escalate_on_failure: Boolean(policy.escalate_on_failure),
      cost_ceiling_usd: policy.cost_ceiling_usd,
      plan,
      release_gate: deterministicOnly
        ? 'deterministic_validators_required'
        : 'provider_output_must_pass_required_validators',
      notes: policy.notes || null,
    })
  } catch (error) {
    console.error('ai-route-plan', error)
    return json(req, { error: 'internal_error' }, 500)
  }
})
