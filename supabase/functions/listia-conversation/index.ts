import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const allowedOrigins = new Set(['https://listia-pwa.pages.dev','https://app.listiaapp.com','https://listiaapp.com','https://www.listiaapp.com'])
const cors=(req:Request)=>{const origin=req.headers.get('origin')||'';return {'access-control-allow-origin':allowedOrigins.has(origin)?origin:'https://app.listiaapp.com','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'authorization, x-client-info, apikey, content-type','vary':'Origin'}}
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors(req),'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})
const clean=(v:unknown,max=2000)=>String(v||'').trim().slice(0,max)

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)})
 if(req.method!=='POST')return json(req,{error:'method_not_allowed'},405)
 try{
  const origin=req.headers.get('origin')||'';if(origin&&!allowedOrigins.has(origin))return json(req,{error:'origin_not_allowed'},403)
  const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!jwt)return json(req,{error:'unauthorized'},401)
  const admin=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:userData,error:userError}=await admin.auth.getUser(jwt);const user=userData?.user;if(userError||!user)return json(req,{error:'unauthorized'},401)
  const body=await req.json().catch(()=>({})) as {message?:string;locale?:string;history?:Array<{role?:string;content?:string}>}
  const message=clean(body.message,4000);if(!message)return json(req,{error:'message_required'},400)
  const locale=clean(body.locale,16)||'en'
  const {data:member}=await admin.from('organization_members').select('organization_id,role,status').eq('user_id',user.id).eq('status','active').limit(1).maybeSingle()
  if(!member?.organization_id)return json(req,{error:'organization_access_denied'},403)
  const orgId=member.organization_id
  const [{data:org},{data:billing},{data:properties},{data:leads},{data:appointments}]=await Promise.all([
   admin.from('organizations').select('id,name,business_type,primary_market').eq('id',orgId).maybeSingle(),
   admin.from('organization_billing').select('plan_key,billing_status,access_state').eq('organization_id',orgId).maybeSingle(),
   admin.from('properties').select('id,title,status,operation,price,currency,location_text').eq('organization_id',orgId).limit(20),
   admin.from('leads').select('id,status,created_at').eq('organization_id',orgId).order('created_at',{ascending:false}).limit(20),
   admin.from('appointments').select('id,status,start_at').eq('organization_id',orgId).order('start_at',{ascending:true}).limit(20)
  ])
  const history=(Array.isArray(body.history)?body.history:[]).slice(-10).map(x=>({role:x.role==='assistant'?'assistant':'user',content:clean(x.content,1200)})).filter(x=>x.content)
  const context={organization:org||null,billing:billing||null,properties:properties||[],lead_count:leads?.length||0,appointments:appointments||[]}

  const nvidiaKey=Deno.env.get('NVIDIA_API_KEY')||Deno.env.get('NIM_API_KEY')||''
  const genericKey=Deno.env.get('LISTIA_LLM_API_KEY')||Deno.env.get('OPENAI_API_KEY')||''
  const useNvidia=Boolean(nvidiaKey)
  const providerUrl=useNvidia?'https://integrate.api.nvidia.com/v1/chat/completions':(Deno.env.get('LISTIA_LLM_URL')||'https://api.openai.com/v1/chat/completions')
  const providerKey=useNvidia?nvidiaKey:genericKey
  const model=useNvidia?(Deno.env.get('LISTIA_NVIDIA_MODEL')||'nvidia/nemotron-3.5-lightning-30b-a3b'):(Deno.env.get('LISTIA_LLM_MODEL')||'gpt-4.1-mini')
  if(!providerKey)return json(req,{ok:true,mode:'contextual_fallback',provider:'none',reply:locale.startsWith('es')?'Entendí tu mensaje. Ya tengo el contexto de tu cuenta y puedo seguir ejecutando las acciones disponibles en LISTIA.':'I understood you. I have your account context and can keep executing the actions currently available in LISTIA.',action:{type:'none'}})

  const system=`You are LISTIA, an AI operating system for real-estate professionals. Speak naturally and concisely like a capable conversational assistant, never like a menu or command parser. Reply in the user's language (${locale}). Use the supplied account context when relevant. Do not invent account facts. If the user wants an action that the browser can perform, return a JSON action object as well as a natural reply. Allowed action types: open_screen, marketplace_search, add_property, open_leads, open_agenda, none. For marketplace_search include criteria when explicit. Ask only for genuinely missing information. Output strict JSON: {"reply":"...","action":{"type":"none"}}.`
  const payload:any={model,temperature:.3,max_tokens:700,response_format:{type:'json_object'},messages:[{role:'system',content:system},{role:'system',content:`Account context: ${JSON.stringify(context)}`},...history,{role:'user',content:message}]}
  if(useNvidia)payload.chat_template_kwargs={enable_thinking:false}
  const r=await fetch(providerUrl,{method:'POST',headers:{'authorization':`Bearer ${providerKey}`,'content-type':'application/json'},body:JSON.stringify(payload)})
  if(!r.ok){console.error('LISTIA provider',useNvidia?'nvidia':'generic',r.status,await r.text());return json(req,{error:'conversation_provider_error',provider:useNvidia?'nvidia':'generic'},502)}
  const data=await r.json();const raw=data?.choices?.[0]?.message?.content||'';let parsed:any={};try{parsed=JSON.parse(raw)}catch{parsed={reply:raw,action:{type:'none'}}}
  return json(req,{ok:true,mode:'llm',provider:useNvidia?'nvidia_nemotron':'generic',model,reply:clean(parsed.reply,4000),action:parsed.action&&typeof parsed.action==='object'?parsed.action:{type:'none'}})
 }catch(error){console.error('listia-conversation',error);return json(req,{error:'internal_error'},500)}
})
