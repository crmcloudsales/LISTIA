#!/usr/bin/env python3
"""Security gate for LISTIA account rendering.

Account/profile/organization values are user- or database-controlled. These
surfaces must render them as text nodes rather than HTML fragments.
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
TARGETS = [
    ROOT / "public" / "account-center.js",
    ROOT / "public" / "account-resilience.js",
]

errors: list[str] = []

for path in TARGETS:
    if not path.exists():
        errors.append(f"missing required file: {path.relative_to(ROOT)}")
        continue
    text = path.read_text(encoding="utf-8")
    forbidden = {
        "innerHTML": r"\.innerHTML\b",
        "outerHTML": r"\.outerHTML\b",
        "insertAdjacentHTML": r"\binsertAdjacentHTML\s*\(",
        "document.write": r"\bdocument\.write\s*\(",
        "eval": r"\beval\s*\(",
        "new Function": r"\bnew\s+Function\s*\(",
    }
    for label, pattern in forbidden.items():
        if re.search(pattern, text):
            errors.append(f"{path.relative_to(ROOT)} contains forbidden DOM/code sink: {label}")

    for marker in ("textContent", "replaceChildren", "document.createElement"):
        if marker not in text:
            errors.append(f"{path.relative_to(ROOT)} missing safe-render marker: {marker}")

    if "marketplace" in text.lower():
        errors.append(f"{path.relative_to(ROOT)} must remain independent from Marketplace runtime")

if errors:
    print("LISTIA account DOM safety gate: FAIL", file=sys.stderr)
    for error in errors:
        print(f" - {error}", file=sys.stderr)
    raise SystemExit(1)

print("LISTIA account DOM safety gate: PASS")
print(" - dynamic account values render through text nodes")
print(" - HTML injection sinks are absent")
print(" - account core remains Marketplace-independent")
