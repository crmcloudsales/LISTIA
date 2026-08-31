#!/usr/bin/env python3
from pathlib import Path
import re
import cairosvg

ROOT=Path(__file__).resolve().parents[1]
PUB=ROOT/'public'
SVG=PUB/'listia-official-icon-v5.svg'
if not SVG.exists(): raise SystemExit('missing official icon SVG')

def render(name,size):
    cairosvg.svg2png(bytestring=SVG.read_bytes(),write_to=str(PUB/name),output_width=size,output_height=size)

for name,size in [
    ('listia-app-icon-32.png',32),('listia-app-icon-180.png',180),('listia-app-icon-192.png',192),('listia-app-icon-512.png',512),
    ('listia-app-icon-maskable-192.png',192),('listia-app-icon-maskable-512.png',512)]: render(name,size)

# Rotate every manifest/icon reference to v12.
for p in PUB.glob('manifest*.webmanifest'):
    s=p.read_text(encoding='utf-8');s=re.sub(r'(listia-app-icon[^"?]*\.png)\?v=\d+',r'\1?v=12',s);p.write_text(s,encoding='utf-8')

idx=PUB/'index.html';s=idx.read_text(encoding='utf-8');s=re.sub(r'(manifest-[a-zA-Z0-9-]+\.webmanifest)\?v=\d+',r'\1?v=12',s);s=re.sub(r'(listia-app-icon-(?:180|32)\.png)\?v=\d+',r'\1?v=12',s);idx.write_text(s,encoding='utf-8')

sw=PUB/'sw.js';s=sw.read_text(encoding='utf-8');s=re.sub(r'const CACHE="listia-pwa-v[^"]+"','const CACHE="listia-pwa-v0.27.6-marketplace-v12"',s);s=s.replace('/marketplace.js?v=2','/marketplace.js?v=9').replace('/marketplace-experience-v8.css?v=1','/marketplace-experience-v8.css?v=2').replace('/marketplace-experience-v8.js?v=1','/marketplace-experience-v8.js?v=2');
if '/marketplace-gateway-v9.js?v=1' not in s:s=s.replace('"/marketplace-assistant.js?v=2",','"/marketplace-assistant.js?v=2","/marketplace-gateway-v9.js?v=1",')
s=re.sub(r'\?v=11', '?v=12', s);sw.write_text(s,encoding='utf-8')

(PUB/'APP_ICON_VERSION.txt').write_text('''LISTIA OFFICIAL APPLICATION ICON\nversion=12\nsource=public/listia-official-icon-v5.svg\nscope=application-icon-site-favicon-and-pwa-cache\nhouse_scale=0.72\nhouse_fill=brand-purple-gradient-no-white\nbackground=full-bleed-brand-purple-gradient-no-white\npadding_rule=preserve-complete-house-add-safe-space-no-crop\nbrand_logo=listia-site-isotipo-v4.svg\npwa_release=0.27.6\ncache_version=v12\n''',encoding='utf-8')
print('LISTIA icon v12 assets generated from official purple SVG')
