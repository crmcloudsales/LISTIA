import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, max-age=60','x-content-type-options':'nosniff'}});
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
const sane=(v:string|null,max=120)=>String(v||'').trim().slice(0,max);

Deno.serve(async(req:Request)=>{
  if(req.method!=='GET') return json(405,{error:'method_not_allowed'});
  const u=new URL(req.url);
  const mode=sane(u.searchParams.get('mode')||'clusters',24);
  if(!['clusters','listings','summary','microzones','trends'].includes(mode)) return json(400,{error:'invalid_mode'});
  const municipality=sane(u.searchParams.get('municipality'));
  const place=sane(u.searchParams.get('place'));
  const operation=sane(u.searchParams.get('operation'),20).toLowerCase();
  const propertyType=sane(u.searchParams.get('property_type'),50).toLowerCase();
  const currency=sane(u.searchParams.get('currency'),12).toUpperCase();
  const confidence=sane(u.searchParams.get('confidence'),12).toLowerCase();
  const minPriceRaw=u.searchParams.get('min_price');
  const maxPriceRaw=u.searchParams.get('max_price');
  const minBedsRaw=u.searchParams.get('min_bedrooms');
  const minPrice=minPriceRaw===null?NaN:Number(minPriceRaw);
  const maxPrice=maxPriceRaw===null?NaN:Number(maxPriceRaw);
  const minBeds=minBedsRaw===null?NaN:Number(minBedsRaw);
  const limit=clamp(Number(u.searchParams.get('limit')|| (mode==='listings'?'250':mode==='microzones'?'150':mode==='trends'?'180':'100'))||100,1,500);

  const sb=Deno.env.get('SUPABASE_URL')||'';
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  if(!sb||!key) return json(500,{error:'runtime_not_configured'});
  const headers={apikey:key,Authorization:`Bearer ${key}`,Accept:'application/json'};

  let path=''; const q=new URLSearchParams();
  if(mode==='clusters'){
    path='marketplace_qroo_map_clusters';
    q.set('select','*'); q.set('order','listings.desc'); q.set('limit',String(limit));
    if(municipality) q.set('municipality',`eq.${municipality}`);
    if(place) q.set('canonical_place',`eq.${place}`);
  } else if(mode==='summary'){
    path='marketplace_qroo_map_summary';
    q.set('select','*'); q.set('order','listings.desc'); q.set('limit',String(limit));
    if(municipality) q.set('municipality',`eq.${municipality}`);
  } else if(mode==='microzones'){
    path='marketplace_qroo_microzones_v3';
    q.set('select','canonical_place,municipality,microzone,postal_code,currency,operation_type,listings,sources,priced_listings,price_m2_samples,median_price,median_price_per_m2,metric_confidence');
    q.set('order','listings.desc'); q.set('limit',String(limit));
    if(municipality) q.set('municipality',`eq.${municipality}`);
    if(place) q.set('canonical_place',`eq.${place}`);
    if(operation&&['sale','rent','unknown'].includes(operation)) q.set('operation_type',`eq.${operation}`);
    if(currency&&['MXN','USD'].includes(currency)) q.set('currency',`eq.${currency}`);
    if(confidence&&['high','medium','low'].includes(confidence)) q.set('metric_confidence',`eq.${confidence}`);
  } else if(mode==='trends'){
    path='marketplace_qroo_market_trends';
    q.set('select','snapshot_date,canonical_place,municipality,operation_type,currency,inventory_count,source_count,price_samples,price_m2_samples,median_price,median_price_per_m2');
    q.set('order','snapshot_date.asc'); q.set('limit',String(limit));
    if(place) q.set('canonical_place',`eq.${place}`);
    if(municipality) q.set('municipality',`eq.${municipality}`);
    if(operation&&['sale','rent','unknown'].includes(operation)) q.set('operation_type',`eq.${operation}`);
    if(currency&&['MXN','USD'].includes(currency)) q.set('currency',`eq.${currency}`);
  } else {
    path='marketplace_qroo_mapped_listings';
    q.set('select','id,source_id,slug,title,operation_type,property_type,price,currency,location_text,city,state_region,bedrooms,bathrooms,area_m2,cover_image_url,external_url,canonical_place,municipality,map_latitude,map_longitude,map_precision');
    q.set('map_precision','neq.unmapped'); q.set('limit',String(limit)); q.set('order','updated_at.desc');
    if(municipality) q.set('municipality',`eq.${municipality}`);
    if(place) q.set('canonical_place',`eq.${place}`);
    if(operation) q.set('operation_type',`ilike.${operation}`);
    if(propertyType) q.set('property_type',`ilike.${propertyType}`);
    if(currency) q.set('currency',`eq.${currency}`);
    if(Number.isFinite(minPrice)) q.set('price',`gte.${minPrice}`);
    if(Number.isFinite(maxPrice)) q.append('price',`lte.${maxPrice}`);
    if(Number.isFinite(minBeds)) q.set('bedrooms',`gte.${minBeds}`);
  }

  const r=await fetch(`${sb}/rest/v1/${path}?${q.toString()}`,{headers});
  if(!r.ok) return json(502,{error:'map_query_failed',status:r.status});
  const data=await r.json();
  return json(200,{ok:true,mode,count:Array.isArray(data)?data.length:0,data});
});
