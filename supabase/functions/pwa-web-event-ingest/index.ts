import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')||'';
const ANON=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY')||'';
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const ALLOWED=new Set(['https://app.listiaapp.com','http://localhost','http://127.0.0.1']);
const CANONICAL=new Set(['page_view','listing_view','lead_submit','appointment','qualified_lead','conversion']);
const json=(body:unknown,status=200,origin='')=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff',...(origin&&ALLOWED.has(origin)?{'access-control-allow-origin':origin,'vary':'Origin'}:{})}});
const clean=(v:unknown,max=300)=>String(v??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max);
const uuidLike=(v:unknown)=>{const x=clean(v,40);return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x)?x:null};

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin')||'';
  if(req.method==='OPTIONS'){
    if(!ALLOWED.has(origin))return new Response(null,{status:403});
    return new Response(null,{status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'POST,OPTIONS','vary':'Origin'}});
  }
  if(req.method!=='POST')return json({error:'method_not_allowed'},405,origin);
  if(origin&&!ALLOWED.has(origin))return json({error:'origin_not_allowed'},403,origin);
  if(!SUPABASE_URL||!ANON||!SERVICE)return json({error:'server_not_configured'},503,origin);
  const auth=req.headers.get('authorization')||'';
  if(!auth.startsWith('Bearer '))return json({error:'unauthorized'},401,origin);
  const userRes=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:ANON,authorization:auth},cache:'no-store'});
  if(!userRes.ok)return json({error:'unauthorized'},401,origin);
  const user=await userRes.json();
  const uid=clean(user?.id,40);
  if(!uid)return json({error:'unauthorized'},401,origin);
  const ah={apikey:SERVICE,authorization:`Bearer ${SERVICE}`};
  const memberRes=await fetch(`${SUPABASE_URL}/rest/v1/organization_members?select=organization_id&user_id=eq.${encodeURIComponent(uid)}&status=eq.active&limit=1`,{headers:ah,cache:'no-store'});
  if(!memberRes.ok)return json({error:'membership_lookup_failed'},502,origin);
  const members=await memberRes.json();
  const organizationId=members?.[0]?.organization_id;
  if(!organizationId)return json({ok:true,accepted:0,reason:'no_workspace'},200,origin);

  let body:any={};try{body=await req.json()}catch{return json({error:'invalid_json'},400,origin)}
  const incoming=Array.isArray(body?.events)?body.events:[body?.event||body];
  const now=new Date().toISOString();
  const normalized=incoming.slice(0,25).map((e:any)=>{
    const rawName=clean(e?.event_name||e?.name,80).toLowerCase().replace(/[^a-z0-9_.:-]+/g,'_');
    if(!rawName)return null;
    const metadata=(e?.metadata&&typeof e.metadata==='object'&&!Array.isArray(e.metadata))?e.metadata:{};
    const clientListingId=uuidLike(e?.listing_id),clientLeadId=uuidLike(e?.lead_id);
    return {
      event_name:rawName,
      event_id:clean(e?.event_id,120)||crypto.randomUUID(),
      anonymous_id:clean(e?.anonymous_id,120)||null,
      session_id:clean(e?.session_id,120)||null,
      page_url:clean(e?.page_url,1000)||null,
      referrer:clean(e?.referrer,1000)||null,
      source:clean(e?.source,120)||null,
      medium:clean(e?.medium,120)||null,
      campaign:clean(e?.campaign,180)||null,
      content:clean(e?.content,180)||null,
      term:clean(e?.term,180)||null,
      click_ids:(e?.click_ids&&typeof e.click_ids==='object'&&!Array.isArray(e.click_ids))?e.click_ids:{},
      metadata:{...metadata,user_id:uid,client:'listia-pwa',...(clientListingId?{client_listing_id:clientListingId}:{}),...(clientLeadId?{client_lead_id:clientLeadId}:{})},
      occurred_at:clean(e?.occurred_at,40)||now,
      listing_id:clientListingId,
      lead_id:clientLeadId
    };
  }).filter(Boolean) as any[];
  if(!normalized.length)return json({ok:true,accepted:0},200,origin);

  const canonical=normalized.filter(e=>CANONICAL.has(e.event_name));
  const product=normalized.filter(e=>!CANONICAL.has(e.event_name));
  let canonicalAccepted=0,productAccepted=0;

  if(product.length){
    const productPayload=product.map(({listing_id,lead_id,...e})=>e);
    const pr=await fetch(`${SUPABASE_URL}/rest/v1/rpc/ingest_pwa_product_events`,{method:'POST',headers:{...ah,'content-type':'application/json'},body:JSON.stringify({p_organization_id:organizationId,p_user_id:uid,p_events:productPayload})});
    if(!pr.ok){console.error('LISTIA pwa product event write failed',pr.status,await pr.text());return json({error:'product_event_write_failed'},502,origin)}
    productAccepted=Number(await pr.json().catch(()=>0))||0;
  }

  if(canonical.length){
    const listingIds=[...new Set(canonical.map(e=>e.listing_id).filter(Boolean))];
    let allowedListings=new Set<string>();
    if(listingIds.length){
      const filter=listingIds.map(id=>`\"${id}\"`).join(',');
      const lr=await fetch(`${SUPABASE_URL}/rest/v1/marketplace_listings?select=id&id=in.(${encodeURIComponent(filter)})`,{headers:ah,cache:'no-store'});
      if(lr.ok){const rows=await lr.json().catch(()=>[]);allowedListings=new Set((rows||[]).map((x:any)=>String(x.id)))}
    }
    const rows=canonical.map(e=>({
      organization_id:organizationId,
      website_host:'app.listiaapp.com',
      event_name:e.event_name,
      event_id:e.event_id,
      anonymous_id:e.anonymous_id,
      session_id:e.session_id,
      listing_id:e.listing_id&&allowedListings.has(e.listing_id)?e.listing_id:null,
      lead_id:e.lead_id,
      page_url:e.page_url,
      referrer:e.referrer,
      source:e.source,
      medium:e.medium,
      campaign:e.campaign,
      content:e.content,
      term:e.term,
      click_ids:e.click_ids,
      metadata:e.metadata,
      occurred_at:e.occurred_at
    }));
    const insert=await fetch(`${SUPABASE_URL}/rest/v1/web_events`,{method:'POST',headers:{...ah,'content-type':'application/json','prefer':'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(rows)});
    if(!insert.ok){console.error('LISTIA canonical web event write failed',insert.status,await insert.text());return json({error:'canonical_event_write_failed'},502,origin)}
    canonicalAccepted=rows.length;
  }

  return json({ok:true,accepted:canonicalAccepted+productAccepted,canonical_events:canonicalAccepted,product_events:productAccepted},200,origin);
});