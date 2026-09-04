import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'

const URL=Deno.env.get('SUPABASE_URL')!
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const DB=Deno.env.get('SUPABASE_DB_URL')!
const admin=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}})
const sql=postgres(DB,{prepare:false})
const origins=new Set(['https://app.listiaapp.com','https://listia-pwa.pages.dev','http://localhost','http://127.0.0.1'])
const meetingTypes=new Set(['in_person','google_meet','zoom','teams','phone','other'])
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const cors=(origin:string)=>({'access-control-allow-origin':origins.has(origin)?origin:'https://app.listiaapp.com','access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type','vary':'Origin'})
const json=(origin:string,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors(origin),'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}})
const clean=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):''

async function consumeRate(userId:string,organizationId:string){const key=`${userId}:${organizationId}:appointment_create`;return await sql.begin(async tx=>{await tx`select pg_advisory_xact_lock(hashtextextended(${key},0))`;const[b]=await tx`insert into private.security_rate_limits(principal_id,organization_id,action,window_started_at,request_count,updated_at) values(${userId}::uuid,${organizationId}::uuid,'appointment_create',now(),1,now()) on conflict(principal_id,organization_id,action) do update set window_started_at=case when private.security_rate_limits.window_started_at<=now()-interval '60 seconds' then now() else private.security_rate_limits.window_started_at end,request_count=case when private.security_rate_limits.window_started_at<=now()-interval '60 seconds' then 1 else private.security_rate_limits.request_count+1 end,updated_at=now() returning request_count,greatest(1,ceil(extract(epoch from(window_started_at+interval '60 seconds'-now()))))::int retry_after`;return{allowed:Number(b?.request_count||1)<=30,retryAfter:Number(b?.retry_after||60)}})}

function parseDate(value:unknown){if(typeof value!=='string'||!value)return null;const d=new Date(value);return Number.isFinite(d.getTime())?d:null}
function writeError(origin:string,error:any){const d=`${String(error?.message||'')} ${String(error?.details||'')} ${String(error?.code||'')}`.toLowerCase();if(d.includes('appointment_conflict'))return json(origin,{error:'appointment_conflict'},409);if(d.includes('appointment_assignee_not_active_member'))return json(origin,{error:'invalid_assignee'},409);console.error('appointment-create write',String(error?.code||'unknown'));return json(origin,{error:'write_failed'},500)}

