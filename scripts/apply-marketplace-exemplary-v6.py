#!/usr/bin/env python3
from pathlib import Path
import json,re

ROOT=Path('.')
js_path=ROOT/'public/marketplace.js'
css_path=ROOT/'public/marketplace.css'
idx_path=ROOT/'public/index.html'
sw_path=ROOT/'public/sw.js'
svg_path=ROOT/'public/listia-site-isotipo-v4.svg'
commercial_path=ROOT/'commercial/index.html'

js=js_path.read_text(encoding='utf-8')

card_re=re.compile(r"  function card\(x\)\{.*?\}\n  function detail",re.S)
card_new=r'''  function sessionData(){try{return JSON.parse(localStorage.getItem('listia_session')||'null')}catch{return null}}
  function profileData(){try{return JSON.parse(localStorage.getItem('listia_profile')||'null')}catch{return null}}
  async function sendInterestClick(x,button){
    const session=sessionData(),token=session?.access_token;
    if(!token){localStorage.setItem('listia_pending_interest',String(x.id));window.ListiaSeeker?.openAuth?.({listingId:x.id});let tries=0;const timer=setInterval(async()=>{tries++;const s=sessionData();if(s?.access_token){clearInterval(timer);await sendInterestClick(x,button)}else if(tries>=60)clearInterval(timer)},1000);return false}
    const once=`listia_interest_sent_${x.id}`;
    if(sessionStorage.getItem(once)==='1')return true;
    const p=profileData()||{},u=session?.user||{};
    const email=u.email||p.email||null,phone=u.phone||p.whatsapp||p.phone||null;
    if(button){button.disabled=true;button.dataset.originalText=button.textContent||'';button.textContent=locale()==='es'?'Enviando…':'Sending…'}
    try{
      const r=await fetch(`${cfg.SUPABASE_URL}/rest/v1/rpc/submit_marketplace_interest_click`,{method:'POST',headers:{apikey:API_KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({p_listing_id:x.id,p_contact_email:email,p_contact_phone:phone,p_source:'marketplace_me_interesa',p_consent_basis:'marketplace_interest_click'})});
      if(r.status===401){localStorage.removeItem('listia_session');window.ListiaSeeker?.openAuth?.({listingId:x.id});return false}
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      sessionStorage.setItem(once,'1');localStorage.removeItem('listia_pending_interest');
      window.dispatchEvent(new CustomEvent('listia:marketplace-interest-created',{detail:{listingId:x.id}}));
      const note=document.querySelector('#marketplaceDetailBody .marketplace-interest-status');if(note){note.className='marketplace-interest-status marketplace-success';note.textContent=locale()==='es'?'Listo. Tu interés fue enviado y un profesional de la zona podrá contactarte.':'Done. Your interest was sent and a local professional can contact you.'}
      return true
    }catch(err){console.error('LISTIA interest click',err);const note=document.querySelector('#marketplaceDetailBody .marketplace-interest-status');if(note){note.className='marketplace-interest-status marketplace-error';note.textContent=c().error}return false}
    finally{if(button){button.disabled=false;button.textContent=button.dataset.originalText||c().interest}}
  }
  async function interestClick(x,button){detail(x,false);await sendInterestClick(x,button)}
  function card(x){const a=el('article','marketplace-card'),media=el('div','marketplace-media');if(x.cover_image_url){const img=new Image();img.src=x.cover_image_url;img.alt=x.title||'';img.loading='lazy';img.referrerPolicy='no-referrer';media.append(img)}else{const img=new Image();img.src='/listia-mark-transparent.webp';img.alt='';img.className='marketplace-placeholder';media.append(img)}media.tabIndex=0;media.setAttribute('role','button');media.onclick=()=>detail(x);media.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();detail(x)}};const body=el('div','marketplace-body'),top=el('div','marketplace-topline'),title=el('h2','marketplace-title',x.title||'');title.tabIndex=0;title.onclick=()=>detail(x);title.onkeydown=e=>{if(e.key==='Enter'){detail(x)}};top.append(title,el('span','marketplace-badge',x.operation_type==='rent'?c().rent:c().sale));body.append(top);if(x.location_text)body.append(el('div','marketplace-location',x.location_text));if(x.price!==null&&x.price!==undefined)body.append(el('div','marketplace-price',money(x.price,x.currency)));const meta=el('div','marketplace-meta');[[x.bedrooms,c().bedrooms],[x.bathrooms,c().bathrooms],[x.area_m2,c().area]].forEach(([v,l])=>{if(v!==null&&v!==undefined&&v!=='')meta.append(el('span','',`${v} ${l}`))});if(meta.children.length)body.append(meta);const acts=el('div','marketplace-actions'),interest=el('button','primary marketplace-interest-button',c().interest);interest.type='button';interest.onclick=()=>interestClick(x,interest);acts.append(interest);body.append(acts);a.append(media,body);return a}
  function detail'''
