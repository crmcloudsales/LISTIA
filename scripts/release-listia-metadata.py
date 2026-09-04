#!/usr/bin/env python3
from pathlib import Path
import json,re,datetime

ROOT=Path(__file__).resolve().parents[1]
PUB=ROOT/'public'
VERSION='0.28.0'

config=PUB/'config.js'
s=config.read_text(encoding='utf-8')
s,n=re.subn(r'BOOTSTRAP_VERSION:"[^"]+"',f'BOOTSTRAP_VERSION:"{VERSION}"',s,count=1)
if n!=1: raise SystemExit('BOOTSTRAP_VERSION not found exactly once')
config.write_text(s,encoding='utf-8')

sw=PUB/'sw.js'
s=sw.read_text(encoding='utf-8')
s,n=re.subn(r'const CACHE="listia-pwa-v[^-\"]+([^\"]*)";',rf'const CACHE="listia-pwa-v{VERSION}\1";',s,count=1)
if n!=1: raise SystemExit('Service Worker cache release prefix not found exactly once')
sw.write_text(s,encoding='utf-8')

icon=PUB/'APP_ICON_VERSION.txt'
s=icon.read_text(encoding='utf-8')
s,n1=re.subn(r'^release=.*$',f'release={VERSION}',s,count=1,flags=re.M)
s,n2=re.subn(r'^pwa_release=.*$',f'pwa_release={VERSION}',s,count=1,flags=re.M)
if n1!=1 or n2!=1: raise SystemExit('APP_ICON release markers not found')
icon.write_text(s,encoding='utf-8')

build={
  'product':'LISTIA',
  'release':VERSION,
  'bootstrap_version':VERSION,
  'service_worker_release':VERSION,
  'app_icon_version':'17',
  'billing_env':'hold',
  'billing_enabled':False,
  'generated_by':'scripts/release-listia-metadata.py',
  'release_contract':'config/sw/app-icon/build-info parity',
  'resource_boundary':'LISTIA_ONLY'
}
(PUB/'BUILD_INFO.json').write_text(json.dumps(build,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'LISTIA release metadata synchronized: {VERSION}')
