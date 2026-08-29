#!/usr/bin/env python3
# LISTIA image-first crawl trigger: 2026-08-29
from __future__ import annotations

import importlib.util
import json
import os
import re
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

HERE = Path(__file__).resolve().parent
PARALLEL_SCRIPT = HERE / "crawl-quintana-roo-properties-parallel.py"
spec = importlib.util.spec_from_file_location("qroo_parallel", PARALLEL_SCRIPT)
if spec is None or spec.loader is None:
    raise RuntimeError("Unable to load Quintana Roo crawler")
parallel = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parallel)
base = parallel.base

BASE_URL = os.getenv("QROO_CRAWL_URL", parallel.BASE_URL)
OUT_DIR = Path(os.getenv("QROO_CRAWL_OUT", "data/qroo-crawl"))
CHUNK_SIZE = int(os.getenv("QROO_CHUNK_SIZE", "1500"))
MAX_PAGES = int(os.getenv("QROO_MAX_PAGES", "0"))
WORKERS = max(2, min(int(os.getenv("QROO_WORKERS", "14")), 24))

# A URL being syntactically valid is not enough to satisfy LISTIA's image rule.
# Known generic site assets/placeholders must never be accepted as property media.
BAD_IMAGE = re.compile(
    r"(?:logo|favicon|sprite|avatar|profile|icon|placeholder|default[-_]?image|"
    r"background[-_]?card|empty[-_]?card|fallback[-_]?image|no[-_]?image|no[-_]?photo|"
    r"sin[-_]?imagen|sin[-_]?foto|image[-_]?not[-_]?available|missing[-_]?image|"
    r"badge|spinner|loader|tracking|pixel|gravatar)",
    re.I,
)
IMAGE_ID = re.compile(r"(?<!\d)(\d{6,})(?!\d)")


def embedded_image_ids(url: str) -> set[str]:
    """Return property-like numeric IDs embedded in the image filename/path."""
    try:
        path = urlparse(url).path
    except Exception:
        path = url
    return set(IMAGE_ID.findall(path))


def image_belongs_to_listing(url: str, external_id: str, reuse_count: int = 1) -> bool:
    """Fail closed when a property photo is demonstrably tied to another listing.

    Propiedades.com often embeds the listing ID in image filenames. If such an ID
    exists, it must match. If the exact same image is mapped to multiple listings,
    only an explicitly matching listing may keep it; otherwise the mapping is
    ambiguous and every affected row is rejected.
    """
    ids = embedded_image_ids(url)
    if ids and external_id not in ids:
        return False
    if reuse_count > 1 and (not ids or external_id not in ids):
        return False
    return True


def image_url(img, page_url: str) -> str | None:
    values: list[str] = []
    for key in ("data-src", "data-lazy-src", "data-original", "src"):
        value = img.get(key)
        if value:
            values.append(str(value))
    for key in ("srcset", "data-srcset"):
        value = img.get(key)
        if value:
            values.extend(x.strip().split(" ")[0] for x in str(value).split(",") if x.strip())
    for raw in values:
        if not raw or raw.startswith("data:") or BAD_IMAGE.search(raw):
            continue
        try:
            resolved = urljoin(page_url, raw)
        except Exception:
            continue
        if BAD_IMAGE.search(resolved):
            continue
        if resolved.startswith(("http://", "https://")) and not resolved.lower().split("?")[0].endswith((".svg", ".ico")):
            return resolved
    return None


