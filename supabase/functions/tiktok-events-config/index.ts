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
function short(v:unknown,max=160){return String(v??'').trim().slice(0,max)}
function sourceId(v:unknown){const s=short(v,128);return /^[A-Za-z0-9._:-]{4,128}$/.test(s)?s:''}

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

    const [prior]=await sql`select c.id,c.metadata,r.access_token_secret_id,s.decrypted_secret as access_token from public.integration_connections c left join private.integration_token_refs r on r.connection_id=c.id left join vault.decrypted_secrets s on s.id=r.access_token_secret_id where c.organization_id=${org}::uuid and c.provider='tiktok' limit 1`
    const advertiserId=digits(body.advertiser_id||prior?.metadata?.advertiser_id)
    if(!/^\d{5,32}$/.test(advertiserId))return out(req,{error:'invalid_tiktok_advertiser_id'},400)
    const pixel=sourceId(body.event_source_id||body.pixel_code||body.pixel_id||prior?.metadata?.event_source_id||prior?.metadata?.pixel_id)
    if(!pixel)return out(req,{error:'invalid_tiktok_pixel_id'},400)
    const providedToken=String(body.access_token||'').trim()
    if(providedToken&&(providedToken.length<20||providedToken.length>4096||/[\r\n]/.test(providedToken)))return out(req,{error:'invalid_tiktok_access_token'},400)
    const token=providedToken||String(prior?.access_token||'')
    if(!token)return out(req,{error:'tiktok_access_token_required'},409)

    const u=new URL('https://business-api.tiktok.com/open_api/v1.3/pixel/list/')
    u.searchParams.set('advertiser_id',advertiserId)
    u.searchParams.set('code',pixel)
    u.searchParams.set('page','1')
    u.searchParams.set('page_size','20')
    const check=await fetch(u,{headers:{'Access-Token':token,'accept':'application/json'},signal:AbortSignal.timeout(12000)})
    const data=await check.json().catch(()=>({})) as any
    const apiCode=Number(data?.code??-1)
    if(!check.ok||apiCode!==0)return out(req,{error:'tiktok_connection_validation_failed',tiktok_code:Number.isFinite(apiCode)?apiCode:null},check.status===401?401:400)
    const list=Array.isArray(data?.data?.list)?data.data.list:Array.isArray(data?.data?.pixels)?data.data.pixels:[]
    const match=list.find((p:any)=>String(p?.code||p?.pixel_code||p?.pixel_id||p?.id||'')===pixel)
    if(!match)return out(req,{error:'tiktok_pixel_not_found'},400)

    const testEventCode=short(body.test_event_code,80)
    const minRaw=Number(body.min_quality_score)
    const minQuality=Number.isFinite(minRaw)?Math.min(100,Math.max(0,minRaw)):Number(prior?.metadata?.min_quality_score??60)
    const name=short(match?.name||match?.pixel_name||'TikTok Pixel',180)
    const result=await sql.begin(async tx=>{
      const [existing]=await tx`select id,metadata from public.integration_connections where organization_id=${org}::uuid and provider='tiktok' limit 1 for update`
      const old=(existing?.metadata&&typeof existing.metadata==='object')?existing.metadata:{}
      const metadata={...old,advertiser_id:advertiserId,event_source_id:pixel,pixel_id:pixel,pixel_code:pixel,pixel_name:name,events_endpoint:'https://business-api.tiktok.com/open_api/v1.3/event/track/',test_event_code:testEventCode||null,require_marketing_consent:true,min_quality_score:minQuality,configured_at:new Date().toISOString(),configured_by_user_id:user.id}
      let connectionId:string
      if(existing?.id){connectionId=String(existing.id);await tx`update public.integration_connections set status='connected',external_account_id=${pixel},display_name=${name},granted_scopes=array['events_api']::text[],metadata=${JSON.stringify(metadata)}::jsonb,connected_at=coalesce(connected_at,now()),last_error=null,updated_at=now() where id=${connectionId}::uuid`}
      else{const [created]=await tx`insert into public.integration_connections(organization_id,provider,status,external_account_id,display_name,granted_scopes,metadata,connected_at) values(${org}::uuid,'tiktok','connected',${pixel},${name},array['events_api']::text[],${JSON.stringify(metadata)}::jsonb,now()) returning id`;connectionId=String(created.id)}
      const [refs]=await tx`select access_token_secret_id from private.integration_token_refs where connection_id=${connectionId}::uuid limit 1`
      let accessId=refs?.access_token_secret_id as string|undefined
      if(providedToken){if(accessId)await tx`select vault.update_secret(${accessId}::uuid,${providedToken})`;else{const [secret]=await tx`select vault.create_secret(${providedToken},${`oauth_${connectionId}_access`},'LISTIA TikTok Events API access token') as id`;accessId=String(secret.id)}}
      if(!accessId&&prior?.access_token_secret_id)accessId=String(prior.access_token_secret_id)
      if(!accessId)throw new Error('tiktok_token_secret_missing')
      await tx`insert into private.integration_token_refs(connection_id,access_token_secret_id,refresh_token_secret_id,token_expires_at,token_metadata,updated_at) values(${connectionId}::uuid,${accessId}::uuid,null,null,${JSON.stringify({provider:'tiktok',kind:'events_api',advertiser_id:advertiserId,event_source_id:pixel})}::jsonb,now()) on conflict(connection_id) do update set access_token_secret_id=excluded.access_token_secret_id,refresh_token_secret_id=null,token_expires_at=null,token_metadata=excluded.token_metadata,updated_at=now()`
      await tx`update public.conversion_signals set delivery_status='pending',last_error=null,updated_at=now() where organization_id=${org}::uuid and delivery_status='waiting' and 'tiktok'=any(platforms)`
      return connectionId
    })
    return out(req,{ok:true,connected:true,connection_id:result,advertiser_id:advertiserId,event_source_id:pixel,pixel_name:name,test_mode:Boolean(testEventCode),min_quality_score:minQuality,token_reused:!providedToken})
  }catch(e){console.error('tiktok-events-config',e instanceof Error?e.message:String(e));return out(req,{error:'internal_error'},500)}
})
