#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

HERE = Path(__file__).resolve().parent
BASE_PATH = HERE / "crawl-qroo-direct-sources.py"
spec = importlib.util.spec_from_file_location("qroo_direct_base", BASE_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError("Unable to load direct-source crawler")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)


def improved_crawl_source(source: dict):
    roots = [base.clean(x) for x in source.get("crawl_roots", []) if base.clean(x)]
    source_url = base.clean(source.get("source_url"))
    robots, announced = base.robots_for(source_url)
    candidates = base.sitemap_candidates(source_url, robots, announced)
    for root in roots:
        if base.same_host(root, source_url):
            candidates.update(base.archive_candidates(root, robots))
    candidates = {u for u in candidates if base.same_host(u, source_url) and base.can_fetch(robots, u)}
    ordered = sorted(
        candidates,
        key=lambda u: (0 if base.PROPERTY_PATH.search(base.urlparse(u).path) else 1, len(u), u),
    )[: base.MAX_DETAILS]

    parsed_rows: list[dict] = []
    failures: list[dict] = []
    with ThreadPoolExecutor(max_workers=base.WORKERS) as pool:
        futures = {pool.submit(base.parse_detail, source, url, robots): url for url in ordered}
        for future in as_completed(futures):
            url = futures[future]
            try:
                row = future.result()
                if row:
                    parsed_rows.append(row)
            except Exception as exc:
                failures.append({"source": source.get("name"), "url": url, "error": str(exc)})

    # A shared hero image must not destroy an otherwise valid listing. Count every
    # gallery image across parsed listings and select the first image unique to that
    # listing. If no image in the gallery is unique, reject the listing entirely.
    image_counts: dict[str, int] = {}
    for row in parsed_rows:
        for image in dict.fromkeys(row.get("gallery") or []):
            image_counts[image] = image_counts.get(image, 0) + 1

    recovered = 0
    rejected_no_unique = 0
    rows: list[dict] = []
    for row in parsed_rows:
        original_cover = row.get("cover_image_url")
        unique_gallery = [img for img in dict.fromkeys(row.get("gallery") or []) if image_counts.get(img, 0) == 1]
        if not unique_gallery:
            rejected_no_unique += 1
            continue
        row["cover_image_url"] = unique_gallery[0]
        row["gallery"] = unique_gallery[:10]
        if original_cover != row["cover_image_url"]:
            recovered += 1
        rows.append(row)

    by_slug = {row["slug"]: row for row in rows}
    fingerprint_rows = [
        {
            "slug": row.get("slug"),
            "title": row.get("title"),
            "price": row.get("price"),
            "currency": row.get("currency"),
            "cover_image_url": row.get("cover_image_url"),
        }
        for row in sorted(by_slug.values(), key=lambda item: str(item.get("slug") or ""))
    ]
    content_hash = base.hashlib.sha256(
        base.json.dumps(fingerprint_rows, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    meta = {
        "name": source.get("name"),
        "source_url": source_url,
        "candidates": len(ordered),
        "parsed_before_image_binding": len(parsed_rows),
        "accepted": len(by_slug),
        "recovered_unique_gallery_cover": recovered,
        "rejected_no_unique_image": rejected_no_unique,
        "failures": len(failures),
        "content_hash": content_hash,
    }
    return list(by_slug.values()), meta, failures


base.crawl_source = improved_crawl_source

if __name__ == "__main__":
    raise SystemExit(base.main())
