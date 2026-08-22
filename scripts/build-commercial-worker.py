#!/usr/bin/env python3
"""Build the versioned LISTIA commercial HTML as a Cloudflare Worker module."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


LANGUAGES = ("es", "en", "fr", "it", "pt-BR", "de", "ar-AE")


def validate_html(html: str) -> None:
    required = [
        "const LISTIA_COMMERCIAL_I18N_VERSION = '1.0.0';",
        "document.documentElement.dir = config.dir;",
        "document.getElementById('accederBtn').href = 'https://app.listiaapp.com/';",
        "canonical.href = 'https://listiaapp.com/?lang='",
    ]
    required.extend(f'<option value="{language}">' for language in LANGUAGES)
    required.extend(
        f'hreflang="{language}" href="https://listiaapp.com/?lang={language}"'
        for language in LANGUAGES
    )
    missing = [marker for marker in required if marker not in html]
    if missing:
        raise ValueError("commercial HTML validation failed; missing: " + ", ".join(missing))


def build_worker(html: str) -> str:
    validate_html(html)
    robots = "User-agent: *\nAllow: /\nSitemap: https://listiaapp.com/sitemap.xml\n"
    sitemap_urls = "".join(
        f"  <url><loc>https://listiaapp.com/?lang={language}</loc></url>\n"
        for language in LANGUAGES
    ).replace("&", "&amp;")
    sitemap = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + sitemap_urls
        + "</urlset>\n"
    )

    return f"""// Generated from commercial/index.html. Do not edit this build artifact.
const HTML = {json.dumps(html, ensure_ascii=False)};
const ROBOTS = {json.dumps(robots, ensure_ascii=False)};
const SITEMAP = {json.dumps(sitemap, ensure_ascii=False)};

const commonHeaders = {{
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'x-frame-options': 'DENY'
}};

function response(body, status, contentType, method) {{
  return new Response(method === 'HEAD' ? null : body, {{
    status,
    headers: {{
      ...commonHeaders,
      'content-type': contentType,
      'cache-control': status === 200 ? 'public, max-age=300' : 'no-store'
    }}
  }});
}}

export default {{
  async fetch(request) {{
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method !== 'GET' && method !== 'HEAD') {{
      return new Response(null, {{
        status: 405,
        headers: {{ ...commonHeaders, allow: 'GET, HEAD', 'cache-control': 'no-store' }}
      }});
    }}

    if (url.hostname === 'www.listiaapp.com') {{
      url.hostname = 'listiaapp.com';
      return Response.redirect(url.toString(), 308);
    }}

    if (url.pathname === '/' || url.pathname === '/index.html') {{
      return response(HTML, 200, 'text/html; charset=UTF-8', method);
    }}
    if (url.pathname === '/robots.txt') {{
      return response(ROBOTS, 200, 'text/plain; charset=UTF-8', method);
    }}
    if (url.pathname === '/sitemap.xml') {{
      return response(SITEMAP, 200, 'application/xml; charset=UTF-8', method);
    }}
    return response('Not Found', 404, 'text/plain; charset=UTF-8', method);
  }}
}};
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    html = args.input.read_text(encoding="utf-8")
    worker = build_worker(html)
    args.output.write_text(worker, encoding="utf-8")
    print(f"Commercial Worker build validated ({len(worker.encode('utf-8'))} bytes).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
