import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'

const U=Deno.env.get('SUPABASE_URL')!
const S=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const DB=Deno.env.get('SUPABASE_DB_URL')!
const EDGE_HASH='71e982086854a8c8621e99901bef3a75c0805a499ad0ff5b72ed4466e31baee1'
const sql=postgres(DB,{prepare:false})
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})
const text=(v:unknown,n:number)=>String(v??'').trim().slice(0,n)
const clamp=(n:number,min=0,max=100)=>Math.min(max,Math.max(min,n))
const disposable=new Set(['10minutemail.com','guerrillamail.com','mailinator.com','tempmail.com','temp-mail.org','yopmail.com','throwawaymail.com','sharklasers.com','getnada.com','maildrop.cc'])
const hex=(a:Uint8Array)=>Array.from(a,x=>x.toString(16).padStart(2,'0')).join('')
async function sha(v:string){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))))}
function constantTime(a:string,b:string){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0}
async function edge(req:Request){const p=req.headers.get('x-listia-edge-proof')||'';return p.length>=32&&constantTime(await sha(p),EDGE_HASH)}
function emailValid(v:string|null){return Boolean(v&&/^[^\s@]{1,64}@[^\s@]{1,190}\.[A-Za-z]{2,63}$/.test(v))}
function phoneDigits(v:string|null){return String(v||'').replace(/\D/g,'')}
function phoneValid(v:string|null){const d=phoneDigits(v);return d.length>=10&&d.length<=15}
function suspiciousName(v:string){const s=v.toLowerCase().replace(/\s+/g,'');return s.length<2||/(.)\1{4,}/.test(s)||/^(test|asdf|qwerty|fake|bot|prueba|xxx)+\d*$/.test(s)}
function obviousBot(ua:string){return /curl|wget|python-requests|httpclient|scrapy|selenium|phantomjs|headlesschrome|postmanruntime|insomnia|spider|crawler|slurp|bot\b/i.test(ua)}
function uaClass(ua:string){if(!ua)return'unknown';if(obviousBot(ua))return'bot';if(/mobile|android|iphone|ipad/i.test(ua))return'mobile_browser';if(/mozilla|chrome|safari|firefox|edg\//i.test(ua))return'browser';return'other'}

Deno.serve(async req=>{
  if(req.method!=='POST')return json({error:'method_not_allowed'},405)
  if(!(await edge(req)))return json({error:'edge_firewall_required'},403)

  const b=await req.json().catch(()=>null) as any
  if(!b||typeof b!=='object')return json({error:'invalid_json'},400)

  const sub=text(b.subdomain,63).toLowerCase()
  const listing=text(b.listing_id,80)
  const name=text(b.name,120)
  const email=(text(b.email,180).toLowerCase()||null) as string|null
  const wa=(text(b.whatsapp,60)||null) as string|null
  const message=(text(b.message,1200)||null) as string|null
  const locale=text(b.locale,12)||'es'
  const ip=text(req.headers.get('x-listia-client-ip')||b.ip,100)
  const ua=text(req.headers.get('x-listia-client-ua')||b.user_agent,500)
  const country=text(req.headers.get('x-listia-country')||b.country_code,8).toUpperCase()||null
  const elapsed=Math.max(0,Number(b.form_elapsed_ms||0))
  const honeypot=text(b.website,250)

  if(!sub||!listing||!name||(!email&&!wa))return json({error:'required_fields_missing'},400)
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:'invalid_email'},400)
  if(!/^[0-9a-f-]{36}$/i.test(listing))return json({error:'invalid_listing'},400)

  const admin=createClient(U,S,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:w}=await admin.from('organization_websites').select('organization_id,status').eq('mode','listia_subdomain').ilike('subdomain',sub).maybeSingle()
  if(!w||w.status!=='active')return json({error:'site_unavailable'},404)

  const {data:l}=await admin.from('marketplace_listings').select('id').eq('id',listing).eq('status','published').eq('visibility','public').maybeSingle()
  if(!l)return json({error:'listing_unavailable'},404)

  const oid=String(w.organization_id)
  const host=`${sub}.listiaapp.com`
  const ipHash=ip?await sha(`ip:${oid}:${ip}`):null
  const normalizedContact=email?`e:${email}`:`p:${phoneDigits(wa)}`
  const contactHash=normalizedContact?await sha(`contact:${oid}:${normalizedContact}`):null
  const [recent]=await sql`
    select
      (select count(*)::int from private.managed_site_firewall_attempts where organization_id=${oid}::uuid and ip_hash=${ipHash} and created_at>now()-interval '10 minutes') as ip_count,
      (select count(*)::int from private.managed_site_firewall_attempts where organization_id=${oid}::uuid and contact_hash=${contactHash} and created_at>now()-interval '60 minutes') as contact_count
  `

  // Pennyworth v1 adapted to the canonical listia-app managed-site gateway.
  // The gateway has already verified Cloudflare Turnstile before it can present
  // the private edge proof, so canonical_edge_verified contributes 5 points.
  let score=50
  const reasons:string[]=['turnstile_verified','canonical_edge_verified']
  let hardBlock=false
  if(honeypot){hardBlock=true;score=0;reasons.push('honeypot')}
  if(Number(recent?.ip_count||0)>=9){hardBlock=true;score=0;reasons.push('ip_rate_limit')}
  if(Number(recent?.contact_count||0)>=3){hardBlock=true;score=0;reasons.push('contact_rate_limit')}
  if(obviousBot(ua)){hardBlock=true;score=0;reasons.push('automated_client')}

  const hasValidEmail=emailValid(email)
  const hasValidPhone=phoneValid(wa)
  if(hasValidEmail||hasValidPhone){score+=20;reasons.push('valid_contact')}else{score-=25;reasons.push('weak_contact')}
  if(email){const domain=email.split('@')[1]||'';if(disposable.has(domain)){score-=35;reasons.push('disposable_email')}}
  if(!suspiciousName(name)){score+=10;reasons.push('name_quality')}else{score-=20;reasons.push('suspicious_name')}
  if(elapsed>=2500){score+=10;reasons.push('human_form_time')}else if(elapsed>0&&elapsed<800){score-=25;reasons.push('impossibly_fast_form')}
  const klass=uaClass(ua)
  if(klass==='browser'||klass==='mobile_browser'){score+=5;reasons.push('browser_client')}
  if(message&&message.length>=12){score+=5;reasons.push('meaningful_message')}
  score=clamp(Math.round(score))
  const decision=hardBlock?'blocked':score>=80?'accepted':score>=60?'review':'junk'

  await sql`insert into private.managed_site_firewall_attempts(organization_id,website_host,listing_id,ip_hash,contact_hash,quality_score,decision,reasons,user_agent_class,country_code) values(${oid}::uuid,${host},${listing}::uuid,${ipHash},${contactHash},${score},${decision},${JSON.stringify(reasons)}::jsonb,${klass},${country})`

  // Junk, suspicious and review traffic never reaches the commercial inquiry layer.
  // Return a generic success so automated clients cannot probe the decision boundary.
  if(decision!=='accepted')return json({ok:true})

  const {data,error}=await admin.from('marketplace_inquiries').insert({
    listing_id:listing,
    organization_id:oid,
    name,
    email:email||null,
    whatsapp:wa||null,
    message:message||null,
    locale,
    status:'new',
    route_type:'managed_site',
    profile_data:{source:'listia_managed_site',subdomain:sub,firewall:'pennyworth_v1',quality_score:score,reasons}
  }).select('id').single()
  if(error){console.error('managed-site-inquiry save failed',error.code);return json({error:'inquiry_save_failed'},502)}
  return json({ok:true,id:data?.id||null})
})
