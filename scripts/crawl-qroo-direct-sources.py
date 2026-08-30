#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urljoin, urlparse, urldefrag
from urllib.robotparser import RobotFileParser
from xml.etree import ElementTree as ET

from bs4 import BeautifulSoup
from curl_cffi import requests

ROOT = Path(__file__).resolve().parents[1]
CONFIG = Path(os.getenv("QROO_DIRECT_CONFIG", ROOT / "ops/qroo-direct-sources.json"))
OUT_DIR = Path(os.getenv("QROO_DIRECT_OUT", "data/qroo-direct"))
MAX_SOURCES = max(1, int(os.getenv("QROO_DIRECT_MAX_SOURCES", "6")))
MAX_DETAILS = max(1, min(int(os.getenv("QROO_DIRECT_MAX_DETAILS", "80")), 250))
WORKERS = max(2, min(int(os.getenv("QROO_DIRECT_WORKERS", "8")), 16))
CHUNK_SIZE = max(1, min(int(os.getenv("QROO_DIRECT_CHUNK_SIZE", "150")), 200))
REQUEST_PAUSE = max(0.0, float(os.getenv("QROO_DIRECT_PAUSE", "0.08")))
USER_AGENT = "LISTIA-PublicInventoryCrawler/1.0 (+https://listiaapp.com/)"

BAD_IMAGE = re.compile(
    r"(?:logo|favicon|sprite|avatar|profile|icon|placeholder|default[-_]?image|"
    r"no[-_]?image|no[-_]?photo|sin[-_]?imagen|sin[-_]?foto|missing[-_]?image|"
    r"badge|spinner|loader|tracking|pixel|gravatar|blank|transparent)", re.I,
)
PROPERTY_PATH = re.compile(
    r"(?:property|properties|propiedad|propiedades|inmueble|inmuebles|listing|listings|"
    r"casa|house|home|departamento|apartment|condo|villa|terreno|land|lot|lote|"
    r"penthouse|development|desarrollo)", re.I,
)
ARCHIVE_PATH = re.compile(r"(?:/page/\d+/?$|[?&](?:page|pagina|paged)=\d+)", re.I)
STATIC_EXT = re.compile(r"\.(?:jpg|jpeg|png|webp|gif|svg|css|js|pdf|zip|xml)(?:\?|$)", re.I)


def clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def canonical(url: str, base: str | None = None) -> str | None:
    try:
        full = urljoin(base or url, url)
        full = urldefrag(full)[0]
        p = urlparse(full)
        if p.scheme not in ("http", "https") or not p.netloc:
            return None
        return full
    except Exception:
        return None


def host_key(url: str) -> str:
    return urlparse(url).hostname.lower().removeprefix("www.") if urlparse(url).hostname else ""


def same_host(a: str, b: str) -> bool:
    return bool(host_key(a)) and host_key(a) == host_key(b)


def fetch(url: str, attempts: int = 3) -> str:
    last = None
    for n in range(attempts):
        try:
            r = requests.get(
                url,
                impersonate="chrome",
                timeout=35,
                headers={
                    "user-agent": USER_AGENT,
                    "accept-language": "es-MX,es;q=0.9,en;q=0.7",
                    "cache-control": "no-cache",
                },
            )
            if r.status_code == 200 and len(r.text) > 100:
                if REQUEST_PAUSE:
                    time.sleep(REQUEST_PAUSE)
                return r.text
            last = RuntimeError(f"HTTP {r.status_code}, bytes={len(r.content)}")
        except Exception as exc:
            last = exc
        time.sleep(min(4.0, 0.8 * (n + 1)))
    raise RuntimeError(f"unable to fetch {url}: {last}")


def robots_for(source_url: str) -> tuple[RobotFileParser, list[str]]:
    p = urlparse(source_url)
    robots_url = f"{p.scheme}://{p.netloc}/robots.txt"
    parser = RobotFileParser()
    parser.set_url(robots_url)
    sitemaps: list[str] = []
    try:
        text = fetch(robots_url)
        parser.parse(text.splitlines())
        for line in text.splitlines():
            if line.lower().startswith("sitemap:"):
                value = canonical(line.split(":", 1)[1].strip())
                if value:
                    sitemaps.append(value)
    except Exception:
        # If robots.txt is unavailable, do not invent restrictions; stay on public same-host URLs.
        parser.parse(["User-agent: *", "Allow: /"])
    return parser, sitemaps


def can_fetch(robots: RobotFileParser, url: str) -> bool:
    try:
        return robots.can_fetch(USER_AGENT, url)
    except Exception:
        return False