js,n=card_re.subn(card_new,js,count=1)
assert n==1,'card patch failed'

detail_re=re.compile(r"  function detail\(x,focusForm=false\)\{.*?\}\n  function buildInterest",re.S)
detail_new=r'''  function detail(x,focusForm=false){selected=x;const root=document.getElementById('marketplaceDetailBody');if(!root)return;root.replaceChildren();const galleryRaw=Array.isArray(x.gallery)?x.gallery:[];const images=[...new Set([x.cover_image_url,...galleryRaw].filter(v=>typeof v==='string'&&v.trim()))];const gallery=el('section','marketplace-detail-gallery');const heroWrap=el('div','marketplace-detail-media'),hero=new Image();hero.src=images[0]||'/listia-mark-transparent.webp';hero.alt=x.title||'';hero.referrerPolicy='no-referrer';if(!images.length)hero.style.objectFit='contain';heroWrap.append(hero);gallery.append(heroWrap);if(images.length>1){const rail=el('div','marketplace-gallery-rail');images.forEach((src,i)=>{const b=document.createElement('button');b.type='button';b.className='marketplace-gallery-thumb'+(i===0?' active':'');const im=new Image();im.src=src;im.alt=`${x.title||''} ${i+1}`;im.loading='lazy';im.referrerPolicy='no-referrer';b.append(im);b.onclick=()=>{hero.src=src;rail.querySelectorAll('button').forEach(q=>q.classList.toggle('active',q===b))};rail.append(b)});gallery.append(rail)}root.append(gallery,el('h1','marketplace-detail-title',x.title||''));const status=el('div','marketplace-interest-status');root.append(status);if(x.location_text)root.append(el('div','marketplace-location',x.location_text));if(x.price!==null&&x.price!==undefined)root.append(el('div','marketplace-price',money(x.price,x.currency)));const stats=el('div','marketplace-detail-grid');[[x.bedrooms,c().bedrooms],[x.bathrooms,c().bathrooms],[x.parking_spaces,c().parking],[x.area_m2,c().area]].forEach(([v,l])=>{if(v!==null&&v!==undefined&&v!==''){const s=el('div','marketplace-detail-stat');s.append(el('span','',l),el('strong','',String(v)));stats.append(s)}});if(stats.children.length)root.append(stats);if(x.description)root.append(el('p','marketplace-detail-copy',x.description));const lat=Number(x.latitude),lng=Number(x.longitude);if(Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180){const map=el('section','marketplace-map');const h=el('h2','',locale()==='es'?'Ubicación':'Location');const iframe=document.createElement('iframe');const d=.008;iframe.loading='lazy';iframe.referrerPolicy='no-referrer';iframe.title=locale()==='es'?'Mapa de la propiedad':'Property map';iframe.src=`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(lng-d)},${encodeURIComponent(lat-d)},${encodeURIComponent(lng+d)},${encodeURIComponent(lat+d)}&layer=mapnik&marker=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`;map.append(h,iframe);root.append(map)}const form=buildInterest(x);root.append(form);show('screen-marketplace-detail');if(focusForm)setTimeout(()=>form.querySelector('input')?.focus(),80)}
  function buildInterest'''
js,n=detail_re.subn(detail_new,js,count=1)
assert n==1,'detail patch failed'
js=js.replace("css.href='/marketplace.css?v=2'","css.href='/marketplace.css?v=6'")
js_path.write_text(js,encoding='utf-8')

