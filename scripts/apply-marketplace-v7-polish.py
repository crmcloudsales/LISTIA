#!/usr/bin/env python3
from pathlib import Path
import json,re

ROOT=Path('.')

# Marketplace: larger SALE/RENT badge, single CTA, detail gallery/map and authenticated lead click.
cssp=ROOT/'public/marketplace.css'
css=cssp.read_text(encoding='utf-8')
css=css.replace('.marketplace-badge{font-size:14px!important;padding:7px 12px!important;', '.marketplace-badge{font-size:16px!important;padding:7px 12px!important;', 1)
css=css.replace('@media(max-width:600px){.marketplace-badge{font-size:14px!important}', '@media(max-width:600px){.marketplace-badge{font-size:15px!important}', 1)
if 'LISTIA MARKETPLACE V7' not in css:
    css += '''\n/* LISTIA MARKETPLACE V7 */\n.marketplace-detail-cta{position:sticky;bottom:10px;z-index:4;padding:10px 0;background:linear-gradient(180deg,rgba(7,7,10,0),rgba(7,7,10,.92) 34%)}\n.marketplace-detail-cta .marketplace-interest-button{width:100%;min-height:54px;font-size:17px}\n'''
cssp.write_text(css,encoding='utf-8')

jsp=ROOT/'public/marketplace.js'
js=jsp.read_text(encoding='utf-8')
js=js.replace("css.href='/marketplace.css?v=6'", "css.href='/marketplace.css?v=7'")
js=js.replace("'/listia-mark-transparent.webp'", "'/listia-site-isotipo-v4.svg?v=7'")
# Replace the old secondary form on detail with the same single Me interesa action.
old="const form=buildInterest(x);root.append(form);show('screen-marketplace-detail');if(focusForm)setTimeout(()=>form.querySelector('input')?.focus(),80)"
new="const cta=el('div','marketplace-detail-cta'),interest=el('button','primary marketplace-interest-button',c().interest);interest.type='button';interest.onclick=()=>sendInterestClick(x,interest);cta.append(interest);root.append(cta);show('screen-marketplace-detail');if(focusForm)setTimeout(()=>interest.focus(),80)"
if old in js: js=js.replace(old,new,1)
jsp.write_text(js,encoding='utf-8')

# Installed PWA identity and icon: preserve the exact supplied square source; do not advertise maskable icons (Android zoom/crop).
for p in ROOT.glob('public/manifest*.webmanifest'):
    d=json.loads(p.read_text(encoding='utf-8'))
    d['name']='Listia'; d['short_name']='Listia'
    d['icons']=[
      {'src':'/listia-app-icon-192.png?v=7','sizes':'192x192','type':'image/png','purpose':'any'},
      {'src':'/listia-app-icon-512.png?v=7','sizes':'512x512','type':'image/png','purpose':'any'}]
    p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

idxp=ROOT/'public/index.html'
idx=idxp.read_text(encoding='utf-8')
idx=re.sub(r'<title>.*?</title>','<title>Listia</title>',idx,count=1,flags=re.S)
idx=re.sub(r'<link href="/manifest-en\.webmanifest\?v=[^"]+" id="appManifest" rel="manifest"/>','<link href="/manifest-en.webmanifest?v=7" id="appManifest" rel="manifest"/>',idx,count=1)
idx=re.sub(r'<link href="/listia-app-icon-180\.png\?v=[^"]+" rel="apple-touch-icon" sizes="180x180"/>','<link href="/listia-app-icon-180.png?v=7" rel="apple-touch-icon" sizes="180x180"/>',idx,count=1)
idx=re.sub(r'<link href="/listia-app-icon-32\.png\?v=[^"]+" rel="icon" sizes="32x32" type="image/png"/>','<link href="/listia-app-icon-32.png?v=7" rel="icon" sizes="32x32" type="image/png"/>',idx,count=1)
idx=re.sub(r'<img alt="[^"]*" class="brand-logo" src="[^"]+"/>','<img alt="Listia" class="brand-logo" src="/listia-site-isotipo-v4.svg?v=7"/>',idx,count=1)
idxp.write_text(idx,encoding='utf-8')

# Service worker cache bust so updated manifest/icon/branding are revalidated.
swp=ROOT/'public/sw.js'
if swp.exists():
    sw=swp.read_text(encoding='utf-8')
    sw=re.sub(r'const CACHE="listia-pwa-v[^"]+";', 'const CACHE="listia-pwa-v1.0.7";', sw)
    sw=re.sub(r'/listia-app-icon-(32|180|192|512)\.png\?v=\d+', r'/listia-app-icon-\1.png?v=7', sw)
    sw=sw.replace('/listia-site-isotipo-v4.svg?v=6','/listia-site-isotipo-v4.svg?v=7')
    swp.write_text(sw,encoding='utf-8')

# Commercial site: use the supplied speech-bubble/house isotipo as the visible brand mark, while favicon remains app icon.
cp=ROOT/'commercial/index.html'
if cp.exists():
    s=cp.read_text(encoding='utf-8')
    s=re.sub(r'const LOGO_SRC = "data:image/[^;]+;base64,[^"]+";', "const LOGO_SRC = './listia-site-isotipo-v4.svg?v=7';", s, count=1)
    s=re.sub(r'<link rel="icon" id="favicon" href="[^"]*" ?/>','<link rel="icon" id="favicon" href="/listia-app-icon-32.png?v=7" />',s,count=1)
    cp.write_text(s,encoding='utf-8')
    # Keep the same exact vector available relative to commercial root.
    src=ROOT/'public/listia-site-isotipo-v4.svg'
    dst=ROOT/'commercial/listia-site-isotipo-v4.svg'
    if src.exists(): dst.write_text(src.read_text(encoding='utf-8'),encoding='utf-8')

# Release marker.
(ROOT/'public/MARKETPLACE_V7_RELEASE.txt').write_text(
    'Listia Marketplace v7\n- Larger Venta/Renta badge\n- Single Me interesa CTA\n- CTA opens detail and creates/routs lead\n- Listia installed name\n- non-maskable official app icon\n- official site isotipo visible across PWA/commercial\n',encoding='utf-8')
print('Marketplace v7 polish applied')