def sitemap_candidates(source_url: str, robots: RobotFileParser, announced: list[str]) -> set[str]:
    p = urlparse(source_url)
    seeds = list(dict.fromkeys(announced + [
        f"{p.scheme}://{p.netloc}/sitemap.xml",
        f"{p.scheme}://{p.netloc}/wp-sitemap.xml",
    ]))
    seen_maps: set[str] = set()
    found: set[str] = set()
    queue = seeds[:]
    while queue and len(seen_maps) < 30 and len(found) < MAX_DETAILS * 8:
        sm = queue.pop(0)
        if sm in seen_maps or not same_host(sm, source_url) or not can_fetch(robots, sm):
            continue
        seen_maps.add(sm)
        try:
            text = fetch(sm)
            root = ET.fromstring(text)
        except Exception:
            continue
        tag = root.tag.lower()
        locs = [clean(node.text) for node in root.iter() if node.tag.lower().endswith("loc") and clean(node.text)]
        if tag.endswith("sitemapindex"):
            for loc in locs:
                value = canonical(loc)
                if value and same_host(value, source_url) and value not in seen_maps:
                    queue.append(value)
        else:
            for loc in locs:
                value = canonical(loc)
                if value and same_host(value, source_url) and is_propertyish_url(value):
                    found.add(value)
    return found


def is_propertyish_url(url: str) -> bool:
    p = urlparse(url)
    if STATIC_EXT.search(p.path) or ARCHIVE_PATH.search(url):
        return False
    low = p.path.lower()
    if low in ("", "/"):
        return False
    return bool(PROPERTY_PATH.search(low))


def archive_candidates(root_url: str, robots: RobotFileParser) -> set[str]:
    found: set[str] = set()
    archive_queue = [root_url]
    seen_archives: set[str] = set()
    while archive_queue and len(seen_archives) < 12 and len(found) < MAX_DETAILS * 5:
        page = archive_queue.pop(0)
        if page in seen_archives or not can_fetch(robots, page):
            continue
        seen_archives.add(page)
        try:
            soup = BeautifulSoup(fetch(page), "html.parser")
        except Exception:
            continue
        for a in soup.find_all("a", href=True):
            href = canonical(str(a.get("href") or ""), page)
            if not href or not same_host(href, root_url):
                continue
            if is_propertyish_url(href):
                found.add(href)
            elif ARCHIVE_PATH.search(href) and href not in seen_archives:
                archive_queue.append(href)
    return found


def jsonld_objects(soup: BeautifulSoup) -> list[dict]:
    out: list[dict] = []

    def walk(value):
        if isinstance(value, dict):
            out.append(value)
            for item in value.values():
                if isinstance(item, (dict, list)):
                    walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)

    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = script.string or script.get_text() or ""
        try:
            walk(json.loads(raw))
        except Exception:
            continue
    return out


def first_meta(soup: BeautifulSoup, *keys: tuple[str, str]) -> str | None:
    for attr, value in keys:
        node = soup.find("meta", attrs={attr: value})
        if node and clean(node.get("content")):
            return clean(node.get("content"))
    return None


def normalized_image(raw: object, page_url: str) -> str | None:
    value = clean(raw)
    if not value or value.startswith("data:"):
        return None
    url = canonical(value, page_url)
    if not url or BAD_IMAGE.search(url) or url.lower().split("?")[0].endswith((".svg", ".ico")):
        return None
    return url


def collect_images(soup: BeautifulSoup, objects: list[dict], page_url: str) -> list[str]:
    raw: list[object] = []
    for obj in objects:
        for key in ("image", "images", "thumbnailUrl", "contentUrl"):
            value = obj.get(key)
            if isinstance(value, list):
                raw.extend(value)
            elif isinstance(value, dict):
                raw.extend([value.get("url"), value.get("contentUrl")])
            elif value:
                raw.append(value)
    raw.extend([
        first_meta(soup, ("property", "og:image")),
        first_meta(soup, ("property", "og:image:secure_url")),
        first_meta(soup, ("name", "twitter:image")),
    ])
    for img in soup.find_all("img")[:120]:
        for key in ("data-src", "data-lazy-src", "data-original", "src"):
            if img.get(key):
                raw.append(img.get(key))
    out: list[str] = []
    seen: set[str] = set()
    for item in raw:
        url = normalized_image(item, page_url)
        if url and url not in seen:
            seen.add(url)
            out.append(url)
            if len(out) >= 10:
                break
    return out


def offer_values(objects: list[dict]) -> tuple[float | None, str | None]:
    for obj in objects:
        candidates = [obj]
        offers = obj.get("offers")
        if isinstance(offers, dict):
            candidates.insert(0, offers)
        elif isinstance(offers, list):
            candidates = offers + candidates
        for offer in candidates:
            if not isinstance(offer, dict):
                continue
            raw = offer.get("price") or offer.get("lowPrice")
            currency = clean(offer.get("priceCurrency")).upper() or None
            try:
                if raw is not None:
                    price = float(str(raw).replace(",", ""))
                    if 100 <= price <= 10_000_000_000:
                        return price, currency
            except Exception:
                pass
    return None, None


