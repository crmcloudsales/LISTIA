#!/usr/bin/env python3
from pathlib import Path
import json
import re
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUB = ROOT / 'public'
SOURCE = PUB / 'listia-app-icon-official.jpg'
ICON_VERSION = '17'
DRIVE_SOURCE = '1v-MeZmwDa6EBR-vo1T7d9m_hk3jTnceB'

if not SOURCE.exists():
    raise SystemExit('missing official LISTIA icon master')

source = Image.open(SOURCE).convert('RGB')
w, h = source.size
if w != h or w < 512:
    raise SystemExit(f'unexpected official source dimensions: {source.size}')

# Remove only the outer white launcher margin. Find the first diagonal inset
# where all four corners are part of the purple artwork. No redraw/recolor.
def purple(pixel):
    r, g, b = pixel
    return b > g + 12 and r > g + 8 and max(pixel) - min(pixel) > 25

inset = None
for i in range(0, w // 4):
    pts = [source.getpixel((i, i)), source.getpixel((w-1-i, i)),
           source.getpixel((i, h-1-i)), source.getpixel((w-1-i, h-1-i))]
    if all(purple(p) for p in pts):
        inset = i
        break
if inset is None:
    raise SystemExit('could not locate full-bleed purple artwork boundary')

master = source.crop((inset, inset, w-inset, h-inset))

def render(path, size):
    master.resize((size, size), Image.Resampling.LANCZOS).save(PUB / path, 'PNG', optimize=True)

for size in (32, 180, 192, 512):
    render(f'listia-app-icon-v{ICON_VERSION}-{size}.png', size)
    render(f'listia-app-icon-{size}.png', size)
for size in (192, 512):
    render(f'listia-app-icon-v{ICON_VERSION}-maskable-{size}.png', size)
    render(f'listia-app-icon-maskable-{size}.png', size)

# Physical filenames are deliberate: installed launchers can retain an old icon
# even when only a query string changes.
for path in PUB.glob('manifest*.webmanifest'):
    data = json.loads(path.read_text(encoding='utf-8'))
    for icon in data.get('icons', []):
        size = str(icon.get('sizes', '')).split('x', 1)[0]
        if size not in {'192', '512'}:
            continue
        if 'maskable' in str(icon.get('purpose', 'any')):
            icon['src'] = f'/listia-app-icon-v{ICON_VERSION}-maskable-{size}.png'
        else:
            icon['src'] = f'/listia-app-icon-v{ICON_VERSION}-{size}.png'
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')

idx = PUB / 'index.html'
s = idx.read_text(encoding='utf-8')
s = re.sub(r'(manifest(?:-[a-zA-Z0-9-]+)?\.webmanifest)(?:\?v=\d+)?', rf'\1?v={ICON_VERSION}', s)
s = re.sub(r'/listia-app-icon(?:-v\d+)?-180\.png(?:\?v=\d+)?', f'/listia-app-icon-v{ICON_VERSION}-180.png', s)
s = re.sub(r'/listia-app-icon(?:-v\d+)?-32\.png(?:\?v=\d+)?', f'/listia-app-icon-v{ICON_VERSION}-32.png', s)
idx.write_text(s, encoding='utf-8')

config = PUB / 'config.js'
s = config.read_text(encoding='utf-8')
s = re.sub(r"const v='\d+'", f"const v='{ICON_VERSION}'", s, count=1)
s = re.sub(r'`/listia-app-icon(?:-v\d+)?-180\.png(?:\?v=\$\{v\})?`', f'`/listia-app-icon-v{ICON_VERSION}-180.png`', s)
s = re.sub(r'`/listia-app-icon(?:-v\d+)?-32\.png(?:\?v=\$\{v\})?`', f'`/listia-app-icon-v{ICON_VERSION}-32.png`', s)
config.write_text(s, encoding='utf-8')

sw = PUB / 'sw.js'
s = sw.read_text(encoding='utf-8')
s = re.sub(r'const CACHE="([^"]+?)(?:-icon-v\d+)?";', rf'const CACHE="\1-icon-v{ICON_VERSION}";', s, count=1)
for size in ('32', '180', '192', '512'):
    s = re.sub(rf'/listia-app-icon(?:-v\d+)?-{size}\.png(?:\?v=\d+)?', f'/listia-app-icon-v{ICON_VERSION}-{size}.png', s)
for size in ('192', '512'):
    s = re.sub(rf'/listia-app-icon(?:-v\d+)?-maskable-{size}\.png(?:\?v=\d+)?', f'/listia-app-icon-v{ICON_VERSION}-maskable-{size}.png', s)
s = re.sub(r'(manifest(?:-[a-zA-Z0-9-]+)?\.webmanifest)\?v=\d+', rf'\1?v={ICON_VERSION}', s)
sw.write_text(s, encoding='utf-8')

release = 'unknown'
m = re.search(r'BOOTSTRAP_VERSION:"([^"]+)"', config.read_text(encoding='utf-8'))
if m:
    release = m.group(1)
(PUB / 'APP_ICON_VERSION.txt').write_text(
    '\n'.join([
        'LISTIA OFFICIAL APPLICATION ICON',
        f'version={ICON_VERSION}', f'icon_version={ICON_VERSION}',
        f'source_repo={SOURCE.name}', f'canonical_drive_source={DRIVE_SOURCE}',
        f'source_dimensions={w}x{h}', f'outer_margin_crop={inset}px_each_side',
        'scope=application-icon-launcher-favicon-apple-touch-and-pwa',
        f'release={release}', f'pwa_release={release}',
        'artwork=user-approved official master; house, lighting, volume and gradient preserved',
        'outer_white_background=removed', 'redraw=none', 'recolor=none',
        'extra_wheel_or_pointer=forbidden',
        'cache_strategy=physical-versioned-filenames', f'cache_version=v{ICON_VERSION}'
    ]) + '\n', encoding='utf-8')
print(f'LISTIA icon v{ICON_VERSION} generated from official master; crop={inset}px')
