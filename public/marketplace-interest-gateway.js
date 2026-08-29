(()=>{'use strict';
const nativeFetch=window.fetch.bind(window),SESSION='listia_session';
let scriptPromise=null,siteKeyPromise=null,tokenPromise=null;
function session(){try{return JSON.parse(localStorage.getItem(SESSION)||'null')}catch{return null}}
function response(body,status){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store'}})}
function loadTurnstile(){
  if(window.turnstile)return Promise.resolve(window.turnstile);
  if(scriptPromise)return scriptPromise;
  scriptPromise=new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async=true;s.defer=true;
    s.onload=()=>window.turnstile?resolve(window.turnstile):reject(new Error('turnstile_unavailable'));
    s.onerror=()=>reject(new Error('turnstile_load_failed'));
    document.head.append(s);
  });
  return scriptPromise;
}
function getSiteKey(){
  if(siteKeyPromise)return siteKeyPromise;
  siteKeyPromise=nativeFetch('/api/security/turnstile-config',{cache:'no-store',credentials:'same-origin'})
    .then(async r=>{const d=await r.json().catch(()=>null);if(!r.ok||!d?.sitekey)throw new Error('turnstile_config_failed');return d.sitekey})
    .catch(e=>{siteKeyPromise=null;throw e});
  return siteKeyPromise;
}
function humanToken(){
  if(tokenPromise)return tokenPromise;
  tokenPromise=(async()=>{
    const [turnstile,sitekey]=await Promise.all([loadTurnstile(),getSiteKey()]);
    const host=document.createElement('div');
    host.id=`listia-turnstile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    host.setAttribute('aria-live','polite');
    Object.assign(host.style,{position:'fixed',left:'50%',bottom:'24px',transform:'translateX(-50%)',zIndex:'2147483647',maxWidth:'calc(100vw - 24px)'});
    document.body.append(host);
    return await new Promise((resolve,reject)=>{
      let widgetId=null,done=false;
      const finish=(fn,value)=>{if(done)return;done=true;try{if(widgetId!==null)turnstile.remove(widgetId)}catch{}host.remove();fn(value)};
      try{
        widgetId=turnstile.render(host,{
          sitekey,
          action:'marketplace_interest',
          appearance:'interaction-only',
          execution:'execute',
          theme:'auto',
          language:'auto',
          callback:token=>finish(resolve,token),
          'error-callback':()=>finish(reject,new Error('human_verification_failed')),
          'expired-callback':()=>finish(reject,new Error('human_verification_expired')),
          'timeout-callback':()=>finish(reject,new Error('human_verification_timeout'))
        });
        turnstile.execute(widgetId);
      }catch(e){finish(reject,e)}
    });
  })().finally(()=>{tokenPromise=null});
  return tokenPromise;
}
window.fetch=async function(input,init={}){
  const raw=typeof input==='string'?input:(input?.url||'');
  const isClick=raw.includes('/rest/v1/rpc/submit_marketplace_interest_click');
  const isForm=raw.includes('/rest/v1/rpc/submit_marketplace_interest');
  if(!isClick&&!isForm)return nativeFetch(input,init);
  const s=session();
  if(!s?.access_token)return response({error:'authentication_required'},401);
  const cfg=window.LISTIA_CONFIG||{};
  let token;
  try{token=await humanToken()}catch{return response({error:'human_verification_required'},403)}
  let payload={};
  try{payload=init.body?JSON.parse(String(init.body)):{} }catch{return response({error:'invalid_json'},400)}
  payload.mode=isClick?'click':'form';
  payload.turnstile_token=token;
  const headers={...(init.headers||{}),apikey:cfg.SUPABASE_PUBLISHABLE_KEY||cfg.SUPABASE_ANON_KEY||'',Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'};
  return nativeFetch('/api/interest',{method:'POST',headers,body:JSON.stringify(payload),cache:'no-store',credentials:'same-origin'});
};
})();
