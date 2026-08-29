import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'

const URL=Deno.env.get('SUPABASE_URL')!
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const DB=Deno.env.get('SUPABASE_DB_URL')!
const admin=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}})
const sql=postgres(DB,{prepare:false,max:2})
const allowedOrigins=new Set(['https://app.listiaapp.com','https://listia-pwa.pages.dev'])
const keys=['qualified_lead','appointment','conversion'] as const

function cors(req:Request){const o=req.headers.get('origin')||'';return{'access-control-allow-origin':allowedOrigins.has(o)?o:'https://app.listiaapp.com','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'authorization, apikey, content-type','vary':'Origin'}}
function out(req:Request,b:unknown,s=200){return new Response(JSON.stringify(b),{status:s,headers:{...cors(req),'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}})}
function digits(v:unknown){return String(v??'').replace(/\D/g,'')}
function version(v:unknown){const x=String(v??'');return /^20\d{4}$/.test(x)?x:'202608'}

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)})
 if(req.method!=='POST')return out(req,{error:'method_not_allowed'},405)
 try{
  const origin=req.headers.get('origin')||''
  if(origin&&!allowedOrigins.has(origin))return out(req,{error:'origin_not_allowed'},403)
  const auth=req.headers.get('authorization')||''
  if(!auth)return out(req,{error:'unauthorized'},401)
  const {data:{user},error:userError}=await admin.auth.getUser(auth.replace(/^Bearer\s+/i,''))
  if(userError||!user)return out(req,{error:'unauthorized'},401)
  const body=await req.json().catch(()=>({})) as any
  const org=String(body.organization_id||'')
  if(!/^[0-9a-f-]{36}$/i.test(org))return out(req,{error:'organization_required'},400)
  const {data:member}=await admin.from('organization_members').select('role,status').eq('organization_id',org).eq('user_id',user.id).eq('status','active').maybeSingle()
  if(!member||!['owner','admin'].includes(String(member.role)))return out(req,{error:'forbidden'},403)

  const [prior]=await sql`select c.id,c.metadata,r.access_token_secret_id,s.decrypted_secret as access_token from public.integration_connections c left join private.integration_token_refs r on r.connection_id=c.id left join vault.decrypted_secrets s on s.id=r.access_token_secret_id where c.organization_id=${org}::uuid and c.provider='linkedin' limit 1`
  const accountId=digits(body.sponsored_account_id||body.account_id||prior?.metadata?.sponsored_account_id)
  if(!/^\d{3,32}$/.test(accountId))return out(req,{error:'invalid_linkedin_account_id'},400)
  const providedToken=String(body.access_token||'').trim()
  if(providedToken&&(providedToken.length<20||providedToken.length>4096||/[\r\n]/.test(providedToken)))return out(req,{error:'invalid_linkedin_access_token'},400)
  const token=providedToken||String(prior?.access_token||'')
  if(!token)return out(req,{error:'linkedin_access_token_required'},409)
  const apiVersion=version(body.linkedin_version||prior?.metadata?.linkedin_version)
  const input=body.conversion_ids||{}
  const previous=(prior?.metadata?.conversion_ids&&typeof prior.metadata.conversion_ids==='object')?prior.metadata.conversion_ids:{}
  const ids:Record<string,string>={...previous}
  for(const k of keys){const id=digits(input[k]);if(id)ids[k]=id}
  const configured=keys.filter(k=>/^\d{1,32}$/.test(String(ids[k]||'')))
  if(configured.length===0)return out(req,{error:'linkedin_conversion_required'},400)

  const accountUrn=`urn:li:sponsoredAccount:${accountId}`
  const names:Record<string,string>={}
  for(const k of configured){
   const id=ids[k]
   const u=new URL(`https://api.linkedin.com/rest/conversions/${encodeURIComponent(id)}`)
   u.searchParams.set('account',accountUrn)
   const r=await fetch(u,{headers:{authorization:`Bearer ${token}`,'Linkedin-Version':apiVersion,'X-Restli-Protocol-Version':'2.0.0','accept':'application/json'},signal:AbortSignal.timeout(12000)})
   const data=await r.json().catch(()=>({})) as any
   if(!r.ok)return out(req,{error:'linkedin_connection_validation_failed',conversion_type:k,http_status:r.status},r.status===401?401:400)
   if(data?.conversionMethod&&String(data.conversionMethod)!=='CONVERSIONS_API')return out(req,{error:'linkedin_rule_not_conversions_api',conversion_type:k},400)
   if(data?.enabled===false)return out(req,{error:'linkedin_rule_disabled',conversion_type:k},400)
   names[k]=String(data?.name||`Conversion ${id}`).slice(0,180)
  }

  const minRaw=Number(body.min_quality_score)
  const minQuality=Number.isFinite(minRaw)?Math.min(100,Math.max(0,minRaw)):Number(prior?.metadata?.min_quality_score??60)
  const result=await sql.begin(async tx=>{
   const [existing]=await tx`select id,metadata from public.integration_connections where organization_id=${org}::uuid and provider='linkedin' limit 1 for update`
   const old=(existing?.metadata&&typeof existing.metadata==='object')?existing.metadata:{}
   const metadata={...old,sponsored_account_id:accountId,account_urn:accountUrn,conversion_ids:ids,conversion_names:{...(old.conversion_names||{}),...names},linkedin_version:apiVersion,require_marketing_consent:true,min_quality_score:minQuality,configured_at:new Date().toISOString(),configured_by_user_id:user.id}
   let connectionId:string
   if(existing?.id){connectionId=String(existing.id);await tx`update public.integration_connections set status='connected',external_account_id=${accountId},display_name=${`LinkedIn Ads ${accountId}`},granted_scopes=array['conversions_api']::text[],metadata=${JSON.stringify(metadata)}::jsonb,connected_at=coalesce(connected_at,now()),last_error=null,updated_at=now() where id=${connectionId}::uuid`}
   else{const [created]=await tx`insert into public.integration_connections(organization_id,provider,status,external_account_id,display_name,granted_scopes,metadata,connected_at) values(${org}::uuid,'linkedin','connected',${accountId},${`LinkedIn Ads ${accountId}`},array['conversions_api']::text[],${JSON.stringify(metadata)}::jsonb,now()) returning id`;connectionId=String(created.id)}
   const [refs]=await tx`select access_token_secret_id from private.integration_token_refs where connection_id=${connectionId}::uuid limit 1`
   let accessId=refs?.access_token_secret_id as string|undefined
   if(providedToken){if(accessId)await tx`select vault.update_secret(${accessId}::uuid,${providedToken})`;else{const [secret]=await tx`select vault.create_secret(${providedToken},${`oauth_${connectionId}_access`},'LISTIA LinkedIn Conversions API access token') as id`;accessId=String(secret.id)}}
   if(!accessId&&prior?.access_token_secret_id)accessId=String(prior.access_token_secret_id)
   if(!accessId)throw new Error('linkedin_token_secret_missing')
   await tx`insert into private.integration_token_refs(connection_id,access_token_secret_id,refresh_token_secret_id,token_expires_at,token_metadata,updated_at) values(${connectionId}::uuid,${accessId}::uuid,null,null,${JSON.stringify({provider:'linkedin',kind:'conversions_api',sponsored_account_id:accountId})}::jsonb,now()) on conflict(connection_id) do update set access_token_secret_id=excluded.access_token_secret_id,refresh_token_secret_id=null,token_expires_at=null,token_metadata=excluded.token_metadata,updated_at=now()`
   await tx`update public.conversion_signals set delivery_status='pending',last_error=null,updated_at=now() where organization_id=${org}::uuid and delivery_status='waiting' and 'linkedin'=any(platforms)`
   return connectionId
  })
  return out(req,{ok:true,connected:true,connection_id:result,sponsored_account_id:accountId,linkedin_version:apiVersion,configured_actions:configured,min_quality_score:minQuality,token_reused:!providedToken})
 }catch(e){console.error('linkedin-conversions-config',e instanceof Error?e.message:String(e));return out(req,{error:'internal_error'},500)}
})