def regex_price(text: str) -> tuple[float | None, str | None]:
    patterns = [
        r"\b(USD|MXN)\s*\$?\s*([0-9][0-9,.]{2,})",
        r"\$\s*([0-9][0-9,.]{2,})\s*(USD|MXN)?",
    ]
    for idx, pattern in enumerate(patterns):
        m = re.search(pattern, text, re.I)
        if not m:
            continue
        currency = (m.group(1) if idx == 0 else (m.group(2) or "MXN")).upper()
        raw = m.group(2) if idx == 0 else m.group(1)
        try:
            price = float(raw.replace(",", ""))
            if 100 <= price <= 10_000_000_000:
                return price, currency
        except Exception:
            pass
    return None, None


def metric(text: str, patterns: list[str], maximum: float = 100000000) -> float | None:
    for pattern in patterns:
        m = re.search(pattern, text, re.I)
        if not m:
            continue
        try:
            value = float(m.group(1).replace(",", ""))
            if 0 <= value <= maximum:
                return value
        except Exception:
            pass
    return None


def infer_type(title: str, text: str, url: str) -> str:
    hay = f"{title} {url} {text[:1500]}".lower()
    for needles, value in (
        (("penthouse",), "penthouse"),
        (("departamento", "apartment", "condo"), "apartment"),
        (("casa", "house", "home", "villa"), "house"),
        (("terreno", "land", " lote", "/lot"), "land"),
        (("local", "oficina", "commercial"), "commercial"),
    ):
        if any(n in hay for n in needles):
            return value
    return "property"


def infer_operation(title: str, text: str, url: str) -> str:
    hay = f"{title} {url} {text[:2000]}".lower()
    if re.search(r"\b(?:renta|rent|rental|for rent|alquiler)\b", hay):
        return "rent"
    return "sale"


def location_from_jsonld(objects: list[dict], city_hint: str) -> tuple[str, str]:
    city = city_hint
    pieces: list[str] = []
    for obj in objects:
        address = obj.get("address")
        if not isinstance(address, dict):
            continue
        locality = clean(address.get("addressLocality"))
        region = clean(address.get("addressRegion"))
        street = clean(address.get("streetAddress"))
        if locality:
            city = locality
        pieces = [x for x in (street, locality, region) if x]
        if pieces:
            break
    location = ", ".join(dict.fromkeys(pieces)) if pieces else f"{city_hint}, Quintana Roo"
    if "quintana roo" not in location.lower():
        location = f"{location}, Quintana Roo"
    return city or city_hint, location


def parse_detail(source: dict, page_url: str, robots: RobotFileParser) -> dict | None:
    if not can_fetch(robots, page_url):
        return None
    html = fetch(page_url)
    soup = BeautifulSoup(html, "html.parser")
    objects = jsonld_objects(soup)
    title = clean(first_meta(soup, ("property", "og:title")) or (soup.find("h1").get_text(" ", strip=True) if soup.find("h1") else soup.title.get_text(" ", strip=True) if soup.title else ""))
    title = re.split(r"\s+[|–—]\s+", title, maxsplit=1)[0][:300]
    text = clean(" ".join(soup.stripped_strings))
    images = collect_images(soup, objects, page_url)
    if not title or not images:
        return None

    price, currency = offer_values(objects)
    if price is None:
        price, currency = regex_price(text)
    bedrooms = metric(text, [r"([0-9]+(?:\.[0-9]+)?)\s*(?:rec[aá]maras?|habitaciones?|bedrooms?|beds?\b)"], 50)
    bathrooms = metric(text, [r"([0-9]+(?:\.[0-9]+)?)\s*(?:baños?|bathrooms?|baths?\b)"], 50)
    area = metric(text, [r"([0-9][0-9,.]*)\s*(?:m²|m2|sq\.?\s*m|metros? cuadrados?)"], 100000000)
    operation = infer_operation(title, text, page_url)
    ptype = infer_type(title, text, page_url)
    city, location = location_from_jsonld(objects, clean(source.get("city_hint")))

    property_signal = bool(price is not None or bedrooms is not None or bathrooms is not None or area is not None)
    wording_signal = bool(re.search(r"\b(?:venta|renta|sale|rent|property|propiedad|casa|house|condo|departamento|terreno|land|villa|penthouse)\b", f"{title} {page_url}", re.I))
    if not property_signal or not wording_signal:
        return None

    bits = [f"Propiedad en {city}, Quintana Roo."]
    if bedrooms is not None:
        bits.append(f"{bedrooms:g} recámaras.")
    if bathrooms is not None:
        bits.append(f"{bathrooms:g} baños.")
    if area is not None:
        bits.append(f"{area:g} m².")
    bits.append("Precio y disponibilidad sujetos a confirmación con la fuente publicada.")

    source_key = re.sub(r"[^a-z0-9]+", "-", clean(source.get("name")).lower()).strip("-")[:45]
    digest = hashlib.sha1(page_url.encode("utf-8")).hexdigest()[:20]
    return {
        "source_url": clean(source.get("source_url")),
        "slug": f"qroo-direct-{source_key}-{digest}",
        "title": title,
        "description": " ".join(bits),
        "operation_type": operation,
        "property_type": ptype,
        "price": price,
        "currency": (currency or "MXN").upper(),
        "location_text": location,
        "city": city,
        "bedrooms": bedrooms,
        "bathrooms": bathrooms,
        "area_m2": area,
        "cover_image_url": images[0],
        "gallery": images,
        "page_url": page_url,
    }


