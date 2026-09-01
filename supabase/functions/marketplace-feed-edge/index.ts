import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { MARKETPLACE_EDGE_PROOF_SHA256 } from './firewall-proof.ts'

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY'}})
const clean=(v:unknown,n:number)=>String(v??'').trim().slice(0,n)
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')
async function sha256(v:string){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))))}
async function edgeVerified(req:Request){const proof=req.headers.get('x-listia-edge-proof')||'';return proof.length>=32&&(await sha256(proof))===MARKETPLACE_EDGE_PROOF_SHA256}

Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return json({error:'method_not_allowed'},405)
  if(!(await edgeVerified(req)))return json({error:'edge_firewall_required'},403)
  const len=Number(req.headers.get('content-length')||0)
  if(len>4096)return json({error:'payload_too_large'},413)
  const body=await req.json().catch(()=>null) as any
  if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'invalid_json'},400)
  const admin=createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}})

  if(clean(body.mode,20)==='detail'){
    const slug=clean(body.slug,180)||null
    const id=clean(body.id,80)||null
    if(!slug&&!id)return json({error:'listing_required'},400)
    const {data,error}=await admin.rpc('marketplace_public_listing_detail',{p_slug:slug,p_id:id})
    if(error)return json({error:'detail_unavailable'},502)
    const row=Array.isArray(data)?data[0]:null
    return row?json(row):json({error:'not_found'},404)
  }

  const params={
    p_limit:Math.min(Math.max(Number(body.p_limit)||24,1),30),
    p_offset:Math.min(Math.max(Number(body.p_offset)||0,0),5000),
    p_q:clean(body.p_q,120)||null,
    p_operation:clean(body.p_operation,30)||null,
    p_property_type:clean(body.p_property_type,80)||null,
    p_min_price:Number.isFinite(Number(body.p_min_price))?Number(body.p_min_price):null,
    p_max_price:Number.isFinite(Number(body.p_max_price))?Number(body.p_max_price):null,
    p_bedrooms:Number.isFinite(Number(body.p_bedrooms))?Number(body.p_bedrooms):null
  }
  const {data,error}=await admin.rpc('marketplace_public_feed_edge',params)
  if(error)return json({error:'feed_unavailable'},502)
  return json(Array.isArray(data)?data:[])
})
