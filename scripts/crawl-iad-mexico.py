#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urljoin, urlparse, parse_qs

from bs4 import BeautifulSoup
from curl_cffi import requests

ROOTS = [
    ("sale", "https://properties.iadmexico.mx/en-venta"),
    ("rent", "https://properties.iadmexico.mx/en-renta"),
]
OUT_DIR = Path(os.getenv("IAD_OUT", "data/iad-mexico"))
MAX_PAGES = int(os.getenv("IAD_MAX_PAGES", "1"))
DETAILS = os.getenv("IAD_FETCH_DETAILS", "0") == "1"
WORKERS = max(2, min(int(os.getenv("IAD_WORKERS", "6")), 12))
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
        time.sleep(1.5 * (n + 1))
    raise RuntimeError(f"unable to fetch {url}: {last}")


def abs_url(base: str, value: str | None) -> str | None:
    if not value:
        return None
    return urljoin(base, value)


def img_url(img, base: str) -> str | None:
    for key in ("data-src", "data-lazy-src", "src"):
        v = img.get(key)
        if v and not str(v).startswith("data:"):
            return abs_url(base, str(v))
    srcset = img.get("srcset") or img.get("data-srcset")
    if srcset:
        first = str(srcset).split(",")[0].strip().split(" ")[0]
        return abs_url(base, first)
    return None


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def nearest_card(img):
    node = img
    fallback = img.parent
    for _ in range(12):
        node = getattr(node, "parent", None)
        if node is None:
            break
        text = clean(" ".join(node.stripped_strings))
        if not text:
            continue
        if len(text) < 5000:
            fallback = node
        has_price = bool(re.search(r"\$\s*[\d,.]+", text))
        has_operation = bool(re.search(r"\b(?:Venta|Renta)\b", text, re.I))
        if has_price and has_operation and len(text) < 3500:
            return node
    return fallback


def parse_float(raw: str | None) -> float | None:
    if not raw:
        return None
    raw = raw.replace(",", "").strip()
    try:
        return float(raw)
    except Exception:
        return None


def parse_alt_metrics(alt: str):
    folded = alt.lower()
    ptype = "property"
    if "departamento" in folded or "depto" in folded:
        ptype = "apartment"
    elif "casa" in folded:
        ptype = "house"
    elif "terreno" in folded:
        ptype = "land"
    elif "local" in folded or "oficina" in folded:
        ptype = "commercial"

    def grab(pattern: str):
        m = re.search(pattern, alt, re.I)
        return parse_float(m.group(1)) if m else None

    bedrooms = grab(r"con\s+([\d.,]+)\s+rec[aá]maras?")
    bathrooms = grab(r"con\s+([\d.,]+)\s+baños?")
    area = grab(r"con\s+([\d.,]+)\s+m2\s+de\s+construcci[oó]n")
    return ptype, bedrooms, bathrooms, area


def best_title(card, alt: str) -> str:
    candidates = []
    for tag in card.find_all(["h1", "h2", "h3", "h4", "h5", "p", "a"]):
        t = clean(" ".join(tag.stripped_strings))
        if not t or len(t) < 8 or len(t) > 320:
            continue
        if "$" in t or "NEX-" in t.upper():
            continue
        if re.fullmatch(r"(?:Venta|Renta|Casa|Depto\.?|Departamento|Terreno|Local|Oficina|Ver más)", t, re.I):
            continue
        if any(x in t for x in ("Recamara", "Recámaras", "Sanitario", "Construcción", "Terreno")):
            continue
        candidates.append(t)
    if candidates:
        # Marketing titles tend to be longer than category labels but shorter than whole-card text.
        return max(candidates, key=lambda x: min(len(x), 140))[:300]
    return re.sub(r"^NEX-\d+\s*-\s*", "", alt).strip()[:300] or "Propiedad"


def best_detail_url(card, img, base_url: str, nex: str) -> str | None:
    links = []
    for a in card.find_all("a", href=True):
        href = str(a.get("href") or "")
        full = abs_url(base_url, href)
        if not full or full.startswith("javascript:"):
            continue
        score = 0
        low = href.lower()
        if nex in href:
            score += 10
        if any(x in low for x in ("inmueble", "property", "propiedad", "detalle")):
            score += 5
        if urlparse(full).netloc.endswith("iadmexico.mx"):
            score += 2
        links.append((score, full))
    parent = img.find_parent("a", href=True)
    if parent:
        full = abs_url(base_url, str(parent.get("href")))
        if full:
            links.append((8, full))
    if not links:
        return None
    links.sort(key=lambda x: x[0], reverse=True)
    return links[0][1]