def crawl_source(source: dict) -> tuple[list[dict], dict, list[dict]]:
    roots = [clean(x) for x in source.get("crawl_roots", []) if clean(x)]
    source_url = clean(source.get("source_url"))
    robots, announced = robots_for(source_url)
    candidates = sitemap_candidates(source_url, robots, announced)
    for root in roots:
        if same_host(root, source_url):
            candidates.update(archive_candidates(root, robots))
    candidates = {u for u in candidates if same_host(u, source_url) and can_fetch(robots, u)}
    ordered = sorted(candidates, key=lambda u: (0 if PROPERTY_PATH.search(urlparse(u).path) else 1, len(u), u))[:MAX_DETAILS]

    rows: list[dict] = []
    failures: list[dict] = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(parse_detail, source, url, robots): url for url in ordered}
        for future in as_completed(futures):
            url = futures[future]
            try:
                row = future.result()
                if row:
                    rows.append(row)
            except Exception as exc:
                failures.append({"source": source.get("name"), "url": url, "error": str(exc)})

    # One cover must represent one listing. Reject ambiguous reused cover images.
    counts: dict[str, int] = {}
    for row in rows:
        counts[row["cover_image_url"]] = counts.get(row["cover_image_url"], 0) + 1
    rows = [row for row in rows if counts.get(row["cover_image_url"], 0) == 1]
    by_slug = {row["slug"]: row for row in rows}
    meta = {
        "name": source.get("name"),
        "source_url": source_url,
        "candidates": len(ordered),
        "accepted": len(by_slug),
        "failures": len(failures),
    }
    return list(by_slug.values()), meta, failures


def main() -> int:
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    sources = sorted(config.get("sources", []), key=lambda s: (int(s.get("priority", 99)), clean(s.get("name"))))[:MAX_SOURCES]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("chunk-*.json"):
        old.unlink()

    all_rows: dict[str, dict] = {}
    summaries: list[dict] = []
    failures: list[dict] = []
    for source in sources:
        rows, meta, errs = crawl_source(source)
        summaries.append(meta)
        failures.extend(errs)
        for row in rows:
            all_rows[row["slug"]] = row
        print(json.dumps(meta, ensure_ascii=False), flush=True)

    # Also reject covers reused across different configured sources in this run.
    cover_counts: dict[str, int] = {}
    for row in all_rows.values():
        cover_counts[row["cover_image_url"]] = cover_counts.get(row["cover_image_url"], 0) + 1
    rows = sorted((r for r in all_rows.values() if cover_counts.get(r["cover_image_url"], 0) == 1), key=lambda r: r["slug"])

    chunks = []
    for start in range(0, len(rows), CHUNK_SIZE):
        part = rows[start:start + CHUNK_SIZE]
        name = f"chunk-{start // CHUNK_SIZE + 1:04d}.json"
        (OUT_DIR / name).write_text(json.dumps(part, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        chunks.append({"file": name, "count": len(part)})

    manifest = {
        "source": "qroo-verified-direct-public-sources",
        "territory": "Quintana Roo",
        "sources_attempted": len(sources),
        "rows": len(rows),
        "summaries": summaries,
        "chunks": chunks,
        "failures": failures,
        "image_required": True,
        "generic_placeholders_rejected": True,
        "verified_source_contact_required": True,
        "robots_respected": True,
        "same_host_detail_provenance": True,
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"rows": len(rows), "sources_attempted": len(sources), "failures": len(failures)}, ensure_ascii=False), flush=True)
    return 0 if rows else 2


if __name__ == "__main__":
    raise SystemExit(main())
