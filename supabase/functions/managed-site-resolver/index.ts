import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const json = (body: unknown, status = 410) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'private,no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY'
  }
})

// Retired compatibility endpoint.
// Canonical LISTIA Managed Sites now use managed-site-data behind the private
// LISTIA edge proof. Keep this function only so stale callers fail explicitly
// instead of exposing or resolving tenant payloads through the old public path.
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({error: 'method_not_allowed'}, 405)
  return json({error: 'legacy_resolver_retired', canonical: 'managed-site-data'}, 410)
})
