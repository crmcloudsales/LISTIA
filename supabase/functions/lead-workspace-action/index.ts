import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'

const U = Deno.env.get('SUPABASE_URL')!
const S = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const DB = Deno.env.get('SUPABASE_DB_URL')!
const sql = postgres(DB, { prepare: false })

const allowed = new Set([
  'https://app.listiaapp.com',
  'https://listia-pwa.pages.dev',
  'http://localhost',
  'http://127.0.0.1',
])
const cors = (origin: string) => ({
  'access-control-allow-origin': allowed.has(origin) ? origin : 'https://app.listiaapp.com',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'authorization,apikey,content-type',
  'vary': 'Origin',
})
const reply = (origin: string, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...cors(origin),
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  },
})

async function consumeRateLimit(principalId: string, organizationId: string) {
  const action = 'lead_workspace_action'
  const maxRequests = 90
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

function optionalIsoDate(value: unknown) {
  if (value === null || value === undefined || value === '') return { ok: true, value: null as string | null }
  if (typeof value !== 'string') return { ok: false, value: null as string | null }
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return { ok: false, value: null as string | null }
  return { ok: true, value: date.toISOString() }
}

Deno.serve(async req => {
  const origin = req.headers.get('origin') || ''
  if (req.method === 'OPTIONS') {
    return allowed.has(origin)
      ? new Response(null, { status: 204, headers: cors(origin) })
      : new Response(null, { status: 403 })
  }
  if (req.method !== 'POST') return reply(origin, { error: 'method_not_allowed' }, 405)
  if (origin && !allowed.has(origin)) return reply(origin, { error: 'origin_not_allowed' }, 403)

  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!jwt) return reply(origin, { error: 'unauthorized' }, 401)

  const db = createClient(U, S, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userData, error: userError } = await db.auth.getUser(jwt)
  const user = userData?.user
  if (userError || !user) return reply(origin, { error: 'unauthorized' }, 401)

  let body: any
  try { body = await req.json() } catch { return reply(origin, { error: 'invalid_json' }, 400) }

  const organizationId = String(body.organization_id || '')
  const leadId = String(body.lead_id || '')
  const action = String(body.action || '')
  if (!organizationId || !leadId || !action) return reply(origin, { error: 'missing_fields' }, 400)

  const { data: member } = await db.from('organization_members')
    .select('role,status')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (!member) return reply(origin, { error: 'forbidden' }, 403)

  const { data: lead } = await db.from('leads')
    .select('id,organization_id,assigned_user_id')
    .eq('id', leadId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (!lead) return reply(origin, { error: 'lead_not_found' }, 404)

  const rate = await consumeRateLimit(user.id, organizationId)
  if (!rate.allowed) return reply(origin, { error: 'rate_limited', retry_after: rate.retryAfter }, 429)

  const admin = ['owner', 'admin'].includes(String(member.role))

  if (action === 'add_note') {
    const noteBody = String(body.body || '').trim().slice(0, 4000)
    if (!noteBody) return reply(origin, { error: 'note_required' }, 400)

    const { data, error } = await db.from('lead_notes')
      .insert({ organization_id: organizationId, lead_id: leadId, author_user_id: user.id, body: noteBody })
      .select('id,body,author_user_id,created_at')
      .single()
    if (error) return reply(origin, { error: 'write_failed' }, 500)

    const now = new Date().toISOString()
    await db.from('lead_events').insert({
      organization_id: organizationId,
      lead_id: leadId,
      event_type: 'note_added',
      source: 'listia',
      metadata: { note_id: data.id },
      occurred_at: now,
    })
    await db.from('leads').update({ last_activity_at: now, updated_at: now }).eq('id', leadId).eq('organization_id', organizationId)
    return reply(origin, { ok: true, note: data })
  }

  if (action === 'add_task') {
    const title = String(body.title || '').trim().slice(0, 240)
    if (!title) return reply(origin, { error: 'title_required' }, 400)

    const requestedAssignee = String(body.assigned_user_id || '')
    const assignedUserId = requestedAssignee || user.id
    if (requestedAssignee) {
      const { data: assigneeMember } = await db.from('organization_members')
        .select('user_id')
        .eq('organization_id', organizationId)
        .eq('user_id', requestedAssignee)
        .eq('status', 'active')
        .maybeSingle()
      if (!assigneeMember) return reply(origin, { error: 'invalid_assignee' }, 400)
    }

    const due = optionalIsoDate(body.due_at)
    if (!due.ok) return reply(origin, { error: 'invalid_due_at' }, 400)

    const { data, error } = await db.from('lead_tasks')
      .insert({
        organization_id: organizationId,
        lead_id: leadId,
        title,
        status: 'open',
        due_at: due.value,
        assigned_user_id: assignedUserId,
        created_by: user.id,
      })
      .select('id,title,status,due_at,assigned_user_id,created_at')
      .single()
    if (error) return reply(origin, { error: 'write_failed' }, 500)

    await db.from('lead_events').insert({
      organization_id: organizationId,
      lead_id: leadId,
      event_type: 'task_created',
      source: 'listia',
      metadata: { task_id: data.id, title: data.title, assigned_user_id: assignedUserId },
      occurred_at: new Date().toISOString(),
    })
    return reply(origin, { ok: true, task: data })
  }

  if (action === 'task_status') {
    const taskId = String(body.task_id || '')
    const status = String(body.status || '')
    if (!taskId || !['done', 'cancelled', 'open'].includes(status)) {
      return reply(origin, { error: 'invalid_task_status' }, 400)
    }

    const { data: task } = await db.from('lead_tasks')
      .select('id,status,assigned_user_id,created_by')
      .eq('id', taskId)
      .eq('lead_id', leadId)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (!task) return reply(origin, { error: 'task_not_found' }, 404)
    if (!admin && task.assigned_user_id !== user.id && task.created_by !== user.id) {
      return reply(origin, { error: 'forbidden' }, 403)
    }
    if (String(task.status) === status) return reply(origin, { ok: true, unchanged: true, status })

    const now = new Date().toISOString()
    const { error } = await db.from('lead_tasks')
      .update({ status, completed_at: status === 'done' ? now : null, updated_at: now })
      .eq('id', taskId)
      .eq('lead_id', leadId)
      .eq('organization_id', organizationId)
    if (error) return reply(origin, { error: 'write_failed' }, 500)

    await db.from('lead_events').insert({
      organization_id: organizationId,
      lead_id: leadId,
      event_type: `task_${status}`,
      source: 'listia',
      metadata: { task_id: taskId },
      occurred_at: now,
    })
    return reply(origin, { ok: true, status })
  }

  if (action === 'assign') {
    if (!admin) return reply(origin, { error: 'forbidden' }, 403)
    const assignedUserId = String(body.assigned_user_id || '')
    if (assignedUserId) {
      const { data: assigneeMember } = await db.from('organization_members')
        .select('user_id')
        .eq('organization_id', organizationId)
        .eq('user_id', assignedUserId)
        .eq('status', 'active')
        .maybeSingle()
      if (!assigneeMember) return reply(origin, { error: 'invalid_assignee' }, 400)
    }

    const normalized = assignedUserId || null
    if ((lead.assigned_user_id || null) === normalized) {
      return reply(origin, { ok: true, unchanged: true, assigned_user_id: normalized })
    }

    const now = new Date().toISOString()
    const { error } = await db.from('leads')
      .update({ assigned_user_id: normalized, last_activity_at: now, updated_at: now })
      .eq('id', leadId)
      .eq('organization_id', organizationId)
    if (error) return reply(origin, { error: 'write_failed' }, 500)

    await db.from('lead_events').insert({
      organization_id: organizationId,
      lead_id: leadId,
      event_type: 'assigned',
      source: 'listia',
      metadata: { assigned_user_id: normalized, previous_assigned_user_id: lead.assigned_user_id || null },
      occurred_at: now,
    })
    return reply(origin, { ok: true, assigned_user_id: normalized })
  }

  return reply(origin, { error: 'unsupported_action' }, 400)
})
