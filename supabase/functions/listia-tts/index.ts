import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import {createClient} from 'npm:@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!,SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,DB=Deno.env.get('SUPABASE_DB_URL')||''
const sql=postgres(DB,{prepare:false})
const ALLOWED=new Set(['https://app.listiaapp.com','https://listiaapp.com','https://www.listiaapp.com'])
const LOCALES:Record<string,string>={es:'Native Mexican/Latin American Spanish. Warm, elegant, confident, conversational. Never use a Spain accent.',en:'Native United States English. Warm, elegant, confident and conversational.',fr:'Native metropolitan French. Warm, elegant, confident and conversational.',it:'Native Italian. Warm, elegant, confident and conversational.','pt-BR':'Native Brazilian Portuguese. Warm, elegant, confident and conversational.',de:'Native German. Warm, elegant, confident and conversational.','ar-AE':'Native Emirati/Gulf Arabic appropriate for Dubai. Warm, elegant, confident and conversational.',ru:'Native Russian. Warm, elegant, confident and conversational.',he:'Native Israeli Hebrew. Warm, elegant, confident and conversational.','zh-CN':'Native Mainland Mandarin Chinese. Warm, elegant, confident and conversational.',ja:'Native Japanese. Warm, elegant, confident and conversational.'}
const clean=(v:unknown,n=900)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n)
const localeKey=(v:unknown)=>{const s=String(v||'en').toLowerCase();if(s.startsWith('es'))return'es';if(s.startsWith('fr'))return'fr';if(s.startsWith('it'))return'it';if(s.startsWith('pt'))return'pt-BR';if(s.startsWith('de'))return'de';if(s.startsWith('ar'))return'ar-AE';if(s.startsWith('ru'))return'ru';if(s.startsWith('he'))return'he';if(s.startsWith('zh'))return'zh-CN';if(s.startsWith('ja'))return'ja';return'en'}
const originAllowed=(req:Request)=>ALLOWED.has(req.headers.get('origin')||'')
const cors=(req:Request)=>{const o=req.headers.get('origin')||'',h:Record<string,string>={'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type','access-control-max-age':'600','vary':'Origin'};if(ALLOWED.has(o))h['access-control-allow-origin']=o;return h}
const fail=(req:Request,error:string,status:number)=>new Response(JSON.stringify({error}),{status,headers:{...cors(req),'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY'}})
async function engineKey(){if(!DB)return'';const[row]=await sql`select decrypted_secret from vault.decrypted_secrets where name='listia_ai_engine_secret' limit 1`;return String(row?.decrypted_secret||'')}

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return originAllowed(req)?new Response(null,{status:204,headers:cors(req)}):new Response(null,{status:403})
 if(req.method!=='POST')return fail(req,'method_not_allowed',405)
 if(!originAllowed(req))return fail(req,'origin_not_allowed',403)
 const sec=req.headers.get('sec-fetch-site');if(sec&&sec!=='same-origin'&&sec!=='same-site')return fail(req,'cross_site_blocked',403)
 const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!jwt)return fail(req,'unauthorized',401)
 const admin=createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}}),{data,error}=await admin.auth.getUser(jwt);if(error||!data?.user)return fail(req,'unauthorized',401)
 const body=await req.json().catch(()=>({}))as{text?:string;locale?:string},text=clean(body.text);if(!text)return fail(req,'text_required',400)
 const key=localeKey(body.locale),instructions=`You are the voice of LISTIA, a premium real-estate AI assistant. ${LOCALES[key]} Sound human, natural and attentive, never robotic, theatrical or like an advertisement. Use natural phrasing and subtle pauses. Speak briskly but clearly.`
 const internalKey=await engineKey();if(!internalKey)return fail(req,'service_unavailable',503)
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000)
 try{
  const r=await fetch(`${SUPABASE_URL}/functions/v1/listia-ai-engine`,{method:'POST',headers:{'x-listia-ai-engine-key':internalKey,'content-type':'application/json'},body:JSON.stringify({task_type:'tts',quality_tier:'q1',text,instructions,voice:'coral',speed:1.08}),signal:controller.signal})
  if(!r.ok)return fail(req,'voice_unavailable',r.status===503?503:502)
  return new Response(r.body,{status:200,headers:{...cors(req),'content-type':'audio/mpeg','cache-control':'private,no-store','x-content-type-options':'nosniff','cross-origin-resource-policy':'same-site','x-listia-ai-engine':'v1'}})
 }catch{return fail(req,'voice_unavailable',502)}finally{clearTimeout(timer)}
})
