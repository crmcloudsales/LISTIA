(()=>{
'use strict';
if(window.__LISTIA_MARKETPLACE_NATIVE_RUNTIME_V1__)return;
window.__LISTIA_MARKETPLACE_NATIVE_RUNTIME_V1__=true;
const nativeFetch=window.fetch.bind(window);
const RPC_RE=/\/rest\/v1\/rpc\/marketplace_public_feed(?:_v2|_v3)?(?:\?|$)/i;
const API='/api/marketplace/feed';
const parseBody=async(input,init)=>{try{if(init&&init.body!=null)return JSON.parse(String(init.body));if(input instanceof Request)return JSON.parse(await input.clone().text());}catch{}return{}};
window.fetch=async function(input,init={}){
  const raw=typeof input==='string'?input:(input?.url||'');
  if(RPC_RE.test(raw)){
    const body=await parseBody(input,init);
    return nativeFetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store',credentials:'same-origin'});
  }
  return nativeFetch(input,init);
};
async function refreshApp(){
  try{if('caches'in window){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)))}}catch{}
  try{const reg=await navigator.serviceWorker?.getRegistration?.();await reg?.update?.()}catch{}
  location.reload();
}
function addRefreshControl(){
  if(document.getElementById('listiaRefreshAppButton'))return;
  const account=document.getElementById('screen-account')||document.querySelector('[id*=account].screen');
  if(!account)return;
  const host=account.querySelector('.panel')||account;
  const b=document.createElement('button');b.id='listiaRefreshAppButton';b.type='button';b.className='secondary full listia-refresh-app';b.textContent='Actualizar LISTIA';
  const note=document.createElement('small');note.className='listia-refresh-note';note.textContent='Limpia archivos temporales y carga la versión más reciente sin borrar tu cuenta.';
  b.addEventListener('click',refreshApp);host.append(b,note);
}
let tries=0;const boot=()=>{addRefreshControl();if(!document.getElementById('listiaRefreshAppButton')&&tries++<80)setTimeout(boot,250)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.LISTIA_APP_REFRESH=refreshApp;
})();
