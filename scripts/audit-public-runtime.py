#!/usr/bin/env python3
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
PUB = ROOT / 'public'
CONFIG = PUB / 'config.js'
SW = PUB / 'sw.js'

errors = []

def fail(msg):
    errors.append(msg)

def strip_query(url: str) -> str:
    return url.split('?', 1)[0]

config = CONFIG.read_text(encoding='utf-8')
sw = SW.read_text(encoding='utf-8')

# Every public asset loaded by config.js must exist physically.
refs = re.findall(r'\["([^"\n]+(?:\.js|\.css)(?:\?[^"\n]+)?)","([^"\n]+)"\]', config)
seen_ids = set()
seen_urls = set()
for url, loader_id in refs:
    if loader_id in seen_ids:
        fail(f'duplicate runtime loader/style id: {loader_id}')
    seen_ids.add(loader_id)
    clean = strip_query(url).lstrip('/')
    if clean in seen_urls:
        fail(f'duplicate runtime asset reference: {clean}')
    seen_urls.add(clean)
    if not (PUB / clean).is_file():
        fail(f'missing runtime asset: {url}')

# Manifest references must exist and use immutable icon filenames.
for manifest in PUB.glob('manifest*.webmanifest'):
    try:
        data = json.loads(manifest.read_text(encoding='utf-8'))
    except Exception as exc:
        fail(f'invalid JSON {manifest.name}: {exc}')
        continue
    if data.get('name') != 'Listia' or data.get('short_name') != 'Listia':
        fail(f'{manifest.name}: app name must be Listia')
    for icon in data.get('icons', []):
        src = str(icon.get('src', ''))
        if '?v=' in src:
            fail(f'{manifest.name}: icon must use immutable physical filename, not query cache busting: {src}')
        clean = strip_query(src).lstrip('/')
        if not clean or not (PUB / clean).is_file():
            fail(f'{manifest.name}: missing icon file: {src}')

# The active icon version must agree across config, manifest and version note.
m = re.search(r"const v='(\d+)'", config)
if not m:
    fail('config.js: app icon version not found')
else:
    icon_v = m.group(1)
    note = (PUB / 'APP_ICON_VERSION.txt').read_text(encoding='utf-8') if (PUB / 'APP_ICON_VERSION.txt').exists() else ''
    if f'icon_version={icon_v}' not in note and f'version={icon_v}' not in note:
        fail(f'APP_ICON_VERSION.txt does not agree with config icon v{icon_v}')
    for manifest in PUB.glob('manifest*.webmanifest'):
        text = manifest.read_text(encoding='utf-8')
        if f'listia-app-icon-v{icon_v}-' not in text:
            fail(f'{manifest.name}: does not reference active icon v{icon_v}')

# Marketplace critical runtime assets must be both loaded and cached.
critical = [
    'marketplace-native-runtime-v1.js',
    'marketplace-gateway-v9.js',
    'marketplace.js',
    'marketplace-qroo-map.js',
    'marketplace-visible-mobile-v1.css',
    'listings-my-website.js',
    'market-intelligence.js',
]
for name in critical:
    if name not in config:
        fail(f'config.js missing critical asset: {name}')
    if name not in sw:
        fail(f'sw.js missing critical asset: {name}')

# Keep the public browser configuration free of known secret-key shapes.
secret_patterns = [
    r'service_role',
    r'sk_live_[A-Za-z0-9]+',
    r'sk_test_[A-Za-z0-9]+',
    r'ghp_[A-Za-z0-9]+',
]
for pat in secret_patterns:
    if re.search(pat, config, re.I):
        fail(f'config.js contains forbidden secret pattern: {pat}')

if errors:
    print('LISTIA PUBLIC RUNTIME INTEGRITY: FAIL')
    for item in errors:
        print(f' - {item}')
    sys.exit(1)

print('LISTIA PUBLIC RUNTIME INTEGRITY: PASS')
print(f' assets_checked={len(refs)} critical_checked={len(critical)} manifests={len(list(PUB.glob("manifest*.webmanifest")))}')
