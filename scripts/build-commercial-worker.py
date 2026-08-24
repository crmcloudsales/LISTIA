#!/usr/bin/env python3
"""Build the versioned LISTIA commercial site as a Cloudflare Worker module."""
from __future__ import annotations
import argparse, base64, json
from pathlib import Path

BASE_LANGUAGES=("es","en","fr","it","pt-BR","de","ar-AE")
LANGUAGES=BASE_LANGUAGES+("ru","he","zh-CN","ja")
CLOUDCO_FORM_ENDPOINT="https://zvzafiarwerbuoaccnoz.supabase.co/functions/v1/cloudco-investment-lead"


def validate_html(html:str)->None:
    required=[
        "const LISTIA_COMMERCIAL_I18N_VERSION = '1.0.0';",
        "const LISTIA_COMMERCIAL_INSTALL_VERSION = '1.0.0';",
        "document.documentElement.dir = config.dir;",
        "document.getElementById('accederBtn').href = 'https://app.listiaapp.com/';",
        "document.getElementById('iosBtn').href = 'https://app.listiaapp.com/?install=ios';",
        "document.getElementById('androidBtn').href = 'https://app.listiaapp.com/?install=android';",
        "document.getElementById('desktopBtn').href = 'https://app.listiaapp.com/?install=desktop';",
        "canonical.href = 'https://listiaapp.com/?lang='",
        '<script src="/footer-legal.js?v=1" defer></script>',
    ]
    required.extend(f'<option value="{x}">' for x in BASE_LANGUAGES)
    required.extend(f'hreflang="{x}" href="https://listiaapp.com/?lang={x}"' for x in BASE_LANGUAGES)
    missing=[x for x in required if x not in html]
    if missing: raise ValueError("commercial HTML validation failed; missing: "+", ".join(missing))


def validate_locale_assets(global_js:str,japanese_js:str,footer_js:str)->None:
    required_global=["ru:","he:","'zh-CN':", "Русский", "עברית", "简体中文"]
    required_ja=["const key='ja'", "日本語", "ja-JP"]
    missing=[x for x in required_global if x not in global_js]+[x for x in required_ja if x not in japanese_js]
    if missing: raise ValueError("commercial locale validation failed; missing: "+", ".join(missing))
    for lang in ("ru","he","zh-CN","ja"):
        if lang not in footer_js: raise ValueError(f"footer missing locale {lang}")
    if 'href="/terms.html"' not in footer_js or 'href="/privacy.html"' not in footer_js:
        raise ValueError("commercial footer must link local current legal pages")


def validate_cloudco(html:str,footer_js:str)->None:
    required=[
        'name="robots" content="noindex,nofollow,noarchive,nosnippet,noimageindex"',
        'src="/cloudco-assets/cloudco-logo-official.webp"',
        'upload.wikimedia.org',
        'id="investmentForm"',
        "'/cloudco/investment-plan'",
        'Plan de Inversión',
        'Aceleramos y Aumentamos tu productividad',
        '1975', '1976', '1994', '1998', '2015', '2026',
        'cloudco-arrival',
    ]
    missing=[x for x in required if x not in html]
    if missing: raise ValueError("CloudCo HTML validation failed; missing: "+", ".join(missing))
    if 'href="/cloudco">CloudCo</a>' not in footer_js:
        raise ValueError("footer attribution does not point to /cloudco")


def validate_legal(terms_html:str,privacy_html:str)->None:
    if 'Version 1.4' not in terms_html or 'LISTIA Voice' not in terms_html or 'up to three non-archived properties' not in terms_html:
        raise ValueError('Terms are not current v1.4')
    if '<h1>Privacy Policy</h1>' not in privacy_html:
        raise ValueError('Privacy Policy source missing')


