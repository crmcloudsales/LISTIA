(() => {
  'use strict';

  const CFG=window.LISTIA_CONFIG||{};
  const KEY=CFG.SUPABASE_PUBLISHABLE_KEY||CFG.SUPABASE_ANON_KEY||'';
  const nativeFetch=window.fetch.bind(window);
  const LEGACY_MARK='/rest/v1/marketplace_listings?select=';
  const SAFE_MARK='/rest/v1/rpc/marketplace_public_feed';
  const SAFE_V2_MARK='/rest/v1/rpc/marketplace_public_feed_v2';
  const SAFE_V3_MARK='/rest/v1/rpc/marketplace_public_feed_v3';
  const SESSION_KEY='listia_session';

  window.LISTIA_MARKETPLACE_DATA=window.LISTIA_MARKETPLACE_DATA||[];
  window.LISTIA_MARKETPLACE_COUNTRY=window.LISTIA_MARKETPLACE_COUNTRY||'';
  window.LISTIA_MARKETPLACE_SELECTED=window.LISTIA_MARKETPLACE_SELECTED||null;

  const text=v=>String(v||'').trim();
  function session(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
  function locale(){return String(window.LISTIA_I18N?.getLanguage?.()||document.documentElement.lang||'es')}
  function spanish(){return locale().toLowerCase().startsWith('es')}

  function shuffle(values){const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

  async function detectCountry(){try{const r=await nativeFetch('/cdn-cgi/trace',{cache:'no-store'});if(!r.ok)return;const raw=await r.text(),m=raw.match(/(?:^|\n)loc=([A-Z]{2})(?:\n|$)/);if(m)window.LISTIA_MARKETPLACE_COUNTRY=m[1]}catch{}}
  detectCountry();

  function safeMarketplaceUrl(raw){
    if(raw.includes(SAFE_V3_MARK))return raw;
    if(raw.includes(SAFE_V2_MARK))return raw.replace(SAFE_V2_MARK,SAFE_V3_MARK);
    if(!raw.includes(LEGACY_MARK))return raw;
    const i=raw.indexOf('/rest/v1/');
    if(i<0)return raw;
    return`${raw.slice(0,i)}${SAFE_V3_MARK}?p_limit=60&p_offset=0`;
  }
  function mergeRows(rows){if(!Array.isArray(rows))return;const m=new Map((window.LISTIA_MARKETPLACE_DATA||[]).map(x=>[String(x.id||`${x.title}|${x.price}|${x.location_text}`),x]));for(const row of rows)m.set(String(row.id||`${row.title}|${row.price}|${row.location_text}`),row);window.LISTIA_MARKETPLACE_DATA=[...m.values()];window.dispatchEvent(new CustomEvent('listia:marketplace-data',{detail:{count:window.LISTIA_MARKETPLACE_DATA.length}}));setTimeout(repair,0)}

  window.fetch=async function(input,init){const raw=typeof input==='string'?input:(input?.url||''),safeUrl=safeMarketplaceUrl(raw);let target=input;if(safeUrl!==raw)target=typeof input==='string'?safeUrl:new Request(safeUrl,input);const response=await nativeFetch(target,init);const finalUrl=typeof target==='string'?target:(target?.url||raw);if((finalUrl.includes(SAFE_MARK)||finalUrl.includes(SAFE_V2_MARK)||finalUrl.includes(SAFE_V3_MARK))&&response.ok){response.clone().json().then(mergeRows).catch(()=>{})}return response};

  function neutralEmptyCopy(){const empty=document.querySelector('#marketplaceGrid .marketplace-empty span');if(!empty)return;const lang=locale().toLowerCase();let value='Available properties will appear here as they are published on Listia.';if(lang.startsWith('es'))value='Las propiedades disponibles aparecerán aquí a medida que se publiquen en Listia.';else if(lang.startsWith('fr'))value='Les biens disponibles apparaîtront ici à mesure de leur publication sur Listia.';else if(lang.startsWith('it'))value='Le proprietà disponibili appariranno qui man mano che vengono pubblicate su Listia.';else if(lang.startsWith('pt'))value='Os imóveis disponíveis aparecerão aqui à medida que forem publicados na Listia.';else if(lang.startsWith('de'))value='Verfügbare Immobilien erscheinen hier, sobald sie auf Listia veröffentlicht werden.';else if(lang.startsWith('ar'))value='ستظهر العقارات المتاحة هنا عند نشرها على Listia.';else if(lang.startsWith('ru'))value='Доступные объекты будут появляться здесь по мере публикации в Listia.';else if(lang.startsWith('he'))value='נכסים זמינים יופיעו כאן עם פרסומם ב-Listia.';else if(lang.startsWith('zh'))value='可用房源发布到 Listia 后会显示在这里。';else if(lang.startsWith('ja'))value='Listiaで公開された物件がここに表示されます。';if(empty.textContent!==value)empty.textContent=value}

  function removeLegacyProvenanceUI(){document.querySelectorAll('.marketplace-source-contact,.marketplace-source-pill').forEach(n=>n.remove())}
  function rowFor(card){const title=text(card?.querySelector('.marketplace-title')?.textContent),price=text(card?.querySelector('.marketplace-price')?.textContent),rows=window.LISTIA_MARKETPLACE_DATA||[];return rows.find(x=>text(x.title)===title&&(!price||price.includes(String(Math.round(Number(x.price||0))))) )||rows.find(x=>text(x.title)===title)||null}

  async function captureInterest(row){const s=session();if(!row?.id||!s?.access_token||row.__interestCaptured)return null;row.__interestCaptured=true;try{const r=await nativeFetch(`${CFG.SUPABASE_URL}/rest/v1/rpc/submit_marketplace_interest_click`,{method:'POST',headers:{apikey:KEY,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({p_listing_id:row.id,p_locale:locale()}),cache:'no-store'});if(!r.ok){row.__interestCaptured=false;throw new Error(`interest_click_${r.status}`)}const out=await r.json().catch(()=>null);window.dispatchEvent(new CustomEvent('listia:marketplace-interest-created',{detail:{listing_id:row.id,...(out||{})}}));return out}catch(e){console.warn('Listia marketplace interest capture',e);return null}}

  function normalizeGallery(row){const urls=[];const add=v=>{let u='';if(typeof v==='string')u=v;else if(v&&typeof v==='object')u=v.url||v.src||v.public_url||v.image_url||'';u=text(u);if(u&&!urls.includes(u))urls.push(u)};add(row?.cover_image_url);if(Array.isArray(row?.gallery))row.gallery.forEach(add);return urls.slice(0,40)}

  function pendingMediaNode(){const box=document.createElement('div');box.className='listia-media-pending';box.setAttribute('role','img');box.setAttribute('aria-label',spanish()?'Fotografía pendiente':'Photo pending');const icon=document.createElement('span');icon.className='listia-media-pending-icon';icon.textContent='⌂';const label=document.createElement('small');label.textContent=spanish()?'Fotografía pendiente':'Photo pending';box.append(icon,label);return box}
  function neutralizeCardMedia(card,row){const media=card?.querySelector('.marketplace-media');if(!media)return;const gallery=normalizeGallery(row);if(gallery.length){const img=media.querySelector('img')||new Image();img.src=gallery[0];img.alt=row?.title||'';img.loading='lazy';img.referrerPolicy='no-referrer';img.classList.remove('marketplace-placeholder');media.replaceChildren(img);return}const logo=media.querySelector('img');if(logo?.classList.contains('marketplace-placeholder')||/listia-(?:mark|isotipo)/i.test(String(logo?.src||''))||!media.querySelector('.listia-media-pending'))media.replaceChildren(pendingMediaNode())}

  function approximateMapQuery(row){return [row?.location_text,row?.city,row?.state_region,row?.country_code||'México'].map(text).filter(Boolean).join(', ')}
  function addMap(screen,row){if(screen.querySelector('.listia-marketplace-map,.marketplace-map'))return;const lat=Number(row?.latitude),lon=Number(row?.longitude),hasCoords=Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180&&lat!==0&&lon!==0;const query=approximateMapQuery(row);if(!hasCoords&&!query)return;const box=document.createElement('section');box.className='listia-marketplace-map marketplace-map';const h=document.createElement('strong');h.textContent=spanish()?'Ubicación aproximada':'Approximate location';const note=document.createElement('small');note.className='listia-map-note';note.textContent=spanish()?'El punto puede representar la cuadra o zona cercana, no la ubicación exacta.':'The point may represent the nearby block or area, not the exact address.';const frame=document.createElement('iframe');frame.loading='lazy';frame.referrerPolicy='no-referrer';frame.title=h.textContent;if(hasCoords){const d=.008;frame.src=`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(lon-d)},${encodeURIComponent(lat-d)},${encodeURIComponent(lon+d)},${encodeURIComponent(lat+d)}&layer=mapnik&marker=${encodeURIComponent(lat)},${encodeURIComponent(lon)}`}else{frame.src=`https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`}box.append(h,note,frame);const form=screen.querySelector('.marketplace-interest,.marketplace-interest-grid');if(form)form.before(box);else screen.querySelector('.marketplace-detail')?.append(box)}

  function enhanceDetail(row){const screen=document.getElementById('screen-marketplace-detail');if(!screen||!screen.classList.contains('active')||!row)return;const media=screen.querySelector('.marketplace-detail-media');const main=media?.querySelector('img');const gallery=normalizeGallery(row);if(media){if(gallery.length){let hero=main;if(!hero){hero=new Image();media.prepend(hero)}hero.src=gallery[0];hero.alt=row.title||'';hero.referrerPolicy='no-referrer';hero.style.objectFit='cover';let rail=screen.querySelector('.marketplace-gallery-rail,.listia-marketplace-gallery');if(!rail&&gallery.length>1){rail=document.createElement('div');rail.className='marketplace-gallery-rail listia-marketplace-gallery';media.parentElement?.append(rail)}if(rail){rail.innerHTML='';gallery.forEach((url,i)=>{const b=document.createElement('button');b.type='button';b.className=`marketplace-gallery-thumb listia-marketplace-thumb${i===0?' active':''}`;const img=document.createElement('img');img.src=url;img.alt=`${row.title||''} ${i+1}`;img.loading='lazy';img.referrerPolicy='no-referrer';b.append(img);b.onclick=()=>{hero.src=url;rail.querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active')};rail.append(b)})}}else{media.replaceChildren(pendingMediaNode())}}
    addMap(screen,row);
  }

  function enhanceCards(){document.querySelectorAll('#marketplaceGrid .marketplace-card').forEach(card=>{const row=rowFor(card);if(row)neutralizeCardMedia(card,row);const actions=card.querySelector('.marketplace-actions');if(!actions)return;actions.querySelectorAll('.secondary').forEach(b=>b.remove());const interest=actions.querySelector('.primary')||actions.querySelector('button');if(!interest)return;actions.classList.add('listia-interest-only');if(interest.dataset.listiaInterest==='1')return;interest.dataset.listiaInterest='1';interest.addEventListener('click',()=>{const r=row||rowFor(card);if(!r)return;window.LISTIA_MARKETPLACE_SELECTED=r;setTimeout(()=>enhanceDetail(r),40);setTimeout(()=>enhanceDetail(r),180)},true)})}

  let lastShuffleFingerprint='';
  function shuffleVisibleCards(){const grid=document.getElementById('marketplaceGrid');if(!grid)return;const cards=[...grid.querySelectorAll('.marketplace-card')];if(cards.length<2)return;const titles=cards.map(c=>text(c.querySelector('.marketplace-title')?.textContent)),fingerprint=[...titles].sort().join('|');if(fingerprint===lastShuffleFingerprint)return;const country=String(window.LISTIA_MARKETPLACE_COUNTRY||'').toUpperCase(),local=[],rest=[];for(const card of cards){const row=rowFor(card);if(country&&String(row?.country_code||'').toUpperCase()===country)local.push(card);else rest.push(card)}lastShuffleFingerprint=fingerprint;const frag=document.createDocumentFragment();[...shuffle(local),...shuffle(rest)].forEach(c=>frag.append(c));grid.append(frag)}

  let timer=0;function repair(){clearTimeout(timer);timer=setTimeout(()=>{removeLegacyProvenanceUI();neutralEmptyCopy();enhanceCards();if(window.LISTIA_MARKETPLACE_SELECTED)enhanceDetail(window.LISTIA_MARKETPLACE_SELECTED);shuffleVisibleCards()},80)}
  function installObservers(attempt=0){const grid=document.getElementById('marketplaceGrid'),detail=document.getElementById('screen-marketplace-detail');if(!grid||!detail){if(attempt<30)setTimeout(()=>installObservers(attempt+1),100);return}if(grid.dataset.listiaFeedObserver!=='1'){grid.dataset.listiaFeedObserver='1';new MutationObserver(repair).observe(grid,{childList:true,subtree:true})}if(detail.dataset.listiaFeedObserver!=='1'){detail.dataset.listiaFeedObserver='1';new MutationObserver(repair).observe(detail,{attributes:true,attributeFilter:['class'],childList:true,subtree:true})}repair()}
  function boot(){installObservers();window.addEventListener('listia:languagechange',()=>{lastShuffleFingerprint='';repair()});window.addEventListener('focus',()=>{lastShuffleFingerprint='';repair()});window.addEventListener('listia:marketplace-data',()=>{lastShuffleFingerprint='';repair()})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();