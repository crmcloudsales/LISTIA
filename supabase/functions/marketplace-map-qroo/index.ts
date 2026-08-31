import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, max-age=60','x-content-type-options':'nosniff'}});
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
const sane=(v:string|null,max=120)=>String(v||'').trim().slice(0,max);

Deno.serve(async(req:Request)=>{
  if(req.method!=='GET') return json(405,{error:'method_not_allowed'});
  const u=new URL(req.url);
  const mode=sane(u.searchParams.get('mode')||'clusters',20);
  if(!['clusters','listings','summary'].includes(mode)) return json(400,{error:'invalid_mode'});
  const municipality=sane(u.searchParams.get('municipality'));
  const place=sane(u.searchParams.get('place'));
  const operation=sane(u.searchParams.get('operation'),20).toLowerCase();
  const propertyType=sane(u.searchParams.get('property_type'),50).toLowerCase();
  const minPrice=Number(u.searchParams.get('min_price')||'');
  const maxPrice=Number(u.searchParams.get('max_price')||'');
  const minBeds=Number(u.searchParams.get('min_bedrooms')||'');
  const limit=clamp(Number(u.searchParams.get('limit')|| (mode==='listings'?'250':'100'))||100,1,500);

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
  } else {
    path='marketplace_qroo_mapped_listings';
    q.set('select','id,source_id,slug,title,operation_type,property_type,price,currency,location_text,city,state_region,bedrooms,bathrooms,area_m2,cover_image_url,external_url,canonical_place,municipality,map_latitude,map_longitude,map_precision');
    q.set('map_precision','neq.unmapped'); q.set('limit',String(limit)); q.set('order','updated_at.desc');
    if(municipality) q.set('municipality',`eq.${municipality}`);
    if(place) q.set('canonical_place',`eq.${place}`);
    if(operation) q.set('operation_type',`ilike.${operation}`);
    if(propertyType) q.set('property_type',`ilike.${propertyType}`);
    if(Number.isFinite(minPrice)) q.set('price',`gte.${minPrice}`);
    if(Number.isFinite(maxPrice)) q.append('price',`lte.${maxPrice}`);
    if(Number.isFinite(minBeds)) q.set('bedrooms',`gte.${minBeds}`);
  }

  const r=await fetch(`${sb}/rest/v1/${path}?${q.toString()}`,{headers});
  if(!r.ok) return json(502,{error:'map_query_failed',status:r.status});
  const data=await r.json();
  return json(200,{ok:true,mode,count:Array.isArray(data)?data.length:0,data});
});
