#!/usr/bin/env python3
from __future__ import annotations

import base64
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

AUDIENCE = "listia-qroo-direct-ingest"
DEFAULT_ENDPOINT = "https://zvzafiarwerbuoaccnoz.supabase.co/functions/v1/qroo-direct-private-ingest"
BATCH_SIZE = max(1, min(int(os.getenv("QROO_DIRECT_INGEST_BATCH_SIZE", "150")), 200))
TIMEOUT = int(os.getenv("QROO_DIRECT_INGEST_TIMEOUT_SECONDS", "60"))


def decode_exp(token: str) -> int:
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        return int(json.loads(base64.urlsafe_b64decode(payload.encode()))["exp"])
    except Exception:
        return 0


def request_oidc_token() -> tuple[str, int]:
    base = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL")
    request_token = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
    if not base or not request_token:
        raise RuntimeError("GitHub OIDC environment unavailable; id-token: write is required")
    separator = "&" if "?" in base else "?"
    req = urllib.request.Request(
        f"{base}{separator}audience={urllib.parse.quote(AUDIENCE)}",
        headers={"Authorization": f"Bearer {request_token}", "Accept": "application/json"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    token = data.get("value")
    if not isinstance(token, str) or token.count(".") != 2:
        raise RuntimeError("GitHub OIDC response did not contain a JWT")
    return token, decode_exp(token)


def post(endpoint: str, token: str, batch: list[dict]) -> dict:
    body = json.dumps({"batch": batch}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "LISTIA-QROO-Direct-GitHub-Actions/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        text = exc.read().decode("utf-8", errors="replace")[:2000]
        raise RuntimeError(f"direct private ingest HTTP {exc.code}: {text}") from exc
    if payload.get("ok") is not True or not isinstance(payload.get("result"), dict):
        raise RuntimeError(f"unexpected direct ingest response: {payload}")
    return payload


def post_refresh_results(endpoint: str, token: str, refresh_results: list[dict]) -> dict:
    body = json.dumps(
        {"refresh_results": refresh_results},
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "LISTIA-QROO-Direct-GitHub-Actions/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        text = exc.read().decode("utf-8", errors="replace")[:2000]
        raise RuntimeError(f"direct refresh completion HTTP {exc.code}: {text}") from exc
    if payload.get("ok") is not True or not isinstance(payload.get("refresh_result"), dict):
        raise RuntimeError(f"unexpected refresh completion response: {payload}")
    return payload


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: push-qroo-direct-private-ingest.py <crawl-output-dir>", file=sys.stderr)
        return 2
    root = Path(sys.argv[1])
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    for key in ("image_required", "generic_placeholders_rejected", "verified_source_contact_required", "robots_respected", "same_host_detail_provenance"):
        if manifest.get(key) is not True:
            raise RuntimeError(f"direct crawler manifest missing required proof: {key}")
    chunks = [e.get("file") for e in manifest.get("chunks", []) if e.get("file")]
    if not chunks:
        raise RuntimeError("direct crawler manifest contains no chunks")

    endpoint = os.getenv("QROO_DIRECT_PRIVATE_INGEST_URL", DEFAULT_ENDPOINT)
    token = ""
    exp = 0
    totals = {"payload": 0, "valid": 0, "invalid": 0, "inserted": 0, "duplicate_or_existing": 0, "requests": 0}
    for chunk_name in chunks:
        rows = json.loads((root / str(chunk_name)).read_text(encoding="utf-8"))
        for start in range(0, len(rows), BATCH_SIZE):
            batch = rows[start:start + BATCH_SIZE]
            if not token or exp <= int(time.time()) + 60:
                token, exp = request_oidc_token()
            response = post(endpoint, token, batch)
            result = response["result"]
            totals["requests"] += 1
            for key in ("payload", "valid", "invalid", "inserted", "duplicate_or_existing"):
                totals[key] += int(result.get(key, 0) or 0)
            print(json.dumps({"chunk": chunk_name, "offset": start, "batch": len(batch), "result": result, "run_id": response.get("run_id")}, ensure_ascii=False), flush=True)

    refresh_results = [
        {
            "source_url": str(item.get("source_url") or ""),
            "content_hash": str(item.get("content_hash") or ""),
            "candidates": int(item.get("candidates", 0) or 0),
            "accepted": int(item.get("accepted", 0) or 0),
            "failures": int(item.get("failures", 0) or 0),
        }
        for item in manifest.get("summaries", [])
        if item.get("source_url")
    ]
    if refresh_results:
        if not token or exp <= int(time.time()) + 60:
            token, exp = request_oidc_token()
        refresh_response = post_refresh_results(endpoint, token, refresh_results)
        print(json.dumps({
            "refresh_completion": refresh_response["refresh_result"],
            "run_id": refresh_response.get("run_id"),
        }, ensure_ascii=False), flush=True)
    print(json.dumps({"summary": totals}, ensure_ascii=False), flush=True)
    return 0 if totals["invalid"] == 0 else 3


if __name__ == "__main__":
    raise SystemExit(main())
