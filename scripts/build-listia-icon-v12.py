#!/usr/bin/env python3
from pathlib import Path
import re
import cairosvg

ROOT=Path(__file__).resolve().parents[1]
PUB=ROOT/'public'
SVG=PUB/'listia-official-icon-v5.svg'
ICON_VERSION='15'
DRIVE_SOURCE='1v-MeZmwDa6EBR-vo1T7d9m_hk3jTnceB'
if not SVG.exists(): raise SystemExit('missing official icon SVG')

def render(name,size):
    cairosvg.svg2png(bytestring=SVG.read_bytes(),write_to=str(PUB/name),output_width=size,output_height=size)

for name,size in [
    ('listia-app-icon-32.png',32),('listia-app-icon-180.png',180),('listia-app-icon-192.png',192),('listia-app-icon-512.png',512),
    ('listia-app-icon-maskable-192.png',192),('listia-app-icon-maskable-512.png',512)]: render(name,size)

# Rotate every manifest icon reference to v15 so Android requests fresh launcher assets.
for p in PUB.glob('manifest*.webmanifest'):
    s=p.read_text(encoding='utf-8')
    s=re.sub(r'(listia-app-icon[^"?]*\.png)\?v=\d+',rf'\1?v={ICON_VERSION}',s)
    p.write_text(s,encoding='utf-8')

idx=PUB/'index.html'
s=idx.read_text(encoding='utf-8')
s=re.sub(r'(manifest(?:-[a-zA-Z0-9-]+)?\.webmanifest)\?v=\d+',rf'\1?v={ICON_VERSION}',s)
s=re.sub(r'(listia-app-icon-(?:180|32)\.png)\?v=\d+',rf'\1?v={ICON_VERSION}',s)
idx.write_text(s,encoding='utf-8')

config=PUB/'config.js'
s=config.read_text(encoding='utf-8')
s=re.sub(r"const v='\d+'",f"const v='{ICON_VERSION}'",s,count=1)
config.write_text(s,encoding='utf-8')

sw=PUB/'sw.js'
s=sw.read_text(encoding='utf-8')
s=re.sub(r'(listia-app-icon[^"?]*\.png)\?v=\d+',rf'\1?v={ICON_VERSION}',s)
s=re.sub(r'(const CACHE="listia-pwa-v[^\"]+-marketplace-v)\d+(\")',rf'\g<1>{ICON_VERSION}\2',s)
sw.write_text(s,encoding='utf-8')

release='unknown'
m=re.search(r'BOOTSTRAP_VERSION:"([^"]+)"',config.read_text(encoding='utf-8'))
if m: release=m.group(1)
(PUB/'APP_ICON_VERSION.txt').write_text(f'''LISTIA OFFICIAL APPLICATION ICON\nversion={ICON_VERSION}\nicon_version={ICON_VERSION}\nsource=Google Drive file {DRIVE_SOURCE}\nscope=application-icon-launcher-favicon-apple-touch-and-pwa\nrelease={release}\npwa_release={release}\nartwork=purple rounded square with white house\nwhite_house=required\nouter_white_background=removed\nhouse_scale=0.90\nhouse_vertical_adjustment=-3px_source\nextra_wheel_or_pointer=forbidden\ninternal_isotipo=listia-site-isotipo-v4.svg\ninternal_isotipo_change=none\ncache_version=v{ICON_VERSION}\n''',encoding='utf-8')
print(f'LISTIA icon v{ICON_VERSION} generated: full-bleed purple, centered white house, no outer white tile')
