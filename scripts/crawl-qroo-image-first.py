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
# Fail closed: detail-page recovery is prepared but has not passed a live workflow smoke test.
# It must be explicitly enabled by the controlled workflow when QA is being performed.
DETAIL_FALLBACK = os.getenv("QROO_DETAIL_IMAGE_FALLBACK", "0").strip().lower() not in {"0", "false", "off", "no"}
MAX_DETAIL_IMAGES = max(1, min(int(os.getenv("QROO_MAX_DETAIL_IMAGES", "12")), 24))

BAD_IMAGE = re.compile(
    r"(?:logo|favicon|sprite|avatar|profile|icon|placeholder|default[-_]?image|"
    r"background[-_]?card|empty[-_]?card|fallback[-_]?image|no[-_]?image|no[-_]?photo|"
    r"sin[-_]?imagen|sin[-_]?foto|image[-_]?not[-_]?available|missing[-_]?image|"
    r"badge|spinner|loader|tracking|pixel|gravatar)",
    re.I,
)
IMAGE_ID = re.compile(r"(?<!\d)(\d{6,})(?!\d)")


def embedded_image_ids(url: str) -> set[str]:
    try:
        path = urlparse(url).path
    except Exception:
        path = url
    return set(IMAGE_ID.findall(path))


def image_belongs_to_listing(url: str, external_id: str, reuse_count: int = 1) -> bool:
    ids = embedded_image_ids(url)
    if ids and external_id not in ids:
        return False
    if reuse_count > 1 and (not ids or external_id not in ids):
        return False
    return True


def normalized_image_url(raw: str | None, page_url: str) -> str | None:
    if not raw:
        return None
    raw = str(raw).strip()
    if not raw or raw.startswith("data:") or BAD_IMAGE.search(raw):
        return None
    try:
        resolved = urljoin(page_url, raw)
    except Exception:
        return None
    if BAD_IMAGE.search(resolved):
        return None
    if not resolved.startswith(("http://", "https://")):
        return None
    if resolved.lower().split("?")[0].endswith((".svg", ".ico")):
        return None
    return resolved


def image_url(img, page_url: str) -> str | None:
    values: list[str] = []
    for key in ("data-src", "data-lazy-src", "data-original", "data-image", "src"):
        value = img.get(key)
        if value:
            values.append(str(value))
    for key in ("srcset", "data-srcset"):
        value = img.get(key)
        if value:
            values.extend(x.strip().split(" ")[0] for x in str(value).split(",") if x.strip())
    for raw in values:
        resolved = normalized_image_url(raw, page_url)
        if resolved:
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
        if ext_id not in found:
            found[ext_id] = {"detail_url": detail}
        if chosen and "cover_image_url" not in found[ext_id]:
            found[ext_id]["cover_image_url"] = chosen
    return found


def _collect_json_images(value, out: list[str]) -> None:
    if isinstance(value, dict):
        for key, item in value.items():
            if str(key).lower() in {"image", "images", "contenturl", "thumbnailurl"}:
                _collect_json_images(item, out)
            elif isinstance(item, (dict, list)):
                _collect_json_images(item, out)
    elif isinstance(value, list):
        for item in value:
            _collect_json_images(item, out)
    elif isinstance(value, str):
        out.append(value)


def detail_media(detail_url: str, external_id: str) -> dict[str, object] | None:
    if not DETAIL_FALLBACK or not detail_url:
        return None
    try:
        html = base.get_page(detail_url)
    except Exception as exc:
        print(f"WARN detail_image_fetch id={external_id}: {exc}", file=sys.stderr, flush=True)
        return None

    soup = BeautifulSoup(html, "html.parser")
    raw_candidates: list[str] = []

    for selector in (
        ('meta', {'property': 'og:image'}),
        ('meta', {'property': 'og:image:secure_url'}),
        ('meta', {'name': 'twitter:image'}),
        ('meta', {'itemprop': 'image'}),
    ):
        for node in soup.find_all(selector[0], attrs=selector[1]):
            value = node.get('content')
            if value:
                raw_candidates.append(str(value))

    for node in soup.find_all('link', attrs={'rel': lambda v: v and 'image_src' in v if isinstance(v, list) else v == 'image_src'}):
        value = node.get('href')
        if value:
            raw_candidates.append(str(value))

    for script in soup.find_all('script', attrs={'type': 'application/ld+json'}):
        try:
            parsed = json.loads(script.string or script.get_text() or '{}')
        except Exception:
            continue
        _collect_json_images(parsed, raw_candidates)

    for img in soup.find_all('img'):
        for key in ('data-src', 'data-lazy-src', 'data-original', 'data-image', 'src'):
            value = img.get(key)
            if value:
                raw_candidates.append(str(value))
        for key in ('srcset', 'data-srcset'):
            value = img.get(key)
            if value:
                raw_candidates.extend(x.strip().split(' ')[0] for x in str(value).split(',') if x.strip())

    gallery: list[str] = []
    seen: set[str] = set()
    for raw in raw_candidates:
        url = normalized_image_url(raw, detail_url)
        if not url or url in seen:
            continue
        if not image_belongs_to_listing(url, external_id, 1):
            continue
        seen.add(url)
        gallery.append(url)
        if len(gallery) >= MAX_DETAIL_IMAGES:
            break

    if not gallery:
        return None
    return {"cover_image_url": gallery[0], "gallery": gallery, "detail_url": detail_url}


