#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from curl_cffi import requests

ROOTS = [
    ("sale", "https://properties.iadmexico.mx/en-venta"),
    ("rent", "https://properties.iadmexico.mx/en-renta"),
]
OUT_DIR = Path(os.getenv("IAD_OUT", "data/iad-mexico"))
MAX_PAGES = int(os.getenv("IAD_MAX_PAGES", "0"))
WORKERS = max(2, min(int(os.getenv("IAD_WORKERS", "10")), 16))
CHUNK_SIZE = int(os.getenv("IAD_CHUNK_SIZE", "250"))


def fetch(url: str, attempts: int = 4) -> str:
    last = None
    for n in range(attempts):
        try:
            r = requests.get(
                url,
                impersonate="chrome",
                timeout=40,
                headers={"accept-language": "es-MX,es;q=0.9,en;q=0.7"},
            )
            if r.status_code == 200 and "NEX-" in r.text:
                return r.text
            last = RuntimeError(f"HTTP {r.status_code}, bytes={len(r.content)}")
        except Exception as exc:
            last = exc
        time.sleep(1.0 * (n + 1))
    raise RuntimeError(f"unable to fetch {url}: {last}")


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def abs_url(base: str, value: str | None) -> str | None:
    return urljoin(base, value) if value else None


def image_url(img, base: str) -> str | None:
    for key in ("data-src", "data-lazy-src", "src"):
        value = img.get(key)
        if value and not str(value).startswith("data:"):
            return abs_url(base, str(value))
    srcset = img.get("srcset") or img.get("data-srcset")
    if srcset:
        return abs_url(base, str(srcset).split(",")[0].strip().split(" ")[0])
    return None


def number(raw: str | None) -> float | None:
    if not raw:
        return None
    try:
        return float(raw.replace(",", "").strip())
    except Exception:
        return None


def card_for(img):
    node = img
    fallback = img.parent
    for _ in range(12):
        node = getattr(node, "parent", None)
        if node is None:
            break
        text = clean(" ".join(node.stripped_strings))
        if len(text) < 5000:
            fallback = node
        if len(text) < 3500 and re.search(r"\$\s*[\d,.]+", text) and re.search(r"\b(?:Venta|Renta)\b", text, re.I):
            return node
    return fallback


def metrics_from_alt(alt: str):
    low = alt.lower()
    ptype = "property"
    if "departamento" in low or "depto" in low:
        ptype = "apartment"
    elif "casa" in low:
        ptype = "house"
    elif "terreno" in low:
        ptype = "land"
    elif "local" in low or "oficina" in low:
        ptype = "commercial"

    def grab(pattern):
        m = re.search(pattern, alt, re.I)
        return number(m.group(1)) if m else None

    return (
        ptype,
        grab(r"con\s+([\d.,]+)\s+rec[aá]maras?"),
        grab(r"con\s+([\d.,]+)\s+baños?"),
        grab(r"con\s+([\d.,]+)\s+m2\s+de\s+construcci[oó]n"),
    )


def detail_link(card, img, base: str, nex: str) -> str | None:
    choices = []
    for a in card.find_all("a", href=True):
        href = str(a.get("href") or "")
        full = abs_url(base, href)
        if not full:
            continue
        score = (10 if nex in href else 0) + (3 if urlparse(full).netloc.endswith("iadmexico.mx") else 0)
        choices.append((score, full))
    parent = img.find_parent("a", href=True)
    if parent:
        choices.append((8, abs_url(base, str(parent.get("href")))))
    choices = [(s, u) for s, u in choices if u]
    return max(choices, default=(0, None), key=lambda x: x[0])[1]


def title_from_card(card, alt: str) -> str:
    values = []
    for tag in card.find_all(["h1", "h2", "h3", "h4", "h5", "p", "a"]):
        text = clean(" ".join(tag.stripped_strings))
        if not 8 <= len(text) <= 300:
            continue
        if "$" in text or "NEX-" in text.upper():
            continue
        if re.fullmatch(r"(?:Venta|Renta|Casa|Depto\.?|Departamento|Terreno|Local|Oficina|Ver más)", text, re.I):
            continue
        if any(x in text for x in ("Recamara", "Recámaras", "Sanitario", "Construcción")):
            continue
        values.append(text)
    if values:
        return max(values, key=lambda x: min(len(x), 140))[:300]
    return re.sub(r"^NEX-\d+\s*-\s*", "", alt).strip()[:300] or "Propiedad"


