import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
const URL=Deno.env.get('SUPABASE_URL')!,SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,ANON=Deno.env.get('SUPABASE_ANON_KEY')!
const admin=createClient(URL,SERVICE,{auth:{persistSession:false}})
const origins=new Set(['https://app.listiaapp.com','https://listia-pwa.pages.dev','http://localhost','http://127.0.0.1'])
const cors=(o:string)=>({'access-control-allow-origin':origins.has(o)?o:'https://app.listiaapp.com','access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type','vary':'Origin'})
const json=(o:string,b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors(o),'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}})
const map:any={confirm:'confirmed',complete:'completed',cancel:'cancelled',no_show:'no_show'}
Deno.serve(async req=>{
 const o=req.headers.get('origin')||''
 if(req.method==='OPTIONS')return origins.has(o)?new Response(null,{status:204,headers:cors(o)}):new Response(null,{status:403})
 if(req.method!=='POST')return json(o,{error:'method_not_allowed'},405)
 if(o&&!origins.has(o))return json(o,{error:'origin_not_allowed'},403)
 const auth=req.headers.get('authorization')||'';const client=createClient(URL,ANON,{global:{headers:{Authorization:auth}},auth:{persistSession:false}})
 const {data:{user}}=await client.auth.getUser();if(!user)return json(o,{error:'unauthorized'},401)
 const body=await req.json().catch(()=>null);if(!body)return json(o,{error:'invalid_json'},400)
 const appointmentId=String(body.appointment_id||''),action=String(body.action||'');if(!appointmentId||!action)return json(o,{error:'invalid_action'},400)
 const {data:appt}=await admin.from('appointments').select('id,organization_id,lead_id,status,starts_at,ends_at').eq('id',appointmentId).maybeSingle();if(!appt)return json(o,{error:'not_found'},404)
 const {data:member}=await admin.from('organization_members').select('role,status').eq('organization_id',appt.organization_id).eq('user_id',user.id).eq('status','active').maybeSingle();if(!member||!['owner','admin'].includes(String(member.role)))return json(o,{error:'forbidden'},403)
 const current=String(appt.status||'')
 if(action==='reschedule'){
   if(!['scheduled','confirmed'].includes(current))return json(o,{error:'invalid_transition',current},409)
   const start=new Date(String(body.starts_at||''));if(!Number.isFinite(start.getTime()))return json(o,{error:'invalid_start'},400)
   let end:any=null;if(body.ends_at){end=new Date(String(body.ends_at));if(!Number.isFinite(end.getTime())||end<=start)return json(o,{error:'invalid_end'},400)}
   const now=new Date().toISOString();const patch:any={starts_at:start.toISOString(),ends_at:end?end.toISOString():null,status:'scheduled',updated_at:now}
   const {error}=await admin.from('appointments').update(patch).eq('id',appointmentId);if(error)return json(o,{error:'update_failed'},500)
   if(appt.lead_id)await admin.from('lead_events').insert({organization_id:appt.organization_id,lead_id:appt.lead_id,event_type:'appointment_rescheduled',source:'listia',metadata:{appointment_id:appointmentId,previous_starts_at:appt.starts_at,new_starts_at:patch.starts_at},occurred_at:now})
   return json(o,{ok:true,status:'scheduled',starts_at:patch.starts_at,ends_at:patch.ends_at})
 }
 const next=map[action];if(!next)return json(o,{error:'invalid_action'},400)
 const allowed:any={scheduled:['confirmed','cancelled','no_show'],confirmed:['completed','cancelled','no_show'],completed:[],cancelled:[],no_show:[]};if(!(allowed[current]||[]).includes(next))return json(o,{error:'invalid_transition',current,next},409)
 const now=new Date().toISOString();const {error}=await admin.from('appointments').update({status:next,updated_at:now}).eq('id',appointmentId);if(error)return json(o,{error:'update_failed'},500)
 if(appt.lead_id)await admin.from('lead_events').insert({organization_id:appt.organization_id,lead_id:appt.lead_id,event_type:`appointment_${next}`,source:'listia',metadata:{appointment_id:appointmentId},occurred_at:now})
 return json(o,{ok:true,status:next})
})
