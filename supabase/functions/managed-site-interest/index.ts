import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'
import { MANAGED_SITE_EDGE_PROOF_SHA256 } from './firewall-proof.ts'

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const DB=Deno.env.get('SUPABASE_DB_URL')!
const sql=postgres(DB,{prepare:false})
const clean=(v:unknown,n=2000)=>String(v??'').trim().slice(0,n)
const clamp=(n:number,min=0,max=100)=>Math.min(max,Math.max(min,n))
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY'}})
const disposable=new Set(['10minutemail.com','guerrillamail.com','mailinator.com','tempmail.com','temp-mail.org','yopmail.com','throwawaymail.com','sharklasers.com','getnada.com','maildrop.cc'])

async function sha256(v:string){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return Array.from(new Uint8Array(d),b=>b.toString(16).padStart(2,'0')).join('')}
function constantTime(a:string,b:string){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0}
async function edgeAuthorized(req:Request){const proof=clean(req.headers.get('x-listia-edge-proof'),300);if(!proof||!MANAGED_SITE_EDGE_PROOF_SHA256)return false;return constantTime(await sha256(proof),MANAGED_SITE_EDGE_PROOF_SHA256)}
function emailValid(v:string|null){return Boolean(v&&/^[^\s@]{1,64}@[^\s@]{1,190}\.[A-Za-z]{2,63}$/.test(v))}
function phoneDigits(v:string|null){return String(v||'').replace(/\D/g,'')}
function phoneValid(v:string|null){const d=phoneDigits(v);return d.length>=10&&d.length<=15}
function suspiciousName(v:string){const s=v.toLowerCase().replace(/\s+/g,'');return s.length<2||/(.)\1{4,}/.test(s)||/^(test|asdf|qwerty|fake|bot|prueba|xxx)+\d*$/.test(s)}
function obviousBot(ua:string){return /curl|wget|python-requests|httpclient|scrapy|selenium|phantomjs|headlesschrome|postmanruntime|insomnia|spider|crawler|slurp|bot\b/i.test(ua)}
function uaClass(ua:string){if(!ua)return'unknown';if(obviousBot(ua))return'bot';if(/mobile|android|iphone|ipad/i.test(ua))return'mobile_browser';if(/mozilla|chrome|safari|firefox|edg\//i.test(ua))return'browser';return'other'}

Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return json({error:'method_not_allowed'},405)
  if(!(await edgeAuthorized(req)))return json({error:'gateway_auth_required'},401)
  const body=await req.json().catch(()=>null) as any
  if(!body)return json({error:'invalid_json'},400)
  const host=clean(body.host,255).toLowerCase()
  if(!host||(!host.endsWith('.listiaapp.com')&&host!=='listiaapp.com'))return json({error:'host_not_allowed'},403)
  if(body.turnstile_verified!==true)return json({error:'gateway_verification_required'},403)

  const listingId=clean(body.listing_id,80)
  const name=clean(body.name,120)
  const email=(clean(body.email,254).toLowerCase()||null) as string|null
  const whatsapp=(clean(body.whatsapp,80)||null) as string|null
  const message=(clean(body.message,2000)||null) as string|null
  const locale=clean(body.locale,20)||'es'
  const ip=clean(body.ip,100)
  const ua=clean(body.user_agent,500)
  const country=clean(body.country_code,8).toUpperCase()||null
  const elapsed=Math.max(0,Number(body.form_elapsed_ms||0))
  const botScore=Number(body.bot_score)
  const verifiedBot=body.verified_bot===true
  const honeypot=clean(body.website,250)
  if(!listingId||name.length<2||(!email&&!whatsapp))return json({error:'invalid_submission'},400)

  const admin=createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:listing,error:lerr}=await admin.from('marketplace_listings').select('id,organization_id,property_id').eq('id',listingId).eq('visibility','public').eq('status','published').not('rights_confirmed_at','is',null).maybeSingle()
  if(lerr||!listing?.organization_id)return json({error:'listing_not_available'},404)
  const oid=String(listing.organization_id)
  const ipHash=ip?await sha256(`ip:${oid}:${ip}`):null
  const normalizedContact=email?`e:${email}`:`p:${phoneDigits(whatsapp)}`
  const contactHash=normalizedContact?await sha256(`contact:${oid}:${normalizedContact}`):null
  const [recent]=await sql`
    select
      (select count(*)::int from private.managed_site_firewall_attempts where organization_id=${oid}::uuid and ip_hash=${ipHash} and created_at>now()-interval '10 minutes') as ip_count,
      (select count(*)::int from private.managed_site_firewall_attempts where organization_id=${oid}::uuid and contact_hash=${contactHash} and created_at>now()-interval '60 minutes') as contact_count
  `

  let score=45
  const reasons:string[]=['turnstile_verified']
  let hardBlock=false
  if(honeypot){hardBlock=true;score=0;reasons.push('honeypot')}
  if(Number(recent?.ip_count||0)>=9){hardBlock=true;score=0;reasons.push('ip_rate_limit')}
  if(Number(recent?.contact_count||0)>=3){hardBlock=true;score=0;reasons.push('contact_rate_limit')}
  if(verifiedBot||obviousBot(ua)){hardBlock=true;score=0;reasons.push('automated_client')}

  const hasValidEmail=emailValid(email)
  const hasValidPhone=phoneValid(whatsapp)
  if(hasValidEmail||hasValidPhone){score+=20;reasons.push('valid_contact')}else{score-=25;reasons.push('weak_contact')}
  if(email){const domain=email.split('@')[1]||'';if(disposable.has(domain)){score-=35;reasons.push('disposable_email')}}
  if(!suspiciousName(name)){score+=10;reasons.push('name_quality')}else{score-=20;reasons.push('suspicious_name')}
  if(elapsed>=2500){score+=10;reasons.push('human_form_time')}else if(elapsed>0&&elapsed<800){score-=25;reasons.push('impossibly_fast_form')}
  const klass=uaClass(ua)
  if(klass==='browser'||klass==='mobile_browser'){score+=5;reasons.push('browser_client')}
  if(message&&message.length>=12){score+=5;reasons.push('meaningful_message')}
  if(Number.isFinite(botScore)){
    if(botScore>=70){score+=10;reasons.push('cloudflare_high_human_score')}
    else if(botScore<30){score-=45;reasons.push('cloudflare_low_human_score')}
  }
  score=clamp(Math.round(score))
  const decision=hardBlock?'blocked':score>=80?'accepted':score>=60?'review':'junk'

  await sql`insert into private.managed_site_firewall_attempts(organization_id,website_host,listing_id,ip_hash,contact_hash,quality_score,decision,reasons,user_agent_class,country_code) values(${oid}::uuid,${host},${listingId}::uuid,${ipHash},${contactHash},${score},${decision},${JSON.stringify(reasons)}::jsonb,${klass},${country})`

  // Junk, suspicious and review traffic never reaches CRM. Return a generic success
  // so automated clients receive no useful signal about the firewall decision.
  if(decision!=='accepted')return json({ok:true})

  const {data,error}=await admin.rpc('submit_marketplace_interest',{
    p_listing_id:listingId,p_name:name,p_email:email,p_whatsapp:whatsapp,p_message:message,p_locale:locale,p_website:null
  })
  if(error){console.error('managed-site-interest submit failed',error.code);return json({error:'submission_failed'},502)}
  const inquiryId=String(data??'')
  const attribution=body?.attribution&&typeof body.attribution==='object'?body.attribution:{}
  const clickIds:any={}
  for(const k of ['fbclid','gclid','gbraid','wbraid','ttclid','li_fat_id','msclkid']){const v=clean(attribution[k],300);if(v)clickIds[k]=v}
  const attrib={source:clean(attribution.utm_source,180)||'listia_managed_site',medium:clean(attribution.utm_medium,180)||'website',campaign:clean(attribution.utm_campaign,240)||null,content:clean(attribution.utm_content,240)||null,term:clean(attribution.utm_term,240)||null,click_ids:clickIds,landing_url:clean(body.page_url,1200)||null,referrer:clean(body.referrer,1200)||null,anonymous_id:clean(body.anonymous_id,120)||null,session_id:clean(body.session_id,120)||null,website_host:host,listing_id:listingId,inquiry_id:inquiryId,quality_score:score,firewall:'pennyworth_v1'}

  let leadId:string|null=null
  if(listing.property_id){
    let q=admin.from('leads').select('id,status,contact_id').eq('organization_id',oid).eq('property_id',listing.property_id).gte('created_at',new Date(Date.now()-15*60*1000).toISOString()).order('created_at',{ascending:false}).limit(1)
    if(email)q=q.eq('email',email);else if(whatsapp)q=q.eq('whatsapp',whatsapp)
    const {data:leadRows}=await q
    const lead=leadRows?.[0]
    leadId=lead?.id||null
    if(leadId){
      await admin.from('leads').update({quality_score:score,lead_score:score,verification_status:'verified',status:score>=90?'qualified':'active',attribution:attrib,source_detail:{channel:'managed_site',host,listing_id:listingId,inquiry_id:inquiryId,firewall:'pennyworth_v1',quality_score:score}}).eq('id',leadId)
      if(score>=90){
        await admin.from('lead_events').insert({organization_id:oid,lead_id:leadId,contact_id:lead?.contact_id||null,event_type:'qualified_lead',from_stage:lead?.status||'new',to_stage:'qualified',quality_score:score,source:'listia_managed_site',metadata:{host,listing_id:listingId,inquiry_id:inquiryId,firewall:'pennyworth_v1'}})
      }
    }
  }

  if(inquiryId){
    const eventId=`lead_submit:${inquiryId}`
    const occurredAt=new Date().toISOString()
    await admin.from('web_events').upsert({organization_id:oid,website_host:host,event_name:score>=90?'qualified_lead_submit':'verified_lead_submit',event_id:eventId,anonymous_id:attrib.anonymous_id,session_id:attrib.session_id,listing_id:listingId,page_url:attrib.landing_url,referrer:attrib.referrer,source:attrib.source,medium:attrib.medium,campaign:attrib.campaign,content:attrib.content,term:attrib.term,click_ids:clickIds,metadata:{inquiry_id:inquiryId,lead_id:leadId,quality_score:score,firewall:'pennyworth_v1'},occurred_at:occurredAt},{onConflict:'organization_id,event_id',ignoreDuplicates:true})
    if(score>=90){
      await admin.from('attribution_touchpoints').upsert({organization_id:oid,anonymous_id:attrib.anonymous_id,session_id:attrib.session_id,event_id:eventId,touch_type:'conversion',source:attrib.source,medium:attrib.medium,campaign:attrib.campaign,content:attrib.content,term:attrib.term,click_ids:clickIds,landing_url:attrib.landing_url,referrer:attrib.referrer,occurred_at:occurredAt},{onConflict:'organization_id,event_id,touch_type',ignoreDuplicates:true})
    }
  }
  return json({ok:true,result:inquiryId||null})
})
