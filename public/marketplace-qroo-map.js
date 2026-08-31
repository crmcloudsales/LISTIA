(()=>{
'use strict';
const cfg=window.LISTIA_CONFIG||{};
const ENDPOINT=`${cfg.SUPABASE_URL||''}/functions/v1/marketplace-map-qroo`;
const BOUNDS={minLat:18.05,maxLat:21.65,minLng:-89.05,maxLng:-86.55};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
const locale=()=>String(window.LISTIA_I18N?.getLanguage?.()||document.documentElement.lang||'es').toLowerCase();
const isEs=()=>locale().startsWith('es');
const fmt=n=>new Intl.NumberFormat(isEs()?'es-MX':'en-US').format(Number(n)||0);
const money=(n,c)=>new Intl.NumberFormat(isEs()?'es-MX':'en-US',{style:'currency',currency:c||'MXN',maximumFractionDigits:0}).format(Number(n)||0);
const project=(lat,lng)=>({x:((lng-BOUNDS.minLng)/(BOUNDS.maxLng-BOUNDS.minLng))*100,y:(1-((lat-BOUNDS.minLat)/(BOUNDS.maxLat-BOUNDS.minLat)))*100});
const headers=()=>({apikey:cfg.SUPABASE_PUBLISHABLE_KEY||cfg.SUPABASE_ANON_KEY||''});
let selectedPlace='';
let intelligenceState={operation:'sale',currency:'MXN'};

async function request(params){
 const r=await fetch(`${ENDPOINT}?${new URLSearchParams(params)}`,{headers:headers(),cache:'no-store'});
 if(!r.ok)throw new Error(`map_${r.status}`);
 const j=await r.json();return Array.isArray(j.data)?j.data:[];
}
const getClusters=()=>request({mode:'clusters',limit:'100'});
const getMicrozones=(place='')=>request({mode:'microzones',limit:'24',operation:intelligenceState.operation,currency:intelligenceState.currency,...(place?{place}:{})});
const getTrends=(place='')=>place?request({mode:'trends',limit:'180',operation:intelligenceState.operation,currency:intelligenceState.currency,place}):Promise.resolve([]);
function radius(n,max){const v=Math.max(1,Number(n)||1),m=Math.max(1,max||1);return 5+15*Math.sqrt(v/m)}
function searchMarket(term,statsPlace=term){
 selectedPlace=statsPlace||'';
 window.dispatchEvent(new CustomEvent('listia:qroo-place-selected',{detail:{place:selectedPlace,term:term||''}}));
 const input=document.getElementById('marketplaceSearch');
 if(input){input.value=term||'';input.dispatchEvent(new Event('input',{bubbles:true}));return}
 if(window.LISTIA_MARKETPLACE?.reload)window.LISTIA_MARKETPLACE.reload();
}
function confidenceLabel(v){
 if(v==='high')return isEs()?'Alta':'High';
 if(v==='medium')return isEs()?'Media':'Medium';
 return isEs()?'Indicativa':'Indicative';
}
function operationLabel(v){return v==='rent'?(isEs()?'Renta':'Rent'):(isEs()?'Venta':'Sale')}
function pct(a,b){if(!Number.isFinite(a)||!Number.isFinite(b)||b===0)return null;return ((a-b)/b)*100}
function trendText(v){if(v===null)return '—';const sign=v>0?'+':'';return `${sign}${v.toFixed(1)}%`}
function renderTrend(box,rows){
 const trend=box.querySelector('.qroo-trend-status');if(!trend)return;
 if(!selectedPlace){trend.innerHTML=`<strong>${isEs()?'Seguimiento histórico activo':'Historical tracking active'}</strong><span>${isEs()?'Baseline iniciado el 31 ago 2026. Selecciona una ciudad para ver su evolución.':'Baseline started Aug 31, 2026. Select a city to see its evolution.'}</span>`;return}
 if(!rows.length){trend.innerHTML=`<strong>${esc(selectedPlace)}</strong><span>${isEs()?'Aún no hay snapshot histórico para estos filtros.':'No historical snapshot is available for these filters yet.'}</span>`;return}
 const first=rows[0],last=rows[rows.length-1];
 if(rows.length<2){trend.innerHTML=`<strong>${esc(selectedPlace)} · ${operationLabel(last.operation_type)} · ${esc(last.currency)}</strong><span>${isEs()?'Seguimiento iniciado':'Tracking started'} ${esc(last.snapshot_date)} · ${fmt(last.inventory_count)} ${isEs()?'propiedades':'properties'} · ${money(last.median_price_per_m2,last.currency)}/m²</span>`;return}
 const inv=pct(Number(last.inventory_count),Number(first.inventory_count));
 const ppm=pct(Number(last.median_price_per_m2),Number(first.median_price_per_m2));
 trend.innerHTML=`<strong>${esc(selectedPlace)} · ${operationLabel(last.operation_type)} · ${esc(last.currency)}</strong><span>${esc(first.snapshot_date)} → ${esc(last.snapshot_date)} · ${isEs()?'Inventario':'Inventory'} ${trendText(inv)} · ${isEs()?'Precio/m²':'Price/m²'} ${trendText(ppm)}</span>`;
}
function renderIntelligence(root,rows,trends=[]){
 const box=root.querySelector('.qroo-intelligence');if(!box)return;
 const placeTitle=selectedPlace?` · ${esc(selectedPlace)}`:'';
 box.innerHTML=`<div class="qroo-intel-head"><div><div class="qroo-map-kicker">LISTIA MARKET INTELLIGENCE</div><h3>${isEs()?'Microzonas observadas':'Observed microzones'}${placeTitle}</h3><p>${isEs()?'Las métricas separan venta/renta y moneda. Son observaciones del inventario disponible, no avalúos.':'Metrics separate sale/rent and currency. They are observed listing-market data, not appraisals.'}</p></div><div class="qroo-intel-controls" role="group" aria-label="Market intelligence filters"><button type="button" data-op="sale" class="${intelligenceState.operation==='sale'?'active':''}">${isEs()?'Venta':'Sale'}</button><button type="button" data-op="rent" class="${intelligenceState.operation==='rent'?'active':''}">${isEs()?'Renta':'Rent'}</button><button type="button" data-currency="MXN" class="${intelligenceState.currency==='MXN'?'active':''}">MXN</button><button type="button" data-currency="USD" class="${intelligenceState.currency==='USD'?'active':''}">USD</button></div></div><div class="qroo-trend-status"></div><div class="qroo-intel-grid"></div>`;
 renderTrend(box,trends);
 const grid=box.querySelector('.qroo-intel-grid');
 if(!rows.length){grid.innerHTML=`<div class="qroo-intel-empty">${isEs()?'No hay una muestra suficiente para estos filtros.':'There is not enough observed inventory for these filters.'}</div>`}else rows.slice(0,12).forEach(x=>{
  const card=document.createElement('button');card.type='button';card.className='qroo-intel-card';
  const ppm=Number(x.median_price_per_m2);const med=Number(x.median_price);
  card.innerHTML=`<span class="qroo-intel-place">${esc(x.microzone||x.canonical_place)}</span><small>${esc(x.canonical_place||'')} · ${operationLabel(x.operation_type)} · ${esc(x.currency||'')}</small><div class="qroo-intel-metrics"><span><b>${fmt(x.listings)}</b>${isEs()?' anuncios':' listings'}</span><span><b>${fmt(x.sources)}</b>${isEs()?' fuentes':' sources'}</span><span><b>${med>0?money(med,x.currency):'—'}</b>${isEs()?' mediana':' median'}</span><span><b>${ppm>0?`${money(ppm,x.currency)}/m²`:'—'}</b>${isEs()?' mediana/m²':' median/m²'}</span></div><em class="confidence-${esc(x.metric_confidence)}">${isEs()?'Confianza ':'Confidence '}${confidenceLabel(x.metric_confidence)} · n=${fmt(x.price_m2_samples)}</em>`;
  card.addEventListener('click',()=>searchMarket(x.microzone||x.canonical_place,x.canonical_place));grid.append(card);
 });
 box.querySelectorAll('[data-op]').forEach(b=>b.addEventListener('click',async()=>{intelligenceState.operation=b.dataset.op;await refreshIntelligence(root)}));
 box.querySelectorAll('[data-currency]').forEach(b=>b.addEventListener('click',async()=>{intelligenceState.currency=b.dataset.currency;await refreshIntelligence(root)}));
}
async function refreshIntelligence(root){
 const box=root.querySelector('.qroo-intelligence');if(box)box.innerHTML=`<div class="qroo-map-loading">${isEs()?'Actualizando inteligencia de mercado…':'Updating market intelligence…'}</div>`;
 try{const [microzones,trends]=await Promise.all([getMicrozones(selectedPlace),getTrends(selectedPlace)]);renderIntelligence(root,microzones,trends)}catch(e){console.error('LISTIA QROO intelligence',e);if(box)box.innerHTML=`<div class="qroo-map-error">${isEs()?'La inteligencia por microzona no está disponible temporalmente.':'Microzone intelligence is temporarily unavailable.'}</div>`}
}
function draw(root,rows){
 const total=rows.reduce((a,x)=>a+(Number(x.listings)||0),0);const max=Math.max(...rows.map(x=>Number(x.listings)||0),1);
 root.innerHTML=`<section class="qroo-map-shell" aria-label="${isEs()?'Mapa inmobiliario de Quintana Roo':'Quintana Roo real estate map'}"><div class="qroo-map-head"><div><div class="qroo-map-kicker">LISTIA MARKET INTELLIGENCE</div><h2>${isEs()?'Mapa de Quintana Roo':'Quintana Roo Map'}</h2></div><div class="qroo-map-summary"><strong>${fmt(total)}</strong> ${isEs()?'propiedades mapeadas':'mapped properties'} · <strong>${rows.length}</strong> ${isEs()?'zonas':'areas'}</div></div><div class="qroo-map-layout"><div class="qroo-map-stage"><svg class="qroo-map-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="${isEs()?'Distribución geográfica del inventario':'Geographic inventory distribution'}"></svg></div><div class="qroo-map-side"></div></div><div class="qroo-map-note">${isEs()?'Los puntos representan la localidad o zona cuando la fuente no proporciona coordenadas exactas. LISTIA nunca presenta un centroide como ubicación exacta de una propiedad.':'Points represent the locality or area when the source does not provide exact coordinates. LISTIA never presents a centroid as an exact property location.'}</div><div class="qroo-intelligence"></div></section>`;
 const svg=root.querySelector('svg'),side=root.querySelector('.qroo-map-side');
 rows.slice().sort((a,b)=>(Number(b.listings)||0)-(Number(a.listings)||0)).forEach(x=>{
  const lat=Number(x.latitude),lng=Number(x.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
  const p=project(lat,lng),r=radius(x.listings,max);const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.setAttribute('tabindex','0');g.setAttribute('role','button');g.setAttribute('aria-label',`${x.canonical_place}: ${fmt(x.listings)} ${isEs()?'propiedades':'properties'}`);g.style.cursor='pointer';
  const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('class','qroo-map-dot');c.setAttribute('cx',String(p.x));c.setAttribute('cy',String(p.y));c.setAttribute('r',String(r));
  const count=document.createElementNS('http://www.w3.org/2000/svg','text');count.setAttribute('class','qroo-map-count');count.setAttribute('x',String(p.x));count.setAttribute('y',String(p.y));count.textContent=Number(x.listings)>=1000?`${(Number(x.listings)/1000).toFixed(1)}k`:String(x.listings);
  const label=document.createElementNS('http://www.w3.org/2000/svg','text');label.setAttribute('class','qroo-map-label');label.setAttribute('x',String(Math.min(92,p.x+r+1.5)));label.setAttribute('y',String(Math.max(5,p.y-1)));label.textContent=x.canonical_place;
  const activate=()=>searchMarket(x.canonical_place,x.canonical_place);g.addEventListener('click',activate);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate()}});g.append(c,count,label);svg.append(g);
  const b=document.createElement('button');b.type='button';b.className='qroo-place';b.innerHTML=`<strong>${esc(x.canonical_place)}</strong><span>${esc(x.municipality||'')}</span><b>${fmt(x.listings)}</b>`;b.addEventListener('click',activate);side.append(b);
 });
 refreshIntelligence(root);
}
async function mount(){
 const screen=document.getElementById('screen-marketplace');if(!screen)return false;
 if(document.getElementById('qrooMarketplaceMapMount'))return true;
 const panel=screen.querySelector('.marketplace-panel');const grid=document.getElementById('marketplaceGrid');if(!panel||!grid)return false;
 const root=document.createElement('div');root.id='qrooMarketplaceMapMount';root.innerHTML=`<div class="qroo-map-loading">${isEs()?'Preparando mapa de Quintana Roo…':'Preparing Quintana Roo map…'}</div>`;panel.insertBefore(root,grid);
 try{draw(root,await getClusters())}catch(e){console.error('LISTIA QROO map',e);root.innerHTML=`<div class="qroo-map-error">${isEs()?'El mapa no está disponible en este momento. El listado de propiedades sigue funcionando.':'The map is temporarily unavailable. Property listings remain available.'}</div>`}
 return true;
}
window.addEventListener('listia:qroo-place-selected',()=>{const root=document.getElementById('qrooMarketplaceMapMount');if(root)refreshIntelligence(root)});
let tries=0;const boot=()=>{mount().then(ok=>{if(!ok&&tries++<80)setTimeout(boot,250)})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('listia:languagechange',()=>{const root=document.getElementById('qrooMarketplaceMapMount');if(root)root.remove();tries=0;selectedPlace='';boot()});
})();
