import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'

const URL=Deno.env.get('SUPABASE_URL')!
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const DB=Deno.env.get('SUPABASE_DB_URL')!
const admin=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}})
const sql=postgres(DB,{prepare:false,max:2})
const allowedOrigins=new Set(['https://app.listiaapp.com','https://listia-pwa.pages.dev'])

function cors(req:Request){const o=req.headers.get('origin')||'';return{'access-control-allow-origin':allowedOrigins.has(o)?o:'https://app.listiaapp.com','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'authorization, apikey, content-type','vary':'Origin'}}
function out(req:Request,b:unknown,s=200){return new Response(JSON.stringify(b),{status:s,headers:{...cors(req),'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}})}
function digits(v:unknown){return String(v??'').replace(/\D/g,'')}
function safeText(v:unknown,max=120){return String(v??'').trim().slice(0,max)}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)})
  if(req.method!=='POST')return out(req,{error:'method_not_allowed'},405)
  try{
    const origin=req.headers.get('origin')||''
    if(origin&&!allowedOrigins.has(origin))return out(req,{error:'origin_not_allowed'},403)
    const auth=req.headers.get('authorization')||''
    if(!auth)return out(req,{error:'unauthorized'},401)
    const jwt=auth.replace(/^Bearer\s+/i,'')
    const {data:{user},error:userError}=await admin.auth.getUser(jwt)
    if(userError||!user)return out(req,{error:'unauthorized'},401)

    const body=await req.json().catch(()=>({})) as any
    const org=String(body.organization_id||'')
    if(!/^[0-9a-f-]{36}$/i.test(org))return out(req,{error:'organization_required'},400)
    const {data:member}=await admin.from('organization_members').select('role,status').eq('organization_id',org).eq('user_id',user.id).eq('status','active').maybeSingle()
    if(!member||!['owner','admin'].includes(String(member.role)))return out(req,{error:'forbidden'},403)

    const [prior]=await sql`select c.id,c.metadata,r.access_token_secret_id,s.decrypted_secret as access_token from public.integration_connections c left join private.integration_token_refs r on r.connection_id=c.id left join vault.decrypted_secrets s on s.id=r.access_token_secret_id where c.organization_id=${org}::uuid and c.provider='meta' limit 1`
    const providedToken=String(body.access_token||'').trim()
    if(providedToken&&(providedToken.length<20||providedToken.length>4096||/[\r\n]/.test(providedToken)))return out(req,{error:'invalid_meta_access_token'},400)
    const token=providedToken||String(prior?.access_token||'')
    if(!token)return out(req,{error:'meta_access_token_required'},409)

    const datasetId=digits(body.dataset_id||body.pixel_id||prior?.metadata?.dataset_id)
    if(!/^\d{5,32}$/.test(datasetId))return out(req,{error:'invalid_meta_dataset_id'},400)
    const apiVersion=/^v\d{1,2}\.\d$/.test(String(body.api_version||''))?String(body.api_version):safeText(prior?.metadata?.api_version||'v23.0',20)
    const testEventCode=safeText(body.test_event_code,80)
    const minQualityRaw=Number(body.min_quality_score)
    const minQuality=Number.isFinite(minQualityRaw)?Math.min(100,Math.max(0,minQualityRaw)):Number(prior?.metadata?.min_quality_score??60)

    const graph=await fetch(`https://graph.facebook.com/${apiVersion}/${encodeURIComponent(datasetId)}?fields=id,name`,{
      headers:{authorization:`Bearer ${token}`,'accept':'application/json'},
      signal:AbortSignal.timeout(12000)
    })
    const graphData=await graph.json().catch(()=>({})) as any
    if(!graph.ok||!graphData?.id){
      const code=Number(graphData?.error?.code||0)
      const status=graph.status===401||code===190?401:400
      return out(req,{error:'meta_connection_validation_failed',meta_code:code||null},status)
    }
    if(String(graphData.id)!==datasetId)return out(req,{error:'meta_dataset_mismatch'},400)

    const result=await sql.begin(async tx=>{
      const [existing]=await tx`select id,metadata from public.integration_connections where organization_id=${org}::uuid and provider='meta' limit 1 for update`
      const existingMeta=(existing?.metadata&&typeof existing.metadata==='object')?existing.metadata:{}
      const metadata={...existingMeta,dataset_id:datasetId,pixel_id:datasetId,api_version:apiVersion,dataset_name:safeText(graphData.name||'Meta Dataset',180),test_event_code:testEventCode||null,require_marketing_consent:true,min_quality_score:minQuality,configured_at:new Date().toISOString(),configured_by_user_id:user.id}
      let connectionId:string
      if(existing?.id){
        connectionId=String(existing.id)
        await tx`update public.integration_connections set status='connected',external_account_id=${datasetId},display_name=${safeText(graphData.name||'Meta Dataset',180)},granted_scopes=array['conversions_api']::text[],metadata=${JSON.stringify(metadata)}::jsonb,connected_at=coalesce(connected_at,now()),last_error=null,updated_at=now() where id=${connectionId}::uuid`
      }else{
        const [created]=await tx`insert into public.integration_connections(organization_id,provider,status,external_account_id,display_name,granted_scopes,metadata,connected_at) values(${org}::uuid,'meta','connected',${datasetId},${safeText(graphData.name||'Meta Dataset',180)},array['conversions_api']::text[],${JSON.stringify(metadata)}::jsonb,now()) returning id`
        connectionId=String(created.id)
      }

      const [refs]=await tx`select access_token_secret_id from private.integration_token_refs where connection_id=${connectionId}::uuid limit 1`
      let accessId=refs?.access_token_secret_id as string|undefined
      if(providedToken){
        if(accessId)await tx`select vault.update_secret(${accessId}::uuid,${providedToken})`
        else{const [secret]=await tx`select vault.create_secret(${providedToken},${`oauth_${connectionId}_access`},'LISTIA Meta Conversions API access token') as id`;accessId=String(secret.id)}
      }
      if(!accessId&&prior?.access_token_secret_id)accessId=String(prior.access_token_secret_id)
      if(!accessId)throw new Error('meta_token_secret_missing')
      await tx`insert into private.integration_token_refs(connection_id,access_token_secret_id,refresh_token_secret_id,token_expires_at,token_metadata,updated_at) values(${connectionId}::uuid,${accessId}::uuid,null,null,${JSON.stringify({provider:'meta',kind:'conversions_api',dataset_id:datasetId})}::jsonb,now()) on conflict(connection_id) do update set access_token_secret_id=excluded.access_token_secret_id,refresh_token_secret_id=null,token_expires_at=null,token_metadata=excluded.token_metadata,updated_at=now()`
      await tx`update public.conversion_signals set delivery_status='pending',last_error=null,updated_at=now() where organization_id=${org}::uuid and delivery_status='waiting' and 'meta'=any(platforms)`
      return{connection_id:connectionId,metadata}
    })

    return out(req,{ok:true,connected:true,connection_id:result.connection_id,dataset_id:datasetId,dataset_name:result.metadata.dataset_name,test_mode:Boolean(testEventCode),min_quality_score:minQuality,token_reused:!providedToken})
  }catch(e){
    console.error('meta-capi-config',e instanceof Error?e.message:String(e))
    return out(req,{error:'internal_error'},500)
  }
})
