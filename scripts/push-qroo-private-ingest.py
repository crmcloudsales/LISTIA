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

AUDIENCE = "listia-qroo-ingest"
DEFAULT_ENDPOINT = "https://zvzafiarwerbuoaccnoz.supabase.co/functions/v1/qroo-private-ingest"
BATCH_SIZE = max(1, min(int(os.getenv("QROO_INGEST_BATCH_SIZE", "200")), 250))
TIMEOUT = int(os.getenv("QROO_INGEST_TIMEOUT_SECONDS", "60"))


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
        raise RuntimeError("GitHub OIDC environment is unavailable; id-token: write is required")
    separator = "&" if "?" in base else "?"
    url = f"{base}{separator}audience={urllib.parse.quote(AUDIENCE)}"
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {request_token}", "Accept": "application/json"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    token = data.get("value")
    if not isinstance(token, str) or token.count(".") != 2:
        raise RuntimeError("GitHub OIDC response did not contain a JWT")
    return token, decode_exp(token)


def post_batch(endpoint: str, token: str, batch: list[dict]) -> dict:
    body = json.dumps({"batch": batch}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "LISTIA-QROO-GitHub-Actions/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        text = exc.read().decode("utf-8", errors="replace")[:2000]
        raise RuntimeError(f"private ingest HTTP {exc.code}: {text}") from exc
    if payload.get("ok") is not True or not isinstance(payload.get("result"), dict):
        raise RuntimeError(f"unexpected private ingest response: {payload}")
    return payload


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: push-qroo-private-ingest.py <crawl-output-dir>", file=sys.stderr)
        return 2

    out_dir = Path(sys.argv[1])
    manifest_path = out_dir / "manifest.json"
    if not manifest_path.is_file():
        raise RuntimeError(f"manifest not found: {manifest_path}")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("image_required") is not True or manifest.get("generic_placeholders_rejected") is not True:
        raise RuntimeError("crawler manifest does not prove strict image validation")

    endpoint = os.getenv("QROO_PRIVATE_INGEST_URL", DEFAULT_ENDPOINT)
    token = ""
    exp = 0
    totals = {
        "payload": 0,
        "valid": 0,
        "invalid": 0,
        "inserted": 0,
        "duplicate_or_existing": 0,
        "requests": 0,
    }

    chunk_files = [entry.get("file") for entry in manifest.get("chunks", []) if entry.get("file")]
    if not chunk_files:
        raise RuntimeError("manifest contains no crawl chunks")

    for chunk_name in chunk_files:
        chunk_path = out_dir / str(chunk_name)
        rows = json.loads(chunk_path.read_text(encoding="utf-8"))
        if not isinstance(rows, list):
            raise RuntimeError(f"chunk is not an array: {chunk_path}")

        for start in range(0, len(rows), BATCH_SIZE):
            batch = rows[start : start + BATCH_SIZE]
            if not token or exp <= int(time.time()) + 60:
                token, exp = request_oidc_token()
            response = post_batch(endpoint, token, batch)
            result = response["result"]
            totals["requests"] += 1
            for key in ("payload", "valid", "invalid", "inserted", "duplicate_or_existing"):
                totals[key] += int(result.get(key, 0) or 0)
            print(
                json.dumps(
                    {
                        "chunk": chunk_name,
                        "offset": start,
                        "batch": len(batch),
                        "result": result,
                        "run_id": response.get("run_id"),
                        "workflow_sha": response.get("workflow_sha"),
                    },
                    ensure_ascii=False,
                ),
                flush=True,
            )

    print(json.dumps({"summary": totals}, ensure_ascii=False), flush=True)
    if totals["invalid"] > 0:
        print("WARNING: invalid rows were rejected by the server", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
