import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const EDGE_HASH='71e982086854a8c8621e99901bef3a75c0805a499ad0ff5b72ed4466e31baee1'
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})
const hex=(a:Uint8Array)=>Array.from(a,x=>x.toString(16).padStart(2,'0')).join('')
async function sha(v:string){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))))}
async function edge(req:Request){const p=req.headers.get('x-listia-edge-proof')||'';return p.length>=32&&(await sha(p))===EDGE_HASH}
const safe=(v:unknown,n=160)=>String(v??'').trim().slice(0,n)

Deno.serve(async req=>{
  if(req.method!=='GET')return json({error:'method_not_allowed'},405)
  if(!(await edge(req)))return json({error:'edge_firewall_required'},403)
  const u=new URL(req.url),sub=safe(u.searchParams.get('subdomain'),63).toLowerCase()
  if(!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(sub))return json({error:'invalid_subdomain'},400)
  const admin=createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data,error}=await admin.rpc('managed_site_public_payload',{p_subdomain:sub})
  if(error)return json({error:'site_payload_unavailable',code:error.code||null},502)
  if(!data||typeof data!=='object')return json({error:'site_payload_empty'},502)
  const payload=data as any
  if(payload.error==='site_not_found'||payload.error==='site_inactive')return json({error:payload.error},404)
  if(payload.ok!==true)return json({error:'site_payload_invalid'},502)
  return json(payload,200)
})
