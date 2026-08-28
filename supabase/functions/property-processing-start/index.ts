import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_DB_URL = Deno.env.get('SUPABASE_DB_URL')!
const sql = postgres(SUPABASE_DB_URL, { prepare: false })

const allowedOrigins = new Set(['https://listia-pwa.pages.dev','https://app.listiaapp.com','https://listiaapp.com','https://www.listiaapp.com'])
function cors(req: Request) { const origin=req.headers.get('origin')||''; return {'access-control-allow-origin':allowedOrigins.has(origin)?origin:'https://app.listiaapp.com','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'authorization, x-client-info, apikey, content-type','vary':'Origin'} }
function json(req: Request, body: unknown, status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(req),'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}

async function consumeRateLimit(principalId:string,organizationId:string){
  const action='property_processing_start',maxRequests=12,windowSeconds=60,lockKey=`${principalId}:${organizationId}:${action}`
  return await sql.begin(async tx=>{await tx`select pg_advisory_xact_lock(hashtextextended(${lockKey},0))`;const [bucket]=await tx`
    insert into private.security_rate_limits(principal_id,organization_id,action,window_started_at,request_count,updated_at)
    values(${principalId}::uuid,${organizationId}::uuid,${action},now(),1,now())
    on conflict(principal_id,organization_id,action) do update set
      window_started_at=case when private.security_rate_limits.window_started_at<=now()-(${windowSeconds}*interval '1 second') then now() else private.security_rate_limits.window_started_at end,
      request_count=case when private.security_rate_limits.window_started_at<=now()-(${windowSeconds}*interval '1 second') then 1 else private.security_rate_limits.request_count+1 end,
      updated_at=now()
    returning request_count,greatest(1,ceil(extract(epoch from(window_started_at+(${windowSeconds}*interval '1 second')-now()))))::int retry_after`
    return{allowed:Number(bucket?.request_count||1)<=maxRequests,retryAfter:Math.max(1,Number(bucket?.retry_after||windowSeconds))}
  })
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)})
  if(req.method!=='POST')return json(req,{error:'method_not_allowed'},405)
  try{
    const origin=req.headers.get('origin')||'';if(origin&&!allowedOrigins.has(origin))return json(req,{error:'origin_not_allowed'},403)
    const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!jwt)return json(req,{error:'unauthorized'},401)
    const admin=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
    const {data:userData,error:userError}=await admin.auth.getUser(jwt);const user=userData?.user;if(userError||!user)return json(req,{error:'unauthorized'},401)
    const body=await req.json().catch(()=>({})) as {organization_id?:string;property_id?:string}
    const organizationId=String(body.organization_id||''),propertyId=String(body.property_id||'')
    if(!organizationId)return json(req,{error:'organization_id_required'},400);if(!propertyId)return json(req,{error:'property_id_required'},400)
    const {data:member}=await admin.from('organization_members').select('role,status').eq('organization_id',organizationId).eq('user_id',user.id).eq('status','active').maybeSingle()
    if(!member)return json(req,{error:'organization_access_denied'},403)
    const rate=await consumeRateLimit(user.id,organizationId);if(!rate.allowed)return json(req,{error:'rate_limited',retry_after:rate.retryAfter},429)
    const [billing]=await sql`select plan_key,access_state,usage_markup_percent from public.organization_billing where organization_id=${organizationId}::uuid limit 1`
    const effectivePlan=String(billing?.plan_key||'free'),accessState=String(billing?.access_state||'active');if(accessState==='payment_blocked')return json(req,{error:'payment_blocked'},402)
    const [property]=await sql`select id,organization_id,title,operation_type,property_type,description,price,currency,commission_text,location_text,postal_code,status,source,locale,processing_state,created_at from public.properties where id=${propertyId}::uuid and organization_id=${organizationId}::uuid limit 1`
    if(!property)return json(req,{error:'property_not_found'},404)
    const assets=await sql`select id,asset_type,original_name,mime_type,size_bytes,storage_bucket,storage_path,metadata,created_at from public.property_assets where property_id=${propertyId}::uuid and organization_id=${organizationId}::uuid order by created_at asc`
    const submitted={title:property.title||null,operation_type:property.operation_type||null,property_type:property.property_type||null,description:property.description||null,price:property.price??null,currency:property.currency||null,commission_text:property.commission_text||null,location_text:property.location_text||null,postal_code:property.postal_code||null}
    const missing:string[]=[];if(!property.operation_type)missing.push('operation_type');if(!property.property_type)missing.push('property_type');if(!property.location_text)missing.push('location_text');if(!property.description)missing.push('description');if(property.price===null||property.price===undefined)missing.push('price');if(!property.currency)missing.push('currency')
    const assetCount=assets.length,hasMaterial=Boolean(property.description||property.location_text||property.price!==null||assetCount>0),complete=hasMaterial&&missing.length===0
    const nextStage=complete?'draft_ready':'needs_input',nextAction=complete?'review_draft':hasMaterial?'request_missing_fields':'request_more_material',now=new Date().toISOString()
    const manifest={schema_version:1,property_id:propertyId,organization_id:organizationId,effective_plan:effectivePlan,usage_markup_percent:Number(billing?.usage_markup_percent??30),source:property.source,locale:property.locale,submitted_fields:submitted,assets:assets.map((a:any)=>({id:a.id,asset_type:a.asset_type,original_name:a.original_name,mime_type:a.mime_type,size_bytes:a.size_bytes,storage_bucket:a.storage_bucket,storage_path:a.storage_path,metadata:a.metadata||{}})),prepared_at:now,processing_mode:'deterministic_fallback_no_invention'}
    const draftData={...submitted,assets:manifest.assets,provenance:{mode:'deterministic_fallback',generated_at:now,rule:'submitted_fields_only_no_invention'}}
    await sql.begin(async tx=>{
      await tx`insert into public.property_processing_state(property_id,organization_id,stage,asset_count,input_manifest,detected_fields,missing_fields,last_material_at,processing_started_at,processing_completed_at,error_message,updated_at)
        values(${propertyId}::uuid,${organizationId}::uuid,${nextStage},${assetCount},${JSON.stringify(manifest)}::jsonb,${JSON.stringify(submitted)}::jsonb,${missing}::text[],now(),now(),now(),null,now())
        on conflict(property_id) do update set stage=excluded.stage,asset_count=excluded.asset_count,input_manifest=excluded.input_manifest,detected_fields=excluded.detected_fields,missing_fields=excluded.missing_fields,last_material_at=excluded.last_material_at,processing_started_at=coalesce(public.property_processing_state.processing_started_at,excluded.processing_started_at),processing_completed_at=excluded.processing_completed_at,error_message=null,updated_at=now()`
      await tx`insert into public.property_drafts(property_id,organization_id,draft_data,missing_fields,status,version,updated_at)
        values(${propertyId}::uuid,${organizationId}::uuid,${JSON.stringify(draftData)}::jsonb,${missing}::text[],'draft',1,now())
        on conflict(property_id) do update set draft_data=excluded.draft_data,missing_fields=excluded.missing_fields,status='draft',version=public.property_drafts.version+1,approved_at=null,updated_at=now()
        where public.property_drafts.status<>'approved'`
      await tx`update public.properties set status=${hasMaterial?'processing':'material_received'},processing_state=coalesce(processing_state,'{}'::jsonb)||${JSON.stringify({stage:nextStage,asset_count:assetCount,missing_fields:missing,prepared_at:now,next_action:nextAction,processing_mode:'deterministic_fallback'})}::jsonb,updated_at=now() where id=${propertyId}::uuid and organization_id=${organizationId}::uuid`
    })
    return json(req,{ok:true,property_id:propertyId,stage:nextStage,asset_count:assetCount,missing_fields:missing,effective_plan:effectivePlan,next_action:nextAction,processing_mode:'deterministic_fallback'})
  }catch(error){console.error('property-processing-start',error);return json(req,{error:'internal_error'},500)}
})