Deno.serve(async req=>{
  const origin=req.headers.get('origin')||''
  if(req.method==='OPTIONS')return origins.has(origin)?new Response(null,{status:204,headers:cors(origin)}):new Response(null,{status:403})
  if(req.method!=='POST')return json(origin,{error:'method_not_allowed'},405)
  if(origin&&!origins.has(origin))return json(origin,{error:'origin_not_allowed'},403)
  const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!jwt)return json(origin,{error:'unauthorized'},401)
  const {data:userData,error:userError}=await admin.auth.getUser(jwt),user=userData?.user;if(userError||!user)return json(origin,{error:'unauthorized'},401)
  const body=await req.json().catch(()=>null) as any;if(!body)return json(origin,{error:'invalid_json'},400)

  const organizationId=clean(body.organization_id,64),appointmentId=clean(body.appointment_id,64)
  if(!uuid.test(organizationId)||!uuid.test(appointmentId))return json(origin,{error:'invalid_identifier'},400)
  const {data:member}=await admin.from('organization_members').select('role,status').eq('organization_id',organizationId).eq('user_id',user.id).eq('status','active').maybeSingle();if(!member)return json(origin,{error:'forbidden'},403)
  const isAdmin=['owner','admin'].includes(String(member.role||''))
  const rate=await consumeRate(user.id,organizationId);if(!rate.allowed)return json(origin,{error:'rate_limited',retry_after:rate.retryAfter},429)

  const start=parseDate(body.starts_at);if(!start)return json(origin,{error:'invalid_start'},400)
  if(start.getTime()<Date.now()-5*60*1000)return json(origin,{error:'start_in_past'},400)
  if(start.getTime()>Date.now()+5*365*24*60*60*1000)return json(origin,{error:'start_too_far'},400)
  const end=body.ends_at?parseDate(body.ends_at):new Date(start.getTime()+60*60*1000)
  if(!end||end<=start)return json(origin,{error:'invalid_end'},400)
  if(end.getTime()-start.getTime()>24*60*60*1000)return json(origin,{error:'duration_too_long'},400)

  const title=clean(body.title,240)||'LISTIA Appointment'
  const meetingType=clean(body.meeting_type,40)||'other';if(!meetingTypes.has(meetingType))return json(origin,{error:'invalid_meeting_type'},400)
  const leadId=clean(body.lead_id,64),propertyId=clean(body.property_id,64),requestedAssignee=clean(body.assigned_user_id,64)
  if(leadId&&!uuid.test(leadId))return json(origin,{error:'invalid_lead'},400)
  if(propertyId&&!uuid.test(propertyId))return json(origin,{error:'invalid_property'},400)
  if(requestedAssignee&&!uuid.test(requestedAssignee))return json(origin,{error:'invalid_assignee'},400)

  let lead:any=null
  if(leadId){const {data}=await admin.from('leads').select('id,status,assigned_user_id,contact_id').eq('id',leadId).eq('organization_id',organizationId).maybeSingle();lead=data;if(!lead)return json(origin,{error:'lead_not_found'},404)}
  if(propertyId){const {data}=await admin.from('properties').select('id').eq('id',propertyId).eq('organization_id',organizationId).maybeSingle();if(!data)return json(origin,{error:'property_not_found'},404)}

  let assignedUserId=String(lead?.assigned_user_id||requestedAssignee||user.id)
  if(!isAdmin&&assignedUserId!==user.id)return json(origin,{error:'lead_assigned_to_other_member'},403)
  const {data:assignee}=await admin.from('organization_members').select('user_id').eq('organization_id',organizationId).eq('user_id',assignedUserId).eq('status','active').maybeSingle();if(!assignee)return json(origin,{error:'invalid_assignee'},400)

  const existing=await admin.from('appointments').select('id,organization_id,title,starts_at,ends_at,status,assigned_user_id,external_event_id').eq('id',appointmentId).maybeSingle()
  if(existing.data){if(existing.data.organization_id!==organizationId)return json(origin,{error:'appointment_id_conflict'},409);return json(origin,{ok:true,unchanged:true,appointment:existing.data})}

  const {data:appointment,error:insertError}=await admin.from('appointments').insert({id:appointmentId,organization_id:organizationId,property_id:propertyId||null,lead_id:leadId||null,title,starts_at:start.toISOString(),ends_at:end.toISOString(),meeting_type:meetingType,status:'scheduled',assigned_user_id:assignedUserId}).select('id,title,starts_at,ends_at,meeting_type,status,assigned_user_id,external_event_id,created_at').single()
  if(insertError)return writeError(origin,insertError)

  if(lead){const now=new Date().toISOString();const previous=String(lead.status||'new');if(previous!=='closed'&&previous!=='appointment'){await admin.from('leads').update({status:'appointment',last_activity_at:now,updated_at:now}).eq('id',leadId).eq('organization_id',organizationId);await admin.from('lead_events').insert({organization_id:organizationId,lead_id:leadId,contact_id:lead.contact_id,event_type:'stage_changed',from_stage:previous,to_stage:'appointment',source:'listia_agenda',metadata:{actor_user_id:user.id,appointment_id:appointmentId},occurred_at:now})}await admin.from('lead_events').insert({organization_id:organizationId,lead_id:leadId,contact_id:lead.contact_id,event_type:'appointment_created',source:'listia_agenda',metadata:{appointment_id:appointmentId,assigned_user_id:assignedUserId,starts_at:start.toISOString()},occurred_at:now});await admin.from('leads').update({last_activity_at:now,updated_at:now}).eq('id',leadId).eq('organization_id',organizationId)}

  return json(origin,{ok:true,appointment},201)
})
