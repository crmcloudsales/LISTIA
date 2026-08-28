import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')||'';
const ANON=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY')||'';
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const ALLOWED_ORIGIN='https://app.listiaapp.com';
const RESERVED=new Set(['page_view','listing_view','lead_submit','appointment','qualified_lead','conversion']);
const NAME=/^[a-z0-9][a-z0-9_.:-]{0,79}$/;
const EVENT_ID=/^[A-Za-z0-9._:-]{8,120}$/;
const MAX_BODY_BYTES=65536;
const json=(body:unknown,status=200,origin='')=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY',...(origin===ALLOWED_ORIGIN?{'access-control-allow-origin':origin,'vary':'Origin'}:{})}});
const clean=(v:unknown,max=300)=>String(v??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max);
const uuidLike=(v:unknown)=>{const x=clean(v,40);return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x)?x:null};
const safeMeta=(v:unknown)=>{if(!v||typeof v!=='object'||Array.isArray(v))return{};const out:Record<string,string|number|boolean>={};for(const [raw,val] of Object.entries(v as Record<string,unknown>).slice(0,20)){const key=clean(raw,48).replace(/[^A-Za-z0-9_.:-]/g,'_');if(!key)continue;if(typeof val==='string')out[key]=clean(val,180);else if(typeof val==='number'&&Number.isFinite(val))out[key]=val;else if(typeof val==='boolean')out[key]=val}return out};
const safeClicks=(v:unknown)=>{if(!v||typeof v!=='object'||Array.isArray(v))return{};const out:Record<string,string>={};for(const k of ['fbclid','gclid','gbraid','wbraid','ttclid','li_fat_id','msclkid']){const x=clean((v as any)[k],300);if(x)out[k]=x}return out};
const sameAppUrl=(v:unknown)=>{const raw=clean(v,1000);if(!raw)return null;try{const u=new URL(raw);return u.protocol==='https:'&&u.hostname==='app.listiaapp.com'?u.href.slice(0,1000):null}catch{return null}};
const safeReferrer=(v:unknown)=>{const raw=clean(v,1000);if(!raw)return null;try{const u=new URL(raw);return (u.protocol==='https:'||u.protocol==='http:')?u.href.slice(0,1000):null}catch{return null}};

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin')||'';
  if(req.method==='OPTIONS'){
    if(origin!==ALLOWED_ORIGIN)return new Response(null,{status:403});
    return new Response(null,{status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'POST,OPTIONS','access-control-max-age':'600','vary':'Origin'}});
  }
  if(req.method!=='POST')return json({error:'method_not_allowed'},405,origin);
  if(origin!==ALLOWED_ORIGIN)return json({error:'origin_not_allowed'},403,origin);
  const type=(req.headers.get('content-type')||'').toLowerCase();
  if(!type.includes('application/json'))return json({error:'content_type_required'},415,origin);
  const length=Number(req.headers.get('content-length')||'0');
  if(Number.isFinite(length)&&length>MAX_BODY_BYTES)return json({error:'payload_too_large'},413,origin);
  if(!SUPABASE_URL||!ANON||!SERVICE)return json({error:'server_not_configured'},503,origin);

  const auth=req.headers.get('authorization')||'';
  if(!auth.startsWith('Bearer '))return json({error:'unauthorized'},401,origin);
  const userRes=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:ANON,authorization:auth},cache:'no-store'});
  if(!userRes.ok)return json({error:'unauthorized'},401,origin);
  const user=await userRes.json().catch(()=>null) as any;
  const uid=uuidLike(user?.id);
  if(!uid)return json({error:'unauthorized'},401,origin);

  let body:any={};try{body=await req.json()}catch{return json({error:'invalid_json'},400,origin)}
  const requestedOrg=uuidLike(body?.organization_id);
  const ah={apikey:SERVICE,authorization:`Bearer ${SERVICE}`};
  const memberPath=requestedOrg
    ? `/rest/v1/organization_members?select=organization_id,created_at&user_id=eq.${encodeURIComponent(uid)}&organization_id=eq.${encodeURIComponent(requestedOrg)}&status=eq.active&limit=1`
    : `/rest/v1/organization_members?select=organization_id,created_at&user_id=eq.${encodeURIComponent(uid)}&status=eq.active&order=created_at.asc&limit=1`;
  const memberRes=await fetch(`${SUPABASE_URL}${memberPath}`,{headers:ah,cache:'no-store'});
  if(!memberRes.ok)return json({error:'membership_lookup_failed'},502,origin);
  const members=await memberRes.json().catch(()=>[]) as any[];
  const organizationId=uuidLike(members?.[0]?.organization_id);
  if(!organizationId)return json({ok:true,accepted:0,reason:requestedOrg?'workspace_not_allowed':'no_workspace'},200,origin);

  const incoming=Array.isArray(body?.events)?body.events:[body?.event||body];
  if(!incoming.length)return json({ok:true,accepted:0,product_events:0},200,origin);
  const batch=incoming.slice(0,25);

  const limitRes=await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_pwa_product_event_rate_limit`,{method:'POST',headers:{...ah,'content-type':'application/json'},body:JSON.stringify({p_user_id:uid,p_organization_id:organizationId,p_event_count:batch.length})});
  if(!limitRes.ok)return json({error:'rate_limit_failed'},502,origin);
  const limitRows=await limitRes.json().catch(()=>[]) as any[];
  const limit=Array.isArray(limitRows)?limitRows[0]:limitRows;
  if(!limit?.allowed)return new Response(JSON.stringify({error:'rate_limited'}),{status:429,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','retry-after':String(limit?.retry_after||600),'access-control-allow-origin':origin,'vary':'Origin'}});

  const now=new Date().toISOString();
  const pendingListingIds=new Set<string>();
  const normalized=batch.map((e:any)=>{
    const rawName=clean(e?.event_name||e?.name,80).toLowerCase();
    const eventName=rawName.replace(/[^a-z0-9_.:-]+/g,'_');
    if(!NAME.test(eventName)||RESERVED.has(eventName))return null;
    const rawId=clean(e?.event_id,120);
    const eventId=EVENT_ID.test(rawId)?rawId:crypto.randomUUID();
    const listingId=uuidLike(e?.listing_id);if(listingId)pendingListingIds.add(listingId);
    const pageUrl=sameAppUrl(e?.page_url);
    return {event_name:eventName,event_id:eventId,anonymous_id:clean(e?.anonymous_id,120)||null,session_id:clean(e?.session_id,120)||null,page_url:pageUrl,referrer:safeReferrer(e?.referrer),source:clean(e?.source,120)||null,medium:clean(e?.medium,120)||null,campaign:clean(e?.campaign,180)||null,content:clean(e?.content,180)||null,term:clean(e?.term,180)||null,click_ids:safeClicks(e?.click_ids),metadata:{...safeMeta(e?.metadata),user_id:uid,client:'listia-pwa'},occurred_at:now,_listing_id:listingId};
  }).filter(Boolean) as any[];
  if(!normalized.length)return json({ok:true,accepted:0,product_events:0,rejected_reserved_or_invalid:batch.length},200,origin);

  let allowedListings=new Set<string>();
  if(pendingListingIds.size){
    const ids=[...pendingListingIds];
    const filter=ids.map(id=>`\"${id}\"`).join(',');
    const lr=await fetch(`${SUPABASE_URL}/rest/v1/marketplace_listings?select=id&organization_id=eq.${encodeURIComponent(organizationId)}&id=in.(${encodeURIComponent(filter)})`,{headers:ah,cache:'no-store'});
    if(lr.ok){const rows=await lr.json().catch(()=>[]) as any[];allowedListings=new Set((rows||[]).map(x=>String(x.id)))}
  }
  const productPayload=normalized.map(e=>{const {_listing_id,...rest}=e;if(_listing_id&&allowedListings.has(_listing_id))rest.metadata={...rest.metadata,client_listing_id:_listing_id};return rest});
  const pr=await fetch(`${SUPABASE_URL}/rest/v1/rpc/ingest_pwa_product_events`,{method:'POST',headers:{...ah,'content-type':'application/json'},body:JSON.stringify({p_organization_id:organizationId,p_user_id:uid,p_events:productPayload})});
  if(!pr.ok){console.error('LISTIA pwa product event write failed',pr.status);return json({error:'product_event_write_failed'},502,origin)}
  const productAccepted=Number(await pr.json().catch(()=>0))||0;
  return json({ok:true,accepted:productAccepted,product_events:productAccepted,workspace_id:organizationId},200,origin);
});