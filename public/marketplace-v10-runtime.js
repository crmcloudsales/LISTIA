(() => {
  'use strict';
  if(window.__LISTIA_MARKETPLACE_V10_RUNTIME__) return;
  window.__LISTIA_MARKETPLACE_V10_RUNTIME__=true;

  const nativeFetch=window.fetch.bind(window);
  const RPC_MARKERS=['/rest/v1/rpc/marketplace_public_feed','/rest/v1/rpc/marketplace_public_feed_v2','/rest/v1/rpc/marketplace_public_feed_v3'];
  const EDGE_PAGE_SIZE=30;
  const EDGE_MAX_OFFSET=5000;
  const MAP_REQUEST_MAX=1000;

  const validGeo=g=>g&&Number.isFinite(Number(g.latitude))&&Number.isFinite(Number(g.longitude))&&Math.abs(Number(g.latitude))<=90&&Math.abs(Number(g.longitude))<=180;
  const currentGeo=()=>window.LISTIA_MARKETPLACE_GEOLOCATION?.get?.()||window.LISTIA_MARKETPLACE_GEO||null;
  const rawUrl=input=>typeof input==='string'?input:(input?.url||'');
  async function bodyFor(input,init){
    if(init?.body){try{return JSON.parse(String(init.body))}catch{return {}}}
    if(input instanceof Request){try{return JSON.parse(await input.clone().text())}catch{return {}}}
    return {};
  }
  const response=(rows,status=200)=>new Response(JSON.stringify(rows),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store'}});

  async function loadMapBatch(payload){
    const requested=Math.min(Math.max(Number(payload.p_limit)||MAP_REQUEST_MAX,1),MAP_REQUEST_MAX);
    const start=Math.min(Math.max(Number(payload.p_offset)||0,0),EDGE_MAX_OFFSET);
    if(start>=EDGE_MAX_OFFSET) return response([]);
    const clean={...payload};
    delete clean.mode;
    const out=[];
    let offset=start,total=Infinity;
    while(out.length<requested&&offset<EDGE_MAX_OFFSET&&offset<total){
      const size=Math.min(EDGE_PAGE_SIZE,requested-out.length,EDGE_MAX_OFFSET-offset);
      const page={...clean,p_limit:size,p_offset:offset};
      const r=await nativeFetch('/api/marketplace/feed',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(page),cache:'no-store',credentials:'same-origin'});
      if(!r.ok) return r;
      const rows=await r.json().catch(()=>null);
      if(!Array.isArray(rows)||!rows.length) break;
      const reported=Number(rows[0]?.total_count);
      if(Number.isFinite(reported)&&reported>=0) total=reported;
      out.push(...rows.slice(0,requested-out.length));
      offset+=rows.length;
      if(rows.length<size) break;
    }
    return response(out);
  }

  window.fetch=async function(input,init={}){
    const raw=rawUrl(input);
    if(raw.includes('/api/marketplace/feed')){
      const body=await bodyFor(input,init);
      if(body?.mode==='map') return loadMapBatch(body);
      return nativeFetch(input,init);
    }
    if(RPC_MARKERS.some(marker=>raw.includes(marker))){
      const body=await bodyFor(input,init),g=currentGeo();
      if(validGeo(g)){body.p_lat=Number(g.latitude);body.p_lng=Number(g.longitude)}
      return nativeFetch(input,{...init,body:JSON.stringify(body)});
    }
    return nativeFetch(input,init);
  };

  window.LISTIA_MARKETPLACE_V10_RUNTIME={
    version:'10.0.0',
    edgePageSize:EDGE_PAGE_SIZE,
    mapMaxOffset:EDGE_MAX_OFFSET,
    firewallPreserved:true
  };
})();