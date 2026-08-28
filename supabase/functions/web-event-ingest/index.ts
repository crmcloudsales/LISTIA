import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!, SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false}});
const allowed=new Set(['page_view','listing_view','lead_submit']);
const json=(v:any,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{'content-type':'application/json','cache-control':'no-store'}});
const clean=(v:any,n=500)=>typeof v==='string'?v.trim().slice(0,n):null;
Deno.serve(async req=>{
 if(req.method!=='POST') return json({error:'method_not_allowed'},405);
 let b:any; try{b=await req.json()}catch{return json({error:'invalid_json'},400)}
 const host=clean(b.host,253)?.toLowerCase(); const event=clean(b.event,40); const eventId=clean(b.event_id,180);
 if(!host||!event||!eventId||!allowed.has(event)) return json({error:'invalid_event'},400);
 const {data:resolved,error:rerr}=await db.rpc('resolve_listia_public_site',{p_host:host});
 const site=Array.isArray(resolved)?resolved[0]:resolved; if(rerr||!site?.organization_id) return json({error:'unknown_site'},404);
 const listingId=clean(b.listing_id,80); if(listingId && !(site.listings||[]).some((x:any)=>String(x.id)===listingId)) return json({error:'invalid_listing'},400);
 const url=clean(b.url,1200), ref=clean(b.referrer,1200), a=b.attribution&&typeof b.attribution==='object'?b.attribution:{};
 const click:any={}; for(const k of ['fbclid','gclid','gbraid','wbraid','ttclid','li_fat_id','msclkid']){const v=clean(a[k],300);if(v)click[k]=v}
 const row={organization_id:site.organization_id,website_host:host,event_name:event,event_id:eventId,anonymous_id:clean(b.anonymous_id,120),session_id:clean(b.session_id,120),listing_id:listingId||null,page_url:url,referrer:ref,source:clean(a.utm_source,180),medium:clean(a.utm_medium,180),campaign:clean(a.utm_campaign,240),content:clean(a.utm_content,240),term:clean(a.utm_term,240),click_ids:click,metadata:{path:clean(b.path,800)},occurred_at:new Date().toISOString()};
 const {error}=await db.from('web_events').upsert(row,{onConflict:'organization_id,event_id',ignoreDuplicates:true}); if(error)return json({error:'store_failed'},500);
 const touch={organization_id:site.organization_id,anonymous_id:row.anonymous_id,session_id:row.session_id,event_id:eventId,touch_type:event==='lead_submit'?'conversion':'last',source:row.source,medium:row.medium,campaign:row.campaign,content:row.content,term:row.term,click_ids:click,landing_url:url,referrer:ref,occurred_at:row.occurred_at};
 await db.from('attribution_touchpoints').upsert(touch,{onConflict:'organization_id,event_id,touch_type',ignoreDuplicates:true});
 if(event==='page_view' && row.anonymous_id){const {count}=await db.from('attribution_touchpoints').select('id',{count:'exact',head:true}).eq('organization_id',site.organization_id).eq('anonymous_id',row.anonymous_id).eq('touch_type','first'); if(!count) await db.from('attribution_touchpoints').insert({...touch,touch_type:'first'});}
 return json({ok:true});
});