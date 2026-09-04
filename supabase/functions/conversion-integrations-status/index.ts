import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'

const URL=Deno.env.get('SUPABASE_URL')!
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const DB=Deno.env.get('SUPABASE_DB_URL')!
const admin=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}})
const sql=postgres(DB,{prepare:false,max:2})
const providers=['google','meta','tiktok','linkedin'] as const
const origins=new Set(['https://app.listiaapp.com','https://listia-pwa.pages.dev'])

function cors(r:Request){const o=r.headers.get('origin')||'';return{'access-control-allow-origin':origins.has(o)?o:'https://app.listiaapp.com','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'authorization, apikey, content-type','vary':'Origin'}}
function out(r:Request,b:unknown,s=200){return new Response(JSON.stringify(b),{status:s,headers:{...cors(r),'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})}
function truthy(v:unknown){return Boolean(String(v??'').trim())}
function lower(v:unknown){return String(v??'').trim().toLowerCase()}

function readiness(c:any,token:any){
  const missing:string[]=[]
  if(!c||c.status!=='connected') missing.push('connection')
  const m=c?.metadata||{}
  const scopes=(c?.granted_scopes||[]).map((x:string)=>lower(x))
  const p=lower(c?.provider)
  if(c&&c.status==='connected'){
    if(p==='google'){
      if(!scopes.some((x:string)=>x.includes('datamanager'))) missing.push('google_datamanager_scope')
      if(!truthy(m.google_ads_customer_id||m.customer_id)) missing.push('google_ads_customer')
      const actions=m.conversion_actions||{}
      for(const k of ['qualified_lead','appointment','conversion']) if(!truthy(actions[k]||m.conversion_action_id)) missing.push(`google_${k}_action`)
    } else if(p==='meta'){
      if(!truthy(m.dataset_id||m.pixel_id)) missing.push('meta_dataset')
    } else if(p==='tiktok'){
      if(!truthy(m.advertiser_id)) missing.push('tiktok_advertiser')
      if(!truthy(m.event_source_id||m.pixel_id)) missing.push('tiktok_event_source')
    } else if(p==='linkedin'){
      if(!truthy(m.sponsored_account_id)) missing.push('linkedin_ads_account')
      const ids=m.conversion_ids||{}
      for(const k of ['qualified_lead','appointment','conversion']) if(!truthy(ids[k]||m.conversion_id)) missing.push(`linkedin_${k}_conversion`)
    }
    if(!token?.has_access_token) missing.push('access_token')
    if(token?.token_expired===true) missing.push('access_token_expired')
  }
  return {ready:missing.length===0,missing_requirements:missing}
}

function safeConfig(c:any){
  const m=c?.metadata||{}
  const p=lower(c?.provider)
  if(p==='google') return {configured_actions:Object.keys(m.conversion_actions||{}).filter(k=>truthy(m.conversion_actions[k])),validate_only:Boolean(m.validate_only)}
  if(p==='meta') return {dataset_configured:truthy(m.dataset_id||m.pixel_id),test_mode:Boolean(m.test_event_code),min_quality_score:m.min_quality_score??null,require_marketing_consent:m.require_marketing_consent!==false}
  if(p==='tiktok') return {advertiser_configured:truthy(m.advertiser_id),event_source_configured:truthy(m.event_source_id||m.pixel_id),test_mode:Boolean(m.test_event_code),min_quality_score:m.min_quality_score??null,require_marketing_consent:m.require_marketing_consent!==false}
  if(p==='linkedin') return {account_configured:truthy(m.sponsored_account_id),configured_actions:Object.keys(m.conversion_ids||{}).filter(k=>truthy(m.conversion_ids[k])),min_quality_score:m.min_quality_score??null,require_marketing_consent:m.require_marketing_consent!==false}
  return {}
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)})
  if(req.method!=='POST')return out(req,{error:'method_not_allowed'},405)
  try{
    const o=req.headers.get('origin')||''
    if(o&&!origins.has(o))return out(req,{error:'origin_not_allowed'},403)
    const auth=req.headers.get('authorization')||''
    if(!auth)return out(req,{error:'unauthorized'},401)
    const {data:{user}}=await admin.auth.getUser(auth.replace(/^Bearer\s+/i,''))
    if(!user)return out(req,{error:'unauthorized'},401)
    const b=await req.json().catch(()=>({})) as any
    const org=String(b.organization_id||'')
    if(!/^[0-9a-f-]{36}$/i.test(org))return out(req,{error:'organization_required'},400)
    const {data:member}=await admin.from('organization_members').select('status').eq('organization_id',org).eq('user_id',user.id).eq('status','active').maybeSingle()
    if(!member)return out(req,{error:'forbidden'},403)

    const conns=await sql`select id,provider,status,display_name,granted_scopes,metadata,connected_at,last_error from public.integration_connections where organization_id=${org}::uuid and provider=any(${providers as unknown as string[]}::text[]) order by provider`
    const tokenRows=await sql`select r.connection_id,
      (r.access_token_secret_id is not null) as has_access_token,
      (r.refresh_token_secret_id is not null) as has_refresh_token,
      r.token_expires_at,
      (r.token_expires_at is not null and r.token_expires_at<=now()) as token_expired
      from private.integration_token_refs r
      join public.integration_connections c on c.id=r.connection_id
      where c.organization_id=${org}::uuid and c.provider=any(${providers as unknown as string[]}::text[])`
    const queue=await sql`select p.platform,s.delivery_status,count(*)::int total from public.conversion_signals s cross join lateral unnest(s.platforms) p(platform) where s.organization_id=${org}::uuid and p.platform=any(${providers as unknown as string[]}::text[]) group by p.platform,s.delivery_status`
    const deliveries=await sql`select platform,status,count(*)::int total,max(delivered_at) last_delivered_at,max(updated_at) last_updated_at from private.conversion_signal_deliveries where organization_id=${org}::uuid group by platform,status`
    const last=await sql`select distinct on(platform) platform,status,last_http_status,last_error,updated_at,delivered_at from private.conversion_signal_deliveries where organization_id=${org}::uuid order by platform,updated_at desc`

    const result:any[]=[]
    for(const p of providers){
      const c=conns.find((x:any)=>lower(x.provider)===p)
      const token=c?tokenRows.find((x:any)=>String(x.connection_id)===String(c.id)):null
      const check=readiness(c,token)
      const q:any={};for(const x of queue.filter((x:any)=>x.platform===p))q[x.delivery_status]=Number(x.total)
      const d:any={};for(const x of deliveries.filter((x:any)=>x.platform===p))d[x.status]={total:Number(x.total),last_delivered_at:x.last_delivered_at,last_updated_at:x.last_updated_at}
      const l=last.find((x:any)=>x.platform===p)
      result.push({
        provider:p,
        connected:Boolean(c&&c.status==='connected'),
        ready:check.ready,
        missing_requirements:check.missing_requirements,
        connection_status:c?.status||'not_connected',
        display_name:c?.display_name||null,
        connected_at:c?.connected_at||null,
        connection_error:c?.last_error?String(c.last_error).slice(0,240):null,
        token:{present:Boolean(token?.has_access_token),refreshable:Boolean(token?.has_refresh_token),expired:Boolean(token?.token_expired),expires_at:token?.token_expires_at||null},
        config:safeConfig(c),
        queue:q,
        deliveries:d,
        last_delivery:l?{status:l.status,http_status:l.last_http_status,error:l.last_error?String(l.last_error).slice(0,240):null,updated_at:l.updated_at,delivered_at:l.delivered_at}:null
      })
    }
    const totals={queued:queue.reduce((n:number,x:any)=>n+(['pending','processing','partial','failed','waiting'].includes(x.delivery_status)?Number(x.total):0),0),sent:deliveries.filter((x:any)=>x.status==='sent').reduce((n:number,x:any)=>n+Number(x.total),0),failed:deliveries.filter((x:any)=>x.status==='failed').reduce((n:number,x:any)=>n+Number(x.total),0),suppressed:deliveries.filter((x:any)=>x.status==='suppressed').reduce((n:number,x:any)=>n+Number(x.total),0)}
    return out(req,{ok:true,organization_id:org,providers:result,totals,generated_at:new Date().toISOString()})
  }catch(e){console.error('conversion-integrations-status',e);return out(req,{error:'internal_error'},500)}
})
