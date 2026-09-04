import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })

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

const transitionMap: Record<string, string> = {
  confirm: 'confirmed',
  complete: 'completed',
  cancel: 'cancelled',
  no_show: 'no_show',
}

function appointmentWriteError(origin: string, error: any) {
  const diagnostic = `${String(error?.message || '')} ${String(error?.details || '')} ${String(error?.code || '')}`.toLowerCase()
  if (diagnostic.includes('appointment_conflict')) {
    return json(origin, { error: 'appointment_conflict' }, 409)
  }
  if (diagnostic.includes('appointment_assignee_not_active_member')) {
    return json(origin, { error: 'appointment_assignee_not_active_member' }, 409)
  }
  console.error('appointment-action write', String(error?.code || 'unknown'))
  return json(origin, { error: 'update_failed' }, 500)
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
  const appointmentId = String(body.appointment_id || '')
  const action = String(body.action || '')
  if (!appointmentId || !action) return json(origin, { error: 'invalid_action' }, 400)

  const { data: appointment } = await admin.from('appointments')
    .select('id,organization_id,lead_id,assigned_user_id,status,starts_at,ends_at')
    .eq('id', appointmentId)
    .maybeSingle()
  if (!appointment) return json(origin, { error: 'not_found' }, 404)

  const { data: member } = await admin.from('organization_members')
    .select('role,status')
    .eq('organization_id', appointment.organization_id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (!member || !['owner', 'admin'].includes(String(member.role))) {
    return json(origin, { error: 'forbidden' }, 403)
  }

  const current = String(appointment.status || '')
  if (action === 'reschedule') {
    if (!['scheduled', 'confirmed'].includes(current)) {
      return json(origin, { error: 'invalid_transition', current }, 409)
    }

    const start = new Date(String(body.starts_at || ''))
    if (!Number.isFinite(start.getTime())) return json(origin, { error: 'invalid_start' }, 400)
    let end: Date | null = null
    if (body.ends_at) {
      end = new Date(String(body.ends_at))
      if (!Number.isFinite(end.getTime()) || end <= start) {
        return json(origin, { error: 'invalid_end' }, 400)
      }
    }

    const now = new Date().toISOString()
    const patch = {
      starts_at: start.toISOString(),
      ends_at: end ? end.toISOString() : null,
      status: 'scheduled',
      updated_at: now,
    }
    const { error } = await admin.from('appointments').update(patch).eq('id', appointmentId)
    if (error) return appointmentWriteError(origin, error)

    if (appointment.lead_id) {
      await admin.from('lead_events').insert({
        organization_id: appointment.organization_id,
        lead_id: appointment.lead_id,
        event_type: 'appointment_rescheduled',
        source: 'listia',
        metadata: {
          appointment_id: appointmentId,
          assigned_user_id: appointment.assigned_user_id || null,
          previous_starts_at: appointment.starts_at,
          new_starts_at: patch.starts_at,
        },
        occurred_at: now,
      })
    }
    return json(origin, {
      ok: true,
      status: 'scheduled',
      starts_at: patch.starts_at,
      ends_at: patch.ends_at,
      assigned_user_id: appointment.assigned_user_id || null,
    })
  }

  const next = transitionMap[action]
  if (!next) return json(origin, { error: 'invalid_action' }, 400)
  const allowed: Record<string, string[]> = {
    scheduled: ['confirmed', 'cancelled', 'no_show'],
    confirmed: ['completed', 'cancelled', 'no_show'],
    completed: [],
    cancelled: [],
    no_show: [],
  }
  if (!(allowed[current] || []).includes(next)) {
    return json(origin, { error: 'invalid_transition', current, next }, 409)
  }

  const now = new Date().toISOString()
  const { error } = await admin.from('appointments')
    .update({ status: next, updated_at: now })
    .eq('id', appointmentId)
  if (error) return appointmentWriteError(origin, error)

  if (appointment.lead_id) {
    await admin.from('lead_events').insert({
      organization_id: appointment.organization_id,
      lead_id: appointment.lead_id,
      event_type: `appointment_${next}`,
      source: 'listia',
      metadata: {
        appointment_id: appointmentId,
        assigned_user_id: appointment.assigned_user_id || null,
      },
      occurred_at: now,
    })
  }
  return json(origin, { ok: true, status: next })
})
