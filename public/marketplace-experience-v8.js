(() => {
  'use strict';

  const TILE = 256;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const locale = () => String(window.LISTIA_I18N?.getLanguage?.() || document.documentElement.lang || 'es').toLowerCase();
  const spanish = () => locale().startsWith('es');
  const copy = () => spanish() ? {
    search:'Buscar', list:'Lista', map:'Mapa', talk:'Hablar con LISTIA',
    voiceTitle:'Busca hablando con LISTIA',
    voiceHint:'Por ejemplo: “Departamento en Tulum, 2 recámaras, entre 3 y 5 millones”.',
    loaded:(n,t)=>`${n} de ${t || n} propiedades cargadas`,
    mapped:n=>`${n} con ubicación`, view:'Ver', mapEmpty:'Aún no hay coordenadas en los resultados cargados.'
  } : {
    search:'Search', list:'List', map:'Map', talk:'Talk to LISTIA',
    voiceTitle:'Search by talking to LISTIA',
    voiceHint:'For example: “Apartment in Tulum, 2 bedrooms, between 3 and 5 million”.',
    loaded:(n,t)=>`${n} of ${t || n} properties loaded`,
    mapped:n=>`${n} mapped`, view:'View', mapEmpty:'The loaded results do not have coordinates yet.'
  };

  function money(v, currency='MXN') {
    const n = Number(v);
    if (!Number.isFinite(n)) return '';
    try { return new Intl.NumberFormat(spanish()?'es-MX':'en-US',{style:'currency',currency:currency||'MXN',maximumFractionDigits:0}).format(n); }
    catch { return `${currency||''} ${Math.round(n).toLocaleString()}`.trim(); }
  }

  function validPoint(x) {
    const lat=Number(x?.latitude), lng=Number(x?.longitude);
    return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=85.05112878&&Math.abs(lng)<=180;
  }

  function project(lat,lng,z) {
    const n=Math.pow(2,z)*TILE;
    const sin=Math.sin(clamp(lat,-85.05112878,85.05112878)*Math.PI/180);
    return {x:(lng+180)/360*n,y:(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*n};
  }

  function unproject(x,y,z) {
    const n=Math.pow(2,z)*TILE;
    const lng=x/n*360-180;
    const y2=.5-y/n;
    const lat=90-360*Math.atan(Math.exp(-y2*2*Math.PI))/Math.PI;
    return {lat:clamp(lat,-85.05112878,85.05112878),lng:((lng+540)%360)-180};
  }

  class ListiaMiniMap {
    constructor(root) {
      this.root=root; this.tiles=root.querySelector('.marketplace-v8-map-tiles'); this.markers=root.querySelector('.marketplace-v8-map-markers');
      this.preview=root.querySelector('.marketplace-v8-map-preview'); this.zoom=10; this.center={lat:20.63,lng:-87.07}; this.rows=[]; this.userMoved=false; this.drag=null;
      this.bind();
    }
    bind() {
      this.root.querySelector('[data-map-zoom-in]')?.addEventListener('click',()=>this.setZoom(this.zoom+1));
      this.root.querySelector('[data-map-zoom-out]')?.addEventListener('click',()=>this.setZoom(this.zoom-1));
      this.root.addEventListener('wheel',e=>{e.preventDefault();this.userMoved=true;this.setZoom(this.zoom+(e.deltaY<0?1:-1));},{passive:false});
      this.root.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;this.root.setPointerCapture?.(e.pointerId);const p=project(this.center.lat,this.center.lng,this.zoom);this.drag={x:e.clientX,y:e.clientY,cx:p.x,cy:p.y};});
      this.root.addEventListener('pointermove',e=>{if(!this.drag)return;this.userMoved=true;const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;this.center=unproject(this.drag.cx-dx,this.drag.cy-dy,this.zoom);this.render();});
      const end=()=>{this.drag=null};this.root.addEventListener('pointerup',end);this.root.addEventListener('pointercancel',end);
      if ('ResizeObserver' in window) new ResizeObserver(()=>this.render()).observe(this.root);
      else window.addEventListener('resize',()=>this.render(),{passive:true});
    }
    setZoom(z){this.zoom=clamp(Math.round(z),3,17);this.render()}
    setRows(rows,fit=false){
      this.rows=(rows||[]).map((x,index)=>Object.assign({},x,{__listiaCardIndex:index})).filter(validPoint);
      if((fit||!this.userMoved)&&this.rows.length)this.fit();else this.render();
    }
    fit(){
      if(!this.rows.length){this.render();return}
      let minLat=90,maxLat=-90,minLng=180,maxLng=-180;
      for(const x of this.rows){const lat=Number(x.latitude),lng=Number(x.longitude);minLat=Math.min(minLat,lat);maxLat=Math.max(maxLat,lat);minLng=Math.min(minLng,lng);maxLng=Math.max(maxLng,lng)}
      this.center={lat:(minLat+maxLat)/2,lng:(minLng+maxLng)/2};
      const w=Math.max(320,this.root.clientWidth||320),h=Math.max(300,this.root.clientHeight||400);
      for(let z=14;z>=3;z--){const a=project(maxLat,minLng,z),b=project(minLat,maxLng,z);if(Math.abs(b.x-a.x)<w*.78&&Math.abs(b.y-a.y)<h*.7){this.zoom=z;break}}
      this.render();
    }
    render(){if(!this.root.offsetParent)return;this.renderTiles();this.renderMarkers()}
    renderTiles(){
      const w=this.root.clientWidth,h=this.root.clientHeight;if(!w||!h)return;
      const c=project(this.center.lat,this.center.lng,this.zoom),left=c.x-w/2,top=c.y-h/2,n=Math.pow(2,this.zoom);
      const minX=Math.floor(left/TILE)-1,maxX=Math.floor((left+w)/TILE)+1,minY=Math.max(0,Math.floor(top/TILE)-1),maxY=Math.min(n-1,Math.floor((top+h)/TILE)+1);
      const frag=document.createDocumentFragment();
      for(let ty=minY;ty<=maxY;ty++)for(let tx=minX;tx<=maxX;tx++){
        const wrap=((tx%n)+n)%n,img=new Image();img.alt='';img.draggable=false;img.referrerPolicy='no-referrer';img.loading='eager';img.src=`https://tile.openstreetmap.org/${this.zoom}/${wrap}/${ty}.png`;img.style.left=`${tx*TILE-left}px`;img.style.top=`${ty*TILE-top}px`;frag.append(img)
      }
      this.tiles.replaceChildren(frag);
    }
    renderMarkers(){
      const w=this.root.clientWidth,h=this.root.clientHeight;if(!w||!h)return;
      const center=project(this.center.lat,this.center.lng,this.zoom),left=center.x-w/2,top=center.y-h/2,cell=58,groups=new Map();
      this.rows.forEach((x,index)=>{const p=project(Number(x.latitude),Number(x.longitude),this.zoom),sx=p.x-left,sy=p.y-top;if(sx<-40||sx>w+40||sy<-40||sy>h+40)return;const key=`${Math.round(sx/cell)}:${Math.round(sy/cell)}`;const g=groups.get(key)||{x:0,y:0,items:[]};g.x+=sx;g.y+=sy;g.items.push({x,index});groups.set(key,g)});
      const frag=document.createDocumentFragment();
      groups.forEach(g=>{const b=document.createElement('button'),n=g.items.length;b.type='button';b.className='marketplace-v8-marker '+(n>1?'cluster':(g.items[0].x.operation_type==='rent'?'rent':'sale'));b.style.left=`${g.x/n}px`;b.style.top=`${g.y/n}px`;if(n>1){b.textContent=String(n);b.setAttribute('aria-label',`${n} properties`);b.onclick=()=>{this.userMoved=true;this.setZoom(this.zoom+2)}}else{const x=g.items[0].x;b.textContent=money(x.price,x.currency).replace(/\.00$/,'').replace(/^MX\$/,'$').replace(/^US\$/,'$');if(!b.textContent)b.textContent='●';b.setAttribute('aria-label',x.title||'Property');b.onclick=()=>this.showPreview(x,Number.isInteger(x.__listiaCardIndex)?x.__listiaCardIndex:g.items[0].index)}frag.append(b)});
      this.markers.replaceChildren(frag);
      const meta=document.getElementById('marketplaceV8MapMeta');if(meta)meta.textContent=`${copy().mapped(this.rows.length)}`;
    }
    showPreview(x,index){
      const img=this.preview.querySelector('img'),title=this.preview.querySelector('strong'),meta=this.preview.querySelector('span'),button=this.preview.querySelector('button');
      img.src=x.cover_image_url||'/listia-site-isotipo-v4.svg?v=11';img.alt='';title.textContent=x.title||'';meta.textContent=[money(x.price,x.currency),x.location_text||x.city||''].filter(Boolean).join(' · ');button.textContent=copy().view;button.onclick=()=>{const cards=[...document.querySelectorAll('#marketplaceGrid .marketplace-card')];const card=cards[index];if(card){card.querySelector('.marketplace-media')?.click()}else{switchView('list')}};this.preview.classList.add('show');
    }
  }

  let map=null,currentView='list',lastRows=[];

  function switchView(view){
    currentView=view==='map'?'map':'list';const screen=document.getElementById('screen-marketplace');if(!screen)return;screen.classList.toggle('marketplace-map-mode',currentView==='map');
    document.querySelectorAll('[data-marketplace-view]').forEach(b=>{const active=b.dataset.marketplaceView===currentView;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
    if(currentView==='map'){setTimeout(()=>{map?.setRows(lastRows,!map?.userMoved)},30)}
  }

  function runSearch(){
    const button=document.getElementById('marketplaceV8SearchButton');if(button){button.disabled=true;setTimeout(()=>button.disabled=false,500)}
    window.LISTIA_MARKETPLACE?.reload?.();
  }

  function startVoice(){
    if(window.LISTIA_VOICE?.open){window.LISTIA_VOICE.open();return}
    document.getElementById('listiaVoiceButton')?.click();
  }

  function buildExperience(){
    const screen=document.getElementById('screen-marketplace'),filters=screen?.querySelector('.marketplace-filters'),panel=screen?.querySelector('.marketplace-panel'),search=document.getElementById('marketplaceSearch');
    if(!screen||!filters||!panel||!search||document.getElementById('marketplaceV8Toolbar'))return false;
    const t=copy(),toolbar=document.createElement('div');toolbar.id='marketplaceV8Toolbar';toolbar.className='marketplace-v8-toolbar';
    const searchRow=document.createElement('div');searchRow.className='marketplace-v8-search-row';const searchButton=document.createElement('button');searchButton.id='marketplaceV8SearchButton';searchButton.type='button';searchButton.className='marketplace-v8-search-button';searchButton.textContent=t.search;searchButton.onclick=runSearch;
    filters.parentNode.insertBefore(toolbar,filters);searchRow.append(search,searchButton);toolbar.append(searchRow);
    search.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();runSearch()}});

    const voice=document.createElement('section');voice.className='marketplace-v8-voice';voice.innerHTML='<div class="marketplace-v8-voice-orb" aria-hidden="true">✦</div><div class="marketplace-v8-voice-copy"><strong></strong><span></span></div><button class="marketplace-v8-voice-button" type="button"></button>';voice.querySelector('strong').textContent=t.voiceTitle;voice.querySelector('span').textContent=t.voiceHint;voice.querySelector('button').textContent=t.talk;voice.querySelector('button').onclick=startVoice;toolbar.append(voice);

    const actions=document.createElement('div');actions.className='marketplace-v8-actions';actions.innerHTML='<div class="marketplace-v8-view-toggle" role="group"><button type="button" data-marketplace-view="list" class="active"></button><button type="button" data-marketplace-view="map"></button></div><span id="marketplaceV8MapMeta" class="marketplace-v8-map-meta"></span>';actions.querySelector('[data-marketplace-view="list"]').textContent=t.list;actions.querySelector('[data-marketplace-view="map"]').textContent=t.map;actions.querySelectorAll('[data-marketplace-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.marketplaceView));toolbar.append(actions);

    const mapShell=document.createElement('section');mapShell.id='marketplaceV8Map';mapShell.className='marketplace-v8-map-shell';mapShell.setAttribute('aria-label',t.map);mapShell.innerHTML='<div class="marketplace-v8-map-tiles" aria-hidden="true"></div><div class="marketplace-v8-map-markers"></div><div class="marketplace-v8-map-controls"><button type="button" data-map-zoom-in aria-label="Zoom in">+</button><button type="button" data-map-zoom-out aria-label="Zoom out">−</button></div><div class="marketplace-v8-map-preview"><img alt=""><div class="marketplace-v8-map-preview-copy"><strong></strong><span></span></div><button type="button"></button></div><div class="marketplace-v8-map-attribution">© OpenStreetMap contributors</div>';
    const count=document.querySelector('#screen-marketplace .marketplace-count');if(count)count.insertAdjacentElement('afterend',mapShell);else filters.insertAdjacentElement('afterend',mapShell);map=new ListiaMiniMap(mapShell);
    lastRows=[...(window.LISTIA_MARKETPLACE_DATA||[])];map.setRows(lastRows,true);return true;
  }

  function updateData(event){
    lastRows=[...(window.LISTIA_MARKETPLACE_DATA||[])];const detail=event?.detail||{},meta=document.getElementById('marketplaceV8MapMeta');if(meta)meta.textContent=`${copy().loaded(Number(detail.loaded||lastRows.length),Number(detail.total||lastRows.length))} · ${copy().mapped(lastRows.filter(validPoint).length)}`;map?.setRows(lastRows,!map.userMoved&&currentView==='map');
  }

  function syncLanguage(){
    const t=copy(),button=document.getElementById('marketplaceV8SearchButton'),voice=document.querySelector('.marketplace-v8-voice'),list=document.querySelector('[data-marketplace-view="list"]'),mp=document.querySelector('[data-marketplace-view="map"]');if(button)button.textContent=t.search;if(voice){voice.querySelector('strong').textContent=t.voiceTitle;voice.querySelector('span').textContent=t.voiceHint;voice.querySelector('button').textContent=t.talk}if(list)list.textContent=t.list;if(mp)mp.textContent=t.map;updateData();
  }

  function boot(attempt=0){if(buildExperience()){updateData();return}if(attempt<80)setTimeout(()=>boot(attempt+1),100)}
  window.addEventListener('listia:marketplace-data',updateData);window.addEventListener('listia:languagechange',()=>setTimeout(syncLanguage,40));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(),{once:true});else boot();
  window.LISTIA_MARKETPLACE_EXPERIENCE={switchView,startVoice,refreshMap:()=>map?.setRows([...(window.LISTIA_MARKETPLACE_DATA||[])],true)};
})();
