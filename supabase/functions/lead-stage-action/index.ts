import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
const URL=Deno.env.get('SUPABASE_URL')!,SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,ANON=Deno.env.get('SUPABASE_ANON_KEY')!
const admin=createClient(URL,SERVICE,{auth:{persistSession:false}})
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json','cache-control':'no-store'}})
const allowed:any={new:['active','qualified','cold','closed'],active:['qualified','appointment','cold','closed'],qualified:['appointment','cold','closed'],appointment:['cold','closed'],cold:['active','closed'],closed:[]}
Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'method_not_allowed'},405)
 const auth=req.headers.get('authorization')||'';const client=createClient(URL,ANON,{global:{headers:{Authorization:auth}},auth:{persistSession:false}})
 const {data:{user}}=await client.auth.getUser();if(!user)return json({error:'unauthorized'},401)
 const body=await req.json().catch(()=>null);if(!body)return json({error:'invalid_json'},400)
 const id=String(body.lead_id||''),next=String(body.stage||'');if(!id||!['new','active','qualified','appointment','cold','closed'].includes(next))return json({error:'invalid_stage'},400)
 const {data:lead}=await admin.from('leads').select('id,organization_id,contact_id,status,quality_score').eq('id',id).maybeSingle();if(!lead)return json({error:'not_found'},404)
 const {data:member}=await admin.from('organization_members').select('role,status').eq('organization_id',lead.organization_id).eq('user_id',user.id).eq('status','active').maybeSingle();if(!member||!['owner','admin'].includes(String(member.role)))return json({error:'forbidden'},403)
 const current=String(lead.status||'new');if(current===next)return json({ok:true,status:next,unchanged:true});if(!(allowed[current]||[]).includes(next))return json({error:'invalid_transition',current,next},409)
 const now=new Date().toISOString();const {error}=await admin.from('leads').update({status:next,last_activity_at:now,updated_at:now}).eq('id',id);if(error)return json({error:'update_failed'},500)
 await admin.from('lead_events').insert({organization_id:lead.organization_id,lead_id:id,contact_id:lead.contact_id,event_type:'stage_changed',from_stage:current,to_stage:next,quality_score:lead.quality_score,occurred_at:now,source:'listia_office',metadata:{actor_user_id:user.id}})
 return json({ok:true,status:next})
})
