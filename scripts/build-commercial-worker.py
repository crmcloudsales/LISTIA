#!/usr/bin/env python3
"""Build the versioned LISTIA commercial site as a Cloudflare Worker module."""
from __future__ import annotations
import argparse, base64, json
from datetime import date
from pathlib import Path

BASE_LANGUAGES=("es","en","fr","it","pt-BR","de","ar-AE")
LANGUAGES=BASE_LANGUAGES+("ru","he","zh-CN","ja")
CLOUDCO_FORM_ENDPOINT="https://zvzafiarwerbuoaccnoz.supabase.co/functions/v1/cloudco-investment-lead"
MARKETPLACE_FEED_ENDPOINT="https://app.listiaapp.com/api/marketplace/feed"

MARKETPLACE_ROUTES={
    "/marketplace":{
        "title":"Propiedades en venta y renta en México | LISTIA Marketplace",
        "description":"Busca casas, departamentos, terrenos y propiedades en venta y renta en LISTIA. Explora inventario inmobiliario con filtros, mapa interactivo y búsqueda con IA.",
        "h1":"Propiedades en venta y renta, en un solo lugar.",
        "subtitle":"Busca por ciudad, zona, tipo, precio o recámaras. También puedes hablar con LISTIA y describir exactamente lo que necesitas.",
        "query":"","name":"México"
    },
    "/marketplace/quintana-roo":{
        "title":"Propiedades en venta y renta en Quintana Roo | LISTIA",
        "description":"Explora propiedades en venta y renta en Quintana Roo: Cancún, Playa del Carmen, Tulum, Cozumel, Isla Mujeres, Bacalar y más, con mapa y búsqueda con IA.",
        "h1":"Propiedades en venta y renta en Quintana Roo.",
        "subtitle":"Explora el inventario inmobiliario observable de Quintana Roo por zona, tipo, precio y recámaras, o dile a LISTIA lo que buscas.",
        "query":"Quintana Roo","name":"Quintana Roo"
    },
    "/marketplace/quintana-roo/venta":{
        "title":"Propiedades en venta en Quintana Roo | LISTIA",
        "description":"Casas, departamentos, terrenos y otras propiedades en venta en Quintana Roo. Busca por ciudad, precio, recámaras y mapa interactivo en LISTIA.",
        "h1":"Propiedades en venta en Quintana Roo.",
        "subtitle":"Compara inventario de venta en Cancún, Playa del Carmen, Tulum, Cozumel, Isla Mujeres, Bacalar y otras zonas del estado.",
        "query":"Quintana Roo","name":"Quintana Roo · Venta","operation":"sale"
    },
    "/marketplace/quintana-roo/renta":{
        "title":"Propiedades en renta en Quintana Roo | LISTIA",
        "description":"Encuentra casas, departamentos y otras propiedades en renta en Quintana Roo con filtros, mapa interactivo y búsqueda conversacional con LISTIA.",
        "h1":"Propiedades en renta en Quintana Roo.",
        "subtitle":"Busca rentas en Cancún, Playa del Carmen, Tulum, Cozumel, Isla Mujeres, Bacalar y otras zonas con ayuda de LISTIA.",
        "query":"Quintana Roo","name":"Quintana Roo · Renta","operation":"rent"
    },
}
for slug,name in (
    ("cancun","Cancún"),("playa-del-carmen","Playa del Carmen"),("tulum","Tulum"),
    ("puerto-morelos","Puerto Morelos"),("puerto-aventuras","Puerto Aventuras"),("cozumel","Cozumel"),
    ("isla-mujeres","Isla Mujeres"),("bacalar","Bacalar"),("mahahual","Mahahual"),
    ("chetumal","Chetumal"),("akumal","Akumal"),("holbox","Holbox")
):
    MARKETPLACE_ROUTES[f"/marketplace/quintana-roo/{slug}"]={
        "title":f"Propiedades en venta y renta en {name} | LISTIA",
        "description":f"Explora casas, departamentos, terrenos y propiedades en venta y renta en {name}, Quintana Roo, con filtros, mapa interactivo y búsqueda con IA en LISTIA.",
        "h1":f"Propiedades en venta y renta en {name}.",
        "subtitle":f"Explora inventario inmobiliario de {name} por tipo, precio y recámaras, o habla con LISTIA para buscar de forma natural.",
        "query":name,"name":name
    }

