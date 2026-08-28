import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI=Deno.env.get('OPENAI_API_KEY')||''
const ALLOWED=new Set(['https://app.listiaapp.com','https://listiaapp.com','https://www.listiaapp.com','https://listia-pwa.pages.dev'])
const LOCALES:Record<string,string>={
 es:'Native Mexican/Latin American Spanish. Warm, elegant, confident, conversational. Never use a Spain accent.',
 en:'Native United States English. Warm, elegant, confident and conversational.',
 fr:'Native metropolitan French. Warm, elegant, confident and conversational.',
 it:'Native Italian. Warm, elegant, confident and conversational.',
 'pt-BR':'Native Brazilian Portuguese. Warm, elegant, confident and conversational.',
 de:'Native German. Warm, elegant, confident and conversational.',
 'ar-AE':'Native Emirati/Gulf Arabic appropriate for Dubai. Warm, elegant, confident and conversational.',
 ru:'Native Russian. Warm, elegant, confident and conversational.',
 he:'Native Israeli Hebrew. Warm, elegant, confident and conversational.',
 'zh-CN':'Native Mainland Mandarin Chinese. Warm, elegant, confident and conversational.',
 ja:'Native Japanese. Warm, elegant, confident and conversational.'
}
const clean=(v:unknown,n=900)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n)
const localeKey=(v:unknown)=>{const s=String(v||'en').toLowerCase();if(s.startsWith('es'))return'es';if(s.startsWith('fr'))return'fr';if(s.startsWith('it'))return'it';if(s.startsWith('pt'))return'pt-BR';if(s.startsWith('de'))return'de';if(s.startsWith('ar'))return'ar-AE';if(s.startsWith('ru'))return'ru';if(s.startsWith('he'))return'he';if(s.startsWith('zh'))return'zh-CN';if(s.startsWith('ja'))return'ja';return'en'}
const cors=(req:Request)=>{const o=req.headers.get('origin')||'';return {'access-control-allow-origin':ALLOWED.has(o)?o:'https://app.listiaapp.com','access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type','vary':'Origin'}}
const fail=(req:Request,error:string,status:number)=>new Response(JSON.stringify({error}),{status,headers:{...cors(req),'content-type':'application/json','cache-control':'no-store'}})

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)})
 if(req.method!=='POST')return fail(req,'method_not_allowed',405)
 if(!OPENAI)return fail(req,'tts_not_configured',503)
 const origin=req.headers.get('origin')||'';if(origin&&!ALLOWED.has(origin))return fail(req,'origin_not_allowed',403)
 const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!jwt)return fail(req,'unauthorized',401)
 const admin=createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}})
 const {data,error}=await admin.auth.getUser(jwt);if(error||!data?.user)return fail(req,'unauthorized',401)
 const body=await req.json().catch(()=>({})) as {text?:string;locale?:string}
 const text=clean(body.text);if(!text)return fail(req,'text_required',400)
 const key=localeKey(body.locale)
 const instructions=`You are the voice of LISTIA, a premium real-estate AI assistant. ${LOCALES[key]} Sound human, natural and attentive, never robotic, theatrical or like an advertisement. Use natural phrasing and subtle pauses. Speak briskly but clearly.`
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),7500)
 try{
  const r=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{authorization:`Bearer ${OPENAI}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-4o-mini-tts',voice:'coral',input:text,instructions,response_format:'mp3',speed:1.08}),signal:controller.signal})
  clearTimeout(timer)
  if(!r.ok){console.warn('LISTIA TTS upstream',r.status,await r.text().catch(()=>''));return fail(req,'tts_upstream_error',502)}
  return new Response(r.body,{status:200,headers:{...cors(req),'content-type':'audio/mpeg','cache-control':'private,no-store','x-content-type-options':'nosniff'}})
 }catch(error){clearTimeout(timer);console.warn('LISTIA TTS',error);return fail(req,'tts_unavailable',502)}
})
