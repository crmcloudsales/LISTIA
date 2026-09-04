import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const allowedOrigins=new Set([
  'https://listia-pwa.pages.dev',
  'https://app.listiaapp.com',
  'https://listiaapp.com',
  'https://www.listiaapp.com',
])

function cors(req:Request){
  const origin=req.headers.get('origin')||''
  return{
    'access-control-allow-origin':allowedOrigins.has(origin)?origin:'https://app.listiaapp.com',
    'access-control-allow-methods':'POST, OPTIONS',
    'access-control-allow-headers':'authorization, x-client-info, apikey, content-type',
    'vary':'Origin',
  }
}

function json(req:Request,body:unknown,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{...cors(req),'content-type':'application/json; charset=utf-8','cache-control':'no-store'},
  })
}

// LISTIA pricing HOLD.
// Do not create Stripe customers, checkout sessions, subscriptions, or charges
// until the canonical LISTIA plan catalog and pricing release are explicitly
// approved and activated. Production currently uses this same fail-closed entrypoint.
Deno.serve((req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)})
  if(req.method!=='POST')return json(req,{error:'method_not_allowed'},405)
  const origin=req.headers.get('origin')||''
  if(origin&&!allowedOrigins.has(origin))return json(req,{error:'origin_not_allowed'},403)
  return json(req,{error:'pricing_pending',message:'LISTIA pricing is not currently available.'},409)
})
