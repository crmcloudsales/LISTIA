(()=>{
'use strict';
if(window.__LISTIA_MARKETPLACE_DEMAND__)return;window.__LISTIA_MARKETPLACE_DEMAND__=true;
const ENDPOINT='/api/marketplace/events';
const KEY='listia_marketplace_demand_session_v1';
const ALLOWED=new Set(['listing_view','search','voice_search','map_view','property_open','save','share','contact_click','whatsapp_click','inquiry']);
let session='';try{session=sessionStorage.getItem(KEY)||'';if(!session){session=crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;sessionStorage.setItem(KEY,session)}}catch{session=`${Date.now()}-${Math.random()}`}
const seen=new Set();
const lang=()=>String(window.LISTIA_I18N?.getLanguage?.()||document.documentElement.lang||'').slice(0,20);
const query=()=>String(document.getElementById('marketplaceSearch')?.value||'').trim().slice(0,400)||null;
function listingForCard(card){const title=String(card?.querySelector('.marketplace-title')?.textContent||'').trim();return (window.LISTIA_MARKETPLACE_DATA||[]).find(x=>String(x.title||'').trim()===title)||null}
function payload(event,extra={}){return{event_name:event,session_id:session,listing_id:extra.listing_id||null,query_text:extra.query_text??null,metadata:{language:lang(),...(extra.metadata||{})}}}
function track(event,extra={}){if(!ALLOWED.has(event))return Promise.resolve(false);const body=payload(event,extra);try{return fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store',keepalive:true,credentials:'same-origin'}).then(r=>r.ok).catch(()=>false)}catch{return Promise.resolve(false)}}
function markCards(){document.querySelectorAll('#marketplaceGrid .marketplace-card').forEach(card=>{const l=listingForCard(card);if(l?.id)card.dataset.listingId=l.id})}
let observer=null;
function observeCards(){if(observer)return;observer=new IntersectionObserver(entries=>{for(const e of entries){if(!e.isIntersecting||e.intersectionRatio<.35)continue;const card=e.target,lid=card.dataset.listingId;if(lid&&!seen.has(lid)){seen.add(lid);track('listing_view',{listing_id:lid,metadata:{surface:'list'}});observer.unobserve(card)}}},{threshold:[.35]});document.querySelectorAll('#marketplaceGrid .marketplace-card').forEach(c=>observer.observe(c))}
function refreshCards(){markCards();observeCards();document.querySelectorAll('#marketplaceGrid .marketplace-card').forEach(c=>{if(c.dataset.listingId&&!seen.has(c.dataset.listingId))observer?.observe(c)})}
function clickHandler(e){const t=e.target instanceof Element?e.target:null;if(!t)return;
  const search=t.closest('#marketplaceV8SearchButton');if(search){track('search',{query_text:query(),metadata:{surface:'toolbar'}});return}
  const view=t.closest('[data-marketplace-view]');if(view?.getAttribute('data-marketplace-view')==='map'){track('map_view',{query_text:query(),metadata:{surface:'toggle'}});return}
  const fav=t.closest('.marketplace-favorite-btn');if(fav){const card=fav.closest('.marketplace-card'),l=listingForCard(card);if(l?.id&&fav.dataset.saved!=='1')track('save',{listing_id:l.id,metadata:{surface:'favorite'}});return}
  const interest=t.closest('.marketplace-interest-button');if(interest){const card=interest.closest('.marketplace-card'),l=card?listingForCard(card):window.LISTIA_MARKETPLACE_SELECTED||null;const lid=l?.id||document.querySelector('#marketplaceDetailBody')?.dataset?.listingId||null;if(lid)track('contact_click',{listing_id:lid,metadata:{surface:card?'card':'detail'}});return}
  const mapPreview=t.closest('.marketplace-v8-map-preview button');if(mapPreview){track('property_open',{metadata:{surface:'map_preview'}});return}
  const voice=t.closest('#marketplaceV8VoiceButton,#marketplaceV8TalkButton,[data-marketplace-voice]');if(voice){track('voice_search',{query_text:query(),metadata:{surface:'toolbar'}});return}
  const share=t.closest('[data-marketplace-share],.marketplace-share-button');if(share){const card=share.closest('.marketplace-card'),l=listingForCard(card);track('share',{listing_id:l?.id||null,metadata:{surface:card?'card':'detail'}});return}
}
function patchDetail(){const api=window.LISTIA_MARKETPLACE;if(!api||api.__demandPatched)return;api.__demandPatched=true;const original=api.detail;if(typeof original==='function'){api.detail=function(x,...rest){if(x?.id){track('property_open',{listing_id:x.id,metadata:{surface:'detail'}});const root=document.getElementById('marketplaceDetailBody');if(root)root.dataset.listingId=x.id;window.LISTIA_MARKETPLACE_SELECTED=x}return original.call(this,x,...rest)}}}
function boot(){document.addEventListener('click',clickHandler,true);window.addEventListener('listia:marketplace-search-saved',()=>track('save',{query_text:query(),metadata:{surface:'saved_search'}}));const grid=document.getElementById('marketplaceGrid');if(grid)new MutationObserver(()=>setTimeout(refreshCards,40)).observe(grid,{childList:true});setTimeout(()=>{refreshCards();patchDetail()},250);window.addEventListener('listia:bootstrap-ready',()=>setTimeout(()=>{refreshCards();patchDetail()},100));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.LISTIA_MARKETPLACE_DEMAND={track,refresh:refreshCards};
})();
