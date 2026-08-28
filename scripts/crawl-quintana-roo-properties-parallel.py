#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import os
import re
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


def fixed_parse_numbers(lines: list[str], property_type: str):
    # Result cards split values and labels into separate DOM nodes. Join with spaces so
    # "2" + "Recámaras" becomes parseable, and never treat a bare external ID as a bedroom count.
    joined = " ".join(lines)
    bedrooms = None
    bathrooms = None
    area = None

    m = re.search(r"(?:^|\s)([0-9]+(?:\.[0-9]+)?)\s*Rec[aá]maras?\b", joined, re.I)
    if m and property_type not in ("land", "building", "commercial"):
        bedrooms = float(m.group(1))
    m = re.search(r"(?:^|\s)([0-9]+(?:\.[0-9]+)?)\s*Baños?\b", joined, re.I)
    if m:
        bathrooms = float(m.group(1))

    area_matches = re.findall(r"([0-9][0-9.,]*)\s*m(?:²|2|\^\{2\})\b", joined, re.I)
    parsed_areas = []
    for raw in area_matches:
        try:
            value = float(raw.replace(",", ""))
            if 0 < value <= 100000000:
                parsed_areas.append(value)
        except ValueError:
            pass
    if parsed_areas:
        area = parsed_areas[-1]
    return bedrooms, bathrooms, area


def fixed_infer_city(location: str):
    # Most-specific place names must win over corridor text such as "Cancún - Tulum".
    folded = base.strip_accents(location).lower()
    city_rules = [
        ("puerto aventuras", "Puerto Aventuras", "Solidaridad"),
        ("puerto morelos", "Puerto Morelos", "Puerto Morelos"),
        ("costa mujeres", "Costa Mujeres", "Isla Mujeres"),
        ("isla mujeres", "Isla Mujeres", "Isla Mujeres"),
        ("playa del carmen", "Playa del Carmen", "Solidaridad"),
        ("akumal", "Akumal", "Tulum"),
        ("cozumel", "Cozumel", "Cozumel"),
        ("bacalar", "Bacalar", "Bacalar"),
        ("mahahual", "Mahahual", "Othón P. Blanco"),
        ("majahual", "Mahahual", "Othón P. Blanco"),
        ("chetumal", "Chetumal", "Othón P. Blanco"),
        ("holbox", "Holbox", "Lázaro Cárdenas"),
        ("felipe carrillo puerto", "Felipe Carrillo Puerto", "Felipe Carrillo Puerto"),
        ("jose maria morelos", "José María Morelos", "José María Morelos"),
        ("tulum", "Tulum", "Tulum"),
        ("cancun", "Cancún", "Benito Juárez"),
    ]
    for needle, city, municipality in city_rules:
        if needle in folded:
            return city, municipality
    for municipality in base.KNOWN_MUNICIPALITIES:
        if base.strip_accents(municipality).lower() in folded:
            return municipality, municipality
    return None, None


base.parse_numbers_from_lines = fixed_parse_numbers
base.infer_city = fixed_infer_city


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
