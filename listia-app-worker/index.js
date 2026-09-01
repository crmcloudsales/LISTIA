const ALLOWED_ORIGINS=new Set(['https://app.listiaapp.com','https://listiaapp.com','https://www.listiaapp.com']);
const ALLOWED_HOSTNAMES=new Set(['app.listiaapp.com','listiaapp.com','www.listiaapp.com']);
const TURNSTILE_VERIFY='https://challenges.cloudflare.com/turnstile/v0/siteverify';
const SUPABASE_INTEREST='https://zvzafiarwerbuoaccnoz.supabase.co/functions/v1/marketplace-interest-auth';
const SUPABASE_FEED='https://zvzafiarwerbuoaccnoz.supabase.co/functions/v1/marketplace-feed-edge';
const SUPABASE_DEMAND='https://zvzafiarwerbuoaccnoz.supabase.co/functions/v1/marketplace-demand-event';
const SUPABASE_QROO_MAP='https://zvzafiarwerbuoaccnoz.supabase.co/functions/v1/marketplace-map-qroo';
const FEED_KEYS=new Set(['p_limit','p_offset','p_q','p_operation','p_property_type','p_min_price','p_max_price','p_bedrooms','p_lat','p_lng']);
const QROO_KEYS=new Set(['mode','municipality','place','operation','property_type','currency','confidence','min_price','max_price','min_bedrooms','limit']);
const DEMAND_EVENTS=new Set(['listing_view','search','voice_search','map_view','property_open','save','share','contact_click','whatsapp_click','inquiry']);
const DEMAND_KEYS=new Set(['event_name','session_id','listing_id','query_text','metadata']);
const headers={
  'content-type':'application/json;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','cross-origin-resource-policy':'same-site','cross-origin-opener-policy':'same-origin','origin-agent-cluster':'?1','x-permitted-cross-domain-policies':'none','permissions-policy':'camera=(), microphone=(), geolocation=()','x-robots-tag':'noindex, nofollow, noarchive, nosnippet, noimageindex','content-security-policy':"default-src 'none'; frame-ancestors 'none'",'strict-transport-security':'max-age=31536000; includeSubDomains; preload'
};
function cors(req){const origin=req.headers.get('origin')||'';return ALLOWED_ORIGINS.has(origin)?{'access-control-allow-origin':origin,'access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'content-type, authorization, apikey','vary':'Origin'}:{}}
const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{...headers,...extra}});
const empty=(status,extra={})=>new Response(null,{status,headers:{...headers,...extra}});
function clientIp(req){return req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||''}
function trustedOrigin(req){const origin=req.headers.get('origin')||'',sec=req.headers.get('sec-fetch-site')||'';return !!origin&&ALLOWED_ORIGINS.has(origin)&&(!sec||sec==='same-origin'||sec==='same-site')}
function browserCaller(req){if(trustedOrigin(req))return true;const sec=req.headers.get('sec-fetch-site')||'';if(sec&&sec!=='same-origin'&&sec!=='same-site')return false;const ref=req.headers.get('referer')||'';if(!ref)return sec==='same-origin'||sec==='same-site';try{return ALLOWED_HOSTNAMES.has(new URL(ref).hostname.toLowerCase())}catch{return false}}
function jsonContent(req){return (req.headers.get('content-type')||'').toLowerCase().includes('application/json')}
async function verifyHuman(req,env,token){
  if(!token||token.length<20||!env.TURNSTILE_SECRET)return {ok:false,reason:'missing_human_verification'};
  const form=new FormData();form.set('secret',env.TURNSTILE_SECRET);form.set('response',token);const ip=clientIp(req);if(ip)form.set('remoteip',ip);
  let result;try{const r=await fetch(TURNSTILE_VERIFY,{method:'POST',body:form});result=await r.json()}catch{return {ok:false,reason:'verification_unavailable'}}
  if(!result?.success)return {ok:false,reason:'human_verification_failed'};
  if(!ALLOWED_HOSTNAMES.has(String(result.hostname||'').toLowerCase()))return {ok:false,reason:'hostname_mismatch'};
  if(result.action!=='marketplace_interest')return {ok:false,reason:'action_mismatch'};
  return {ok:true};
}
async function handleFeed(req,env){
  if(req.method==='OPTIONS')return empty(204,cors(req));
  if(req.method!=='POST')return json({error:'method_not_allowed'},405,{'allow':'POST, OPTIONS',...cors(req)});
  if(!trustedOrigin(req))return json({error:'origin_not_allowed'},403,cors(req));
  if(!jsonContent(req))return json({error:'json_required'},415,cors(req));
  const len=Number(req.headers.get('content-length')||0);if(len>8192)return json({error:'payload_too_large'},413,cors(req));
  const body=await req.json().catch(()=>null);if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'invalid_json'},400,cors(req));
  if(Object.keys(body).some(k=>!FEED_KEYS.has(k)))return json({error:'unexpected_parameter'},400,cors(req));
  if(!env.MARKETPLACE_EDGE_PROOF)return json({error:'firewall_not_configured'},503,cors(req));
  const upstream=await fetch(SUPABASE_FEED,{method:'POST',headers:{'content-type':'application/json','x-listia-edge-proof':env.MARKETPLACE_EDGE_PROOF,'x-listia-client-ip':clientIp(req)},body:JSON.stringify(body)}).catch(()=>null);
  if(!upstream)return json({error:'upstream_unavailable'},503,cors(req));
  const text=await upstream.text();return new Response(text,{status:upstream.status,headers:{...headers,...cors(req),'content-type':upstream.headers.get('content-type')||headers['content-type']}});
}
async function handleQroo(req){
  if(req.method==='OPTIONS')return empty(204,cors(req));
  if(req.method!=='GET')return json({error:'method_not_allowed'},405,{'allow':'GET, OPTIONS',...cors(req)});
  if(!browserCaller(req))return json({error:'origin_not_allowed'},403,cors(req));
  const url=new URL(req.url),params=new URLSearchParams();
  for(const [k,v] of url.searchParams){if(!QROO_KEYS.has(k))return json({error:'unexpected_parameter'},400,cors(req));if(String(v).length>160)return json({error:'parameter_too_long'},400,cors(req));params.append(k,v)}
  const upstream=await fetch(`${SUPABASE_QROO_MAP}?${params.toString()}`,{method:'GET',headers:{accept:'application/json'},cache:'no-store'}).catch(()=>null);
  if(!upstream)return json({error:'upstream_unavailable'},503,cors(req));
  const text=await upstream.text();return new Response(text,{status:upstream.status,headers:{...headers,...cors(req),'content-type':upstream.headers.get('content-type')||headers['content-type']}});
}
async function handleDemand(req,env){
  if(req.method==='OPTIONS')return empty(204,cors(req));
  if(req.method!=='POST')return json({error:'method_not_allowed'},405,{'allow':'POST, OPTIONS',...cors(req)});
  if(!trustedOrigin(req))return json({error:'origin_not_allowed'},403,cors(req));
  if(!jsonContent(req))return json({error:'json_required'},415,cors(req));
  const len=Number(req.headers.get('content-length')||0);if(len>5000)return json({error:'payload_too_large'},413,cors(req));
  const body=await req.json().catch(()=>null);if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'invalid_json'},400,cors(req));
  if(Object.keys(body).some(k=>!DEMAND_KEYS.has(k)))return json({error:'unexpected_parameter'},400,cors(req));
  if(!DEMAND_EVENTS.has(String(body.event_name||'')))return json({error:'invalid_event'},400,cors(req));
  if(String(body.session_id||'').length<8||String(body.session_id||'').length>180)return json({error:'invalid_session'},400,cors(req));
  if(body.listing_id!=null&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(body.listing_id)))return json({error:'invalid_listing'},400,cors(req));
  if(body.query_text!=null&&String(body.query_text).length>400)return json({error:'query_too_long'},400,cors(req));
  if(!env.MARKETPLACE_EDGE_PROOF)return json({error:'firewall_not_configured'},503,cors(req));
  const upstream=await fetch(SUPABASE_DEMAND,{method:'POST',headers:{'content-type':'application/json','x-listia-edge-proof':env.MARKETPLACE_EDGE_PROOF,'x-listia-client-ip':clientIp(req),'x-listia-client-ua':String(req.headers.get('user-agent')||'').slice(0,300)},body:JSON.stringify(body)}).catch(()=>null);
  if(!upstream)return json({error:'upstream_unavailable'},503,cors(req));
  const text=await upstream.text();return new Response(text,{status:upstream.status,headers:{...headers,...cors(req),'content-type':upstream.headers.get('content-type')||headers['content-type']}});
}
async function handleInterest(req,env){
  if(req.method==='OPTIONS')return empty(204,cors(req));
  if(req.method!=='POST')return json({error:'method_not_allowed'},405,{'allow':'POST, OPTIONS',...cors(req)});
  if(!trustedOrigin(req))return json({error:'origin_not_allowed'},403,cors(req));
  if(!jsonContent(req))return json({error:'json_required'},415,cors(req));
  const auth=req.headers.get('authorization')||'';if(!/^Bearer\s+\S+/i.test(auth))return json({error:'authentication_required'},401,cors(req));
  const apiKey=req.headers.get('apikey')||'';if(!apiKey)return json({error:'client_key_required'},400,cors(req));
  const len=Number(req.headers.get('content-length')||0);if(len>12000)return json({error:'payload_too_large'},413,cors(req));
  const body=await req.json().catch(()=>null);if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'invalid_json'},400,cors(req));
  const verified=await verifyHuman(req,env,String(body.turnstile_token||''));if(!verified.ok)return json({error:verified.reason},403,cors(req));
  if(!env.MARKETPLACE_EDGE_PROOF)return json({error:'firewall_not_configured'},503,cors(req));
  const upstreamBody={...body};delete upstreamBody.turnstile_token;
  const upstream=await fetch(SUPABASE_INTEREST,{method:'POST',headers:{authorization:auth,apikey:apiKey,'content-type':'application/json','x-listia-edge-proof':env.MARKETPLACE_EDGE_PROOF,'x-listia-client-ip':clientIp(req)},body:JSON.stringify(upstreamBody)}).catch(()=>null);
  if(!upstream)return json({error:'upstream_unavailable'},503,cors(req));
  const text=await upstream.text();return new Response(text,{status:upstream.status,headers:{...headers,...cors(req),'content-type':upstream.headers.get('content-type')||headers['content-type']}});
}
export default {async fetch(req,env){
  const url=new URL(req.url);
  if(url.pathname==='/api/security/turnstile-config'){
    if(req.method!=='GET')return json({error:'method_not_allowed'},405);if(!env.TURNSTILE_SITE_KEY)return json({error:'turnstile_not_configured'},503);return json({sitekey:env.TURNSTILE_SITE_KEY},200,{'cache-control':'public, max-age=3600'});
  }
  if(url.pathname==='/api/marketplace/location'){
    if(req.method==='OPTIONS')return empty(204,cors(req));if(req.method!=='GET')return json({error:'method_not_allowed'},405,{'allow':'GET, OPTIONS',...cors(req)});if(!browserCaller(req))return json({error:'origin_not_allowed'},403,cors(req));
    const cf=req.cf||{};const lat=Number(cf.latitude),lng=Number(cf.longitude);return json({latitude:Number.isFinite(lat)?lat:null,longitude:Number.isFinite(lng)?lng:null,city:cf.city||null,region:cf.region||null,country:cf.country||null,source:'cloudflare_approximate'},200,cors(req));
  }
  if(url.pathname==='/api/marketplace/feed'||url.pathname==='/marketplace/api/feed')return handleFeed(req,env);
  if(url.pathname==='/api/marketplace/qroo')return handleQroo(req);
  if(url.pathname==='/api/marketplace/events')return handleDemand(req,env);
  if(url.pathname==='/api/interest')return handleInterest(req,env);
  return env.ASSETS.fetch(req);
}};