def validate_html(html:str)->None:
    required=["const LISTIA_COMMERCIAL_I18N_VERSION = '1.0.0';","const LISTIA_COMMERCIAL_INSTALL_VERSION = '1.0.0';","document.documentElement.dir = config.dir;","document.getElementById('accederBtn').href = 'https://app.listiaapp.com/';","document.getElementById('iosBtn').href = 'https://app.listiaapp.com/?install=ios';","document.getElementById('androidBtn').href = 'https://app.listiaapp.com/?install=android';","document.getElementById('desktopBtn').href = 'https://app.listiaapp.com/?install=desktop';","canonical.href = 'https://listiaapp.com/?lang='",'<script src="/footer-legal.js?v=1" defer></script>']
    required.extend(f'<option value="{x}">' for x in BASE_LANGUAGES)
    required.extend(f'hreflang="{x}" href="https://listiaapp.com/?lang={x}"' for x in BASE_LANGUAGES)
    missing=[x for x in required if x not in html]
    if missing: raise ValueError("commercial HTML validation failed; missing: "+", ".join(missing))

def validate_marketplace(html:str,css:str,js:str)->None:
    required=['__SEO_TITLE__','__SEO_DESCRIPTION__','__SEO_CANONICAL__','__SEO_JSON_LD__','__CSP_NONCE__','id="searchBtn"','id="map"','LISTIA busca por ti','/marketplace.css?v=10','/marketplace.js?v=10']
    missing=[x for x in required if x not in html]
    if missing: raise ValueError("marketplace HTML validation failed; missing: "+", ".join(missing))
    forbidden=['zvzafiarwerbuoaccnoz.supabase.co','sb_publishable_','/rest/v1/marketplace_listings','/rest/v1/rpc/marketplace_public_feed']
    leaked=[x for x in forbidden if x in html or x in js]
    if leaked: raise ValueError("marketplace source bypass detected: "+", ".join(leaked))
    for marker in ("/marketplace/api/feed","p_limit","p_offset","Cargar más"):
        if marker not in js and marker not in html: raise ValueError(f"marketplace client missing {marker}")
    if '.filters' not in css or '.mapwrap' not in css: raise ValueError('marketplace CSS incomplete')

def validate_locale_assets(global_js:str,japanese_js:str,footer_js:str)->None:
    missing=[x for x in ["ru:","he:","'zh-CN':","Русский","עברית","简体中文"] if x not in global_js]+[x for x in ["const key='ja'","日本語","ja-JP"] if x not in japanese_js]
    if missing: raise ValueError("commercial locale validation failed; missing: "+", ".join(missing))
    for lang in ("ru","he","zh-CN","ja"):
        if lang not in footer_js: raise ValueError(f"footer missing locale {lang}")
    if 'href="/terms.html"' not in footer_js or 'href="/privacy.html"' not in footer_js: raise ValueError("commercial footer must link local current legal pages")

def validate_cloudco(html:str,footer_js:str)->None:
    required=['name="robots" content="noindex,nofollow,noarchive,nosnippet,noimageindex"','src="/cloudco-assets/cloudco-logo-official.webp"','upload.wikimedia.org','id="investmentForm"',"'/cloudco/investment-plan'",'Conversemos','Aceleramos y aumentamos tu productividad','1975','1976','1994','1998','2015','2026','cloudco-arrival']
    missing=[x for x in required if x not in html]
    if missing: raise ValueError("CloudCo HTML validation failed; missing: "+", ".join(missing))
    if 'href="/cloudco">CloudCo</a>' not in footer_js: raise ValueError("footer attribution does not point to /cloudco")

def validate_legal(terms_html:str,privacy_html:str)->None:
    if 'Version 1.4' not in terms_html or 'LISTIA Voice' not in terms_html or 'up to three non-archived properties' not in terms_html: raise ValueError('Terms are not current v1.4')
    if 'Version 1.3' not in privacy_html or '<h1>Privacy Policy</h1>' not in privacy_html: raise ValueError('Privacy Policy is not current v1.3')

