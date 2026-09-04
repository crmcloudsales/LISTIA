import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const allowedOrigins = new Set(['https://listiaapp.com', 'https://www.listiaapp.com'])

function headers(req: Request) {
  const origin = req.headers.get('origin') || ''
  return {
    'access-control-allow-origin': allowedOrigins.has(origin) ? origin : 'https://listiaapp.com',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-listia-client-ip, x-listia-source',
    'access-control-max-age': '600',
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'vary': 'Origin',
  }
}

Deno.serve((req: Request) => {
  const origin = req.headers.get('origin') || ''
  if (req.method === 'OPTIONS') {
    if (origin && !allowedOrigins.has(origin)) return new Response(null, { status: 403 })
    return new Response(null, { status: 204, headers: headers(req) })
  }
  if (origin && !allowedOrigins.has(origin)) {
    return new Response(JSON.stringify({ error: 'origin_not_allowed' }), { status: 403, headers: headers(req) })
  }
  return new Response(JSON.stringify({
    error: 'retired_endpoint',
    replacement: 'listia-investment-lead',
    boundary: 'LISTIA_ONLY',
  }), { status: 410, headers: headers(req) })
})