def b64(path:Path)->str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def build_worker(html:str,cloudco_html:str,footer_js:str,global_locales_js:str,japanese_js:str,terms_html:str,privacy_html:str,legal_css:str,logo_b64:str,listia_mark_b64:str)->str:
    validate_html(html);validate_locale_assets(global_locales_js,japanese_js,footer_js);validate_cloudco(cloudco_html,footer_js);validate_legal(terms_html,privacy_html)
    robots="User-agent: *\nAllow: /\nDisallow: /cloudco\nDisallow: /cloudco/\nSitemap: https://listiaapp.com/sitemap.xml\n"
    sitemap_urls="".join(f"  <url><loc>https://listiaapp.com/?lang={x}</loc></url>\n" for x in LANGUAGES).replace("&","&amp;")
    sitemap='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+sitemap_urls+'</urlset>\n'
    return f'''// Generated from commercial sources. Do not edit this build artifact.
const HTML={json.dumps(html,ensure_ascii=False)};
const CLOUDCO_HTML={json.dumps(cloudco_html,ensure_ascii=False)};
const FOOTER_JS={json.dumps(footer_js,ensure_ascii=False)};
const GLOBAL_LOCALES_JS={json.dumps(global_locales_js,ensure_ascii=False)};
const JAPANESE_LOCALE_JS={json.dumps(japanese_js,ensure_ascii=False)};
const TERMS_HTML={json.dumps(terms_html,ensure_ascii=False)};
const PRIVACY_HTML={json.dumps(privacy_html,ensure_ascii=False)};
const LEGAL_CSS={json.dumps(legal_css,ensure_ascii=False)};
const CLOUDCO_LOGO_B64={json.dumps(logo_b64)};
const LISTIA_MARK_B64={json.dumps(listia_mark_b64)};
const CLOUDCO_FORM_ENDPOINT={json.dumps(CLOUDCO_FORM_ENDPOINT)};
const ROBOTS={json.dumps(robots,ensure_ascii=False)};
const SITEMAP={json.dumps(sitemap,ensure_ascii=False)};
const commonHeaders={{'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','permissions-policy':'camera=(), microphone=(), geolocation=()','x-frame-options':'DENY','cross-origin-opener-policy':'same-origin'}};
const cloudcoHeaders={{...commonHeaders,'x-robots-tag':'noindex, nofollow, noarchive, nosnippet, noimageindex','content-security-policy':"default-src 'self'; img-src 'self' data: https://upload.wikimedia.org; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"}};
function response(body,status,contentType,method,extraHeaders={{}},cacheControl=null){{return new Response(method==='HEAD'?null:body,{{status,headers:{{...commonHeaders,...extraHeaders,'content-type':contentType,'cache-control':cacheControl||(status===200?'public, max-age=60, must-revalidate':'no-store')}}}})}}
function decodeBase64(v){{const b=atob(v),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}}
async function cloudcoLead(request){{const origin=request.headers.get('origin')||'';if(!['https://listiaapp.com','https://www.listiaapp.com'].includes(origin))return response(JSON.stringify({{error:'origin_not_allowed'}}),403,'application/json; charset=UTF-8','GET',cloudcoHeaders,'no-store');const ct=(request.headers.get('content-type')||'').toLowerCase();if(!ct.includes('application/json'))return response(JSON.stringify({{error:'json_required'}}),415,'application/json; charset=UTF-8','GET',cloudcoHeaders,'no-store');const body=await request.text();if(new TextEncoder().encode(body).byteLength>20000)return response(JSON.stringify({{error:'payload_too_large'}}),413,'application/json; charset=UTF-8','GET',cloudcoHeaders,'no-store');try{{JSON.parse(body)}}catch(_){{return response(JSON.stringify({{error:'invalid_json'}}),400,'application/json; charset=UTF-8','GET',cloudcoHeaders,'no-store')}}const upstream=await fetch(CLOUDCO_FORM_ENDPOINT,{{method:'POST',headers:{{'content-type':'application/json','accept':'application/json','origin':'https://listiaapp.com','x-listia-client-ip':request.headers.get('cf-connecting-ip')||'','x-listia-source':'cloudco-worker-v3','user-agent':request.headers.get('user-agent')||''}},body}});return response(await upstream.text(),upstream.status,'application/json; charset=UTF-8','GET',cloudcoHeaders,'no-store')}}
export default{{async fetch(request){{const url=new URL(request.url),method=request.method.toUpperCase();if(url.hostname==='www.listiaapp.com'){{url.hostname='listiaapp.com';return Response.redirect(url.toString(),308)}}if(url.pathname==='/cloudco/investment-plan'){{if(method==='OPTIONS')return new Response(null,{{status:204,headers:{{...cloudcoHeaders,allow:'POST, OPTIONS','cache-control':'no-store'}}}});if(method!=='POST')return new Response(null,{{status:405,headers:{{...cloudcoHeaders,allow:'POST, OPTIONS','cache-control':'no-store'}}}});return cloudcoLead(request)}}if(method!=='GET'&&method!=='HEAD')return new Response(null,{{status:405,headers:{{...commonHeaders,allow:'GET, HEAD','cache-control':'no-store'}}}});if(url.pathname==='/'||url.pathname==='/index.html')return response(HTML,200,'text/html; charset=UTF-8',method);if(url.pathname==='/footer-legal.js')return response(FOOTER_JS,200,'application/javascript; charset=UTF-8',method);if(url.pathname==='/global-locales.js')return response(GLOBAL_LOCALES_JS,200,'application/javascript; charset=UTF-8',method);if(url.pathname==='/japanese-locale.js')return response(JAPANESE_LOCALE_JS,200,'application/javascript; charset=UTF-8',method);if(url.pathname==='/terms'||url.pathname==='/terms.html')return response(TERMS_HTML,200,'text/html; charset=UTF-8',method);if(url.pathname==='/privacy'||url.pathname==='/privacy.html')return response(PRIVACY_HTML,200,'text/html; charset=UTF-8',method);if(url.pathname==='/legal.css')return response(LEGAL_CSS,200,'text/css; charset=UTF-8',method);if(url.pathname==='/listia-mark-transparent.webp')return response(decodeBase64(LISTIA_MARK_B64),200,'image/webp',method,{{}},'public, max-age=31536000, immutable');if(url.pathname==='/cloudco'||url.pathname==='/cloudco/'||url.pathname==='/cloudco/index.html')return response(CLOUDCO_HTML,200,'text/html; charset=UTF-8',method,cloudcoHeaders,'private, no-store');if(url.pathname==='/cloudco-assets/cloudco-logo-official.webp'||url.pathname==='/cloudco-assets/logo.webp')return response(decodeBase64(CLOUDCO_LOGO_B64),200,'image/webp',method,cloudcoHeaders,'public, max-age=31536000, immutable');if(url.pathname==='/robots.txt')return response(ROBOTS,200,'text/plain; charset=UTF-8',method);if(url.pathname==='/sitemap.xml')return response(SITEMAP,200,'application/xml; charset=UTF-8',method);return response('Not Found',404,'text/plain; charset=UTF-8',method)}}}};'''


