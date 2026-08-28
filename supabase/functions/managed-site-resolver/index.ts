import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const PUBLIC_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || ''
const MANAGED_HOST = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.listiaapp\.com$/
const RESERVED = new Set(['app','www','api','admin','mail','smtp','ftp','marketplace','web','brain','ai'])
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'private,no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY'
  }
})

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({error: 'method_not_allowed'}, 405)
  const length = Number(req.headers.get('content-length') || '0')
  if (Number.isFinite(length) && length > 2048) return json({error: 'payload_too_large'}, 413)
  if (!SUPABASE_URL || !PUBLIC_KEY) return json({error: 'server_not_configured'}, 503)

  const body = await req.json().catch(() => null) as {host?: unknown} | null
  const host = String(body?.host || '').trim().toLowerCase().replace(/:\d+$/, '')
  if (!MANAGED_HOST.test(host)) return json({error: 'host_not_allowed'}, 403)
  if (RESERVED.has(host.split('.')[0])) return json({error: 'host_not_allowed'}, 403)

  const db = createClient(SUPABASE_URL, PUBLIC_KEY, {
    auth: {persistSession: false, autoRefreshToken: false}
  })
  const {data, error} = await db.rpc('resolve_listia_public_site', {p_host: host})
  if (error) {
    console.error('managed-site-resolver', error.code)
    return json({error: 'resolver_failed'}, 502)
  }
  return json({ok: true, site: data ?? null})
})
