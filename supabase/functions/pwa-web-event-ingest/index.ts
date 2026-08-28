import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')||'';
const ANON=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY')||'';
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const ALLOWED=new Set(['https://app.listiaapp.com','http://localhost','http://127.0.0.1']);
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
  const rows=incoming.slice(0,25).map((e:any)=>{
    const name=clean(e?.event_name||e?.name,80).toLowerCase().replace(/[^a-z0-9_.:-]+/g,'_');
    if(!name)return null;
    const metadata=(e?.metadata&&typeof e.metadata==='object'&&!Array.isArray(e.metadata))?e.metadata:{};
    return {
      organization_id:organizationId,
      website_host:'app.listiaapp.com',
      event_name:name,
      event_id:clean(e?.event_id,120)||crypto.randomUUID(),
      anonymous_id:clean(e?.anonymous_id,120)||null,
      session_id:clean(e?.session_id,120)||null,
      listing_id:uuidLike(e?.listing_id),
      lead_id:uuidLike(e?.lead_id),
      page_url:clean(e?.page_url,1000)||null,
      referrer:clean(e?.referrer,1000)||null,
      source:clean(e?.source,120)||null,
      medium:clean(e?.medium,120)||null,
      campaign:clean(e?.campaign,180)||null,
      content:clean(e?.content,180)||null,
      term:clean(e?.term,180)||null,
      click_ids:(e?.click_ids&&typeof e.click_ids==='object'&&!Array.isArray(e.click_ids))?e.click_ids:{},
      metadata:{...metadata,user_id:uid,client:'listia-pwa'},
      occurred_at:clean(e?.occurred_at,40)||now
    };
  }).filter(Boolean);
  if(!rows.length)return json({ok:true,accepted:0},200,origin);
  const insert=await fetch(`${SUPABASE_URL}/rest/v1/web_events`,{method:'POST',headers:{...ah,'content-type':'application/json','prefer':'return=minimal'},body:JSON.stringify(rows)});
  if(!insert.ok)return json({error:'event_write_failed'},502,origin);
  return json({ok:true,accepted:rows.length},200,origin);
});