def media_map(html: str, page_url: str) -> dict[str, dict[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    found: dict[str, dict[str, str]] = {}
    for anchor in soup.find_all("a", href=True):
        href = str(anchor.get("href") or "")
        match = re.search(r"/inmuebles/[^?#]*-(\d{6,})(?:[/?#]|$)", href)
        if not match:
            continue
        ext_id = match.group(1)
        detail = urljoin(page_url, href)
        candidates = [anchor]
        node = anchor
        # Parent traversal is retained for template compatibility, but every image
        # is subsequently checked against listing identity and cross-row reuse.
        for _ in range(8):
            node = getattr(node, "parent", None)
            if node is None:
                break
            candidates.append(node)
        chosen = None
        for candidate in candidates:
            for img in candidate.find_all("img") if hasattr(candidate, "find_all") else []:
                chosen = image_url(img, page_url)
                if chosen:
                    break
            if chosen:
                break
        if chosen and ext_id not in found:
            found[ext_id] = {"cover_image_url": chosen, "detail_url": detail}
    return found


def parse_image_first(html: str, page_url: str) -> tuple[list[dict], int]:
    raw = base.parse_page(html, page_url)
    media = media_map(html, page_url)
    candidate_covers = {
        str(row.get("external_id") or ""): str((media.get(str(row.get("external_id") or "")) or {}).get("cover_image_url") or "")
        for row in raw
    }
    reuse = Counter(url for url in candidate_covers.values() if url)

    accepted: list[dict] = []
    rejected = 0
    for row in raw:
        ext_id = str(row.get("external_id") or "")
        m = media.get(ext_id)
        cover = (m or {}).get("cover_image_url")
        if (
            not cover
            or BAD_IMAGE.search(cover)
            or not image_belongs_to_listing(cover, ext_id, reuse.get(cover, 1))
        ):
            rejected += 1
            continue
        row["cover_image_url"] = cover
        row["gallery"] = [cover]
        row["page_url"] = (m or {}).get("detail_url") or row.get("page_url")
        accepted.append(row)
    return accepted, rejected


def crawl_one(page: int) -> tuple[int, str, list[dict], int]:
    url = BASE_URL if page == 1 else f"{BASE_URL}?pagina={page}"
    html = base.get_page(url)
    rows, rejected = parse_image_first(html, url)
    return page, url, rows, rejected


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("chunk-*.json"):
        old.unlink()

    first_html = base.get_page(BASE_URL)
    total_pages = base.discover_pages(first_html)
    if MAX_PAGES > 0:
        total_pages = min(total_pages, MAX_PAGES)
    print(f"Discovered {total_pages} pages; image-first; workers={WORKERS}", flush=True)

    by_id: dict[str, dict] = {}
    failures: list[dict] = []
    rejected_without_image = 0

    first_rows, first_rejected = parse_image_first(first_html, BASE_URL)
    rejected_without_image += first_rejected
    for row in first_rows:
        by_id[row["external_id"]] = row
    print(f"page=1/{total_pages} with_image={len(first_rows)} rejected_without_image={first_rejected}", flush=True)

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(crawl_one, page): page for page in range(2, total_pages + 1)}
        done = 1
        for fut in as_completed(futures):
            page = futures[fut]
            try:
                _, _, rows, rejected = fut.result()
                rejected_without_image += rejected
                for row in rows:
                    by_id[row["external_id"]] = row
                done += 1
                if done % 20 == 0 or done == total_pages:
                    print(f"progress={done}/{total_pages} last_page={page} with_image={len(rows)} unique={len(by_id)} rejected_without_image={rejected_without_image}", flush=True)
            except Exception as exc:
                url = BASE_URL if page == 1 else f"{BASE_URL}?pagina={page}"
                failures.append({"page": page, "url": url, "error": str(exc)})
                done += 1
                print(f"WARN page={page}: {exc}", file=sys.stderr, flush=True)

    # Cross-page fail-closed pass: a repeated exact cover URL is ambiguous unless
    # its filename explicitly identifies the current listing.
    cover_reuse = Counter(str(row.get("cover_image_url") or "") for row in by_id.values() if row.get("cover_image_url"))
    globally_valid: list[dict] = []
    rejected_ambiguous_reused_image = 0
    for row in by_id.values():
        cover = str(row.get("cover_image_url") or "")
        ext_id = str(row.get("external_id") or "")
        if not image_belongs_to_listing(cover, ext_id, cover_reuse.get(cover, 1)):
            rejected_ambiguous_reused_image += 1
            continue
        globally_valid.append(row)

    rows = sorted(globally_valid, key=lambda x: int(x["external_id"]))
    rejected_without_image += rejected_ambiguous_reused_image
    chunks = []
    for start in range(0, len(rows), CHUNK_SIZE):
        part = rows[start:start + CHUNK_SIZE]
        name = f"chunk-{start // CHUNK_SIZE + 1:04d}.json"
        (OUT_DIR / name).write_text(json.dumps(part, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        chunks.append({"file": name, "count": len(part)})

    manifest = {
        "source": "qroo-public-marketplace-crawl-image-first",
        "base_url": BASE_URL,
        "pages_attempted": total_pages,
        "unique_listings": len(rows),
        "rejected_without_image": rejected_without_image,
        "rejected_ambiguous_reused_image": rejected_ambiguous_reused_image,
        "chunks": chunks,
        "failures": failures,
        "workers": WORKERS,
        "image_required": True,
        "generic_placeholders_rejected": True,
        "image_listing_binding_enforced": True,
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        "unique_listings": len(rows),
        "chunks": len(chunks),
        "rejected_without_image": rejected_without_image,
        "rejected_ambiguous_reused_image": rejected_ambiguous_reused_image,
        "failures": len(failures),
    }), flush=True)
    return 0 if rows else 2


if __name__ == "__main__":
    raise SystemExit(main())
