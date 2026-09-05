#!/usr/bin/env python3
"""Static invariants for LISTIA Contact & Lead Engine core."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'public' / 'contact-engine.js'
errors: list[str] = []

if not TARGET.exists():
    errors.append('missing public/contact-engine.js')
    text = ''
else:
    text = TARGET.read_text(encoding='utf-8')

for marker in ("es:{", "en:{", "fr:{", "it:{", "'pt-BR':{", "de:{", "'ar-AE':{", "ru:{", "he:{", "'zh-CN':{", "ja:{"):
    if marker not in text:
        errors.append(f'contact engine missing locale marker: {marker}')

for label, pattern in {
    'innerHTML': r'\.innerHTML\b',
    'outerHTML': r'\.outerHTML\b',
    'insertAdjacentHTML': r'\binsertAdjacentHTML\s*\(',
}.items():
    if re.search(pattern, text):
        errors.append(f'contact engine contains forbidden HTML sink: {label}')

for marker in ('REQUEST_TIMEOUT_MS', 'AbortController', "credentials:'omit'", 'replaceChildren', 'document.createElement', 'listia:workspacechange'):
    if marker not in text:
        errors.append(f'contact engine missing resilience marker: {marker}')

if 'marketplace' in text.lower():
    errors.append('contact-engine.js must remain Marketplace-independent')

# Marketing eligibility must remain consent-aware.
if "x.marketing_eligible&&x.consent_status==='opted_in'" not in text:
    errors.append('contact engine marketable metric is not explicitly opt-in gated')

if errors:
    print('LISTIA contact engine core gate: FAIL', file=sys.stderr)
    for error in errors:
        print(f' - {error}', file=sys.stderr)
    raise SystemExit(1)

print('LISTIA contact engine core gate: PASS')
print(' - all 11 LISTIA languages are represented')
print(' - contact PII renders through text nodes')
print(' - network reads are timeout-bounded')
print(' - marketable metric remains explicit-opt-in only')
print(' - module remains Marketplace-independent')
