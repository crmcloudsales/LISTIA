(() => {
  'use strict';
  if(window.__LISTIA_MARKETPLACE_GATEWAY_V9__)return;
  window.__LISTIA_MARKETPLACE_GATEWAY_V9__=true;

  const nativeFetch=window.fetch.bind(window);
  const RPC_MARKERS=['/rest/v1/rpc/marketplace_public_feed','/rest/v1/rpc/marketplace_public_feed_v2','/rest/v1/rpc/marketplace_public_feed_v3'];
  const API_FEED='/api/marketplace/feed';
  const GEO_KEY='listia_marketplace_geo_v1';
  const EDGE_PAGE_SIZE=30;
  const EDGE_MAX_OFFSET=5000;
  const MAP_REQUEST_MAX=1000;
  let geo=null;

  const valid=(lat,lng)=>Number.isFinite(Number(lat))&&Number.isFinite(Number(lng))&&Math.abs(Number(lat))<=90&&Math.abs(Number(lng))<=180;
  const rawUrl=input=>typeof input==='string'?input:(input?.url||'');
  function save(value){if(!value||!valid(value.latitude,value.longitude))return null;geo={latitude:Number(value.latitude),longitude:Number(value.longitude),city:value.city||null,region:value.region||null,country:value.country||null,source:value.source||'unknown',updated_at:Date.now()};try{localStorage.setItem(GEO_KEY,JSON.stringify(geo))}catch{}window.LISTIA_MARKETPLACE_GEO=geo;window.dispatchEvent(new CustomEvent('listia:marketplace-geo',{detail:geo}));return geo}
  try{const stored=JSON.parse(localStorage.getItem(GEO_KEY)||'null');if(stored&&valid(stored.latitude,stored.longitude))geo=stored}catch{}
  if(geo)window.LISTIA_MARKETPLACE_GEO=geo;

  async function approximate(){try{const r=await nativeFetch('/api/marketplace/location',{cache:'no-store'});if(!r.ok)return geo;const x=await r.json();return save(x)||geo}catch{return geo}}
  async function precise(){if(!navigator.geolocation)return geo;return new Promise(resolve=>navigator.geolocation.getCurrentPosition(p=>resolve(save({latitude:p.coords.latitude,longitude:p.coords.longitude,source:'browser_precise'})||geo),()=>resolve(geo),{enableHighAccuracy:false,timeout:7000,maximumAge:300000}))}
  approximate();

  async function bodyFor(input,init){if(init?.body){try{return JSON.parse(String(init.body))}catch{return {}}}if(input instanceof Request){try{return JSON.parse(await input.clone().text())}catch{return {}}}return {}}
  function withGeo(body){const g=window.LISTIA_MARKETPLACE_GEO||geo;if(g&&valid(g.latitude,g.longitude)){body.p_lat=Number(g.latitude);body.p_lng=Number(g.longitude)}return body}
  const jsonResponse=rows=>new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store'}});

  async function fullMap(body){
    const requested=Math.min(Math.max(Number(body.p_limit)||MAP_REQUEST_MAX,1),MAP_REQUEST_MAX);
    const start=Math.min(Math.max(Number(body.p_offset)||0,0),EDGE_MAX_OFFSET);
    if(start>=EDGE_MAX_OFFSET)return jsonResponse([]);
    const clean=withGeo({...body});delete clean.mode;
    const out=[];let offset=start,total=Infinity;
    while(out.length<requested&&offset<EDGE_MAX_OFFSET&&offset<total){
      const size=Math.min(EDGE_PAGE_SIZE,requested-out.length,EDGE_MAX_OFFSET-offset);
      const page={...clean,p_limit:size,p_offset:offset};
      const r=await nativeFetch(API_FEED,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(page),cache:'no-store',credentials:'same-origin'});
      if(!r.ok)return r;
      const rows=await r.json().catch(()=>null);if(!Array.isArray(rows)||!rows.length)break;
      const reported=Number(rows[0]?.total_count);if(Number.isFinite(reported)&&reported>=0)total=reported;
      out.push(...rows.slice(0,requested-out.length));offset+=rows.length;if(rows.length<size)break;
    }
    return jsonResponse(out);
  }

  window.fetch=async function(input,init={}){
    const raw=rawUrl(input);
    if(raw.includes(API_FEED)){
      const body=await bodyFor(input,init);
      if(body?.mode==='map')return fullMap(body);
      return nativeFetch(API_FEED,{...init,method:init?.method||'POST',headers:{...(init?.headers||{}),'content-type':'application/json'},body:JSON.stringify(withGeo(body)),cache:'no-store',credentials:'same-origin'});
    }
    if(RPC_MARKERS.some(m=>raw.includes(m))){
      const body=withGeo(await bodyFor(input,init));
      return nativeFetch(API_FEED,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store',credentials:'same-origin'});
    }
    return nativeFetch(input,init);
  };

  const wantsMarketplace=()=>/^\/marketplace\/?$/i.test(location.pathname)||location.hash==='#marketplace'||new URLSearchParams(location.search).get('marketplace')==='1';
  const wantsVoice=()=>new URLSearchParams(location.search).get('voice')==='1';
  function openMarketplace(attempt=0){
    if(!wantsMarketplace())return;
    const screen=document.getElementById('screen-marketplace'),entry=document.getElementById('marketplaceEntry');
    if(screen){document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s===screen));window.LISTIA_MARKETPLACE?.reload?.();if(wantsVoice())setTimeout(()=>window.LISTIA_VOICE?.open?.(),450);return}
    if(entry){entry.click();if(wantsVoice())setTimeout(()=>window.LISTIA_VOICE?.open?.(),450);return}
    if(attempt<100)setTimeout(()=>openMarketplace(attempt+1),100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>openMarketplace(),{once:true});else openMarketplace();
  window.addEventListener('popstate',()=>openMarketplace());

  window.LISTIA_MARKETPLACE_GEOLOCATION={get:()=>window.LISTIA_MARKETPLACE_GEO||geo,approximate,usePrecise:precise,refresh:approximate};
  window.LISTIA_MARKETPLACE_GATEWAY={version:'10.0.0',edgePageSize:EDGE_PAGE_SIZE,mapMaxOffset:EDGE_MAX_OFFSET,firewallPreserved:true};
  window.LISTIA_MARKETPLACE_GATEWAY_CONTRACT='EDGE_PAGE_SIZE=30';
})();