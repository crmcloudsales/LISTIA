#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

AUDIENCE = "listia-qroo-direct-ingest"
ENDPOINT = os.getenv("QROO_DIRECT_PRIVATE_INGEST_URL", "https://zvzafiarwerbuoaccnoz.supabase.co/functions/v1/qroo-direct-private-ingest")
TIMEOUT = 60


def oidc_token() -> str:
    base = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL")
    request_token = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
    if not base or not request_token:
        raise RuntimeError("GitHub OIDC environment unavailable")
    separator = "&" if "?" in base else "?"
    req = urllib.request.Request(
        f"{base}{separator}audience={urllib.parse.quote(AUDIENCE)}",
        headers={"Authorization": f"Bearer {request_token}", "Accept": "application/json"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    token = data.get("value")
    if not isinstance(token, str):
        raise RuntimeError("OIDC response missing token")
    return token


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: fetch-qroo-direct-source-config.py <static-config> <output-config>", file=sys.stderr)
        return 2
    static_path = Path(sys.argv[1])
    output = Path(sys.argv[2])
    limit = max(1, min(int(os.getenv("QROO_DIRECT_QUEUE_LIMIT", "100")), 200))
    token = oidc_token()
    req = urllib.request.Request(
        f"{ENDPOINT}?limit={limit}",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json", "User-Agent": "LISTIA-QROO-Direct-Config/1.0"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    if payload.get("ok") is not True or not isinstance(payload.get("sources"), list):
        raise RuntimeError(f"unexpected source queue response: {payload}")

    static = json.loads(static_path.read_text(encoding="utf-8")) if static_path.is_file() else {"sources": []}
    merged = []
    seen = set()
    # Adaptive leased sources come first. Static entries remain only as a
    # continuity fallback when a source is not present in the current lease.
    for source in list(payload["sources"]) + list(static.get("sources", [])):
        url = str(source.get("source_url") or "").strip()
        if not url or url in seen:
            continue
        seen.add(url)
        merged.append(source)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"territory": "Quintana Roo", "sources": merged}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"static": len(static.get("sources", [])), "dynamic": len(payload["sources"]), "merged": len(merged)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