def parse_card(img, operation: str, page_url: str):
    alt = clean(str(img.get("alt") or ""))
    match = re.search(r"NEX-(\d+)", alt, re.I)
    if not match:
        return None
    external_id = match.group(1)
    card = card_for(img)
    text = clean(" | ".join(card.stripped_strings))
    ptype, bedrooms, bathrooms, area = metrics_from_alt(alt)

    price = None
    currency = "MXN"
    pm = re.search(r"\$\s*([\d,]+(?:\.\d+)?)\s*(MXN|USD)?", text, re.I)
    if pm:
        price = number(pm.group(1))
        if pm.group(2):
            currency = pm.group(2).upper()

    def metric(pattern):
        m = re.search(rf"(?:{pattern})\s*([\d.,]+)|([\d.,]+)\s*(?:{pattern})", text, re.I)
        return number(m.group(1) or m.group(2)) if m else None

    if bedrooms is None:
        bedrooms = metric(r"Rec[aá]maras?")
    if bathrooms is None:
        bathrooms = metric(r"Sanitarios?|Baños?")
    if area is None:
        area = metric(r"M²\s*Construcci[oó]n|m2\s*de\s*construcci[oó]n|m²\s*de\s*construcci[oó]n")
    parking = metric(r"Prkg|Estacionamientos?")
    land = metric(r"M²\s*Terreno|m2\s*de\s*terreno|m²\s*de\s*terreno")

    cover = image_url(img, page_url)
    title = title_from_card(card, alt)
    return {
        "nex_id": f"NEX-{external_id}",
        "external_id": external_id,
        "operation_type": operation,
        "property_type": ptype,
        "title": title,
        "description": title,
        "price": price,
        "currency": currency,
        "bedrooms": bedrooms,
        "bathrooms": bathrooms,
        "parking_spaces": parking,
        "area_m2": area,
        "land_m2": land,
        "detail_url": detail_link(card, img, page_url, external_id),
        "cover_image_url": cover,
        "gallery": [cover] if cover else [],
        "country_code": "MX",
    }


def parse_page(html: str, operation: str, page_url: str):
    soup = BeautifulSoup(html, "html.parser")
    rows = {}
    for img in soup.find_all("img"):
        if "NEX-" not in str(img.get("alt") or "").upper():
            continue
        row = parse_card(img, operation, page_url)
        if row:
            rows[row["nex_id"]] = row
    return list(rows.values()), soup


def reported_total(soup: BeautifulSoup) -> int | None:
    text = clean(" ".join(soup.stripped_strings))
    for pattern in (r"tiene\s+([\d,]+)\s+Inmuebles", r"([\d,]+)\s+Inmuebles\s+en\s+(?:venta|renta)"):
        m = re.search(pattern, text, re.I)
        if m:
            return int(m.group(1).replace(",", ""))
    return None


def pagination_pattern(root: str, first_ids: set[str], operation: str) -> str | None:
    for pattern in (f"{root}?page={{}}", f"{root}?pagina={{}}", f"{root}?p={{}}"):
        try:
            url = pattern.format(2)
            rows, _ = parse_page(fetch(url), operation, url)
            ids = {r["nex_id"] for r in rows}
            if ids and ids != first_ids:
                return pattern
        except Exception:
            pass
    return None


def crawl(operation: str, root: str):
    first_html = fetch(root)
    first_rows, soup = parse_page(first_html, operation, root)
    first_ids = {r["nex_id"] for r in first_rows}
    total = reported_total(soup)
    per_page = max(1, len(first_rows))
    pages = math.ceil(total / per_page) if total else 1
    if MAX_PAGES > 0:
        pages = min(pages, MAX_PAGES)
    pattern = pagination_pattern(root, first_ids, operation) if pages > 1 else None
    urls = [root] if not pattern else [root] + [pattern.format(i) for i in range(2, pages + 1)]

    by_id = {r["nex_id"]: r for r in first_rows}
    failures = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(fetch, url): url for url in urls[1:]}
        for future in as_completed(futures):
            url = futures[future]
            try:
                rows, _ = parse_page(future.result(), operation, url)
                for row in rows:
                    by_id[row["nex_id"]] = row
            except Exception as exc:
                failures.append({"url": url, "error": str(exc)})
    return list(by_id.values()), failures, {"pages": len(urls), "reported_total": total, "per_page": per_page}


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("chunk-*.json"):
        old.unlink()

    all_rows = {}
    failures = []
    summary = []
    for operation, root in ROOTS:
        rows, errs, meta = crawl(operation, root)
        for row in rows:
            # Same NEX can legitimately be available for both sale and rent.
            all_rows[f"{row['nex_id']}:{operation}"] = row
        failures.extend(errs)
        summary.append({"operation": operation, "root": root, "rows": len(rows), **meta})

    rows = sorted(all_rows.values(), key=lambda r: (int(r["external_id"]), r["operation_type"]))
    chunks = []
    for start in range(0, len(rows), CHUNK_SIZE):
        part = rows[start:start + CHUNK_SIZE]
        name = f"chunk-{start // CHUNK_SIZE + 1:04d}.json"
        (OUT_DIR / name).write_text(json.dumps(part, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        chunks.append({"file": name, "count": len(part)})

    manifest = {
        "source": "iad-mexico-neximo",
        "rows": len(rows),
        "summary": summary,
        "chunks": chunks,
        "failures": failures,
        "photo_mode": "public_watermarked_card_url",
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False))
    return 0 if rows else 2


if __name__ == "__main__":
    raise SystemExit(main())
