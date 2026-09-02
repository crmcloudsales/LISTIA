(()=>{
'use strict';
if(window.__LISTIA_LEGACY_MAP_GUARD__)return;
window.__LISTIA_LEGACY_MAP_GUARD__=true;

const nativeFetch=window.fetch.bind(window);
const isMarketplaceFeed=input=>{
  try{return new URL(typeof input==='string'?input:input?.url||'',location.href).pathname==='/api/marketplace/feed'}catch{return false}
};
const parseBody=init=>{
  try{return typeof init?.body==='string'?JSON.parse(init.body):null}catch{return null}
};
const localMapRows=payload=>{
  const rows=Array.isArray(window.LISTIA_MARKETPLACE_DATA)?window.LISTIA_MARKETPLACE_DATA:[];
  const offset=Math.max(0,Number(payload?.p_offset)||0);
  const limit=Math.max(1,Math.min(1000,Number(payload?.p_limit)||1000));
  return rows.slice(offset,offset+limit);
};

window.fetch=async(input,init={})=>{
  if(isMarketplaceFeed(input)&&String(init?.method||'GET').toUpperCase()==='POST'){
    const payload=parseBody(init);
    if(payload?.mode==='map'){
      const rows=localMapRows(payload);
      return new Response(JSON.stringify(rows),{
        status:200,
        headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-listia-legacy-map-guard':'local'}
      });
    }
  }
  return nativeFetch(input,init);
};
})();
