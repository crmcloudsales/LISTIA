import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { MARKETPLACE_EDGE_PROOF_SHA256 } from './firewall-proof.ts'

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON=Deno.env.get('SUPABASE_ANON_KEY')!
const ALLOWED=new Set(['https://app.listiaapp.com','https://listiaapp.com','https://www.listiaapp.com'])
const clean=(v:unknown,n=2000)=>String(v??'').trim().slice(0,n)
const cors=(req:Request)=>{const origin=req.headers.get('origin')||'',h:Record<string,string>={'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type,x-listia-edge-proof','access-control-max-age':'600','vary':'Origin'};if(ALLOWED.has(origin))h['access-control-allow-origin']=origin;return h}
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors(req),'content-type':'application/json;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY'}})
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')
async function sha256(value:string){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))))}
async function validEdgeProof(req:Request){const proof=req.headers.get('x-listia-edge-proof')||'';return proof.length>=32&&(await sha256(proof))===MARKETPLACE_EDGE_PROOF_SHA256}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return ALLOWED.has(req.headers.get('origin')||'')?new Response(null,{status:204,headers:cors(req)}):new Response(null,{status:403})
  if(req.method!=='POST')return json(req,{error:'method_not_allowed'},405)

  const edgeVerified=await validEdgeProof(req)
  if(!edgeVerified){
    const origin=req.headers.get('origin')||''
    if(!ALLOWED.has(origin))return json(req,{error:'origin_not_allowed'},403)
    const sec=req.headers.get('sec-fetch-site')
    if(sec&&sec!=='same-origin'&&sec!=='same-site')return json(req,{error:'cross_site_blocked'},403)
  }

  const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'')
  if(!jwt)return json(req,{error:'unauthorized'},401)
  const userClient=createClient(SUPABASE_URL,ANON,{global:{headers:{Authorization:`Bearer ${jwt}`}},auth:{persistSession:false,autoRefreshToken:false}})
  const {data:userData,error:userError}=await userClient.auth.getUser(jwt)
  if(userError||!userData?.user)return json(req,{error:'unauthorized'},401)

  const body=await req.json().catch(()=>null) as any
  if(!body)return json(req,{error:'invalid_json'},400)
  const mode=clean(body.mode||'form',20)
  if(mode==='click'&&!edgeVerified)return json(req,{error:'human_firewall_required'},403)

  const admin=createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:allowed,error:rateError}=await admin.rpc('consume_marketplace_interest_rate_limit',{p_user_id:userData.user.id,p_max_requests:6,p_window_seconds:600})
  if(rateError)return json(req,{error:'rate_limit_unavailable'},503)
  if(allowed!==true)return json(req,{error:'too_many_interest_attempts'},429)

  const listingId=clean(body.p_listing_id||body.listing_id,80)
  const locale=clean(body.p_locale||body.locale,20)||'es'
  if(!listingId)return json(req,{error:'invalid_submission'},400)

  if(mode==='click'){
    const {data,error}=await admin.rpc('submit_marketplace_interest_click_verified',{p_user_id:userData.user.id,p_listing_id:listingId,p_locale:locale})
    if(error)return json(req,{error:'submission_failed'},502)
    return json(req,{ok:true,result:data??null})
  }

  const name=clean(body.p_name||body.name,120)
  const email=clean(body.p_email||body.email,254)||null
  const whatsapp=clean(body.p_whatsapp||body.whatsapp,80)||null
  const message=clean(body.p_message||body.message,2000)||null
  const honeypot=clean(body.p_website||body.website,250)
  if(!name||name.length<2||(!email&&!whatsapp))return json(req,{error:'invalid_submission'},400)
  if(honeypot)return json(req,{ok:true})
  const {data,error}=await admin.rpc('submit_marketplace_interest',{p_listing_id:listingId,p_name:name,p_email:email,p_whatsapp:whatsapp,p_message:message,p_locale:locale,p_website:null})
  if(error)return json(req,{error:'submission_failed'},502)
  return json(req,{ok:true,result:data??null})
})