css=css_path.read_text(encoding='utf-8')
css=re.sub(r'/\* LISTIA MARKETPLACE V6 START \*/.*?/\* LISTIA MARKETPLACE V6 END \*/','',css,flags=re.S)
css+=r'''
/* LISTIA MARKETPLACE V6 START */
.marketplace-badge{font-size:14px!important;padding:7px 12px!important;letter-spacing:.02em;line-height:1.1}
.marketplace-actions{display:block!important}.marketplace-interest-button{width:100%;min-height:50px;font-size:16px;font-weight:900;border-radius:15px;box-shadow:0 8px 22px rgba(126,47,255,.22)}
.marketplace-card{transition:transform .18s ease,box-shadow .18s ease}.marketplace-card:hover{transform:translateY(-2px);box-shadow:0 18px 44px rgba(25,18,45,.14)}
.marketplace-media[role=button],.marketplace-title{cursor:pointer}.marketplace-media:focus-visible,.marketplace-title:focus-visible,.marketplace-gallery-thumb:focus-visible{outline:3px solid #7b3fff;outline-offset:3px}
.marketplace-detail-gallery{display:grid;gap:10px}.marketplace-detail-gallery .marketplace-detail-media{border-radius:22px;overflow:hidden;background:#f4f1fa;aspect-ratio:16/10}.marketplace-detail-gallery .marketplace-detail-media img{width:100%;height:100%;object-fit:cover;display:block}
.marketplace-gallery-rail{display:flex;gap:9px;overflow-x:auto;padding:2px 2px 8px;scroll-snap-type:x proximity}.marketplace-gallery-thumb{flex:0 0 92px;height:70px;padding:0;border:2px solid transparent;border-radius:13px;overflow:hidden;background:#eee;scroll-snap-align:start}.marketplace-gallery-thumb.active{border-color:#7b3fff}.marketplace-gallery-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.marketplace-interest-status{min-height:0;margin:2px 0 8px;font-weight:800}.marketplace-interest-status.marketplace-success,.marketplace-interest-status.marketplace-error{padding:12px 14px;border-radius:13px}.marketplace-map{margin-top:18px}.marketplace-map h2{margin:0 0 10px;font-size:18px}.marketplace-map iframe{width:100%;height:320px;border:0;border-radius:18px;background:#eee}
@media(max-width:600px){.marketplace-badge{font-size:14px!important}.marketplace-detail-gallery .marketplace-detail-media{aspect-ratio:4/3}.marketplace-map iframe{height:270px}}
/* LISTIA MARKETPLACE V6 END */
'''
css_path.write_text(css,encoding='utf-8')

# PWA identity: Listia (not LISTIA), supplied application artwork remains un-cropped and Android cannot zoom a maskable variant.
for p in ROOT.glob('public/manifest*.webmanifest'):
    d=json.loads(p.read_text(encoding='utf-8'))
    d['name']='Listia';d['short_name']='Listia'
    d['icons']=[
      {'src':'/listia-app-icon-192.png?v=6','sizes':'192x192','type':'image/png','purpose':'any'},
      {'src':'/listia-app-icon-512.png?v=6','sizes':'512x512','type':'image/png','purpose':'any'}]
    p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

idx=idx_path.read_text(encoding='utf-8')
idx=re.sub(r'<title>.*?</title>','<title>Listia</title>',idx,count=1,flags=re.S)
idx=re.sub(r'<link[^>]+rel="icon"[^>]*>','<link href="/listia-app-icon-32.png?v=6" rel="icon" sizes="32x32" type="image/png"/>',idx,count=1)
idx=re.sub(r'<link[^>]+rel="apple-touch-icon"[^>]*>','<link href="/listia-app-icon-180.png?v=6" rel="apple-touch-icon" sizes="180x180"/>',idx,count=1)
idx=idx.replace('src="/listia-logo-transparent.webp"','src="/listia-logo-transparent.webp?v=6"')
idx_path.write_text(idx,encoding='utf-8')

# Use the supplied speech-bubble/house isotipo everywhere as the visible brand mark; transparent exterior, white house preserved.
svg=svg_path.read_text(encoding='utf-8')
svg=re.sub(r'\s*<rect width="1536" height="1536" fill="#fff"/>\s*','\n',svg,count=1)
svg_path.write_text(svg,encoding='utf-8')

if commercial_path.exists():
    s=commercial_path.read_text(encoding='utf-8')
    s=s.replace('listia-official-icon-v3.svg','listia-site-isotipo-v4.svg')
    s=re.sub(r"logoUrl\s*:\s*(['\"])[^'\"]+\1","logoUrl:'./listia-site-isotipo-v4.svg?v=6'",s)
    s=s.replace('>LISTIA<','>Listia<')
    commercial_path.write_text(s,encoding='utf-8')
    (ROOT/'commercial/listia-site-isotipo-v4.svg').write_text(svg,encoding='utf-8')

if sw_path.exists():
    sw=sw_path.read_text(encoding='utf-8')
    sw=re.sub(r'const CACHE="listia-pwa-v[^"]+";','const CACHE="listia-pwa-v1.0.6";',sw)
    sw=sw.replace('/listia-app-icon-maskable-192.png?v=1','/listia-app-icon-192.png?v=6').replace('/listia-app-icon-maskable-512.png?v=1','/listia-app-icon-512.png?v=6')
    sw=sw.replace('/listia-app-icon-192.png?v=1','/listia-app-icon-192.png?v=6').replace('/listia-app-icon-512.png?v=1','/listia-app-icon-512.png?v=6').replace('/listia-app-icon-180.png?v=1','/listia-app-icon-180.png?v=6').replace('/listia-app-icon-32.png?v=1','/listia-app-icon-32.png?v=6')
    sw_path.write_text(sw,encoding='utf-8')

print('Marketplace v6 patch applied')
