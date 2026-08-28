import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const clean=(v:unknown,n=2000)=>String(v??'').trim().slice(0,n)
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY'}})

async function verifyTurnstile(secret:string,token:string,expectedHost:string,ip:string){
  if(!secret||!token||!expectedHost)return false
  const form=new URLSearchParams({secret,response:token})
  if(ip)form.set('remoteip',ip)
  const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form})
  if(!r.ok)return false
  const result=await r.json().catch(()=>null) as any
  return Boolean(result?.success&&String(result?.hostname||'').toLowerCase()===expectedHost.toLowerCase())
}

Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return json({error:'method_not_allowed'},405)
  const turnstileSecret=clean(req.headers.get('x-listia-turnstile-secret'),500)
  if(!turnstileSecret)return json({error:'gateway_auth_required'},401)
  const body=await req.json().catch(()=>null) as any
  if(!body)return json({error:'invalid_json'},400)
  const host=clean(body.host,255).toLowerCase()
  if(!host||(!host.endsWith('.listiaapp.com')&&host!=='listiaapp.com'))return json({error:'host_not_allowed'},403)
  const token=clean(body.turnstile_token,4096)
  const verified=await verifyTurnstile(turnstileSecret,token,host,clean(body.ip,100))
  if(!verified)return json({error:'turnstile_failed'},403)
  const listingId=clean(body.listing_id,80)
  const name=clean(body.name,120)
  const email=clean(body.email,254)||null
  const whatsapp=clean(body.whatsapp,80)||null
  const message=clean(body.message,2000)||null
  const locale=clean(body.locale,20)||'es'
  const honeypot=clean(body.website,250)
  if(!listingId||name.length<2||(!email&&!whatsapp))return json({error:'invalid_submission'},400)
  if(honeypot)return json({ok:true})
  const admin=createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data,error}=await admin.rpc('submit_marketplace_interest',{
    p_listing_id:listingId,
    p_name:name,
    p_email:email,
    p_whatsapp:whatsapp,
    p_message:message,
    p_locale:locale,
    p_website:null
  })
  if(error){console.error('managed-site-interest submit failed',error.code);return json({error:'submission_failed'},502)}
  return json({ok:true,result:data??null})
})
