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
from urllib.parse import urljoin

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


def slugify(value: str) -> str:
    value = strip_accents(value).lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value[:160] or "listing"


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
            if r.status_code == 200 and "ID:" in r.text:
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
        return 1
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


def parse_price(lines: list[str], id_index: int) -> tuple[float | None, str | None]:
    for i in range(id_index - 1, max(-1, id_index - 22), -1):
        line = lines[i]
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


def parse_type_operation(lines: list[str], id_index: int) -> tuple[str, str]:
    operation = "sale"
    raw_type = "property"
    for i in range(id_index - 1, max(-1, id_index - 24), -1):
        low = strip_accents(lines[i]).lower()
        if low in ("venta", "renta"):
            operation = "rent" if low == "renta" else "sale"
            for j in range(i - 1, max(-1, i - 7), -1):
                candidate = strip_accents(lines[j]).lower().strip()
                for label, normalized in PROPERTY_TYPES.items():
                    if strip_accents(label) == candidate or strip_accents(label) in candidate:
                        return normalized, operation
            break
    return raw_type, operation


def parse_numbers(lines: list[str], id_index: int, property_type: str) -> tuple[float | None, float | None, float | None]:
    window = lines[max(0, id_index - 18): min(len(lines), id_index + 14)]
    area = None
    bedrooms = None
    bathrooms = None

    # Prefer explicit labels when present.
    joined = " | ".join(window)
    m = re.search(r"([\d.,]+)\s*Rec[aá]maras?", joined, re.I)
    if m:
        bedrooms = float(m.group(1).replace(",", ""))
    m = re.search(r"([\d.,]+)\s*Baños?", joined, re.I)
    if m:
        bathrooms = float(m.group(1).replace(",", ""))
    areas = re.findall(r"([\d.,]+)\s*m(?:²|2|\^\{2\})", joined, re.I)
    if areas:
        try:
            area = float(areas[-1].replace(",", ""))
        except ValueError:
            area = None

    if bedrooms is None and bathrooms is None and property_type not in ("land", "building", "commercial"):
        # Older result templates render the bed/bath icons as bare numbers before the area.
        prior = lines[max(0, id_index - 12):id_index]
        nums: list[float] = []
        for line in prior:
            if re.fullmatch(r"\d+(?:\.\d+)?", line):
                nums.append(float(line))
        if nums:
            bedrooms = nums[-2] if len(nums) >= 2 else nums[-1]
            bathrooms = nums[-1] if len(nums) >= 2 else None
    return bedrooms, bathrooms, area


def parse_page(html: str, page_url: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    lines = [clean_line(x) for x in soup.get_text("\n").splitlines()]
    lines = [x for x in lines if x]
    results: list[dict[str, Any]] = []
    seen: set[str] = set()

    for idx, line in enumerate(lines):
        m = re.search(r"\bID:\s*(\d+)\b", line, re.I)
        if not m:
            continue
        ext_id = m.group(1)
        if ext_id in seen:
            continue
        seen.add(ext_id)
        location = re.sub(r"\s*,?\s*ID:\s*\d+.*$", "", line, flags=re.I).strip(" ,")
        ptype, operation = parse_type_operation(lines, idx)
        price, currency = parse_price(lines, idx)
        beds, baths, area = parse_numbers(lines, idx, ptype)
        city, municipality = infer_city(location)

        title_base = ptype.replace("_", " ").title()
        short_location = location.split(", Quintana Roo")[0].strip() if location else "Quintana Roo"
        title = f"{title_base} · {short_location}"[:300]
        desc_bits = [f"{title_base} en {short_location}."]
        if beds is not None:
            desc_bits.append(f"{beds:g} recámaras.")
        if baths is not None:
            desc_bits.append(f"{baths:g} baños.")
        if area is not None:
            desc_bits.append(f"Superficie aproximada {area:g} m².")
        desc_bits.append("Precio y disponibilidad sujetos a cambios.")

        results.append({
            "external_id": ext_id,
            "slug": f"qroo-{ext_id}",
            "title": title,
            "description": " ".join(desc_bits),
            "operation_type": operation,
            "property_type": ptype,
            "price": price,
            "currency": currency or "MXN",
            "location_text": location or "Quintana Roo",
            "city": city,
            "municipality": municipality,
            "state_region": "Quintana Roo",
            "country_code": "MX",
            "bedrooms": beds,
            "bathrooms": baths,
            "area_m2": area,
            "page_url": page_url,
        })
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
