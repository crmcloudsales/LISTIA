(()=>{
'use strict';
const cfg=window.LISTIA_CONFIG||{};
const ENDPOINT=`${cfg.SUPABASE_URL||''}/functions/v1/marketplace-map-qroo`;
const BOUNDS={minLat:18.05,maxLat:21.65,minLng:-89.05,maxLng:-86.55};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
const locale=()=>String(window.LISTIA_I18N?.getLanguage?.()||document.documentElement.lang||'es').toLowerCase();
const isEs=()=>locale().startsWith('es');
const fmt=n=>new Intl.NumberFormat(isEs()?'es-MX':'en-US').format(Number(n)||0);
const project=(lat,lng)=>({x:((lng-BOUNDS.minLng)/(BOUNDS.maxLng-BOUNDS.minLng))*100,y:(1-((lat-BOUNDS.minLat)/(BOUNDS.maxLat-BOUNDS.minLat)))*100});

async function getClusters(){
 const r=await fetch(`${ENDPOINT}?mode=clusters&limit=100`,{headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY||cfg.SUPABASE_ANON_KEY||''},cache:'no-store'});
 if(!r.ok)throw new Error(`map_${r.status}`);
 const j=await r.json();return Array.isArray(j.data)?j.data:[];
}
function radius(n,max){const v=Math.max(1,Number(n)||1),m=Math.max(1,max||1);return 5+15*Math.sqrt(v/m)}
function searchPlace(place){
 const input=document.getElementById('marketplaceSearch');
 if(input){input.value=place;input.dispatchEvent(new Event('input',{bubbles:true}));input.scrollIntoView({behavior:'smooth',block:'center'});return}
 if(window.LISTIA_MARKETPLACE?.reload)window.LISTIA_MARKETPLACE.reload();
}
function draw(root,rows){
 const total=rows.reduce((a,x)=>a+(Number(x.listings)||0),0);const max=Math.max(...rows.map(x=>Number(x.listings)||0),1);
 root.innerHTML=`<section class="qroo-map-shell" aria-label="${isEs()?'Mapa inmobiliario de Quintana Roo':'Quintana Roo real estate map'}"><div class="qroo-map-head"><div><div class="qroo-map-kicker">LISTIA MARKET INTELLIGENCE</div><h2>${isEs()?'Mapa de Quintana Roo':'Quintana Roo Map'}</h2></div><div class="qroo-map-summary"><strong>${fmt(total)}</strong> ${isEs()?'propiedades mapeadas':'mapped properties'} · <strong>${rows.length}</strong> ${isEs()?'zonas':'areas'}</div></div><div class="qroo-map-layout"><div class="qroo-map-stage"><svg class="qroo-map-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="${isEs()?'Distribución geográfica del inventario':'Geographic inventory distribution'}"></svg></div><div class="qroo-map-side"></div></div><div class="qroo-map-note">${isEs()?'Los puntos representan la localidad o zona cuando la fuente no proporciona coordenadas exactas. LISTIA nunca presenta un centroide como ubicación exacta de una propiedad.':'Points represent the locality or area when the source does not provide exact coordinates. LISTIA never presents a centroid as an exact property location.'}</div></section>`;
 const svg=root.querySelector('svg'),side=root.querySelector('.qroo-map-side');
 rows.slice().sort((a,b)=>(Number(b.listings)||0)-(Number(a.listings)||0)).forEach((x,i)=>{
  const lat=Number(x.latitude),lng=Number(x.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
  const p=project(lat,lng),r=radius(x.listings,max);const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.setAttribute('tabindex','0');g.setAttribute('role','button');g.setAttribute('aria-label',`${x.canonical_place}: ${fmt(x.listings)} ${isEs()?'propiedades':'properties'}`);g.style.cursor='pointer';
  const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('class','qroo-map-dot');c.setAttribute('cx',String(p.x));c.setAttribute('cy',String(p.y));c.setAttribute('r',String(r));
  const count=document.createElementNS('http://www.w3.org/2000/svg','text');count.setAttribute('class','qroo-map-count');count.setAttribute('x',String(p.x));count.setAttribute('y',String(p.y));count.textContent=Number(x.listings)>=1000?`${(Number(x.listings)/1000).toFixed(1)}k`:String(x.listings);
  const label=document.createElementNS('http://www.w3.org/2000/svg','text');label.setAttribute('class','qroo-map-label');label.setAttribute('x',String(Math.min(92,p.x+r+1.5)));label.setAttribute('y',String(Math.max(5,p.y-1)));label.textContent=x.canonical_place;
  const activate=()=>searchPlace(x.canonical_place);g.addEventListener('click',activate);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate()}});g.append(c,count,label);svg.append(g);
  const b=document.createElement('button');b.type='button';b.className='qroo-place';b.innerHTML=`<strong>${esc(x.canonical_place)}</strong><span>${esc(x.municipality||'')}</span><b>${fmt(x.listings)}</b>`;b.addEventListener('click',activate);side.append(b);
 });
}
async function mount(){
 const screen=document.getElementById('screen-marketplace');if(!screen)return false;
 if(document.getElementById('qrooMarketplaceMapMount'))return true;
 const panel=screen.querySelector('.marketplace-panel');const grid=document.getElementById('marketplaceGrid');if(!panel||!grid)return false;
 const root=document.createElement('div');root.id='qrooMarketplaceMapMount';root.innerHTML=`<div class="qroo-map-loading">${isEs()?'Preparando mapa de Quintana Roo…':'Preparing Quintana Roo map…'}</div>`;panel.insertBefore(root,grid);
 try{const rows=await getClusters();draw(root,rows)}catch(e){console.error('LISTIA QROO map',e);root.innerHTML=`<div class="qroo-map-error">${isEs()?'El mapa no está disponible en este momento. El listado de propiedades sigue funcionando.':'The map is temporarily unavailable. Property listings remain available.'}</div>`}
 return true;
}
let tries=0;const boot=()=>{mount().then(ok=>{if(!ok&&tries++<80)setTimeout(boot,250)})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('listia:languagechange',()=>{const root=document.getElementById('qrooMarketplaceMapMount');if(root)root.remove();tries=0;boot()});
})();
