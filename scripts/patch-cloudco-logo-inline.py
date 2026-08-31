#!/usr/bin/env python3
from pathlib import Path

path=Path('scripts/build-commercial-worker.py')
text=path.read_text(encoding='utf-8')
old="cloudco_html=cloudco_html.replace('/cloudco-assets/cloudco-logo-official.webp','/cloudco-assets/cloudco-logo-official.webp?v=2')"
new="cloudco_html=cloudco_html.replace('src=\"/cloudco-assets/cloudco-logo-official.webp\"',f'src=\"data:image/webp;base64,{logo_b64}\" data-cloudco-logo-fallback=\"/cloudco-assets/cloudco-logo-official.webp?v=2\"')"
if old not in text:
    raise SystemExit('CloudCo logo replacement anchor not found')
path.write_text(text.replace(old,new,1),encoding='utf-8')
print('CloudCo official logo will be embedded inline in /cloudco HTML while preserving deployment verification marker')
