import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_DB_URL = Deno.env.get('SUPABASE_DB_URL')!
const sql = postgres(SUPABASE_DB_URL, { prepare: false })
const allowedOrigins = new Set(['https://listia-pwa.pages.dev','https://app.listiaapp.com','https://listiaapp.com','https://www.listiaapp.com'])
function cors(req:Request){const origin=req.headers.get('origin')||'';return{'access-control-allow-origin':allowedOrigins.has(origin)?origin:'https://app.listiaapp.com','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'authorization, x-client-info, apikey, content-type','vary':'Origin'}}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(req),'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)})
  if(req.method!=='POST')return json(req,{error:'method_not_allowed'},405)
  try{
    const origin=req.headers.get('origin')||'';if(origin&&!allowedOrigins.has(origin))return json(req,{error:'origin_not_allowed'},403)
    const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!jwt)return json(req,{error:'unauthorized'},401)
    const admin=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
    const {data:userData,error:userError}=await admin.auth.getUser(jwt);const user=userData?.user;if(userError||!user)return json(req,{error:'unauthorized'},401)
    const body=await req.json().catch(()=>({})) as {property_id?:string};const propertyId=String(body.property_id||'');if(!propertyId)return json(req,{error:'property_id_required'},400)
    const [seed]=await sql`select id,organization_id from public.properties where id=${propertyId}::uuid limit 1`;if(!seed?.id)return json(req,{error:'property_not_found'},404)
    const organizationId=String(seed.organization_id)
    const {data:member}=await admin.from('organization_members').select('role,status').eq('organization_id',organizationId).eq('user_id',user.id).eq('status','active').maybeSingle();if(!member||!['owner','admin'].includes(String(member.role)))return json(req,{error:'property_admin_required'},403)

    const result=await sql.begin(async tx=>{
      const [property]=await tx`select id,organization_id,operation_type,property_type,location_text,description,price,currency,status from public.properties where id=${propertyId}::uuid and organization_id=${organizationId}::uuid for update`
      if(!property?.id)return{error:'property_not_found',status:404}
      const [draft]=await tx`select property_id,organization_id,status,missing_fields,version from public.property_drafts where property_id=${propertyId}::uuid and organization_id=${organizationId}::uuid for update`
      if(!draft?.property_id)return{error:'draft_not_found',status:404}
      if(String(draft.status)!=='draft')return{error:'draft_not_actionable',status:409}
      const required:any={operation_type:property.operation_type,property_type:property.property_type,location_text:property.location_text,description:property.description,price:property.price,currency:property.currency}
      const currentMissing=Object.entries(required).filter(([,v])=>v===null||v===undefined||(typeof v==='string'&&!v.trim())).map(([k])=>k)
      const draftMissing=Array.isArray(draft.missing_fields)?draft.missing_fields.map(String):[]
      const missing=[...new Set([...currentMissing,...draftMissing])]
      if(missing.length)return{error:'draft_incomplete',status:409,missing_fields:missing}
      await tx`update public.property_drafts set status='approved',approved_at=now(),updated_at=now() where property_id=${propertyId}::uuid and organization_id=${organizationId}::uuid and status='draft'`
      await tx`update public.property_processing_state set stage='ready',missing_fields='{}'::text[],updated_at=now(),error_message=null where property_id=${propertyId}::uuid and organization_id=${organizationId}::uuid`
      await tx`update public.properties set status='ready',processing_state=coalesce(processing_state,'{}'::jsonb)||jsonb_build_object('stage','ready','missing_fields','[]'::jsonb,'approved_by',${user.id}::text,'approved_at',now(),'next_action','publish_or_distribute'),updated_at=now() where id=${propertyId}::uuid and organization_id=${organizationId}::uuid`
      return{ok:true,property_id:propertyId,stage:'ready',version:Number(draft.version||1)}
    })
    if('error'in result)return json(req,result,Number(result.status||409));return json(req,result)
  }catch(error){console.error('property-draft-approve',error);return json(req,{error:'internal_error'},500)}
})
