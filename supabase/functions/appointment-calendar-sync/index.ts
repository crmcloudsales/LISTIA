import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'

const DB=Deno.env.get('SUPABASE_DB_URL')||''
const GOOGLE_CLIENT_ID=Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')||''
const GOOGLE_CLIENT_SECRET=Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')||''
const sql=postgres(DB,{prepare:false})

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}})

async function sha256(value:string){const d=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));return [...d].map(b=>b.toString(16).padStart(2,'0')).join('')}
function constantTimeEqual(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
async function authorized(req:Request){const supplied=req.headers.get('x-listia-calendar-sync-key')||'';if(!supplied||supplied.length>256||!DB)return false;const[row]=await sql`select decrypted_secret from vault.decrypted_secrets where name='listia_calendar_sync_secret' limit 1`;const expected=String(row?.decrypted_secret||'');return Boolean(expected)&&constantTimeEqual(await sha256(supplied),await sha256(expected))}

function eventId(appointmentId:string){return `listia${appointmentId.replaceAll('-','').toLowerCase()}`}
function isoEnd(start:string,end?:string|null){if(end){const d=new Date(end);if(Number.isFinite(d.getTime()))return d.toISOString()}const s=new Date(start);return new Date(s.getTime()+60*60*1000).toISOString()}
function safeTitle(value:unknown){const v=String(value||'').trim().slice(0,300);return v||'LISTIA Appointment'}

async function refreshToken(row:any){
  if(!row.refresh_token)throw new Error('google_refresh_token_missing')
  if(!GOOGLE_CLIENT_ID||!GOOGLE_CLIENT_SECRET)throw new Error('google_oauth_server_credentials_missing')
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:GOOGLE_CLIENT_ID,client_secret:GOOGLE_CLIENT_SECRET,refresh_token:String(row.refresh_token),grant_type:'refresh_token'})})
  const data=await r.json().catch(()=>({})) as any
  if(!r.ok||!data.access_token)throw new Error(`google_refresh_failed_${r.status}`)
  const expiresAt=new Date(Date.now()+Math.max(60,Number(data.expires_in)||3600)*1000).toISOString()
  await sql.begin(async tx=>{
    await tx`select vault.update_secret(${row.access_token_secret_id}::uuid,${String(data.access_token)})`
    await tx`update private.integration_token_refs set token_expires_at=${expiresAt}::timestamptz,token_metadata=coalesce(token_metadata,'{}'::jsonb)||jsonb_build_object('token_type',coalesce(${String(data.token_type||'Bearer')},'Bearer'),'refreshed_at',now()),updated_at=now() where connection_id=${row.connection_id}::uuid`
  })
  return String(data.access_token)
}

async function accessToken(row:any,forceRefresh=false){
  const expires=row.token_expires_at?new Date(row.token_expires_at).getTime():null
  const expiring=expires!==null&&Number.isFinite(expires)&&expires<=Date.now()+120000
  if(forceRefresh||!row.access_token||expiring)return await refreshToken(row)
  return String(row.access_token)
}

async function googleFetch(url:string,init:RequestInit,row:any){
  let token=await accessToken(row,false)
  const perform=(t:string)=>fetch(url,{...init,headers:{...(init.headers||{}),authorization:`Bearer ${t}`,'content-type':'application/json','accept':'application/json'}})
  let r=await perform(token)
  if(r.status===401&&row.refresh_token){token=await accessToken(row,true);r=await perform(token)}
  return r
}

async function appointmentContext(job:any){
  const [row]=await sql`
    select
      a.id,a.organization_id,a.title,a.starts_at,a.ends_at,a.meeting_type,a.status,a.external_event_id,
      c.id as connection_id,c.metadata->>'calendar_id' as calendar_id,c.granted_scopes,
      tr.access_token_secret_id,tr.refresh_token_secret_id,tr.token_expires_at,
      (select decrypted_secret from vault.decrypted_secrets where id=tr.access_token_secret_id limit 1) as access_token,
      (select decrypted_secret from vault.decrypted_secrets where id=tr.refresh_token_secret_id limit 1) as refresh_token
    from public.appointments a
    left join lateral (
      select * from public.integration_connections x
      where x.organization_id=a.organization_id and x.provider='google' and x.status='connected'
        and nullif(x.metadata->>'calendar_id','') is not null
      order by x.connected_at desc nulls last,x.created_at desc
      limit 1
    ) c on true
    left join private.integration_token_refs tr on tr.connection_id=c.id
    where a.id=${job.appointment_id}::uuid and a.organization_id=${job.organization_id}::uuid
    limit 1
  `
  return row||null
}

async function markConnection(connectionId:string|undefined,error:string|null){if(!connectionId)return;await sql`update public.integration_connections set last_synced_at=case when ${error}::text is null then now() else last_synced_at end,last_error=${error},updated_at=now() where id=${connectionId}::uuid`}

