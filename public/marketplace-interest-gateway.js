(()=>{'use strict';
const nativeFetch=window.fetch.bind(window),SESSION='listia_session';
function session(){try{return JSON.parse(localStorage.getItem(SESSION)||'null')}catch{return null}}
window.fetch=async function(input,init={}){
  const raw=typeof input==='string'?input:(input?.url||'');
  if(!raw.includes('/rest/v1/rpc/submit_marketplace_interest'))return nativeFetch(input,init);
  const s=session();
  if(!s?.access_token)return new Response(JSON.stringify({error:'authentication_required'}),{status:401,headers:{'content-type':'application/json'}});
  const cfg=window.LISTIA_CONFIG||{},url=`${cfg.SUPABASE_URL}/functions/v1/marketplace-interest-auth`;
  const headers={...(init.headers||{}),apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'};
  return nativeFetch(url,{method:'POST',headers,body:init.body,cache:'no-store',credentials:'omit'});
};
})();
