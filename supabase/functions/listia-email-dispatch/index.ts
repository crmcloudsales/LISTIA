import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U=Deno.env.get('SUPABASE_URL')||'';
const S=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const RESEND_KEY=Deno.env.get('LISTIA_RESEND_API_KEY')||'';
const BREVO_KEY=Deno.env.get('LISTIA_BREVO_API_KEY')||'';
const sbHeaders=()=>({apikey:S,authorization:`Bearer ${S}`,'content-type':'application/json'});
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
async function rpc(name:string,body:unknown={}){const r=await fetch(`${U}/rest/v1/rpc/${name}`,{method:'POST',headers:sbHeaders(),body:JSON.stringify(body)});if(!r.ok)throw new Error(`${name}:${r.status}:${(await r.text()).slice(0,300)}`);const t=await r.text();return t?JSON.parse(t):null;}

async function sendResend(job:any){
  if(!RESEND_KEY)throw new Error('listia_resend_secret_missing');
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${RESEND_KEY}`,'content-type':'application/json','idempotency-key':String(job.idempotency_key)},body:JSON.stringify({from:`${job.from_name||'LISTIA'} <${job.from_email}>`,to:[job.recipient_email],reply_to:job.reply_to||job.from_email,subject:job.subject,html:job.html_body,text:job.text_body||undefined})});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`resend:${r.status}:${JSON.stringify(d).slice(0,250)}`);return String(d?.id||'');
}
async function sendBrevo(job:any){
  if(!BREVO_KEY)throw new Error('listia_brevo_secret_missing');
  const r=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':BREVO_KEY,'content-type':'application/json','accept':'application/json'},body:JSON.stringify({sender:{name:job.from_name||'LISTIA',email:job.from_email},to:[{email:job.recipient_email,name:job.recipient_name||undefined}],replyTo:{email:job.reply_to||job.from_email},subject:job.subject,htmlContent:job.html_body,textContent:job.text_body||undefined,headers:{'X-Listia-Idempotency-Key':String(job.idempotency_key)}})});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`brevo:${r.status}:${JSON.stringify(d).slice(0,250)}`);return String(d?.messageId||'');
}
async function send(provider:string,job:any){if(provider==='resend')return await sendResend(job);if(provider==='brevo')return await sendBrevo(job);throw new Error(`provider_not_implemented:${provider}`);}

Deno.serve(async(req)=>{
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);
  if(!U||!S)return json({error:'server_not_configured'},503);
  let limit=10;try{const b=await req.json();if(Number.isFinite(Number(b?.limit)))limit=Math.min(50,Math.max(1,Number(b.limit)))}catch{}
  const providers:any[]=await rpc('listia_email_dispatch_providers')||[];
  if(!providers.length)return json({ok:false,error:'no_listia_email_provider_active',boundary:'LISTIA_ONLY',secrets_present:{resend:Boolean(RESEND_KEY),brevo:Boolean(BREVO_KEY)}},503);
  const jobs:any[]=await rpc('listia_email_dispatch_claim',{p_limit:limit})||[];
  let sent=0,failed=0;
  for(const job of jobs){
    let success=false,last='',used:string|null=null,messageId:string|null=null;
    for(const p of providers){
      const key=String(p.provider_key||'');
      try{messageId=await send(key,job);used=key;success=true;break;}catch(e){last=String((e as Error)?.message||e).slice(0,500);}
    }
    await rpc('listia_email_dispatch_complete',{p_job_id:job.id,p_success:success,p_provider_key:used,p_provider_message_id:messageId,p_error:success?null:(last||'all_listia_providers_failed')});
    if(success)sent++;else failed++;
  }
  return json({ok:true,boundary:'LISTIA_ONLY',providers:providers.map((p:any)=>p.provider_key),claimed:jobs.length,sent,failed});
});
