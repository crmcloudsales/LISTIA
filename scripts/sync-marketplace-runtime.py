#!/usr/bin/env python3
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
PUB=ROOT/'public'
config_path=PUB/'config.js'
sw_path=PUB/'sw.js'
qroo_path=PUB/'marketplace-qroo-map.js'
config=config_path.read_text(encoding='utf-8')
sw=sw_path.read_text(encoding='utf-8')
qroo=qroo_path.read_text(encoding='utf-8')

# Mobile users must see actual inventory immediately. The map remains one tap away.
if "let proMode='map';" in qroo:
    qroo=qroo.replace("let proMode='map';","let proMode='list';",1)
elif "let proMode='list';" not in qroo:
    raise SystemExit('Unexpected Marketplace proMode state')
legacy="setProMode(matchMedia('(max-width:650px)').matches?'map':'map')"
current="setProMode(matchMedia('(max-width:650px)').matches?'list':'map')"
if legacy in qroo:
    qroo=qroo.replace(legacy,current,1)
elif current not in qroo:
    raise SystemExit('Marketplace mobile default-mode anchor missing')
qroo_path.write_text(qroo,encoding='utf-8')

# Bump the QROO module physically in the cache contract so installed PWAs do not
# retain the old map-first behavior.
if '/marketplace-qroo-map.js?v=2' in sw:
    sw=sw.replace('/marketplace-qroo-map.js?v=2','/marketplace-qroo-map.js?v=3')
elif '/marketplace-qroo-map.js?v=3' not in sw:
    raise SystemExit('Unexpected QROO runtime version in Service Worker')
cache=re.search(r'const CACHE="([^"]+)";',sw)
if not cache:
    raise SystemExit('Service Worker cache marker missing')
if '-qroo-v3' not in cache.group(1):
    sw=sw.replace(cache.group(0),f'const CACHE="{cache.group(1)}-qroo-v3";',1)

# Runtime files that must execute with the exact cache-busting revision that the
# Service Worker considers current. This prevents stale Marketplace logic from
# being executed while a newer file is merely precached.
files=(
    'marketplace-native-runtime-v1.js',
    'marketplace-gateway-v9.js',
    'marketplace.js',
    'marketplace-qroo-map.js',
)
for name in files:
    m=re.search(rf'/{re.escape(name)}\?v=(\d+)',sw)
    if not m:
        raise SystemExit(f'{name}: missing from Service Worker release')
    version=m.group(1)
    pattern=rf'/{re.escape(name)}\?v=\d+'
    if re.search(pattern,config):
        config=re.sub(pattern,f'/{name}?v={version}',config)
        continue
    if name!='marketplace-native-runtime-v1.js':
        raise SystemExit(f'{name}: missing from config runtime loader')
    anchor='["/marketplace-assistant.js?v=2","listiaMarketplaceAssistantLoader"]'
    native=f'["/{name}?v={version}","listiaMarketplaceNativeRuntimeV1Loader"]'
    if anchor not in config:
        raise SystemExit('Marketplace assistant module anchor missing from config.js')
    config=config.replace(anchor,anchor+','+native,1)

# These app-only mobile layers were already part of the release/cache contract
# but were never injected into the live document by config.js.
anchor='["listiaQrooMapStyles","/marketplace-qroo-map.css?v=1"]'
mobile=(
    '["listiaMarketplaceProMobileStyles","/marketplace-pro-mobile.css?v=1"]',
    '["listiaMarketplaceNativeMobileStyles","/marketplace-native-mobile-v1.css?v=1"]',
)
if anchor not in config:
    raise SystemExit('Marketplace map style anchor missing from config.js')
insert=anchor
for item in mobile:
    if item not in config:
        insert+=','+item
config=config.replace(anchor,insert,1)

config_path.write_text(config,encoding='utf-8')
sw_path.write_text(sw,encoding='utf-8')
print('LISTIA Marketplace runtime synchronized; mobile opens Properties and QROO runtime is v3')
