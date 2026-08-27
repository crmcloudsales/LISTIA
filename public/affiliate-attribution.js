(() => {
  'use strict';
  const cfg=window.LISTIA_CONFIG||{};
  const API_KEY=cfg.SUPABASE_PUBLISHABLE_KEY||cfg.SUPABASE_ANON_KEY||'';
  const SESSION_KEY='listia_session';
  const REF_KEY='listia_affiliate_ref';
  let attempts=0,timer=0;
  function normalize(v){return String(v||'').toLowerCase().trim().replace(/[^a-z0-9-]+/g,'').slice(0,32)}
  function cookie(name){const m=document.cookie.match(new RegExp('(?:^|;\\s*)'+name+'=([^;]+)'));return m?decodeURIComponent(m[1]):''}
  function capture(){let code='';try{code=normalize(new URLSearchParams(location.search).get('ref'))}catch{}if(!code)code=normalize(cookie(REF_KEY));if(!code){try{code=normalize(localStorage.getItem(REF_KEY))}catch{}}if(!code)return'';try{localStorage.setItem(REF_KEY,code)}catch{}const secure=location.protocol==='https:'?'; Secure':'';document.cookie=`${REF_KEY}=${encodeURIComponent(code)}; Path=/; Domain=.listiaapp.com; Max-Age=7776000; SameSite=Lax${secure}`;return code}
  function session(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
  async function attribute(){const code=capture();if(!code)return true;const s=session();if(!s?.access_token)return false;const done=`listia_affiliate_attributed_${code}`;try{if(localStorage.getItem(done)==='1')return true}catch{}if(!cfg.SUPABASE_URL||!API_KEY)return false;const r=await fetch(`${cfg.SUPABASE_URL}/functions/v1/affiliate-portal`,{method:'POST',headers:{apikey:API_KEY,Authorization:`Bearer ${s.access_token}`,'content-type':'application/json'},body:JSON.stringify({action:'attribute',referral_code:code}),cache:'no-store'});const j=await r.json().catch(()=>({}));if(r.ok||j?.error==='self_referral_not_allowed'){try{localStorage.setItem(done,'1')}catch{}return true}if(j?.error==='organization_not_found')return false;if(j?.error==='organization_already_attributed'){try{localStorage.setItem(done,'1')}catch{}return true}return false}
  function schedule(delay=300){clearTimeout(timer);timer=window.setTimeout(async()=>{attempts+=1;const finished=await attribute().catch(()=>false);if(!finished&&attempts<48)schedule(Math.min(5000,300+attempts*180))},delay)}
  function boot(){capture();schedule();window.addEventListener('storage',e=>{if(e.key===SESSION_KEY)schedule(50)});window.addEventListener('listia:onboarding-complete',()=>schedule(50));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
