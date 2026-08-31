#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import urllib.parse
import urllib.request
import urllib.robotparser
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup

UA = "LISTIA-Marketplace-Public-Research/1.0 (+https://listiaapp.com)"
GOOGLE_WRAPPERS = {"google.com", "www.google.com", "share.google"}
MAX_FETCH_BYTES = 3_000_000


def fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/json,text/csv;q=0.8,*/*;q=0.5"})
    with urllib.request.urlopen(req, timeout=25) as resp:
        raw = resp.read(MAX_FETCH_BYTES + 1)
        if len(raw) > MAX_FETCH_BYTES:
            raise RuntimeError(f"response too large: {url}")
        return raw.decode(resp.headers.get_content_charset() or "utf-8", errors="replace")


def robots_allowed(url: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    robots = urllib.parse.urlunparse((parsed.scheme, parsed.netloc, "/robots.txt", "", "", ""))
    rp = urllib.robotparser.RobotFileParser()
    rp.set_url(robots)
    try:
        rp.read()
        return rp.can_fetch(UA, url)
    except Exception:
        return False


def jsonld_nodes(value: Any):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from jsonld_nodes(child)
    elif isinstance(value, list):
        for child in value:
            yield from jsonld_nodes(child)


def first(*values):
    for value in values:
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        return value
    return None


def text_value(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        value = re.sub(r"\s+", " ", value).strip()
        return value or None
    return None


def image_value(value: Any) -> str | None:
    if isinstance(value, str) and value.startswith(("http://", "https://")):
        return value
    if isinstance(value, list):
        for item in value:
            found = image_value(item)
            if found:
                return found
    if isinstance(value, dict):
        return image_value(value.get("url") or value.get("contentUrl"))
    return None


def offer_info(nodes: list[dict]) -> tuple[str | None, str | None]:
    for node in nodes:
        offers = node.get("offers")
        candidates = offers if isinstance(offers, list) else [offers]
        for offer in candidates:
            if not isinstance(offer, dict):
                continue
            price = text_value(first(offer.get("price"), offer.get("lowPrice")))
            currency = text_value(offer.get("priceCurrency"))
            if price:
                cleaned = re.sub(r"[^0-9.]", "", price.replace(",", ""))
                if cleaned:
                    return cleaned, currency
    return None, None


def address_info(nodes: list[dict]) -> dict[str, str | None]:
    for node in nodes:
        addr = node.get("address")
        if isinstance(addr, dict):
            parts = [text_value(addr.get(k)) for k in ("streetAddress", "addressLocality", "addressRegion", "postalCode", "addressCountry")]
            return {
                "location_text": ", ".join([x for x in parts if x]),
                "city": text_value(addr.get("addressLocality")),
                "state_region": text_value(addr.get("addressRegion")),
                "postal_code": text_value(addr.get("postalCode")),
                "country_code": text_value(addr.get("addressCountry")) or "MX",
            }
    return {"location_text": None, "city": None, "state_region": None, "postal_code": None, "country_code": "MX"}


def geo_info(nodes: list[dict]) -> tuple[str | None, str | None]:
    for node in nodes:
        geo = node.get("geo")
        if isinstance(geo, dict):
            lat = text_value(geo.get("latitude"))
            lng = text_value(geo.get("longitude"))
            if lat and lng:
                return lat, lng
    return None, None


def numeric_from_nodes(nodes: list[dict], keys: tuple[str, ...]) -> str | None:
    for node in nodes:
        for key in keys:
            value = node.get(key)
            if isinstance(value, dict):
                value = value.get("value")
            txt = text_value(value)
            if txt:
                m = re.search(r"\d+(?:\.\d+)?", txt.replace(",", ""))
                if m:
                    return m.group(0)
    return None


def operation_from_text(text: str) -> str | None:
    low = text.lower()
    rent = bool(re.search(r"\b(renta|rent|alquiler|for rent)\b", low))
    sale = bool(re.search(r"\b(venta|sale|for sale|se vende)\b", low))
    if rent and not sale:
        return "rent"
    if sale and not rent:
        return "sale"
    return None


def contact_from_page(soup: BeautifulSoup, nodes: list[dict], page_url: str, source_name: str) -> list[dict]:
    company = None
    person = None
    role = "listing_contact"
    for node in nodes:
        typ = node.get("@type")
        types = [typ] if isinstance(typ, str) else (typ or [])
        if any(str(x).lower() in {"organization", "realestateagent", "person", "localbusiness"} for x in types):
            name = text_value(node.get("name"))
            if not name:
                continue
            if any(str(x).lower() == "person" for x in types):
                person = person or name
                role = "realtor"
            else:
                company = company or name
    emails = []
    phones = []
    whatsapps = []
    for a in soup.find_all("a", href=True):
        href = a.get("href", "").strip()
        if href.lower().startswith("mailto:"):
            email = href[7:].split("?", 1)[0].strip().lower()
            if email and email not in emails:
                emails.append(email)
        elif href.lower().startswith("tel:"):
            phone = href[4:].split("?", 1)[0].strip()
            if phone and phone not in phones:
                phones.append(phone)
        elif "wa.me/" in href or "api.whatsapp.com" in href or "whatsapp.com/send" in href:
            m = re.search(r"(?:phone=|wa\.me/)(\+?\d{7,18})", href)
            if m:
                value = m.group(1)
                if value not in whatsapps:
                    whatsapps.append(value)
    if not (emails or phones or whatsapps or company or person):
        return []
    return [{
        "party_type": "realtor" if person else "brokerage",
        "company_name": company or source_name,
        "person_name": person,
        "display_name": person or company or source_name,
        "website_url": urllib.parse.urlunparse((*urllib.parse.urlparse(page_url)[:2], "", "", "", "")),
        "email": emails[0] if emails else None,
        "phone": phones[0] if phones else None,
        "whatsapp": whatsapps[0] if whatsapps else None,
        "role": role if person else "brokerage",
        "evidence_url": page_url,
        "evidence_type": "public_listing_page",
        "confidence": "0.80" if (emails or phones or whatsapps) else "0.60",
    }]


def extract_direct_listing(url: str) -> dict:
    parsed = urllib.parse.urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not host:
        raise RuntimeError(f"direct listing URL must be https: {url}")
    if host in GOOGLE_WRAPPERS or host.endswith(".google.com"):
        raise RuntimeError("Google/shared search wrappers must be exported to direct public listing URLs before ingestion")
    if not robots_allowed(url):
        raise RuntimeError(f"robots.txt does not permit this public fetch: {url}")
    html = fetch_text(url)
    soup = BeautifulSoup(html, "html.parser")
    nodes: list[dict] = []
    for script in soup.find_all("script", type=lambda x: x and "ld+json" in x.lower()):
        try:
            data = json.loads(script.string or script.get_text() or "null")
        except Exception:
            continue
        nodes.extend([n for n in jsonld_nodes(data) if isinstance(n, dict)])
    title = None
    for selector in [("meta", {"property": "og:title"}), ("meta", {"name": "twitter:title"})]:
        tag = soup.find(*selector)
        if tag and tag.get("content"):
            title = tag.get("content").strip()
            break
    if not title:
        h1 = soup.find("h1")
        title = h1.get_text(" ", strip=True) if h1 else None
    if not title and soup.title:
        title = soup.title.get_text(" ", strip=True)
    if not title:
        raise RuntimeError(f"no public title found: {url}")
    desc = None
    tag = soup.find("meta", attrs={"property": "og:description"}) or soup.find("meta", attrs={"name": "description"})
    if tag and tag.get("content"):
        desc = tag.get("content").strip()
    image = None
    tag = soup.find("meta", attrs={"property": "og:image"})
    if tag and tag.get("content"):
        image = urllib.parse.urljoin(url, tag.get("content").strip())
    if not image:
        for node in nodes:
            image = image_value(node.get("image"))
            if image:
                break
    price, currency = offer_info(nodes)
    addr = address_info(nodes)
    lat, lng = geo_info(nodes)
    text_sample = " ".join([title, desc or "", soup.get_text(" ", strip=True)[:12000]])
    operation = operation_from_text(text_sample)
    source_url = f"{parsed.scheme}://{parsed.netloc}"
    source_name = host.removeprefix("www.")
    property_type = None
    for node in nodes:
        typ = node.get("@type")
        if isinstance(typ, str) and typ.lower() not in {"webpage", "website", "organization", "person", "breadcrumblist", "imageobject", "offer"}:
            property_type = typ
            break
    item = {
        "source": {"name": source_name, "url": source_url, "type": "url", "rights_basis": "public_link_only"},
        "listing": {
            "page_url": url,
            "title": title[:300],
            "summary": (desc or "")[:1200] or None,
            "operation_type": operation,
            "property_type": property_type,
            "price": price,
            "currency": currency or "MXN",
            **addr,
            "bedrooms": numeric_from_nodes(nodes, ("numberOfBedrooms", "numberOfRooms")),
            "bathrooms": numeric_from_nodes(nodes, ("numberOfBathroomsTotal", "numberOfBathrooms")),
            "area_m2": numeric_from_nodes(nodes, ("floorSize", "area")),
            "latitude": lat,
            "longitude": lng,
            "cover_image_url": image,
            "gallery": [image] if image else [],
            "rights_basis": "public_link_only",
            "rights_confirmed": False,
            "publish_authorized": False,
        },
        "contacts": contact_from_page(soup, nodes, url, source_name),
    }
    return item


def row_to_item(row: dict[str, str]) -> dict:
    contacts = []
    if any(row.get(k) for k in ("email", "phone", "whatsapp", "person_name", "company_name")):
        contacts.append({
            "party_type": row.get("party_type") or "unknown",
            "company_name": row.get("company_name") or None,
            "person_name": row.get("person_name") or None,
            "display_name": row.get("display_name") or row.get("person_name") or row.get("company_name") or None,
            "website_url": row.get("website_url") or row.get("source_url") or None,
            "email": row.get("email") or None,
            "phone": row.get("phone") or None,
            "whatsapp": row.get("whatsapp") or None,
            "role": row.get("contact_role") or "listing_contact",
            "evidence_url": row.get("evidence_url") or row.get("page_url") or row.get("external_url") or None,
            "confidence": row.get("contact_confidence") or "0.70",
        })
    return {
        "source": {"name": row.get("source_name") or None, "url": row.get("source_url") or None, "rights_basis": row.get("source_rights_basis") or "public_link_only"},
        "listing": {k: (row.get(k) or None) for k in (
            "external_key","page_url","external_url","title","summary","description","operation_type","property_type","price","currency",
            "location_text","city","state_region","country_code","postal_code","bedrooms","bathrooms","parking_spaces","area_m2","latitude","longitude","cover_image_url"
        )} | {"rights_basis": row.get("rights_basis") or "public_link_only", "rights_confirmed": str(row.get("rights_confirmed","")).lower() in {"1","true","yes"}, "publish_authorized": str(row.get("publish_authorized","")).lower() in {"1","true","yes"}},
        "contacts": contacts,
    }


def load_input(ref: str) -> Any:
    if ref.startswith("https://"):
        return fetch_text(ref)
    return Path(ref).read_text(encoding="utf-8")


def parse_payload(ref: str) -> tuple[list[dict], str | None]:
    raw = load_input(ref)
    suffix = urllib.parse.urlparse(ref).path.lower()
    if suffix.endswith(".csv"):
        rows = list(csv.DictReader(raw.splitlines()))
        return [row_to_item(r) for r in rows], None
    try:
        data = json.loads(raw)
    except Exception as exc:
        raise RuntimeError("input must be JSON/JSONL/CSV; do not point input_ref at a Google search HTML page") from exc
    seed = data.get("seed_ref") if isinstance(data, dict) else None
    if isinstance(data, list):
        return data, seed
    if not isinstance(data, dict):
        raise RuntimeError("unsupported JSON root")
    if isinstance(data.get("items"), list):
        return data["items"], seed
    if isinstance(data.get("results"), list):
        return data["results"], seed
    if isinstance(data.get("urls"), list):
        items = []
        for url in data["urls"]:
            try:
                items.append(extract_direct_listing(str(url)))
            except Exception as exc:
                print(json.dumps({"url": url, "skipped": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return items, seed
    raise RuntimeError("JSON must contain items, results, or urls")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--seed-ref", default="")
    ap.add_argument("--max-items", type=int, default=250)
    args = ap.parse_args()
    items, embedded_seed = parse_payload(args.input)
    if not items:
        raise RuntimeError("no ingestible direct results were produced")
    if len(items) > max(1, min(args.max_items, 5000)):
        items = items[: args.max_items]
    output = {"seed_ref": args.seed_ref or embedded_seed or "", "items": items}
    Path(args.output).write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"prepared": len(items), "seed_ref": output["seed_ref"], "output": args.output}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
