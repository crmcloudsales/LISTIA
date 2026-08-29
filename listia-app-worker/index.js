const ALLOWED_ORIGINS=new Set(['https://app.listiaapp.com','https://listiaapp.com','https://www.listiaapp.com']);
const ALLOWED_HOSTNAMES=new Set(['app.listiaapp.com','listiaapp.com','www.listiaapp.com']);
const TURNSTILE_VERIFY='https://challenges.cloudflare.com/turnstile/v0/siteverify';
const SUPABASE_INTEREST='https://zvzafiarwerbuoaccnoz.supabase.co/functions/v1/marketplace-interest-auth';

const headers={
  'content-type':'application/json;charset=utf-8',
  'cache-control':'no-store',
  'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer',
  'x-frame-options':'DENY'
};
const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{...headers,...extra}});

function clientIp(req){
  return req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'';
}
function sameSite(req){
  const origin=req.headers.get('origin')||'';
  const sec=req.headers.get('sec-fetch-site')||'';
  return ALLOWED_ORIGINS.has(origin)&&(!sec||sec==='same-origin'||sec==='same-site');
}
async function verifyHuman(req,env,token){
  if(!token||token.length<20||!env.TURNSTILE_SECRET)return {ok:false,reason:'missing_human_verification'};
  const form=new FormData();
  form.set('secret',env.TURNSTILE_SECRET);
  form.set('response',token);
  const ip=clientIp(req);if(ip)form.set('remoteip',ip);
  let result;
  try{
    const r=await fetch(TURNSTILE_VERIFY,{method:'POST',body:form});
    result=await r.json();
  }catch{return {ok:false,reason:'verification_unavailable'}}
  if(!result?.success)return {ok:false,reason:'human_verification_failed'};
  if(!ALLOWED_HOSTNAMES.has(String(result.hostname||'').toLowerCase()))return {ok:false,reason:'hostname_mismatch'};
  if(result.action!=='marketplace_interest')return {ok:false,reason:'action_mismatch'};
  return {ok:true};
}

async function handleInterest(req,env){
  if(req.method!=='POST')return json({error:'method_not_allowed'},405,{'allow':'POST'});
  if(!sameSite(req))return json({error:'origin_not_allowed'},403);
  const auth=req.headers.get('authorization')||'';
  if(!/^Bearer\s+\S+/i.test(auth))return json({error:'authentication_required'},401);
  const apiKey=req.headers.get('apikey')||'';
  if(!apiKey)return json({error:'client_key_required'},400);
  const len=Number(req.headers.get('content-length')||0);
  if(len>12000)return json({error:'payload_too_large'},413);

  const body=await req.json().catch(()=>null);
  if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'invalid_json'},400);
  const turnstile=String(body.turnstile_token||'');
  const verified=await verifyHuman(req,env,turnstile);
  if(!verified.ok)return json({error:verified.reason},403);
  if(!env.MARKETPLACE_EDGE_PROOF)return json({error:'firewall_not_configured'},503);

  const upstreamBody={...body};
  delete upstreamBody.turnstile_token;
  const upstream=await fetch(SUPABASE_INTEREST,{
    method:'POST',
    headers:{
      'authorization':auth,
      'apikey':apiKey,
      'content-type':'application/json',
      'x-listia-edge-proof':env.MARKETPLACE_EDGE_PROOF,
      'x-listia-client-ip':clientIp(req)
    },
    body:JSON.stringify(upstreamBody)
  }).catch(()=>null);
  if(!upstream)return json({error:'upstream_unavailable'},503);
  const text=await upstream.text();
  return new Response(text,{status:upstream.status,headers:{...headers,'content-type':upstream.headers.get('content-type')||headers['content-type']}});
}

export default {
  async fetch(req,env){
    const url=new URL(req.url);
    if(url.pathname==='/api/security/turnstile-config'){
      if(req.method!=='GET')return json({error:'method_not_allowed'},405);
      if(!env.TURNSTILE_SITE_KEY)return json({error:'turnstile_not_configured'},503);
      return json({sitekey:env.TURNSTILE_SITE_KEY},200,{'cache-control':'public, max-age=3600'});
    }
    if(url.pathname==='/api/interest')return handleInterest(req,env);
    return env.ASSETS.fetch(req);
  }
};