def b64(path:Path)->str: return base64.b64encode(path.read_bytes()).decode("ascii")

def build_worker(html:str,marketplace_html:str,marketplace_css:str,marketplace_js:str,affiliate_html:str,affiliate_icon_svg:str,site_logo_svg:str,cloudco_html:str,footer_js:str,global_locales_js:str,japanese_js:str,terms_html:str,privacy_html:str,legal_css:str,logo_b64:str,listia_mark_b64:str,wordmark_light_b64:str,wordmark_dark_b64:str,favicon_b64:str)->str:
    validate_html(html);validate_marketplace(marketplace_html,marketplace_css,marketplace_js);validate_locale_assets(global_locales_js,japanese_js,footer_js);validate_cloudco(cloudco_html,footer_js);validate_legal(terms_html,privacy_html)
    if 'LISTIA Affiliate Program' not in affiliate_html or '40%' not in affiliate_html: raise ValueError('affiliate portal validation failed')
    cloudco_html=cloudco_html.replace('/cloudco-assets/cloudco-logo-official.webp','/cloudco-assets/cloudco-logo-official.webp?v=2')
    robots="User-agent: *\nAllow: /\nDisallow: /cloudco\nDisallow: /cloudco/\nSitemap: https://listiaapp.com/sitemap.xml\n"
    today=date.today().isoformat()
    urls=[*(f"https://listiaapp.com/?lang={x}" for x in LANGUAGES),*(f"https://listiaapp.com{p}" for p in MARKETPLACE_ROUTES),"https://listiaapp.com/affiliate"]
    sitemap_urls="".join(f"  <url><loc>{u.replace('&','&amp;')}</loc><lastmod>{today}</lastmod></url>\n" for u in urls)
    sitemap='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+sitemap_urls+'</urlset>\n'
    replacements={
        '__HTML__':json.dumps(html,ensure_ascii=False),'__MARKETPLACE_HTML__':json.dumps(marketplace_html,ensure_ascii=False),
        '__MARKETPLACE_CSS__':json.dumps(marketplace_css,ensure_ascii=False),'__MARKETPLACE_JS__':json.dumps(marketplace_js,ensure_ascii=False),
        '__MARKETPLACE_ROUTES__':json.dumps(MARKETPLACE_ROUTES,ensure_ascii=False),'__MARKETPLACE_FEED_ENDPOINT__':json.dumps(MARKETPLACE_FEED_ENDPOINT),
        '__AFFILIATE_HTML__':json.dumps(affiliate_html,ensure_ascii=False),'__AFFILIATE_ICON__':json.dumps(affiliate_icon_svg,ensure_ascii=False),'__SITE_LOGO__':json.dumps(site_logo_svg,ensure_ascii=False),
        '__WORDMARK_LIGHT__':json.dumps(wordmark_light_b64),'__WORDMARK_DARK__':json.dumps(wordmark_dark_b64),'__FAVICON__':json.dumps(favicon_b64),
        '__CLOUDCO_HTML__':json.dumps(cloudco_html,ensure_ascii=False),'__FOOTER_JS__':json.dumps(footer_js,ensure_ascii=False),'__GLOBAL_LOCALES_JS__':json.dumps(global_locales_js,ensure_ascii=False),'__JAPANESE_JS__':json.dumps(japanese_js,ensure_ascii=False),
        '__TERMS_HTML__':json.dumps(terms_html,ensure_ascii=False),'__PRIVACY_HTML__':json.dumps(privacy_html,ensure_ascii=False),'__LEGAL_CSS__':json.dumps(legal_css,ensure_ascii=False),'__CLOUDCO_LOGO__':json.dumps(logo_b64),'__LISTIA_MARK__':json.dumps(listia_mark_b64),
        '__CLOUDCO_FORM_ENDPOINT__':json.dumps(CLOUDCO_FORM_ENDPOINT),'__ROBOTS__':json.dumps(robots,ensure_ascii=False),'__SITEMAP__':json.dumps(sitemap,ensure_ascii=False)
    }
    template=r'''// Generated from LISTIA commercial sources. Do not edit this build artifact.
const HTML=__HTML__;
const MARKETPLACE_HTML=__MARKETPLACE_HTML__;
const MARKETPLACE_CSS=__MARKETPLACE_CSS__;
const MARKETPLACE_JS=__MARKETPLACE_JS__;
const MARKETPLACE_ROUTES=__MARKETPLACE_ROUTES__;
const MARKETPLACE_FEED_ENDPOINT=__MARKETPLACE_FEED_ENDPOINT__;
const AFFILIATE_HTML=__AFFILIATE_HTML__;
const AFFILIATE_ICON=__AFFILIATE_ICON__;
const SITE_LOGO=__SITE_LOGO__;
const LISTIA_WORDMARK_LIGHT_B64=__WORDMARK_LIGHT__;
const LISTIA_WORDMARK_DARK_B64=__WORDMARK_DARK__;
const LISTIA_FAVICON_B64=__FAVICON__;
const CLOUDCO_HTML=__CLOUDCO_HTML__;
const FOOTER_JS=__FOOTER_JS__;
const GLOBAL_LOCALES_JS=__GLOBAL_LOCALES_JS__;
const JAPANESE_LOCALE_JS=__JAPANESE_JS__;
const TERMS_HTML=__TERMS_HTML__;
const PRIVACY_HTML=__PRIVACY_HTML__;
const LEGAL_CSS=__LEGAL_CSS__;
const CLOUDCO_LOGO_B64=__CLOUDCO_LOGO__;
const LISTIA_MARK_B64=__LISTIA_MARK__;
const CLOUDCO_FORM_ENDPOINT=__CLOUDCO_FORM_ENDPOINT__;
const ROBOTS=__ROBOTS__;
const SITEMAP=__SITEMAP__;
const commonHeaders={'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','x-frame-options':'DENY','cross-origin-opener-policy':'same-origin','origin-agent-cluster':'?1','x-permitted-cross-domain-policies':'none','strict-transport-security':'max-age=31536000; includeSubDomains; preload'};
const cloudcoHeaders={...commonHeaders,'permissions-policy':'camera=(), microphone=(), geolocation=()','x-robots-tag':'noindex, nofollow, noarchive, nosnippet, noimageindex','content-security-policy':"default-src 'self'; img-src 'self' data: https://upload.wikimedia.org; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
const apiHeaders={...commonHeaders,'permissions-policy':'camera=(), microphone=(), geolocation=()','x-robots-tag':'noindex, nofollow, noarchive, nosnippet, noimageindex','cross-origin-resource-policy':'same-origin'};
function response(body,status,contentType,method,extraHeaders={},cacheControl=null){return new Response(method==='HEAD'?null:body,{status,headers:{...commonHeaders,...extraHeaders,'content-type':contentType,'cache-control':cacheControl||(status===200?'public, max-age=60, must-revalidate':'no-store')}})}
function decodeBase64(v){const b=atob(v),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
function clean(v,n){return String(v??'').trim().slice(0,n)}
function finite(v){const n=Number(v);return Number.isFinite(n)?n:null}
function marketNonce(){return crypto.randomUUID().replaceAll('-','')}
function marketplaceStructured(cfg,canonical){return {'@context':'https://schema.org','@graph':[{'@type':'WebSite','@id':'https://listiaapp.com/#website','url':'https://listiaapp.com/','name':'LISTIA','potentialAction':{'@type':'SearchAction','target':{'@type':'EntryPoint','urlTemplate':'https://listiaapp.com/marketplace?q={search_term_string}'},'query-input':'required name=search_term_string'}},{'@type':'CollectionPage','@id':canonical+'#page','url':canonical,'name':cfg.title,'description':cfg.description,'isPartOf':{'@id':'https://listiaapp.com/#website'},'about':{'@type':'Thing','name':'Real estate'}},{'@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':1,'name':'LISTIA','item':'https://listiaapp.com/'},{'@type':'ListItem','position':2,'name':'Marketplace','item':'https://listiaapp.com/marketplace'},...((canonical==='https://listiaapp.com/marketplace')?[]:[{'@type':'ListItem','position':3,'name':cfg.name,'item':canonical}])]}]}}
function renderMarketplace(path){const cfg=MARKETPLACE_ROUTES[path];if(!cfg)return null;const nonce=marketNonce(),canonical='https://listiaapp.com'+path,jsonLd=JSON.stringify(marketplaceStructured(cfg,canonical)).replaceAll('<','\\u003c');let page=MARKETPLACE_HTML;const pairs={'__SEO_TITLE__':cfg.title,'__SEO_DESCRIPTION__':cfg.description,'__SEO_CANONICAL__':canonical,'__SEO_H1__':cfg.h1,'__SEO_SUBTITLE__':cfg.subtitle,'__MARKET_QUERY__':cfg.query||'','__MARKET_NAME__':cfg.name||'','__SEO_JSON_LD__':jsonLd,'__CSP_NONCE__':nonce};for(const [k,v] of Object.entries(pairs))page=page.split(k).join(String(v));const csp=`default-src 'self'; script-src 'self' 'nonce-${nonce}' https://unpkg.com; style-src 'self' https://unpkg.com; img-src 'self' data: https:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; worker-src 'none'; manifest-src 'self'; media-src 'none'; upgrade-insecure-requests`;return {page,headers:{...commonHeaders,'permissions-policy':'camera=(), microphone=(), geolocation=()','cross-origin-resource-policy':'same-origin','x-robots-tag':'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1','content-security-policy':csp}}}
async function marketplaceFeed(request){const origin=request.headers.get('origin')||'',sec=request.headers.get('sec-fetch-site')||'';if(origin!=='https://listiaapp.com'||(sec&&sec!=='same-origin'))return response(JSON.stringify({error:'origin_not_allowed'}),403,'application/json; charset=UTF-8','GET',apiHeaders,'no-store');const ct=(request.headers.get('content-type')||'').toLowerCase();if(!ct.includes('application/json'))return response(JSON.stringify({error:'json_required'}),415,'application/json; charset=UTF-8','GET',apiHeaders,'no-store');const raw=await request.text();if(new TextEncoder().encode(raw).byteLength>8192)return response(JSON.stringify({error:'payload_too_large'}),413,'application/json; charset=UTF-8','GET',apiHeaders,'no-store');let b;try{b=JSON.parse(raw)}catch{return response(JSON.stringify({error:'invalid_json'}),400,'application/json; charset=UTF-8','GET',apiHeaders,'no-store')}if(!b||typeof b!=='object'||Array.isArray(b))return response(JSON.stringify({error:'invalid_json'}),400,'application/json; charset=UTF-8','GET',apiHeaders,'no-store');const payload={p_limit:Math.min(Math.max(finite(b.p_limit)||30,1),30),p_offset:Math.min(Math.max(finite(b.p_offset)||0,0),5000),p_q:clean(b.p_q,120)||null,p_operation:['sale','rent'].includes(clean(b.p_operation,30))?clean(b.p_operation,30):null,p_property_type:clean(b.p_property_type,80)||null,p_min_price:finite(b.p_min_price),p_max_price:finite(b.p_max_price),p_bedrooms:finite(b.p_bedrooms)};const upstream=await fetch(MARKETPLACE_FEED_ENDPOINT,{method:'POST',headers:{'content-type':'application/json','accept':'application/json','origin':'https://listiaapp.com','x-listia-source':'commercial-marketplace-v10'},body:JSON.stringify(payload)}).catch(()=>null);if(!upstream)return response(JSON.stringify({error:'upstream_unavailable'}),503,'application/json; charset=UTF-8','GET',apiHeaders,'no-store');const text=await upstream.text();return response(text,upstream.status,upstream.headers.get('content-type')||'application/json; charset=UTF-8','GET',apiHeaders,'no-store')}
async function cloudcoLead(request){const origin=request.headers.get('origin')||'';if(!['https://listiaapp.com','https://www.listiaapp.com'].includes(origin))return response(JSON.stringify({error:'origin_not_allowed'}),403,'application/json; charset=UTF-8','GET',cloudcoHeaders,'no-store');const ct=(request.headers.get('content-type')||'').toLowerCase();if(!ct.includes('application/json'))return response(JSON.stringify({error:'json_required'}),415,'application/json; charset=UTF-8','GET',cloudcoHeaders,'no-store');const body=await request.text();if(new TextEncoder().encode(body).byteLength>20000)return response(JSON.stringify({error:'payload_too_large'}),413,'application/json; charset=UTF-8','GET',cloudcoHeaders,'no-store');try{JSON.parse(body)}catch{return response(JSON.stringify({error:'invalid_json'}),400,'application/json; charset=UTF-8','GET',cloudcoHeaders,'no-store')}const upstream=await fetch(CLOUDCO_FORM_ENDPOINT,{method:'POST',headers:{'content-type':'application/json','accept':'application/json','origin':'https://listiaapp.com','x-listia-client-ip':request.headers.get('cf-connecting-ip')||'','x-listia-source':'cloudco-worker-v3','user-agent':request.headers.get('user-agent')||''},body});return response(await upstream.text(),upstream.status,'application/json; charset=UTF-8','GET',cloudcoHeaders,'no-store')}
export default{async fetch(request){const url=new URL(request.url),method=request.method.toUpperCase();if(url.hostname==='www.listiaapp.com'){url.hostname='listiaapp.com';return Response.redirect(url.toString(),308)}if(url.pathname.length>1&&url.pathname.endsWith('/')){url.pathname=url.pathname.replace(/\/+$/,'');return Response.redirect(url.toString(),308)}if(url.pathname==='/marketplace/api/feed'){if(method!=='POST')return new Response(null,{status:405,headers:{...apiHeaders,allow:'POST','cache-control':'no-store'}});return marketplaceFeed(request)}if(url.pathname==='/cloudco/investment-plan'){if(method==='OPTIONS')return new Response(null,{status:204,headers:{...cloudcoHeaders,allow:'POST, OPTIONS','cache-control':'no-store'}});if(method!=='POST')return new Response(null,{status:405,headers:{...cloudcoHeaders,allow:'POST, OPTIONS','cache-control':'no-store'}});return cloudcoLead(request)}if(method!=='GET'&&method!=='HEAD')return new Response(null,{status:405,headers:{...commonHeaders,allow:'GET, HEAD','cache-control':'no-store'}});if(url.pathname==='/'||url.pathname==='/index.html')return response(HTML,200,'text/html; charset=UTF-8',method);const market=renderMarketplace(url.pathname);if(market)return response(market.page,200,'text/html; charset=UTF-8',method,market.headers,'public, max-age=30, must-revalidate');if(url.pathname==='/marketplace.css')return response(MARKETPLACE_CSS,200,'text/css; charset=UTF-8',method,{'x-content-type-options':'nosniff'},'public, max-age=3600, must-revalidate');if(url.pathname==='/marketplace.js')return response(MARKETPLACE_JS,200,'application/javascript; charset=UTF-8',method,{'x-content-type-options':'nosniff','x-robots-tag':'noindex'},'public, max-age=3600, must-revalidate');if(url.pathname==='/affiliate'||url.pathname==='/affiliate/index.html')return response(AFFILIATE_HTML,200,'text/html; charset=UTF-8',method,{'x-robots-tag':'index, follow, max-image-preview:large'},'public, max-age=30, must-revalidate');if(url.pathname==='/listia-official-icon-v3.svg')return response(AFFILIATE_ICON,200,'image/svg+xml; charset=UTF-8',method,{},'public, max-age=31536000, immutable');if(url.pathname==='/listia-site-isotipo-v4.svg')return response(SITE_LOGO,200,'image/svg+xml; charset=UTF-8',method,{},'public, max-age=31536000, immutable');if(url.pathname==='/listia-wordmark-light.webp')return response(decodeBase64(LISTIA_WORDMARK_LIGHT_B64),200,'image/webp',method,{},'public, max-age=31536000, immutable');if(url.pathname==='/listia-wordmark-dark.webp')return response(decodeBase64(LISTIA_WORDMARK_DARK_B64),200,'image/webp',method,{},'public, max-age=31536000, immutable');if(url.pathname==='/listia-app-icon-32.png'||url.pathname==='/favicon.ico')return response(decodeBase64(LISTIA_FAVICON_B64),200,'image/png',method,{},'public, max-age=31536000, immutable');if(url.pathname==='/footer-legal.js')return response(FOOTER_JS,200,'application/javascript; charset=UTF-8',method);if(url.pathname==='/global-locales.js')return response(GLOBAL_LOCALES_JS,200,'application/javascript; charset=UTF-8',method);if(url.pathname==='/japanese-locale.js')return response(JAPANESE_LOCALE_JS,200,'application/javascript; charset=UTF-8',method);if(url.pathname==='/terms'||url.pathname==='/terms.html')return response(TERMS_HTML,200,'text/html; charset=UTF-8',method);if(url.pathname==='/privacy'||url.pathname==='/privacy.html')return response(PRIVACY_HTML,200,'text/html; charset=UTF-8',method);if(url.pathname==='/legal.css')return response(LEGAL_CSS,200,'text/css; charset=UTF-8',method);if(url.pathname==='/listia-mark-transparent.webp')return response(decodeBase64(LISTIA_MARK_B64),200,'image/webp',method,{},'public, max-age=31536000, immutable');if(url.pathname==='/cloudco'||url.pathname==='/cloudco/index.html')return response(CLOUDCO_HTML,200,'text/html; charset=UTF-8',method,cloudcoHeaders,'private, no-store');if(url.pathname==='/cloudco-assets/cloudco-logo-official.webp'||url.pathname==='/cloudco-assets/logo.webp')return response(decodeBase64(CLOUDCO_LOGO_B64),200,'image/webp',method,cloudcoHeaders,'public, max-age=31536000, immutable');if(url.pathname==='/robots.txt')return response(ROBOTS,200,'text/plain; charset=UTF-8',method);if(url.pathname==='/sitemap.xml')return response(SITEMAP,200,'application/xml; charset=UTF-8',method);return response('Not Found',404,'text/plain; charset=UTF-8',method,{'x-robots-tag':'noindex, nofollow'},'no-store')}};
'''
    for key,value in replacements.items(): template=template.replace(key,value)
    return template

