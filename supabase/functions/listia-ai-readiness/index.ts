import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'

const U=Deno.env.get('SUPABASE_URL')||''
const S=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
const DB=Deno.env.get('SUPABASE_DB_URL')||''
const sql=postgres(DB,{prepare:false})
const allowedOrigins=new Set(['https://listia-pwa.pages.dev','https://app.listiaapp.com','https://listiaapp.com','https://www.listiaapp.com'])
function cors(req:Request){const o=req.headers.get('origin')||'';return{'access-control-allow-origin':allowedOrigins.has(o)?o:'https://app.listiaapp.com','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'authorization, content-type, apikey, x-client-info','vary':'Origin'}}
const json=(req:Request,b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors(req),'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)})
  if(req.method!=='POST')return json(req,{error:'method_not_allowed'},405)
  const origin=req.headers.get('origin')||''
  if(origin&&!allowedOrigins.has(origin))return json(req,{error:'origin_not_allowed'},403)
  if(!U||!S||!DB)return json(req,{error:'server_not_configured'},503)

  const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'')
  if(!jwt)return json(req,{error:'unauthorized'},401)
  const admin=createClient(U,S,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:userData,error:userError}=await admin.auth.getUser(jwt)
  const user=userData?.user
  if(userError||!user)return json(req,{error:'unauthorized'},401)

  const body=await req.json().catch(()=>({})) as {organization_id?:string}
  const organizationId=String(body.organization_id||'').trim()
  if(!/^[0-9a-f-]{36}$/i.test(organizationId))return json(req,{error:'organization_id_required'},400)
  const {data:member}=await admin.from('organization_members').select('role,status').eq('organization_id',organizationId).eq('user_id',user.id).eq('status','active').maybeSingle()
  if(!member||!['owner','admin'].includes(String(member.role||'')))return json(req,{error:'admin_required'},403)

  const rows=await sql`
    with route_use as (
      select m.model_key, count(*)::int as route_count,
             array_agg(distinct p.task_type order by p.task_type) as tasks
      from private.ai_models m
      join private.ai_route_policies p on p.active=true
       and (m.model_key=any(p.primary_models) or m.model_key=any(p.fallback_models) or m.model_key=any(p.reviewer_models))
      group by m.model_key
    ), model_counts as (
      select provider_key,count(*)::int as model_count,
             count(*) filter(where lifecycle_status not in ('deprecated','removed'))::int as usable_model_count
      from private.ai_models group by provider_key
    ), provider_routes as (
      select m.provider_key,
             count(distinct ru.model_key)::int as routed_model_count,
             coalesce(sum(ru.route_count),0)::int as route_placements,
             coalesce(array_agg(distinct task order by task) filter(where task is not null),array[]::text[]) as tasks
      from private.ai_models m
      left join route_use ru on ru.model_key=m.model_key
      left join lateral unnest(coalesce(ru.tasks,array[]::text[])) task on true
      group by m.provider_key
    )
    select p.provider_key,p.display_name,p.lifecycle_status,
           r.runtime_key,r.adapter_key,r.enabled,r.credential_status,r.health_status,
           coalesce(r.configuration->>'cost_class','unspecified') as cost_class,
           coalesce((r.configuration->>'requires_dedicated_listia_credentials')::boolean,false) as dedicated_listia_credentials,
           coalesce(mc.model_count,0) as model_count,coalesce(mc.usable_model_count,0) as usable_model_count,
           coalesce(pr.routed_model_count,0) as routed_model_count,coalesce(pr.route_placements,0) as route_placements,
           coalesce(pr.tasks,array[]::text[]) as tasks,
           r.last_healthcheck_at,
           case
             when r.runtime_key is null then 'adapter_not_registered'
             when r.enabled is not true then 'disabled'
             when r.credential_status='not_configured' then 'credential_required'
             when r.credential_status='invalid' then 'credential_invalid'
             when r.health_status='down' then 'provider_down'
             when r.credential_status in ('configured','not_required') and r.health_status in ('healthy','unknown') then 'ready'
             else 'attention_required'
           end as readiness
    from private.ai_providers p
    left join private.ai_provider_runtimes r on r.provider_key=p.provider_key
    left join model_counts mc on mc.provider_key=p.provider_key
    left join provider_routes pr on pr.provider_key=p.provider_key
    where p.lifecycle_status not in ('removed')
    order by
      case coalesce(r.configuration->>'cost_class','') when 'free_first' then 0 when 'free_tier_candidate' then 1 else 2 end,
      p.display_name,r.runtime_key
  `

  const providers=rows.map((r:any)=>({
    provider_key:r.provider_key,
    display_name:r.display_name,
    provider_status:r.lifecycle_status,
    runtime_key:r.runtime_key||null,
    adapter:r.adapter_key||null,
    enabled:Boolean(r.enabled),
    configured:['configured','not_required'].includes(String(r.credential_status||'')),
    credential_status:r.credential_status||'not_configured',
    health:r.health_status||'unknown',
    cost_class:r.cost_class,
    dedicated_listia_credentials:Boolean(r.dedicated_listia_credentials),
    model_count:Number(r.model_count||0),
    usable_model_count:Number(r.usable_model_count||0),
    routed_model_count:Number(r.routed_model_count||0),
    route_placements:Number(r.route_placements||0),
    tasks:Array.isArray(r.tasks)?r.tasks:[],
    readiness:r.readiness,
    last_healthcheck_at:r.last_healthcheck_at||null,
  }))

  return json(req,{ok:true,boundary:'LISTIA_ONLY',organization_id:organizationId,summary:{total:providers.length,ready:providers.filter((p:any)=>p.readiness==='ready').length,free_first_ready:providers.filter((p:any)=>p.readiness==='ready'&&p.cost_class==='free_first').length,needs_credentials:providers.filter((p:any)=>p.readiness==='credential_required').length},providers})
})
