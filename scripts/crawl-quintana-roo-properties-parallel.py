#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

HERE = Path(__file__).resolve().parent
BASE_SCRIPT = HERE / "crawl-quintana-roo-properties.py"
spec = importlib.util.spec_from_file_location("qroo_base", BASE_SCRIPT)
if spec is None or spec.loader is None:
    raise RuntimeError("Unable to load base crawler")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

BASE_URL = os.getenv("QROO_CRAWL_URL", base.BASE_URL)
OUT_DIR = Path(os.getenv("QROO_CRAWL_OUT", "data/qroo-crawl"))
CHUNK_SIZE = int(os.getenv("QROO_CHUNK_SIZE", "1500"))
MAX_PAGES = int(os.getenv("QROO_MAX_PAGES", "0"))
WORKERS = max(2, min(int(os.getenv("QROO_WORKERS", "14")), 24))


def crawl_one(page: int) -> tuple[int, str, list[dict]]:
    url = BASE_URL if page == 1 else f"{BASE_URL}?pagina={page}"
    html = base.get_page(url)
    return page, url, base.parse_page(html, url)


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("chunk-*.json"):
        old.unlink()

    first_html = base.get_page(BASE_URL)
    total_pages = base.discover_pages(first_html)
    if MAX_PAGES > 0:
        total_pages = min(total_pages, MAX_PAGES)
    print(f"Discovered {total_pages} pages; workers={WORKERS}", flush=True)

    by_id: dict[str, dict] = {}
    failures: list[dict] = []

    first_rows = base.parse_page(first_html, BASE_URL)
    for row in first_rows:
        by_id[row["external_id"]] = row
    print(f"page=1/{total_pages} parsed={len(first_rows)} unique={len(by_id)}", flush=True)

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(crawl_one, page): page for page in range(2, total_pages + 1)}
        done = 1
        for fut in as_completed(futures):
            page = futures[fut]
            try:
                _, url, rows = fut.result()
                for row in rows:
                    by_id[row["external_id"]] = row
                done += 1
                if done % 20 == 0 or done == total_pages:
                    print(f"progress={done}/{total_pages} last_page={page} parsed={len(rows)} unique={len(by_id)}", flush=True)
            except Exception as exc:  # noqa: BLE001
                url = BASE_URL if page == 1 else f"{BASE_URL}?pagina={page}"
                failures.append({"page": page, "url": url, "error": str(exc)})
                done += 1
                print(f"WARN page={page}: {exc}", file=sys.stderr, flush=True)

    rows = sorted(by_id.values(), key=lambda x: int(x["external_id"]))
    chunks = []
    for start in range(0, len(rows), CHUNK_SIZE):
        part = rows[start:start + CHUNK_SIZE]
        name = f"chunk-{start // CHUNK_SIZE + 1:04d}.json"
        (OUT_DIR / name).write_text(
            json.dumps(part, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        chunks.append({"file": name, "count": len(part)})

    manifest = {
        "source": "qroo-public-marketplace-crawl",
        "base_url": BASE_URL,
        "pages_attempted": total_pages,
        "unique_listings": len(rows),
        "chunks": chunks,
        "failures": failures,
        "workers": WORKERS,
    }
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps({"unique_listings": len(rows), "chunks": len(chunks), "failures": len(failures)}), flush=True)
    return 0 if rows else 2


if __name__ == "__main__":
    raise SystemExit(main())