def parse_image_first(html: str, page_url: str) -> tuple[list[dict], int, int]:
    raw = base.parse_page(html, page_url)
    media = media_map(html, page_url)
    candidate_covers = {
        str(row.get("external_id") or ""): str((media.get(str(row.get("external_id") or "")) or {}).get("cover_image_url") or "")
        for row in raw
    }
    reuse = Counter(url for url in candidate_covers.values() if url)

    accepted: list[dict] = []
    rejected = 0
    recovered_from_detail = 0

    for row in raw:
        ext_id = str(row.get("external_id") or "")
        m = media.get(ext_id) or {}
        cover = str(m.get("cover_image_url") or "")
        detail_url = str(m.get("detail_url") or "")
        gallery: list[str] = [cover] if cover else []

        card_media_valid = bool(
            cover
            and not BAD_IMAGE.search(cover)
            and image_belongs_to_listing(cover, ext_id, reuse.get(cover, 1))
        )

        if not card_media_valid:
            recovered = detail_media(detail_url, ext_id)
            if recovered:
                cover = str(recovered["cover_image_url"])
                gallery = [str(x) for x in recovered.get("gallery", [])]
                detail_url = str(recovered.get("detail_url") or detail_url)
                recovered_from_detail += 1
            else:
                rejected += 1
                continue

        row["cover_image_url"] = cover
        row["gallery"] = gallery or [cover]
        row["page_url"] = detail_url or row.get("page_url")
        accepted.append(row)

    return accepted, rejected, recovered_from_detail


def crawl_one(page: int) -> tuple[int, str, list[dict], int, int]:
    url = BASE_URL if page == 1 else f"{BASE_URL}?pagina={page}"
    html = base.get_page(url)
    rows, rejected, recovered = parse_image_first(html, url)
    return page, url, rows, rejected, recovered


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("chunk-*.json"):
        old.unlink()

    first_html = base.get_page(BASE_URL)
    total_pages = base.discover_pages(first_html)
    if MAX_PAGES > 0:
        total_pages = min(total_pages, MAX_PAGES)
    print(f"Discovered {total_pages} pages; image-first; detail_fallback={DETAIL_FALLBACK}; workers={WORKERS}", flush=True)

    by_id: dict[str, dict] = {}
    failures: list[dict] = []
    rejected_without_image = 0
    recovered_from_detail_pages = 0

    first_rows, first_rejected, first_recovered = parse_image_first(first_html, BASE_URL)
    rejected_without_image += first_rejected
    recovered_from_detail_pages += first_recovered
    for row in first_rows:
        by_id[row["external_id"]] = row
    print(f"page=1/{total_pages} with_image={len(first_rows)} rejected_without_image={first_rejected} recovered_detail={first_recovered}", flush=True)

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(crawl_one, page): page for page in range(2, total_pages + 1)}
        done = 1
        for fut in as_completed(futures):
            page = futures[fut]
            try:
                _, _, rows, rejected, recovered = fut.result()
                rejected_without_image += rejected
                recovered_from_detail_pages += recovered
                for row in rows:
                    by_id[row["external_id"]] = row
                done += 1
                if done % 20 == 0 or done == total_pages:
                    print(f"progress={done}/{total_pages} last_page={page} with_image={len(rows)} unique={len(by_id)} rejected_without_image={rejected_without_image} recovered_detail={recovered_from_detail_pages}", flush=True)
            except Exception as exc:
                url = BASE_URL if page == 1 else f"{BASE_URL}?pagina={page}"
                failures.append({"page": page, "url": url, "error": str(exc)})
                done += 1
                print(f"WARN page={page}: {exc}", file=sys.stderr, flush=True)

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
        "recovered_from_detail_pages": recovered_from_detail_pages,
        "chunks": chunks,
        "failures": failures,
        "workers": WORKERS,
        "image_required": True,
        "generic_placeholders_rejected": True,
        "image_listing_binding_enforced": True,
        "detail_page_image_fallback": DETAIL_FALLBACK,
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        "unique_listings": len(rows),
        "chunks": len(chunks),
        "rejected_without_image": rejected_without_image,
        "rejected_ambiguous_reused_image": rejected_ambiguous_reused_image,
        "recovered_from_detail_pages": recovered_from_detail_pages,
        "failures": len(failures),
    }), flush=True)
    return 0 if rows else 2


if __name__ == "__main__":
    raise SystemExit(main())
