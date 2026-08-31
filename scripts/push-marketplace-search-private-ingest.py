#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

AUDIENCE = "listia-marketplace-search-ingest"
DEFAULT_ENDPOINT = "https://zvzafiarwerbuoaccnoz.supabase.co/functions/v1/marketplace-search-private-ingest"
TIMEOUT = 75


def decode_exp(token: str) -> int:
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        return int(json.loads(base64.urlsafe_b64decode(payload.encode()))["exp"])
    except Exception:
        return 0


def request_oidc_token() -> tuple[str, int]:
    base = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL")
    req_token = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
    if not base or not req_token:
        raise RuntimeError("GitHub OIDC environment unavailable; workflow requires id-token: write")
    sep = "&" if "?" in base else "?"
    req = urllib.request.Request(
        f"{base}{sep}audience={urllib.parse.quote(AUDIENCE)}",
        headers={"Authorization": f"Bearer {req_token}", "Accept": "application/json"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    token = data.get("value")
    if not isinstance(token, str) or token.count(".") != 2:
        raise RuntimeError("GitHub OIDC response did not contain a JWT")
    return token, decode_exp(token)


def post(endpoint: str, token: str, seed_ref: str, channel: str, batch: list[dict]) -> dict:
    body = json.dumps({"seed_ref": seed_ref, "channel": channel, "batch": batch}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "LISTIA-Real-Estate-Search-GitHub-Actions/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        text = exc.read().decode("utf-8", errors="replace")[:3000]
        raise RuntimeError(f"marketplace search ingest HTTP {exc.code}: {text}") from exc
    if data.get("ok") is not True or not isinstance(data.get("result"), dict):
        raise RuntimeError(f"unexpected ingest response: {data}")
    return data


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("payload")
    ap.add_argument("--channel", default="real_estate_search")
    ap.add_argument("--batch-size", type=int, default=100)
    args = ap.parse_args()

    payload = json.loads(Path(args.payload).read_text(encoding="utf-8"))
    items = payload.get("items")
    if not isinstance(items, list) or not items:
        raise RuntimeError("prepared payload has no items")
    seed_ref = str(payload.get("seed_ref") or "")[:3000]
    batch_size = max(1, min(args.batch_size, 250))
    endpoint = os.getenv("LISTIA_MARKETPLACE_SEARCH_INGEST_URL", DEFAULT_ENDPOINT)

    token = ""
    exp = 0
    totals = {"requests": 0, "payload": 0, "imported": 0, "updated": 0, "needs_review": 0, "invalid": 0, "contacts": 0, "observations": 0}
    run_ids: list[str] = []
    for start in range(0, len(items), batch_size):
        batch = items[start:start + batch_size]
        if not token or exp <= int(time.time()) + 60:
            token, exp = request_oidc_token()
        response = post(endpoint, token, seed_ref, args.channel, batch)
        result = response["result"]
        totals["requests"] += 1
        for key in ("payload", "imported", "updated", "needs_review", "invalid", "contacts", "observations"):
            totals[key] += int(result.get(key, 0) or 0)
        if result.get("run_id"):
            run_ids.append(str(result["run_id"]))
        print(json.dumps({"offset": start, "batch": len(batch), "result": result}, ensure_ascii=False), flush=True)

    print(json.dumps({"summary": totals, "run_ids": run_ids, "seed_ref": seed_ref}, ensure_ascii=False), flush=True)
    return 0 if totals["invalid"] == 0 else 3


if __name__ == "__main__":
    raise SystemExit(main())
