import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')||'';
const ANON=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY')||'';
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const allowed=new Set(['https://app.listiaapp.com','http://localhost','http://127.0.0.1']);
const json=(body:unknown,status=200,origin='')=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff',...(origin&&allowed.has(origin)?{'access-control-allow-origin':origin,'vary':'Origin'}:{})}});

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin')||'';
  if(req.method==='OPTIONS'){
    if(!allowed.has(origin))return new Response(null,{status:403});
    return new Response(null,{status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'POST,OPTIONS','vary':'Origin'}});
  }
  if(req.method!=='POST')return json({error:'method_not_allowed'},405,origin);
  if(origin&&!allowed.has(origin))return json({error:'origin_not_allowed'},403,origin);
  const auth=req.headers.get('authorization')||'';
  if(!auth.startsWith('Bearer '))return json({error:'unauthorized'},401,origin);
  if(!SUPABASE_URL||!ANON||!SERVICE)return json({error:'server_not_configured'},503,origin);

  const userRes=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:ANON,authorization:auth},cache:'no-store'});
  if(!userRes.ok)return json({error:'unauthorized'},401,origin);
  const user=await userRes.json();
  const uid=String(user?.id||'');
  if(!uid)return json({error:'unauthorized'},401,origin);

  const ah={apikey:SERVICE,authorization:`Bearer ${SERVICE}`};
  const unseenRes=await fetch(`${SUPABASE_URL}/rest/v1/marketplace_saved_search_matches?select=id,saved_search_id,listing_id,matched_at&user_id=eq.${encodeURIComponent(uid)}&seen_at=is.null&order=matched_at.desc&limit=50`,{headers:ah,cache:'no-store'});
  if(!unseenRes.ok)return json({error:'match_load_failed'},502,origin);
  const unseen=await unseenRes.json();
  if(!Array.isArray(unseen)||!unseen.length)return json({ok:true,server_generated:true,new_matches:0,unseen_count:0,matches:[]},200,origin);

  const listingIds=[...new Set(unseen.map((r:any)=>String(r.listing_id)).filter(Boolean))];
  const searchIds=[...new Set(unseen.map((r:any)=>String(r.saved_search_id)).filter(Boolean))];
  let details:any[]=[];
  let searches:any[]=[];
  if(listingIds.length){
    const f=`in.(${listingIds.join(',')})`;
    const r=await fetch(`${SUPABASE_URL}/rest/v1/marketplace_listings?select=id,slug,title,price,currency,location_text,cover_image_url,bedrooms,bathrooms,property_type,operation_type&id=${encodeURIComponent(f)}&status=eq.published&visibility=eq.public`,{headers:ah,cache:'no-store'});
    if(r.ok)details=await r.json();
  }
  if(searchIds.length){
    const f=`in.(${searchIds.join(',')})`;
    const r=await fetch(`${SUPABASE_URL}/rest/v1/marketplace_saved_searches?select=id,name,criteria,alert_enabled&id=${encodeURIComponent(f)}&user_id=eq.${encodeURIComponent(uid)}`,{headers:ah,cache:'no-store'});
    if(r.ok)searches=await r.json();
  }
  const byListing=new Map(details.map((d:any)=>[String(d.id),d]));
  const bySearch=new Map(searches.map((s:any)=>[String(s.id),s]));
  const output=unseen.map((r:any)=>({...r,listing:byListing.get(String(r.listing_id))||null,saved_search:bySearch.get(String(r.saved_search_id))||null}));
  return json({ok:true,server_generated:true,new_matches:0,unseen_count:output.length,matches:output},200,origin);
});