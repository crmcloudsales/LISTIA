import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const U=Deno.env.get('SUPABASE_URL')||''
const S=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
const allowedOrigins=new Set(['https://listiaapp.com','https://www.listiaapp.com'])
const sbHeaders=()=>({apikey:S,authorization:`Bearer ${S}`,'content-type':'application/json'})
const cors=(req:Request)=>{const o=req.headers.get('origin')||'';return {'access-control-allow-origin':allowedOrigins.has(o)?o:'https://listiaapp.com','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type, x-listia-client-ip, x-listia-source','access-control-max-age':'600','vary':'Origin'}}
const json=(req:Request,body:unknown,status=200,extra:Record<string,string>={})=>new Response(JSON.stringify(body),{status,headers:{...cors(req),...extra,'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})
const clean=(v:unknown,max:number)=>typeof v==='string'?(v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'').trim().slice(0,max)||null):null
const email=(v:unknown)=>{const x=clean(v,254)?.toLowerCase()||null;return x&&/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(x)?x:null}
const ip=(req:Request)=>String(req.headers.get('x-listia-client-ip')||req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown').trim().slice(0,80)
async function sha(v:string){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function rpc(name:string,body:unknown){const r=await fetch(`${U}/rest/v1/rpc/${name}`,{method:'POST',headers:sbHeaders(),body:JSON.stringify(body)});const t=await r.text();if(!r.ok)throw new Error(`${name}:${r.status}:${t.slice(0,300)}`);return t?JSON.parse(t):null}
async function insertLead(body:unknown){const r=await fetch(`${U}/rest/v1/listia_investment_leads`,{method:'POST',headers:{...sbHeaders(),prefer:'return=representation'},body:JSON.stringify(body)});const t=await r.text();if(!r.ok)throw new Error(`lead_insert:${r.status}:${t.slice(0,300)}`);const rows=JSON.parse(t);return rows?.[0]}
function suspicious(...vals:(string|null)[]){const j=vals.filter(Boolean).join(' ').toLowerCase();return (j.match(/https?:\/\//g)?.length||0)>4||/<script|javascript:|data:text\/html|onerror\s*=|onload\s*=/i.test(j)}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)})
  if(req.method!=='POST')return json(req,{error:'method_not_allowed'},405)
  try{
    if(!U||!S)return json(req,{error:'server_not_configured'},503)
    const origin=req.headers.get('origin')||''
    if(!allowedOrigins.has(origin))return json(req,{error:'origin_not_allowed'},403)
    if(!(req.headers.get('content-type')||'').toLowerCase().includes('application/json'))return json(req,{error:'json_required'},415)
    const len=Number(req.headers.get('content-length')||'0');if(Number.isFinite(len)&&len>20000)return json(req,{error:'payload_too_large'},413)
    const b=await req.json().catch(()=>null) as null|Record<string,unknown>;if(!b)return json(req,{error:'invalid_json'},400)
    if(clean(b.website,200))return json(req,{ok:true},200)
    const startedAt=Number(b.started_at||0),elapsed=Date.now()-startedAt
    if(!Number.isFinite(startedAt)||elapsed<3500||elapsed>2*60*60*1000)return json(req,{error:'invalid_form_session'},400)
    const fullName=clean(b.full_name,120),mail=email(b.email),phone=clean(b.phone,40),companyRole=clean(b.company_role,180),cityCountry=clean(b.city_country,160),message=clean(b.message,3000)
    const consent=b.consent===true
    const localeRaw=clean(b.locale,12)||'es',locale=new Set(['es','en','fr','it','pt-BR','de','ar-AE','ru','he','zh-CN','ja']).has(localeRaw)?localeRaw:'es'
    const interestRaw=clean(b.interest_type,40)||'investment_plan',interest=new Set(['investment_plan','strategic_partnership','technology','other']).has(interestRaw)?interestRaw:'investment_plan'
    if(!fullName||fullName.length<2)return json(req,{error:'full_name_required'},400)
    if(!mail)return json(req,{error:'valid_email_required'},400)
    if(!consent)return json(req,{error:'consent_required'},400)
    if(suspicious(fullName,phone,companyRole,cityCountry,message))return json(req,{error:'submission_rejected'},400)
    const ipHash=await sha(ip(req)),uaHash=await sha(req.headers.get('user-agent')||'unknown'),emailHash=await sha(mail)
    const ipRate=await rpc('listia_public_form_rate_limit_consume',{p_bucket_key:`listia:investment:ip:${ipHash}`,p_max_requests:5,p_window_seconds:3600})
    if(!ipRate?.allowed)return json(req,{error:'rate_limited',retry_after:ipRate?.retry_after||3600},429,{'retry-after':String(ipRate?.retry_after||3600)})
    const emRate=await rpc('listia_public_form_rate_limit_consume',{p_bucket_key:`listia:investment:email:${emailHash}`,p_max_requests:3,p_window_seconds:86400})
    if(!emRate?.allowed)return json(req,{error:'rate_limited',retry_after:emRate?.retry_after||86400},429,{'retry-after':String(emRate?.retry_after||86400)})
    const lead=await insertLead({full_name:fullName,email:mail,phone,company_role:companyRole,city_country:cityCountry,interest_type:interest,message,consent:true,source:'listia_investment_landing',locale,ip_hash:ipHash,user_agent_hash:uaHash,notification_status:'queued'})
    const subject=`LISTIA · ${interest==='investment_plan'?'Plan de inversión':'Contacto estratégico'} · ${fullName}`
    const text=`Nuevo contacto LISTIA\n\nNombre: ${fullName}\nEmail: ${mail}\nTeléfono: ${phone||'No indicado'}\nRol/empresa: ${companyRole||'No indicado'}\nCiudad/país: ${cityCountry||'No indicado'}\nInterés: ${interest}\nMensaje: ${message||'Sin mensaje adicional'}\nReferencia: ${lead.id}`
    const html=`<h2>Nuevo contacto LISTIA</h2><p><strong>Nombre:</strong> ${fullName.replace(/[&<>]/g,'')}</p><p><strong>Email:</strong> ${mail.replace(/[&<>]/g,'')}</p><p><strong>Teléfono:</strong> ${(phone||'No indicado').replace(/[&<>]/g,'')}</p><p><strong>Rol/empresa:</strong> ${(companyRole||'No indicado').replace(/[&<>]/g,'')}</p><p><strong>Ciudad/país:</strong> ${(cityCountry||'No indicado').replace(/[&<>]/g,'')}</p><p><strong>Interés:</strong> ${interest}</p><p><strong>Mensaje:</strong> ${(message||'Sin mensaje adicional').replace(/[&<>]/g,'')}</p><p><strong>Referencia:</strong> ${lead.id}</p>`
    let notificationStatus='queued',notificationDetail='Queued in LISTIA-owned email engine; provider activation may still be pending.'
    try{await rpc('listia_email_enqueue',{p_idempotency_key:`investment-lead:${lead.id}`,p_identity_key:'listia_primary',p_category:'operational',p_recipient_email:'jalil@listiaapp.com',p_recipient_name:'LISTIA',p_subject:subject,p_html_body:html,p_text_body:text,p_organization_id:null,p_template_key:'investment_lead_internal',p_metadata:{lead_id:lead.id,source:'listia_investment_landing',boundary:'LISTIA_ONLY'}})}catch(e){notificationStatus='enqueue_failed';notificationDetail=String((e as Error)?.message||e).slice(0,400)}
    await fetch(`${U}/rest/v1/listia_investment_leads?id=eq.${lead.id}`,{method:'PATCH',headers:{...sbHeaders(),prefer:'return=minimal'},body:JSON.stringify({notification_status:notificationStatus,notification_detail:notificationDetail})})
    return json(req,{ok:true,reference:lead.id},201)
  }catch(e){console.error('listia-investment-lead',e);return json(req,{error:'internal_error'},500)}
})
