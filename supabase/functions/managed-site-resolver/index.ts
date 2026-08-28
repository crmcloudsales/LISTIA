import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const clean=(v:unknown,n=255)=>String(v??'').trim().slice(0,n)
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'private,no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY'}})

Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return json({error:'method_not_allowed'},405)
  const gatewaySecret=clean(req.headers.get('x-listia-gateway-secret'),500)
  if(!gatewaySecret)return json({error:'gateway_auth_required'},401)
  const body=await req.json().catch(()=>null) as any
  const host=clean(body?.host,255).toLowerCase()
  if(!host)return json({error:'host_required'},400)
  // Validate the caller-held Cloudflare Turnstile secret without ever storing it here.
  // A fake secret cannot pass Cloudflare's siteverify endpoint.
  const probe=new URLSearchParams({secret:gatewaySecret,response:'__listia_gateway_probe__'})
  const verify=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:probe})
  if(!verify.ok)return json({error:'gateway_auth_failed'},403)
  const verdict=await verify.json().catch(()=>null) as any
  const codes=Array.isArray(verdict?.['error-codes'])?verdict['error-codes']:[]
  if(codes.includes('invalid-input-secret')||codes.includes('missing-input-secret'))return json({error:'gateway_auth_failed'},403)
  const admin=createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data,error}=await admin.rpc('resolve_listia_public_site',{p_host:host})
  if(error)return json({error:'resolver_failed'},502)
  return json({ok:true,site:data??null})
})
