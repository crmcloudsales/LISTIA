import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

Deno.serve((_req: Request) => new Response(JSON.stringify({
  error: 'endpoint_retired',
  replacement: 'authenticated_contact_import_pipeline'
}), {
  status: 410,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  }
}))
