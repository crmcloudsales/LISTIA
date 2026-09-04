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
    'access-control-allow-origin': allowedOrigins.has(origin) ? origin : 'https://app.listiaapp.com',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'vary': 'Origin',
  }
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(req),
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  })
}

async function consumeRateLimit(principalId: string, organizationId: string) {
  const action = 'property_lifecycle_action'
  const maxRequests = 20
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
    return {
      allowed: Number(bucket?.request_count || 1) <= maxRequests,
      retryAfter: Math.max(1, Number(bucket?.retry_after || windowSeconds)),
    }
  })
}

const RESTORABLE = new Set(['material_received', 'processing', 'needs_info', 'ready', 'error'])

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

    const body = await req.json().catch(() => null) as null | {
      organization_id?: string
      property_id?: string
      action?: string
    }
    if (!body) return json(req, { error: 'invalid_json' }, 400)

    const organizationId = String(body.organization_id || '')
    const propertyId = String(body.property_id || '')
    const action = String(body.action || '')
    if (!organizationId || !propertyId || !['archive', 'restore'].includes(action)) {
      return json(req, { error: 'invalid_action' }, 400)
    }

    const { data: member } = await admin.from('organization_members')
      .select('role,status')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (!member || !['owner', 'admin'].includes(String(member.role || ''))) {
      return json(req, { error: 'owner_or_admin_required' }, 403)
    }

    const rate = await consumeRateLimit(user.id, organizationId)
    if (!rate.allowed) return json(req, { error: 'rate_limited', retry_after: rate.retryAfter }, 429)

    const result = await sql.begin(async tx => {
      const [property] = await tx`
        select id, organization_id, status, processing_state
        from public.properties
        where id=${propertyId}::uuid and organization_id=${organizationId}::uuid
        for update
      `
      if (!property) return { error: 'property_not_found', status: 404 }

      const current = String(property.status || '')
      if (action === 'archive') {
        if (current === 'archived') {
          return { ok: true, unchanged: true, property_id: propertyId, status: 'archived' }
        }
        if (current === 'published') {
          return { error: 'published_property_requires_marketplace_unpublish', status: 409 }
        }

        await tx`
          update public.properties
          set status='archived',
              processing_state=coalesce(processing_state,'{}'::jsonb)
                || jsonb_build_object(
                     'stage','archived',
                     'next_action','restore_when_needed',
                     'lifecycle',
                       coalesce(processing_state->'lifecycle','{}'::jsonb)
                       || jsonb_build_object(
                            'previous_status',${current},
                            'archived_at',now(),
                            'archived_by',${user.id}::text
                          )
                   ),
              updated_at=now()
          where id=${propertyId}::uuid and organization_id=${organizationId}::uuid
        `
        await tx`
          insert into private.property_lifecycle_events
            (organization_id, property_id, actor_user_id, action, from_status, to_status, metadata)
          values
            (${organizationId}::uuid, ${propertyId}::uuid, ${user.id}::uuid, 'archive', ${current}, 'archived',
             jsonb_build_object('source','listia_inventory'))
        `
        return { ok: true, unchanged: false, property_id: propertyId, status: 'archived' }
      }

      if (current !== 'archived') {
        return { ok: true, unchanged: true, property_id: propertyId, status: current }
      }

      const previousRaw = String(property.processing_state?.lifecycle?.previous_status || 'material_received')
      if (previousRaw === 'published') {
        return { error: 'published_property_requires_marketplace_restore', status: 409 }
      }
      const target = RESTORABLE.has(previousRaw) ? previousRaw : 'material_received'

      await tx`
        update public.properties
        set status=${target},
            processing_state=coalesce(processing_state,'{}'::jsonb)
              || jsonb_build_object(
                   'stage',${target},
                   'next_action',case when ${target}='ready' then 'publish_or_distribute' else 'continue_preparation' end,
                   'lifecycle',
                     coalesce(processing_state->'lifecycle','{}'::jsonb)
                     || jsonb_build_object(
                          'restored_at',now(),
                          'restored_by',${user.id}::text,
                          'restored_status',${target}
                        )
                 ),
            updated_at=now()
        where id=${propertyId}::uuid and organization_id=${organizationId}::uuid
      `
      await tx`
        insert into private.property_lifecycle_events
          (organization_id, property_id, actor_user_id, action, from_status, to_status, metadata)
        values
          (${organizationId}::uuid, ${propertyId}::uuid, ${user.id}::uuid, 'restore', 'archived', ${target},
           jsonb_build_object('source','listia_inventory'))
      `
      return { ok: true, unchanged: false, property_id: propertyId, status: target }
    })

    if ('error' in result) return json(req, result, Number(result.status || 409))
    return json(req, result)
  } catch (error) {
    const message = String((error as Error)?.message || error)
    if (message.includes('property_limit_reached')) return json(req, { error: 'property_limit_reached' }, 409)
    if (message.includes('plan_entitlement_unavailable')) return json(req, { error: 'plan_entitlement_unavailable' }, 503)
    console.error('property-lifecycle-action', message.slice(0, 240))
    return json(req, { error: 'internal_error' }, 500)
  }
})
