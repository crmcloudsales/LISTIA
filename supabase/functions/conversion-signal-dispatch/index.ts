import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
const URL=Deno.env.get('SUPABASE_URL')!,SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,ANON=Deno.env.get('SUPABASE_ANON_KEY')!
const admin=createClient(URL,SERVICE,{auth:{persistSession:false}})
const out=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json','cache-control':'no-store'}})
Deno.serve(async req=>{
 if(req.method!=='POST')return out({error:'method_not_allowed'},405)
 const auth=req.headers.get('authorization')||'';const client=createClient(URL,ANON,{global:{headers:{Authorization:auth}},auth:{persistSession:false}})
 const {data:{user}}=await client.auth.getUser();if(!user)return out({error:'unauthorized'},401)
 const body=await req.json().catch(()=>({}));const org=String(body.organization_id||'');if(!org)return out({error:'organization_required'},400)
 const {data:member}=await admin.from('organization_members').select('role,status').eq('organization_id',org).eq('user_id',user.id).eq('status','active').maybeSingle();if(!member||!['owner','admin'].includes(String(member.role)))return out({error:'forbidden'},403)
 const {data:connections}=await admin.from('integration_connections').select('provider,status,granted_scopes,metadata').eq('organization_id',org).eq('status','connected')
 const ads=new Set<string>();for(const c of connections||[]){const p=String(c.provider||'').toLowerCase(),scopes=(c.granted_scopes||[]).join(' ').toLowerCase(),m=c.metadata||{};if(p==='meta'&&(m.pixel_id||m.dataset_id||m.ad_account_id))ads.add('meta');if(p==='google'&&(scopes.includes('adwords')||m.customer_id||m.conversion_action_id))ads.add('google');if(p==='tiktok'&&(m.pixel_id||m.advertiser_id))ads.add('tiktok');if(p==='linkedin'&&(m.partner_id||m.conversion_id||m.ad_account_id))ads.add('linkedin')}
 const {data:signals}=await admin.from('conversion_signals').select('id,signal_type,platforms,delivery_status').eq('organization_id',org).in('delivery_status',['pending','failed']).order('created_at',{ascending:true}).limit(50)
 let ready=0,waiting=0;for(const s of signals||[]){const targets=(s.platforms||[]).filter((p:string)=>ads.has(p));if(targets.length){ready++;continue}waiting++}
 return out({ok:true,configured_platforms:[...ads],queued:(signals||[]).length,ready,waiting_for_connection:waiting})
})
