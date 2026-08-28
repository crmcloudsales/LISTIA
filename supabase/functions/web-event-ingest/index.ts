import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const PUBLIC_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || ''
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const DB = Deno.env.get('SUPABASE_DB_URL') || ''
const sql = postgres(DB, {prepare:false})
const EVENTS = new Set(['page_view','listing_view'])
const MANAGED_ORIGIN = /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.listiaapp\.com$/
const MAX_BODY_BYTES = 16384
const EVENT_ID = /^[A-Za-z0-9._:-]{8,180}$/

const clean = (v: unknown, n = 500) => typeof v === 'string' ? v.trim().slice(0,n) : null
const cors = (req: Request) => {
  const origin = req.headers.get('origin') || ''
  const h: Record<string,string> = {
    'access-control-allow-methods':'POST, OPTIONS',
    'access-control-allow-headers':'content-type, apikey',
    'access-control-max-age':'600',
    'vary':'Origin'
  }
  if (MANAGED_ORIGIN.test(origin)) h['access-control-allow-origin'] = origin
  return h
}
const json = (req: Request, body: unknown, status = 200, extra: Record<string,string> = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...cors(req),
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff',
    'referrer-policy':'no-referrer',
    'x-frame-options':'DENY',
    ...extra
  }
})
async function hash(v:string){
  const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))
  return Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,'0')).join('')
}
function clientIp(req: Request){
  const cf=clean(req.headers.get('cf-connecting-ip'),100)
  if(cf)return cf
  const xs=String(req.headers.get('x-forwarded-for')||'').split(',').map(x=>x.trim()).filter(Boolean)
  return clean(xs.at(-1)||'unknown',100) || 'unknown'
}
function sameHostUrl(v: unknown, host: string){
  const raw=clean(v,1200)
  if(!raw)return null
  try{
    const u=new URL(raw)
    if(u.protocol!=='https:'||u.hostname.toLowerCase()!==host)return null
    return u.href.slice(0,1200)
  }catch{return null}
}
function safeReferrer(v: unknown){
  const raw=clean(v,1200)
  if(!raw)return null
  try{
    const u=new URL(raw)
    if(u.protocol!=='https:'&&u.protocol!=='http:')return null
    return u.href.slice(0,1200)
  }catch{return null}
}

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin')||''
  if(req.method==='OPTIONS') return MANAGED_ORIGIN.test(origin) ? new Response(null,{status:204,headers:cors(req)}) : new Response(null,{status:403})
  if(req.method!=='POST') return json(req,{error:'method_not_allowed'},405)
  if(!MANAGED_ORIGIN.test(origin)) return json(req,{error:'origin_not_allowed'},403)
  const type=(req.headers.get('content-type')||'').toLowerCase()
  if(!type.includes('application/json')) return json(req,{error:'content_type_required'},415)
  const length=Number(req.headers.get('content-length')||'0')
  if(Number.isFinite(length)&&length>MAX_BODY_BYTES) return json(req,{error:'payload_too_large'},413)
  if(!SUPABASE_URL||!PUBLIC_KEY||!SERVICE||!DB) return json(req,{error:'server_not_configured'},503)

  const body=await req.json().catch(()=>null) as any
  if(!body)return json(req,{error:'invalid_json'},400)
  const host=clean(body.host,253)?.toLowerCase()||''
  let originHost=''
  try{originHost=new URL(origin).hostname.toLowerCase()}catch{}
  if(!host||host!==originHost) return json(req,{error:'host_origin_mismatch'},403)
  const event=clean(body.event,40)||'', eventId=clean(body.event_id,180)||''
  if(!EVENTS.has(event)||!EVENT_ID.test(eventId)) return json(req,{error:'invalid_event'},400)

  const principal=await hash(`${host}|${clientIp(req)}`)
  const [limit]=await sql`select * from private.consume_web_event_ingest_rate_limit(${principal},${host})`
  if(!limit?.allowed) return json(req,{error:'rate_limited'},429,{'retry-after':String(limit?.retry_after||600)})

  const publicDb=createClient(SUPABASE_URL,PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:site,error:resolveError}=await publicDb.rpc('resolve_listia_public_site',{p_host:host})
  const organizationId=site?.organization?.id
  if(resolveError||!organizationId) return json(req,{error:'unknown_site'},404)

  const listingId=clean(body.listing_id,80)
  if(event==='listing_view'&&!listingId) return json(req,{error:'listing_required'},400)
  if(listingId&&!(site.listings||[]).some((x:any)=>String(x.id)===listingId)) return json(req,{error:'invalid_listing'},400)

  const pageUrl=sameHostUrl(body.url,host)
  if(body.url&&!pageUrl) return json(req,{error:'invalid_page_url'},400)
  const referrer=safeReferrer(body.referrer)
  const a=body.attribution&&typeof body.attribution==='object'?body.attribution:{}
  const click:any={}
  for(const k of ['fbclid','gclid','gbraid','wbraid','ttclid','li_fat_id','msclkid']){const v=clean(a[k],300);if(v)click[k]=v}
  const path=clean(body.path,800)
  if(path&&!path.startsWith('/')) return json(req,{error:'invalid_path'},400)
  const occurredAt=new Date().toISOString()
  const row={
    organization_id:organizationId,website_host:host,event_name:event,event_id:eventId,
    anonymous_id:clean(body.anonymous_id,120),session_id:clean(body.session_id,120),listing_id:listingId||null,
    page_url:pageUrl,referrer,source:clean(a.utm_source,180),medium:clean(a.utm_medium,180),
    campaign:clean(a.utm_campaign,240),content:clean(a.utm_content,240),term:clean(a.utm_term,240),
    click_ids:click,metadata:{path:path||null},occurred_at:occurredAt
  }
  const admin=createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}})
  const {error}=await admin.from('web_events').upsert(row,{onConflict:'organization_id,event_id',ignoreDuplicates:true})
  if(error)return json(req,{error:'store_failed'},500)

  const touch={organization_id:organizationId,anonymous_id:row.anonymous_id,session_id:row.session_id,event_id:eventId,touch_type:'last',source:row.source,medium:row.medium,campaign:row.campaign,content:row.content,term:row.term,click_ids:click,landing_url:pageUrl,referrer,occurred_at:occurredAt}
  await admin.from('attribution_touchpoints').upsert(touch,{onConflict:'organization_id,event_id,touch_type',ignoreDuplicates:true})
  if(event==='page_view'&&row.anonymous_id){
    const {count}=await admin.from('attribution_touchpoints').select('id',{count:'exact',head:true}).eq('organization_id',organizationId).eq('anonymous_id',row.anonymous_id).eq('touch_type','first')
    if(!count)await admin.from('attribution_touchpoints').insert({...touch,touch_type:'first'})
  }
  return json(req,{ok:true})
})
