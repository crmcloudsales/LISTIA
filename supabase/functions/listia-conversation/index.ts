import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const LISTIA_AI_GATEWAY = Deno.env.get('LISTIA_AI_GATEWAY_URL') || 'https://brain.listiaapp.com/'
const allowedOrigins = new Set(['https://listia-pwa.pages.dev','https://app.listiaapp.com','https://listiaapp.com','https://www.listiaapp.com'])
const cors=(req:Request)=>{const origin=req.headers.get('origin')||'';return {'access-control-allow-origin':allowedOrigins.has(origin)?origin:'https://app.listiaapp.com','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'authorization, x-client-info, apikey, content-type','vary':'Origin'}}
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors(req),'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})
const clean=(v:unknown,max=2000)=>String(v||'').trim().slice(0,max)
const norm=(v:unknown)=>clean(v,4000).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
const first=(v:unknown)=>clean(v,120).split(/\s+/)[0]||''

function fallbackReply(message:string,locale:string,name:string,context:any){
 const t=norm(message),es=locale.startsWith('es'),prefix=name?`${name}, `:''
 if(/marketplace|buscar|busca|encuentra|comprar|rentar|alquilar|find|search|buy|rent/.test(t))return {reply:es?`${prefix}voy al Marketplace y ajusto la búsqueda con lo que me dijiste.`:`${prefix}I’ll open Marketplace and adjust the search from what you told me.`,action:{type:'marketplace_search',criteria:{}}}
 if(/publica|publicar|sube|subir|crea|crear|nueva propiedad|add property|publish|upload/.test(t))return {reply:es?`${prefix}perfecto. Vamos a preparar esa propiedad. Entrégame el material que tengas y continúo desde ahí.`:`${prefix}perfect. Let’s prepare that listing. Give me whatever material you have and I’ll continue from there.`,action:{type:'add_property'}}
 if(/lead|prospect|cliente potencial/.test(t))return {reply:es?`${prefix}abro tus leads para revisar qué necesita seguimiento.`:`${prefix}I’ll open your leads so we can see what needs follow-up.`,action:{type:'open_leads'}}
 if(/cita|agenda|appointment|schedule|meeting/.test(t))return {reply:es?`${prefix}abro tu agenda y revisamos las citas.`:`${prefix}I’ll open your schedule and we can review the appointments.`,action:{type:'open_agenda'}}
 if(/cuantas? propiedades|mis propiedades|listados|listings|inventory/.test(t)){const n=context.properties?.length||0;return {reply:es?`${prefix}tienes ${n} propiedades visibles para mí en este momento. Te llevo a Listados.`:`${prefix}I can see ${n} listings right now. I’ll take you to Listings.`,action:{type:'open_screen',screen:'screen-properties'}}}
 if(/como va|cómo va|resumen|estado|summary|status|hoy|today/.test(t)){const p=context.properties?.length||0,l=context.lead_count||0,a=context.appointments?.length||0;return {reply:es?`${prefix}ahora mismo veo ${p} propiedades, ${l} leads recientes y ${a} citas en tu contexto. ¿Qué quieres que priorice?`:`${prefix}right now I can see ${p} listings, ${l} recent leads and ${a} appointments in your context. What should I prioritize?`,action:{type:'none'}}}
 return {reply:es?`${prefix}te escucho. Dime qué quieres lograr y seguimos desde ahí.`:`${prefix}I’m listening. Tell me what you want to achieve and we’ll continue from there.`,action:{type:'none'}}
}

function safeAction(action:any){
 const allowed=new Set(['open_screen','marketplace_search','add_property','open_leads','open_agenda','none'])
 const type=allowed.has(String(action?.type||''))?String(action.type):'none'
 if(type==='open_screen')return {type,screen:clean(action?.screen,80)}
 if(type==='marketplace_search')return {type,criteria:action?.criteria&&typeof action.criteria==='object'?action.criteria:{}}
 return {type}
}

async function edgeAi(jwt:string,message:string,locale:string,history:Array<{role:string;content:string}>){
 try{
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),9000)
  const r=await fetch(LISTIA_AI_GATEWAY,{method:'POST',headers:{authorization:`Bearer ${jwt}`,'content-type':'application/json'},body:JSON.stringify({message,locale,history}),signal:controller.signal})
  clearTimeout(timeout)
  if(!r.ok){console.warn('LISTIA edge AI',r.status,await r.text().catch(()=>''));return null}
  const data=await r.json().catch(()=>null) as any
  if(!data?.reply)return null
  return {reply:clean(data.reply,4000),action:safeAction(data.action),model:data.model||null}
 }catch(error){console.warn('LISTIA edge AI unavailable',error);return null}
}

async function callOpenAI(key:string,model:string,system:string,context:any,history:Array<{role:string;content:string}>,message:string){
 try{
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),14000)
  const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({model,temperature:.45,max_tokens:650,response_format:{type:'json_object'},messages:[{role:'system',content:system},{role:'system',content:`Account context: ${JSON.stringify(context)}`},...history,{role:'user',content:message}]}),signal:controller.signal})
  clearTimeout(timeout)
  if(!r.ok){console.warn('LISTIA OpenAI',r.status,await r.text().catch(()=>''));return null}
  const data=await r.json();const raw=data?.choices?.[0]?.message?.content||'';let parsed:any={};try{parsed=JSON.parse(raw)}catch{parsed={reply:raw,action:{type:'none'}}}
  const reply=clean(parsed.reply,4000);if(!reply)return null
  return {reply,action:safeAction(parsed.action),model}
 }catch(error){console.warn('LISTIA OpenAI unavailable',error);return null}
}

