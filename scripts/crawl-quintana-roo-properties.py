#!/usr/bin/env python3
"""Crawl public Quintana Roo listing result pages and create a normalized LISTIA import snapshot.

The crawler intentionally stores no external images. Provenance is retained only in internal
fields so the public Marketplace can remain source-agnostic.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import unicodedata
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup
from curl_cffi import requests

BASE_URL = os.getenv("QROO_CRAWL_URL", "https://propiedades.com/quintana-roo/")
OUT_DIR = Path(os.getenv("QROO_CRAWL_OUT", "data/qroo-crawl"))
CHUNK_SIZE = int(os.getenv("QROO_CHUNK_SIZE", "1500"))
MAX_PAGES = int(os.getenv("QROO_MAX_PAGES", "0"))  # 0 = all discovered pages
SLEEP = float(os.getenv("QROO_CRAWL_SLEEP", "0.18"))

PROPERTY_TYPES = {
    "casa en condominio": "house",
    "casa": "house",
    "departamento": "apartment",
    "penthouse": "penthouse",
    "terreno habitacional": "land",
    "terreno comercial": "land",
    "terreno": "land",
    "rancho": "land",
    "edificio": "building",
    "local comercial": "commercial",
    "local": "commercial",
    "oficina": "commercial",
    "bodega comercial": "commercial",
    "bodega industrial": "commercial",
    "nave industrial": "commercial",
    "hotel": "commercial",
}
KNOWN_MUNICIPALITIES = [
    "Benito Juárez", "Solidaridad", "Tulum", "Puerto Morelos", "Cozumel",
    "Isla Mujeres", "Bacalar", "Othón P. Blanco", "Lázaro Cárdenas",
    "Felipe Carrillo Puerto", "José María Morelos",
]


def strip_accents(value: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", value) if unicodedata.category(c) != "Mn")


def clean_line(value: str) -> str:
    value = value.replace("\xa0", " ").replace("m^{2}", "m²")
    value = re.sub(r"\s+", " ", value).strip()
    return value


def get_page(url: str, attempts: int = 4) -> str:
    last = None
    for attempt in range(1, attempts + 1):
        try:
            r = requests.get(
                url,
                impersonate="chrome",
                timeout=35,
                headers={
                    "accept-language": "es-MX,es;q=0.9,en;q=0.7",
                    "cache-control": "no-cache",
                },
            )
            if r.status_code == 200 and ("/inmuebles/" in r.text or "ID:" in r.text):
                return r.text
            last = RuntimeError(f"HTTP {r.status_code}, bytes={len(r.content)}")
        except Exception as exc:  # noqa: BLE001
            last = exc
        time.sleep(min(6, attempt * 1.5))
    raise RuntimeError(f"Unable to fetch {url}: {last}")


def discover_pages(html: str) -> int:
    text = clean_line(BeautifulSoup(html, "html.parser").get_text(" "))
    matches = re.findall(r"Página\s+1\s+de\s+([\d,]+)", text, re.I)
    if not matches:
        matches = re.findall(r"Pagina\s+1\s+de\s+([\d,]+)", strip_accents(text), re.I)
    if not matches:
        # Some templates expose a hard last-page number without the literal "Página 1 de".
        candidates = [int(x.replace(",", "")) for x in re.findall(r"[?&]pagina=(\d{1,4})", html, re.I)]
        return max(candidates) if candidates else 1
    return int(matches[-1].replace(",", ""))


def infer_city(location: str) -> tuple[str | None, str | None]:
    folded = strip_accents(location).lower()
    city_rules = [
        ("cancun", "Cancún", "Benito Juárez"),
        ("playa del carmen", "Playa del Carmen", "Solidaridad"),
        ("puerto aventuras", "Puerto Aventuras", "Solidaridad"),
        ("akumal", "Akumal", "Tulum"),
        ("tulum", "Tulum", "Tulum"),
        ("puerto morelos", "Puerto Morelos", "Puerto Morelos"),
        ("cozumel", "Cozumel", "Cozumel"),
        ("isla mujeres", "Isla Mujeres", "Isla Mujeres"),
        ("costa mujeres", "Costa Mujeres", "Isla Mujeres"),
        ("bacalar", "Bacalar", "Bacalar"),
        ("mahahual", "Mahahual", "Othón P. Blanco"),
        ("majahual", "Mahahual", "Othón P. Blanco"),
        ("chetumal", "Chetumal", "Othón P. Blanco"),
        ("holbox", "Holbox", "Lázaro Cárdenas"),
        ("felipe carrillo puerto", "Felipe Carrillo Puerto", "Felipe Carrillo Puerto"),
        ("jose maria morelos", "José María Morelos", "José María Morelos"),
    ]
    for needle, city, municipality in city_rules:
        if needle in folded:
            return city, municipality
    for municipality in KNOWN_MUNICIPALITIES:
        if strip_accents(municipality).lower() in folded:
            return municipality, municipality
    return None, None


def parse_price_from_lines(lines: list[str]) -> tuple[float | None, str | None]:
    for line in lines:
        m = re.search(r"\$\s*([\d.,]+)\s*(MXN|USD)?", line, re.I)
        if m:
            raw = m.group(1).replace(",", "")
            try:
                return float(raw), (m.group(2) or "MXN").upper()
            except ValueError:
                pass
        m = re.search(r"\b(?:MN|MXN)\s*([\d.,]+)", line, re.I)
        if m:
            try:
                return float(m.group(1).replace(",", "")), "MXN"
            except ValueError:
                pass
        m = re.search(r"\bUSD\s*([\d.,]+)", line, re.I)
        if m:
            try:
                return float(m.group(1).replace(",", "")), "USD"
            except ValueError:
                pass
    return None, None


def parse_type_operation_from_lines(lines: list[str]) -> tuple[str, str]:
    operation = "sale"
    ptype = "property"
    normalized_lines = [strip_accents(x).lower().strip() for x in lines]
    if any(x == "renta" for x in normalized_lines):
        operation = "rent"
    elif any(x == "venta" for x in normalized_lines):
        operation = "sale"

    # Prefer the most specific labels first (e.g. casa en condominio before casa).
    for label, normalized in PROPERTY_TYPES.items():
        folded_label = strip_accents(label).lower()
        for candidate in normalized_lines:
            if candidate == folded_label or candidate.startswith(folded_label + " "):
                return normalized, operation
    return ptype, operation


def parse_numbers_from_lines(lines: list[str], property_type: str) -> tuple[float | None, float | None, float | None]:
    joined = " | ".join(lines)
    bedrooms = None
    bathrooms = None
    area = None

    m = re.search(r"([\d.,]+)\s*Rec[aá]maras?", joined, re.I)
    if m:
        bedrooms = float(m.group(1).replace(",", ""))
    m = re.search(r"([\d.,]+)\s*Baños?", joined, re.I)
    if m:
        bathrooms = float(m.group(1).replace(",", ""))
    areas = re.findall(r"([\d.,]+)\s*m(?:²|2|\^\{2\})", joined, re.I)
    if areas:
        parsed_areas = []
        for raw in areas:
            try:
                parsed_areas.append(float(raw.replace(",", "")))
            except ValueError:
                pass
        if parsed_areas:
            area = parsed_areas[-1]

    # Some result templates render numeric icon values without textual labels.
    if bedrooms is None and bathrooms is None and property_type not in ("land", "building", "commercial"):
        nums: list[float] = []
        for line in lines:
            if re.fullmatch(r"\d+(?:\.\d+)?", line):
                nums.append(float(line))
        if nums:
            bedrooms = nums[0]
            bathrooms = nums[1] if len(nums) > 1 else None
    return bedrooms, bathrooms, area


def strip_marketing_prefix(location: str) -> str:
    value = re.sub(r"\s*,?\s*ID:\s*\d+.*$", "", location, flags=re.I).strip(" ,")
    patterns = [
        r"^Se vende\s+", r"^Se renta\s+", r"^Venta de\s+", r"^Renta de\s+",
        r"^Venta\s+", r"^Renta\s+", r"^Departamento (?:disponible )?en venta en\s+",
        r"^Departamento en renta disponible en\s+", r"^Casa en venta disponible en\s+",
        r"^Casa disponible en renta en\s+", r"^Terreno (?:disponible )?en venta en\s+",
        r"^Venta de casa en condominio en\s+",
    ]
    for pattern in patterns:
        value = re.sub(pattern, "", value, flags=re.I)
    return value.strip(" ,")


def build_result(ext_id: str, location: str, lines: list[str], page_url: str) -> dict[str, Any]:
    ptype, operation = parse_type_operation_from_lines(lines)
    price, currency = parse_price_from_lines(lines)
    beds, baths, area = parse_numbers_from_lines(lines, ptype)
    location = strip_marketing_prefix(location) or "Quintana Roo"
    city, municipality = infer_city(location)

    title_base = ptype.replace("_", " ").title()
    short_location = location.split(", Quintana Roo")[0].strip() if location else "Quintana Roo"
    title = f"{title_base} · {short_location}"[:300]
    desc_bits = [f"{title_base} en {short_location}."]
    if beds is not None and ptype not in ("land", "building", "commercial"):
        desc_bits.append(f"{beds:g} recámaras.")
    if baths is not None:
        desc_bits.append(f"{baths:g} baños.")
    if area is not None:
        desc_bits.append(f"Superficie aproximada {area:g} m².")
    desc_bits.append("Precio y disponibilidad sujetos a cambios.")

    return {
        "external_id": ext_id,
        "slug": f"qroo-{ext_id}",
        "title": title,
        "description": " ".join(desc_bits),
        "operation_type": operation,
        "property_type": ptype,
        "price": price,
        "currency": currency or "MXN",
        "location_text": location,
        "city": city,
        "municipality": municipality,
        "state_region": "Quintana Roo",
        "country_code": "MX",
        "bedrooms": beds,
        "bathrooms": baths,
        "area_m2": area,
        "page_url": page_url,
    }


def nearest_card_lines(anchor) -> list[str]:
    node = anchor
    fallback: list[str] = []
    for _ in range(10):
        node = getattr(node, "parent", None)
        if node is None:
            break
        lines = [clean_line(x) for x in node.get_text("\n", strip=True).splitlines()]
        lines = [x for x in lines if x]
        if len(lines) > len(fallback) and len(lines) <= 80:
            fallback = lines
        joined = " | ".join(lines)
        has_price = bool(re.search(r"\$\s*[\d.,]+", joined))
        has_operation = bool(re.search(r"(?:^|\|\s*)(?:Venta|Renta)(?:\s*\||$)", joined, re.I))
        folded = strip_accents(joined).lower()
        has_type = any(strip_accents(label).lower() in folded for label in PROPERTY_TYPES)
        if has_price and has_operation and has_type and len(lines) <= 60:
            return lines
    return fallback


def parse_page(html: str, page_url: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    results: list[dict[str, Any]] = []
    seen: set[str] = set()

    # Current result cards expose the stable property ID in the /inmuebles/...-<ID> link.
    anchors = []
    for anchor in soup.find_all("a", href=True):
        href = str(anchor.get("href") or "")
        m = re.search(r"/inmuebles/[^?#]*-(\d{6,})(?:[/?#]|$)", href)
        if m:
            anchors.append((anchor, m.group(1)))

    # Prefer anchors carrying human-readable address/title text over image-only links.
    anchors.sort(key=lambda item: len(clean_line(item[0].get_text(" ", strip=True))), reverse=True)
    for anchor, ext_id in anchors:
        if ext_id in seen:
            continue
        anchor_text = clean_line(anchor.get_text(" ", strip=True))
        if not anchor_text:
            anchor_text = clean_line(str(anchor.get("title") or anchor.get("aria-label") or ""))
        lines = nearest_card_lines(anchor)
        if not lines:
            continue
        if not anchor_text:
            candidates = [x for x in lines if "Quintana Roo" in x or "Q.R." in x or "C.P." in x]
            anchor_text = max(candidates, key=len) if candidates else "Quintana Roo"
        row = build_result(ext_id, anchor_text, lines, page_url)
        # A valid card should expose at least a price or a recognizable type; otherwise ignore noise links.
        if row["price"] is None and row["property_type"] == "property":
            continue
        seen.add(ext_id)
        results.append(row)

    # Compatibility fallback for older templates where ID was visible in text.
    lines = [clean_line(x) for x in soup.get_text("\n").splitlines()]
    lines = [x for x in lines if x]
    for idx, line in enumerate(lines):
        m = re.search(r"\bID:\s*(\d+)\b", line, re.I)
        if not m or m.group(1) in seen:
            continue
        ext_id = m.group(1)
        block = lines[max(0, idx - 18): min(len(lines), idx + 14)]
        row = build_result(ext_id, line, block, page_url)
        if row["price"] is None and row["property_type"] == "property":
            continue
        seen.add(ext_id)
        results.append(row)

    return results


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("chunk-*.json"):
        old.unlink()

    first_html = get_page(BASE_URL)
    total_pages = discover_pages(first_html)
    if MAX_PAGES > 0:
        total_pages = min(total_pages, MAX_PAGES)
    print(f"Discovered {total_pages} pages from {BASE_URL}")

    by_id: dict[str, dict[str, Any]] = {}
    failures: list[dict[str, Any]] = []
    for page in range(1, total_pages + 1):
        url = BASE_URL if page == 1 else f"{BASE_URL}?pagina={page}"
        try:
            html = first_html if page == 1 else get_page(url)
            rows = parse_page(html, url)
            for row in rows:
                by_id[row["external_id"]] = row
            print(f"page={page}/{total_pages} parsed={len(rows)} unique={len(by_id)}")
        except Exception as exc:  # noqa: BLE001
            failures.append({"page": page, "url": url, "error": str(exc)})
            print(f"WARN page={page}: {exc}", file=sys.stderr)
        time.sleep(SLEEP)

    rows = sorted(by_id.values(), key=lambda x: int(x["external_id"]))
    chunks = []
    for start in range(0, len(rows), CHUNK_SIZE):
        part = rows[start:start + CHUNK_SIZE]
        name = f"chunk-{start // CHUNK_SIZE + 1:04d}.json"
        path = OUT_DIR / name
        path.write_text(json.dumps(part, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        chunks.append({"file": name, "count": len(part)})

    manifest = {
        "source": "qroo-public-marketplace-crawl",
        "base_url": BASE_URL,
        "pages_attempted": total_pages,
        "unique_listings": len(rows),
        "chunks": chunks,
        "failures": failures,
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"unique_listings": len(rows), "chunks": len(chunks), "failures": len(failures)}))
    return 0 if rows else 2


if __name__ == "__main__":
    raise SystemExit(main())