async function upsertEvent(row:any){
  if(!row.connection_id||!row.calendar_id)throw new Error('google_calendar_connection_unavailable')
  if(!Array.isArray(row.granted_scopes)||!row.granted_scopes.includes('https://www.googleapis.com/auth/calendar.app.created'))throw new Error('google_calendar_scope_missing')
  const id=String(row.external_event_id||eventId(String(row.id)))
  const calendar=encodeURIComponent(String(row.calendar_id))
  const event=encodeURIComponent(id)
  const body={
    id,
    summary:safeTitle(row.title),
    description:`Managed by LISTIA. Status: ${String(row.status||'scheduled')}.`,
    start:{dateTime:new Date(row.starts_at).toISOString()},
    end:{dateTime:isoEnd(String(row.starts_at),row.ends_at)},
    extendedProperties:{private:{listia_appointment_id:String(row.id),listia_managed:'true'}},
  }
  const patchUrl=`https://www.googleapis.com/calendar/v3/calendars/${calendar}/events/${event}`
  let r=await googleFetch(patchUrl,{method:'PATCH',body:JSON.stringify(body)},row)
  if(r.status===404){
    const createUrl=`https://www.googleapis.com/calendar/v3/calendars/${calendar}/events`
    r=await googleFetch(createUrl,{method:'POST',body:JSON.stringify(body)},row)
    if(r.status===409)r=await googleFetch(patchUrl,{method:'PATCH',body:JSON.stringify(body)},row)
  }
  const text=await r.text()
  if(!r.ok)throw new Error(`google_event_upsert_${r.status}:${text.slice(0,180)}`)
  const data=text?JSON.parse(text):{}
  const finalId=String(data?.id||id)
  await sql`update public.appointments set external_event_id=${finalId},updated_at=now() where id=${row.id}::uuid and organization_id=${row.organization_id}::uuid`
  await markConnection(row.connection_id,null)
  return finalId
}

async function deleteEvent(row:any){
  if(!row.connection_id||!row.calendar_id)throw new Error('google_calendar_connection_unavailable')
  const id=String(row.external_event_id||eventId(String(row.id)))
  const url=`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(String(row.calendar_id))}/events/${encodeURIComponent(id)}`
  const r=await googleFetch(url,{method:'DELETE'},row)
  if(!r.ok&&r.status!==404&&r.status!==410){const text=await r.text();throw new Error(`google_event_delete_${r.status}:${text.slice(0,180)}`)}
  await sql`update public.appointments set external_event_id=null,updated_at=now() where id=${row.id}::uuid and organization_id=${row.organization_id}::uuid`
  await markConnection(row.connection_id,null)
  return id
}

async function claimOne(){return await sql.begin(async tx=>{const[job]=await tx`select appointment_id,organization_id,desired_action,status,attempt_count from private.appointment_calendar_sync_jobs where status in ('pending','retry') and next_attempt_at<=now() order by next_attempt_at asc,created_at asc for update skip locked limit 1`;if(!job)return null;const[claimed]=await tx`update private.appointment_calendar_sync_jobs set status='processing',attempt_count=attempt_count+1,updated_at=now() where appointment_id=${job.appointment_id}::uuid returning appointment_id,organization_id,desired_action,status,attempt_count`;return claimed||null})}

async function retry(job:any,error:unknown,connectionId?:string){const message=String((error as Error)?.message||error).slice(0,500);const attempts=Number(job.attempt_count||1);const terminal=attempts>=8;const delay=Math.min(60,Math.max(1,2**Math.min(attempts,6)));await sql`update private.appointment_calendar_sync_jobs set status=${terminal?'failed':'retry'},next_attempt_at=now()+(${delay}*interval '1 minute'),last_error=${message},updated_at=now() where appointment_id=${job.appointment_id}::uuid`;await markConnection(connectionId,message);return{status:terminal?'failed':'retry',appointment_id:job.appointment_id,error:message}}

async function processOne(){
  const job=await claimOne();if(!job)return{status:'empty'}
  let row:any=null
  try{
    row=await appointmentContext(job)
    if(!row){await sql`delete from private.appointment_calendar_sync_jobs where appointment_id=${job.appointment_id}::uuid`;return{status:'discarded',appointment_id:job.appointment_id,reason:'appointment_missing'}}
    --job.desired_action is coalesced by the trigger; appointment state is rechecked here.
    const action=row.status==='cancelled'?'delete':row.status==='scheduled'||row.status==='confirmed'?'upsert':null
    if(!action){await sql`delete from private.appointment_calendar_sync_jobs where appointment_id=${job.appointment_id}::uuid`;return{status:'discarded',appointment_id:job.appointment_id,reason:'state_no_longer_syncable'}}
    const externalId=action==='delete'?await deleteEvent(row):await upsertEvent(row)
    await sql`delete from private.appointment_calendar_sync_jobs where appointment_id=${job.appointment_id}::uuid`
    return{status:'completed',appointment_id:job.appointment_id,action,external_event_id:action==='delete'?null:externalId}
  }catch(error){return await retry(job,error,row?.connection_id)}
}

Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return json({error:'method_not_allowed'},405)
  if(!(await authorized(req)))return json({error:'unauthorized'},401)
  if(!DB)return json({error:'database_not_configured'},503)
  const body=await req.json().catch(()=>({})) as any
  const limit=Math.min(Math.max(Number(body?.limit)||10,1),25)
  const results:any[]=[]
  for(let i=0;i<limit;i++){const result=await processOne();results.push(result);if(result.status==='empty')break}
  return json({ok:true,processed:results.filter(x=>x.status!=='empty').length,results})
})