def parse_card(img, operation: str, base_url: str):
    alt = clean(str(img.get("alt") or ""))
    m = re.search(r"NEX-(\d+)", alt, re.I)
    if not m:
        return None
    nex = m.group(1)
    card = nearest_card(img)
    text = clean(" | ".join(card.stripped_strings))

    ptype, bedrooms, bathrooms, area = parse_alt_metrics(alt)
    detail_url = best_detail_url(card, img, base_url, nex)
    title = best_title(card, alt)

    price = None
    currency = "MXN"
    pm = re.search(r"\$\s*([\d,]+(?:\.\d+)?)\s*(MXN|USD)?", text, re.I)
    if pm:
        price = parse_float(pm.group(1))
        if pm.group(2):
            currency = pm.group(2).upper()

    def metric(label_pat: str):
        mm = re.search(rf"(?:{label_pat})\s*([\d.,]+)|([\d.,]+)\s*(?:{label_pat})", text, re.I)
        return parse_float(mm.group(1) or mm.group(2)) if mm else None

    parking = metric(r"Prkg|Estacionamientos?")
    if bedrooms is None:
        bedrooms = metric(r"Rec[aá]maras?")
    if bathrooms is None:
        bathrooms = metric(r"Sanitarios?|Baños?")
    if area is None:
        area = metric(r"M²\s*Construcci[oó]n|m2\s*de\s*construcci[oó]n|m²\s*de\s*construcci[oó]n")
    land = metric(r"M²\s*Terreno|m2\s*de\s*terreno|m²\s*de\s*terreno")

    cover = img_url(img, base_url)
    return {
        "nex_id": f"NEX-{nex}",
        "external_id": nex,
        "operation_type": operation,
        "property_type": ptype,
        "title": title,
        "description": title[:1200],
        "price": price,
        "currency": currency,
        "bedrooms": bedrooms,
        "bathrooms": bathrooms,
        "parking_spaces": parking,
        "area_m2": area,
        "land_m2": land,
        "detail_url": detail_url,
        "cover_image_url": cover,
        "gallery": [cover] if cover else [],
        "page_url": base_url,
    }


def parse_page(html: str, operation: str, base_url: str):
    soup = BeautifulSoup(html, "html.parser")
    rows = {}
    for img in soup.find_all("img"):
        if "NEX-" not in str(img.get("alt") or "").upper():
            continue
        row = parse_card(img, operation, base_url)
        if row:
            rows[row["nex_id"]] = row
    return list(rows.values()), soup


def detail_images(url: str) -> list[str]:
    if not url:
        return []
    try:
        html = fetch(url)
    except Exception:
        return []
    soup = BeautifulSoup(html, "html.parser")
    imgs = []
    for img in soup.find_all("img"):
        u = img_url(img, url)
        if not u:
            continue
        low = u.lower()
        if any(x in low for x in ("logo", "icon", "avatar", "favicon")):
            continue
        if "/properties/" not in low and "/property/" not in low:
            continue
        if u not in imgs:
            imgs.append(u)
    return imgs[:30]


def discover_page_urls(soup: BeautifulSoup, root: str) -> list[str]:
    urls = {root}
    root_path = urlparse(root).path.rstrip("/")
    for a in soup.find_all("a", href=True):
        href = abs_url(root, str(a.get("href")))
        if not href:
            continue
        p = urlparse(href)
        if p.netloc != urlparse(root).netloc:
            continue
        if not p.path.rstrip("/").startswith(root_path):
            continue
        q = parse_qs(p.query)
        nums = []
        for k in ("page", "pagina", "p"):
            for v in q.get(k, []):
                if str(v).isdigit():
                    nums.append(int(v))
        if nums:
            urls.add(href)
    return sorted(urls)


def crawl_root(operation: str, root: str):
    first = fetch(root)
    first_rows, soup = parse_page(first, operation, root)
    urls = discover_page_urls(soup, root)
    if len(urls) <= 1:
        urls = [root]
        probes = [f"{root}?page={{}}", f"{root}?pagina={{}}", f"{root}?p={{}}"]
        sample_ids = {r["nex_id"] for r in first_rows}
        chosen = None
        for pattern in probes:
            try:
                html = fetch(pattern.format(2))
                rows, _ = parse_page(html, operation, root)
                ids = {r["nex_id"] for r in rows}
                if ids and ids != sample_ids:
                    chosen = pattern
                    break
            except Exception:
                pass
        if chosen:
            limit = MAX_PAGES if MAX_PAGES > 0 else 250
            urls = [root] + [chosen.format(i) for i in range(2, limit + 1)]
    if MAX_PAGES > 0:
        urls = urls[:MAX_PAGES]

    by_id = {r["nex_id"]: r for r in first_rows}
    failures = []
    if len(urls) > 1:
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futs = {pool.submit(fetch, u): u for u in urls[1:]}
            for fut in as_completed(futs):
                u = futs[fut]
                try:
                    html = fut.result()
                    rows, _ = parse_page(html, operation, u)
                    for r in rows:
                        by_id[r["nex_id"]] = r
                except Exception as exc:
                    failures.append({"url": u, "error": str(exc)})
    return list(by_id.values()), failures, urls


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for p in OUT_DIR.glob("chunk-*.json"):
        p.unlink()
    all_rows = {}
    failures = []
    summary = []
    for operation, root in ROOTS:
        rows, errs, urls = crawl_root(operation, root)
        for r in rows:
            all_rows[r["nex_id"]] = r
        failures.extend(errs)
        summary.append({"operation": operation, "root": root, "pages": len(urls), "rows": len(rows)})

    rows = sorted(all_rows.values(), key=lambda r: int(r["external_id"]))
    if DETAILS and rows:
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futs = {pool.submit(detail_images, r.get("detail_url")): r for r in rows if r.get("detail_url")}
            for fut in as_completed(futs):
                row = futs[fut]
                try:
                    imgs = fut.result()
                except Exception:
                    imgs = []
                if imgs:
                    row["gallery"] = imgs
                    row["cover_image_url"] = imgs[0]

    chunks = []
    for i in range(0, len(rows), CHUNK_SIZE):
        part = rows[i:i + CHUNK_SIZE]
        name = f"chunk-{i // CHUNK_SIZE + 1:04d}.json"
        (OUT_DIR / name).write_text(json.dumps(part, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        chunks.append({"file": name, "count": len(part)})
    manifest = {
        "source": "iad-mexico-neximo",
        "rows": len(rows),
        "summary": summary,
        "chunks": chunks,
        "failures": failures,
        "details": DETAILS,
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False))
    return 0 if rows else 2


if __name__ == "__main__":
    raise SystemExit(main())
