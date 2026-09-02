(()=>{
'use strict';
if(window.__LISTIA_MARKETPLACE_NATIVE_RUNTIME_V1__)return;
window.__LISTIA_MARKETPLACE_NATIVE_RUNTIME_V1__=true;
const nativeFetch=window.fetch.bind(window);
const RPC_RE=/\/rest\/v1\/rpc\/marketplace_public_feed(?:_v2|_v3)?(?:\?|$)/i;
const QROO_RE=/\/functions\/v1\/marketplace-map-qroo(?:\?|$)/i;
const API='/api/marketplace/feed';
const QROO_API='/api/marketplace/qroo';
const parseBody=async(input,init)=>{try{if(init&&init.body!=null)return JSON.parse(String(init.body));if(input instanceof Request)return JSON.parse(await input.clone().text());}catch{}return{}};
window.fetch=async function(input,init={}){
  const raw=typeof input==='string'?input:(input?.url||'');
  if(QROO_RE.test(raw)){
    let search='';try{search=new URL(raw,location.href).search}catch{}
    return nativeFetch(`${QROO_API}${search}`,{method:'GET',headers:{accept:'application/json'},cache:'no-store',credentials:'same-origin'});
  }
  if(RPC_RE.test(raw)){
    const body=await parseBody(input,init);
    return nativeFetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store',credentials:'same-origin'});
  }
  return nativeFetch(input,init);
};

const isMobile=()=>matchMedia('(max-width:650px)').matches;
const resetMarketplaceList=(reason='runtime')=>{
  if(!isMobile())return;
  const screen=document.getElementById('screen-marketplace');
  const grid=document.getElementById('marketplaceGrid');
  if(!screen?.classList.contains('active')||!screen.classList.contains('marketplace-pro-list')||!grid)return;
  const go=()=>{
    try{grid.scrollTo({left:0,top:0,behavior:'instant'})}catch{grid.scrollLeft=0}
    grid.scrollLeft=0;
    grid.dataset.listiaInitialScrollReset=reason;
  };
  requestAnimationFrame(()=>requestAnimationFrame(go));
};
function wireMarketplaceListReset(){
  const screen=document.getElementById('screen-marketplace');
  const grid=document.getElementById('marketplaceGrid');
  if(!screen||!grid)return false;
  if(grid.dataset.listiaResetWired==='1')return true;
  grid.dataset.listiaResetWired='1';
  let renderTimer=0;
  const children=new MutationObserver(mutations=>{
    if(!mutations.some(m=>m.type==='childList'))return;
    clearTimeout(renderTimer);
    renderTimer=setTimeout(()=>resetMarketplaceList('results'),0);
  });
  children.observe(grid,{childList:true});
  let wasList=screen.classList.contains('marketplace-pro-list');
  const mode=new MutationObserver(()=>{
    const now=screen.classList.contains('marketplace-pro-list');
    if(now&&!wasList)resetMarketplaceList('tab');
    wasList=now;
  });
  mode.observe(screen,{attributes:true,attributeFilter:['class']});
  screen.addEventListener('click',event=>{
    const button=event.target.closest?.('.marketplace-pro-tabs button');
    if(button&&/^(Propiedades|Properties)$/i.test((button.textContent||'').trim()))setTimeout(()=>resetMarketplaceList('properties-button'),0);
  },true);
  setTimeout(()=>resetMarketplaceList('boot'),0);
  return true;
}

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
let tries=0;const boot=()=>{
  addRefreshControl();
  const resetReady=wireMarketplaceListReset();
  if((!document.getElementById('listiaRefreshAppButton')||!resetReady)&&tries++<80)setTimeout(boot,250);
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.LISTIA_APP_REFRESH=refreshApp;
window.LISTIA_MARKETPLACE_RESET_LIST=resetMarketplaceList;
})();
