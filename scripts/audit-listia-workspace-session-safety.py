#!/usr/bin/env python3
"""Static safety invariants for LISTIA workspace/session context."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'public' / 'workspace-context.js'
errors: list[str] = []

if not TARGET.exists():
    errors.append('missing public/workspace-context.js')
    text = ''
else:
    text = TARGET.read_text(encoding='utf-8')

required = (
    "CLIENT_VERSION = '1.1.0'",
    'REQUEST_TIMEOUT_MS',
    'AbortController',
    'sessionKey',
    'cachedSessionKey',
    'inflightSessionKey',
    'workspace_session_changed',
    'workspace_context_superseded',
    "credentials: 'omit'",
    'generation += 1',
)
for marker in required:
    if marker not in text:
        errors.append(f'workspace context missing safety marker: {marker}')

if 'marketplace' in text.lower():
    errors.append('workspace-context.js must remain Marketplace-independent')

# A cache hit must be scoped to the current authenticated session.
if 'cachedSessionKey === currentSessionKey' not in text:
    errors.append('workspace cache hit is not scoped to the current session')

# Session must be re-checked after network I/O before data can be accepted.
if 'sessionKey() !== expectedSessionKey' not in text:
    errors.append('workspace RPC does not reject responses from a changed session')

if errors:
    print('LISTIA workspace session safety gate: FAIL', file=sys.stderr)
    for error in errors:
        print(f' - {error}', file=sys.stderr)
    raise SystemExit(1)

print('LISTIA workspace session safety gate: PASS')
print(' - cache is session-scoped')
print(' - stale in-flight context is rejected')
print(' - workspace RPCs are timeout-bounded')
print(' - core workspace module remains Marketplace-independent')