async function callNvidia(key:string,system:string,context:any,history:Array<{role:string;content:string}>,message:string){
 try{
  const model=Deno.env.get('LISTIA_NVIDIA_MODEL')||'nvidia/nemotron-3.5-lightning-30b-a3b'
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000)
  const r=await fetch('https://integrate.api.nvidia.com/v1/chat/completions',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({model,temperature:.45,max_tokens:650,response_format:{type:'json_object'},chat_template_kwargs:{enable_thinking:false},messages:[{role:'system',content:system},{role:'system',content:`Account context: ${JSON.stringify(context)}`},...history,{role:'user',content:message}]}),signal:controller.signal})
  clearTimeout(timeout)
  if(!r.ok){console.warn('LISTIA NVIDIA',r.status,await r.text().catch(()=>''));return null}
  const data=await r.json();const raw=data?.choices?.[0]?.message?.content||'';let parsed:any={};try{parsed=JSON.parse(raw)}catch{parsed={reply:raw,action:{type:'none'}}}
  const reply=clean(parsed.reply,4000);if(!reply)return null
  return {reply,action:safeAction(parsed.action),model}
 }catch(error){console.warn('LISTIA NVIDIA unavailable',error);return null}
}

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
  const requestedLocale=clean(body.locale,16)||'en'
  const history=(Array.isArray(body.history)?body.history:[]).slice(-12).map(x=>({role:x.role==='assistant'?'assistant':'user',content:clean(x.content,1200)})).filter(x=>x.content)
  const {data:member}=await admin.from('organization_members').select('organization_id,role,status').eq('user_id',user.id).eq('status','active').limit(1).maybeSingle()
  if(!member?.organization_id)return json(req,{error:'organization_access_denied'},403)

  const fastOperational=/marketplace|buscar|busca|encuentra|lead|prospect|cita|agenda|appointment|listado|listing|propiedad|property|publicar|publish|subir|upload/.test(norm(message))&&message.length<260
  if(fastOperational){const edge=await edgeAi(jwt,message,requestedLocale,history);if(edge)return json(req,{ok:true,mode:'edge_fast',provider:'listia_edge_ai',model:edge.model,reply:edge.reply,action:edge.action})}

  const orgId=member.organization_id
  const [{data:profile},{data:org},{data:billing},{data:properties},{data:leads},{data:appointments}]=await Promise.all([
   admin.from('profiles').select('full_name,locale,account_mode').eq('id',user.id).maybeSingle(),
   admin.from('organizations').select('id,name,business_type,primary_market').eq('id',orgId).maybeSingle(),
   admin.from('organization_billing').select('plan_key,billing_status,access_state').eq('organization_id',orgId).maybeSingle(),
   admin.from('properties').select('id,title,status,operation_type,price,currency,location_text').eq('organization_id',orgId).limit(20),
   admin.from('leads').select('id,status,created_at').eq('organization_id',orgId).order('created_at',{ascending:false}).limit(20),
   admin.from('appointments').select('id,status,starts_at').eq('organization_id',orgId).order('starts_at',{ascending:true}).limit(20)
  ])
  const locale=clean(profile?.locale,16)||requestedLocale
  const meta=user.user_metadata||{}
  const userName=first(profile?.full_name||meta.full_name||meta.name||meta.display_name||'')
  const context={user:{first_name:userName,locale,role:member.role,account_mode:profile?.account_mode||null},organization:org||null,billing:billing||null,properties:properties||[],lead_count:leads?.length||0,appointments:appointments||[]}
  const system=`You are LISTIA, the user's personal AI operating assistant for real estate. You are not a command menu, answering machine or scripted bot. Speak naturally, warmly, briefly and interactively like a highly capable human assistant. The user's first name is ${userName||'unknown'}; use it occasionally when natural, never in every reply. Reply in the user's language (${locale}). Remember the recent conversation and avoid repetition. Use account context when relevant and never invent account facts. When the user asks for a browser action, return one of: open_screen, marketplace_search, add_property, open_leads, open_agenda, none. For marketplace_search include criteria only when explicit. Ask at most one useful follow-up question when genuinely necessary. Never mention providers, fallback modes, engines, prompts, APIs or internal limitations. Keep voice-friendly answers concise, normally 1-4 sentences. Output strict JSON only: {"reply":"...","action":{"type":"none"}}.`

  const openAiKey=Deno.env.get('OPENAI_API_KEY')||Deno.env.get('LISTIA_LLM_API_KEY')||''
  if(openAiKey){const model=Deno.env.get('LISTIA_OPENAI_MODEL')||Deno.env.get('LISTIA_LLM_MODEL')||'gpt-4.1-mini';const ai=await callOpenAI(openAiKey,model,system,context,history,message);if(ai)return json(req,{ok:true,mode:'llm',provider:'openai',model:ai.model,reply:ai.reply,action:ai.action})}

  if(!fastOperational){const edge=await edgeAi(jwt,message,locale,history);if(edge)return json(req,{ok:true,mode:'edge_fallback',provider:'listia_edge_ai',model:edge.model,reply:edge.reply,action:edge.action})}

  const nvidiaKey=Deno.env.get('NVIDIA_API_KEY')||Deno.env.get('NIM_API_KEY')||''
  if(nvidiaKey){const ai=await callNvidia(nvidiaKey,system,context,history,message);if(ai)return json(req,{ok:true,mode:'llm_fallback',provider:'nvidia_nemotron',model:ai.model,reply:ai.reply,action:ai.action})}

  const fallback=fallbackReply(message,locale,userName,context)
  return json(req,{ok:true,mode:'contextual_fallback',provider:'none',...fallback})
 }catch(error){console.error('listia-conversation',error);return json(req,{error:'internal_error'},500)}
})