def main()->int:
    p=argparse.ArgumentParser();p.add_argument("input",type=Path);p.add_argument("output",type=Path);a=p.parse_args()
    html=a.input.read_text(encoding="utf-8")
    c=Path("commercial") if Path("commercial/cloudco.html").exists() else a.input.parent
    pub=Path("public") if Path("public/terms.html").exists() else a.input.parent.parent/"public"
    worker=build_worker(
        html,
        (c/"cloudco.html").read_text(encoding="utf-8"),
        (c/"footer-legal.js").read_text(encoding="utf-8"),
        (c/"global-locales.js").read_text(encoding="utf-8"),
        (c/"japanese-locale.js").read_text(encoding="utf-8"),
        (pub/"terms.html").read_text(encoding="utf-8"),
        (pub/"privacy.html").read_text(encoding="utf-8"),
        (pub/"legal.css").read_text(encoding="utf-8"),
        b64(c/"cloudco-assets"/"cloudco-logo-official.webp"),
        b64(pub/"listia-mark-transparent.webp"),
    )
    a.output.write_text(worker,encoding="utf-8")
    print(f"Commercial Worker build validated for {len(LANGUAGES)} languages ({len(worker.encode('utf-8'))} bytes).")
    return 0

if __name__=="__main__": raise SystemExit(main())
