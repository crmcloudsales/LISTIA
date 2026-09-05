#!/usr/bin/env python3
"""Static invariants for non-Marketplace LISTIA PWA install and OAuth flows."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
INSTALL = ROOT / "public" / "install.js"
OAUTH = ROOT / "public" / "oauth-auth.js"
errors: list[str] = []


def read(path: Path) -> str:
    if not path.exists():
        errors.append(f"missing required file: {path.relative_to(ROOT)}")
        return ""
    return path.read_text(encoding="utf-8")


install = read(INSTALL)
oauth = read(OAUTH)

# LISTIA's supported language surface must stay aligned with the 11-language app.
for marker in ("es:", "en:", "fr:", "it:", "'pt-BR':", "de:", "'ar-AE':", "ru:", "he:", "'zh-CN':", "ja:"):
    if marker not in install:
        errors.append(f"public/install.js missing locale marker: {marker}")

# The install modal renders only fixed application copy through DOM nodes.
for sink in (r"\.innerHTML\b", r"\.outerHTML\b", r"\binsertAdjacentHTML\s*\("):
    if re.search(sink, install):
        errors.append("public/install.js contains an HTML injection sink")
        break
for marker in ("replaceChildren", "document.createElement", "previousFocus", "aria-live"):
    if marker not in install:
        errors.append(f"public/install.js missing resilient UI marker: {marker}")

# OAuth provider discovery must fail closed and must not hang indefinitely.
for marker in ("OAUTH_ATTEMPT_TTL_MS", "SETTINGS_TIMEOUT_MS", "AbortController", "scrubOAuthError", "clearStaleAttempt"):
    if marker not in oauth:
        errors.append(f"public/oauth-auth.js missing OAuth resilience marker: {marker}")
if "signal:controller.signal" not in oauth:
    errors.append("public/oauth-auth.js settings request is missing abort signal")
if "error_description" not in oauth or "history.replaceState" not in oauth:
    errors.append("public/oauth-auth.js must scrub OAuth callback errors from the browser URL")

# These two core modules are intentionally outside Marketplace scope.
for path, text in ((INSTALL, install), (OAUTH, oauth)):
    if "marketplace" in text.lower():
        errors.append(f"{path.relative_to(ROOT)} must remain Marketplace-independent")

if errors:
    print("LISTIA PWA/Auth resilience gate: FAIL", file=sys.stderr)
    for error in errors:
        print(f" - {error}", file=sys.stderr)
    raise SystemExit(1)

print("LISTIA PWA/Auth resilience gate: PASS")
print(" - PWA install copy covers all 11 LISTIA languages")
print(" - install UI avoids HTML injection sinks")
print(" - OAuth provider discovery is timeout-bounded")
print(" - stale/error OAuth callback state is cleaned")
print(" - checked modules remain Marketplace-independent")