def main()->int:
    p=argparse.ArgumentParser();p.add_argument("input",type=Path);p.add_argument("output",type=Path);a=p.parse_args()
    html=a.input.read_text(encoding="utf-8");c=Path("commercial") if Path("commercial/cloudco.html").exists() else a.input.parent;pub=Path("public") if Path("public/terms.html").exists() else a.input.parent.parent/"public"
    worker=build_worker(html,(c/"marketplace.html").read_text(encoding="utf-8"),(c/"marketplace.css").read_text(encoding="utf-8"),(c/"marketplace.js").read_text(encoding="utf-8"),(c/"affiliate.html").read_text(encoding="utf-8"),(c/"listia-official-icon-v3.svg").read_text(encoding="utf-8"),(c/"listia-site-isotipo-v4.svg").read_text(encoding="utf-8"),(c/"cloudco.html").read_text(encoding="utf-8"),(c/"footer-legal.js").read_text(encoding="utf-8"),(c/"global-locales.js").read_text(encoding="utf-8"),(c/"japanese-locale.js").read_text(encoding="utf-8"),(pub/"terms.html").read_text(encoding="utf-8"),(pub/"privacy.html").read_text(encoding="utf-8"),(pub/"legal.css").read_text(encoding="utf-8"),b64(c/"cloudco-assets"/"cloudco-logo-official.webp"),b64(pub/"listia-mark-transparent.webp"),b64(c/"listia-wordmark-light.webp"),b64(c/"listia-wordmark-dark.webp"),b64(pub/"listia-app-icon-32.png"))
    a.output.write_text(worker,encoding="utf-8");print(f"Commercial Worker build validated for {len(LANGUAGES)} languages, {len(MARKETPLACE_ROUTES)} SEO marketplace routes ({len(worker.encode('utf-8'))} bytes).") ;return 0
if __name__=="__main__": raise SystemExit(main())
