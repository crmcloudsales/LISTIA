(() => {
  'use strict';
  if(window.__LISTIA_MARKETPLACE_GATEWAY_V9__)return;
  window.__LISTIA_MARKETPLACE_GATEWAY_V9__=true;
  const nativeFetch=window.fetch.bind(window);
  const RPC_MARKERS=['/rest/v1/rpc/marketplace_public_feed','/rest/v1/rpc/marketplace_public_feed_v2','/rest/v1/rpc/marketplace_public_feed_v3'];
  const GEO_KEY='listia_marketplace_geo_v1';
  let geo=null;
  const valid=(lat,lng)=>Number.isFinite(Number(lat))&&Number.isFinite(Number(lng))&&Math.abs(Number(lat))<=90&&Math.abs(Number(lng))<=180;
  function save(value){if(!value||!valid(value.latitude,value.longitude))return null;geo={latitude:Number(value.latitude),longitude:Number(value.longitude),city:value.city||null,region:value.region||null,country:value.country||null,source:value.source||'unknown',updated_at:Date.now()};try{localStorage.setItem(GEO_KEY,JSON.stringify(geo))}catch{}window.LISTIA_MARKETPLACE_GEO=geo;window.dispatchEvent(new CustomEvent('listia:marketplace-geo',{detail:geo}));return geo}
  try{const stored=JSON.parse(localStorage.getItem(GEO_KEY)||'null');if(stored&&valid(stored.latitude,stored.longitude))geo=stored}catch{}
  if(geo)window.LISTIA_MARKETPLACE_GEO=geo;
  async function approximate(){try{const r=await nativeFetch('/api/marketplace/location',{cache:'no-store'});if(!r.ok)return geo;const x=await r.json();return save(x)||geo}catch{return geo}}
  async function precise(){if(!navigator.geolocation)return geo;return new Promise(resolve=>navigator.geolocation.getCurrentPosition(p=>resolve(save({latitude:p.coords.latitude,longitude:p.coords.longitude,source:'browser_precise'})||geo),()=>resolve(geo),{enableHighAccuracy:false,timeout:7000,maximumAge:300000}))}
  approximate();
  async function bodyFor(input,init){if(init?.body){try{return JSON.parse(String(init.body))}catch{return {}}}if(input instanceof Request){try{return JSON.parse(await input.clone().text())}catch{return {}}}return {}}
  window.fetch=async function(input,init){
    const raw=typeof input==='string'?input:(input?.url||'');
    if(RPC_MARKERS.some(m=>raw.includes(m))){
      const body=await bodyFor(input,init);const g=window.LISTIA_MARKETPLACE_GEO||geo;if(g&&valid(g.latitude,g.longitude)){body.p_lat=Number(g.latitude);body.p_lng=Number(g.longitude)}
      return nativeFetch('/api/marketplace/feed',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store',credentials:'same-origin'});
    }
    return nativeFetch(input,init);
  };
  window.LISTIA_MARKETPLACE_GEOLOCATION={get:()=>window.LISTIA_MARKETPLACE_GEO||geo,approximate,usePrecise:precise,refresh:approximate};
})();
