const ALLOWED_ORIGINS=new Set(['https://app.listiaapp.com','https://listiaapp.com','https://www.listiaapp.com']);
const ALLOWED_HOSTNAMES=new Set(['app.listiaapp.com','listiaapp.com','www.listiaapp.com']);
const TURNSTILE_VERIFY='https://challenges.cloudflare.com/turnstile/v0/siteverify';
const SUPABASE_INTEREST='https://zvzafiarwerbuoaccnoz.supabase.co/functions/v1/marketplace-interest-auth';
const SUPABASE_FEED='https://zvzafiarwerbuoaccnoz.supabase.co/functions/v1/marketplace-feed-edge';

const headers={
  'content-type':'application/json;charset=utf-8',
  'cache-control':'no-store',
  'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer',
  'x-frame-options':'DENY',
  'cross-origin-resource-policy':'same-site',
  'content-security-policy':"default-src 'none'; frame-ancestors 'none'",
  'strict-transport-security':'max-age=31536000'
};
function cors(req){const origin=req.headers.get('origin')||'';return ALLOWED_ORIGINS.has(origin)?{'access-control-allow-origin':origin,'access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'content-type, authorization, apikey','vary':'Origin'}:{}}
const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{...headers,...extra}});
const empty=(status,extra={})=>new Response(null,{status,headers:{...headers,...extra}});
function clientIp(req){return req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||''}
function allowedCaller(req){const origin=req.headers.get('origin')||'',sec=req.headers.get('sec-fetch-site')||'';if(origin)return ALLOWED_ORIGINS.has(origin)&&(!sec||sec==='same-origin'||sec==='same-site');return !sec||sec==='same-origin'||sec==='same-site'}
function sameSite(req){return allowedCaller(req)}
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
  if(!sameSite(req))return json({error:'origin_not_allowed'},403,cors(req));
  const len=Number(req.headers.get('content-length')||0);if(len>8192)return json({error:'payload_too_large'},413,cors(req));
  const body=await req.json().catch(()=>null);if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'invalid_json'},400,cors(req));
  if(!env.MARKETPLACE_EDGE_PROOF)return json({error:'firewall_not_configured'},503,cors(req));
  const upstream=await fetch(SUPABASE_FEED,{method:'POST',headers:{'content-type':'application/json','x-listia-edge-proof':env.MARKETPLACE_EDGE_PROOF,'x-listia-client-ip':clientIp(req)},body:JSON.stringify(body)}).catch(()=>null);
  if(!upstream)return json({error:'upstream_unavailable'},503,cors(req));
  const text=await upstream.text();return new Response(text,{status:upstream.status,headers:{...headers,...cors(req),'content-type':upstream.headers.get('content-type')||headers['content-type']}});
}
async function handleInterest(req,env){
  if(req.method==='OPTIONS')return empty(204,cors(req));
  if(req.method!=='POST')return json({error:'method_not_allowed'},405,{'allow':'POST, OPTIONS',...cors(req)});
  if(!sameSite(req))return json({error:'origin_not_allowed'},403,cors(req));
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
    if(req.method==='OPTIONS')return empty(204,cors(req));if(req.method!=='GET')return json({error:'method_not_allowed'},405,{'allow':'GET, OPTIONS',...cors(req)});if(!allowedCaller(req))return json({error:'origin_not_allowed'},403,cors(req));
    const cf=req.cf||{};const lat=Number(cf.latitude),lng=Number(cf.longitude);return json({latitude:Number.isFinite(lat)?lat:null,longitude:Number.isFinite(lng)?lng:null,city:cf.city||null,region:cf.region||null,country:cf.country||null,source:'cloudflare_approximate'},200,cors(req));
  }
  if(url.pathname==='/api/marketplace/feed')return handleFeed(req,env);
  if(url.pathname==='/api/interest')return handleInterest(req,env);
  return env.ASSETS.fetch(req);
}};
