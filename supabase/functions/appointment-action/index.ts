import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
const URL=Deno.env.get('SUPABASE_URL')!,SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,ANON=Deno.env.get('SUPABASE_ANON_KEY')!
const admin=createClient(URL,SERVICE,{auth:{persistSession:false}})
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json','cache-control':'no-store'}})
const map:any={confirm:'confirmed',complete:'completed',cancel:'cancelled',no_show:'no_show'}
Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'method_not_allowed'},405)
 const auth=req.headers.get('authorization')||'';const client=createClient(URL,ANON,{global:{headers:{Authorization:auth}},auth:{persistSession:false}})
 const {data:{user}}=await client.auth.getUser();if(!user)return json({error:'unauthorized'},401)
 const body=await req.json().catch(()=>null);if(!body)return json({error:'invalid_json'},400)
 const appointmentId=String(body.appointment_id||''),action=String(body.action||'');const next=map[action];if(!appointmentId||!next)return json({error:'invalid_action'},400)
 const {data:appt}=await admin.from('appointments').select('id,organization_id,status').eq('id',appointmentId).maybeSingle();if(!appt)return json({error:'not_found'},404)
 const {data:member}=await admin.from('organization_members').select('role,status').eq('organization_id',appt.organization_id).eq('user_id',user.id).eq('status','active').maybeSingle();if(!member||!['owner','admin'].includes(String(member.role)))return json({error:'forbidden'},403)
 const current=String(appt.status||'');const allowed:any={scheduled:['confirmed','cancelled','no_show'],confirmed:['completed','cancelled','no_show'],completed:[],cancelled:[],no_show:[]};if(!(allowed[current]||[]).includes(next))return json({error:'invalid_transition',current,next},409)
 const {error}=await admin.from('appointments').update({status:next,updated_at:new Date().toISOString()}).eq('id',appointmentId);if(error)return json({error:'update_failed'},500)
 return json({ok:true,status:next})
})
