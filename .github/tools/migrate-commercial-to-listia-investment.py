from pathlib import Path

p=Path('scripts/build-commercial-worker.py')
s=p.read_text(encoding='utf-8')
if 'cloudco-investment-lead' not in s:
    raise SystemExit('legacy endpoint not found; migration already applied or source changed')

# Keep the builder validator aligned with the current commercial Marketplace assets.
s=s.replace('/marketplace.css?v=10','/marketplace.css?v=11')
s=s.replace('/marketplace.js?v=10','/marketplace.js?v=11')

# Replace concrete resources and routes.
s=s.replace('https://zvzafiarwerbuoaccnoz.supabase.co/functions/v1/cloudco-investment-lead','https://zvzafiarwerbuoaccnoz.supabase.co/functions/v1/listia-investment-lead')
s=s.replace('b64(c/"cloudco-assets"/"cloudco-logo-official.webp")','b64(pub/"listia-mark-transparent.webp")')
s=s.replace('Path("commercial/cloudco.html")','Path("commercial/investment.html")')
s=s.replace('(c/"cloudco.html")','(c/"investment.html")')
s=s.replace('/cloudco-assets/cloudco-logo-official.webp','/listia-mark-transparent.webp')
s=s.replace('/cloudco-assets/logo.webp','/listia-mark-transparent.webp')
s=s.replace('/cloudco/investment-plan','/investment/contact')
s=s.replace('/cloudco/index.html','/investment/index.html')
s=s.replace('/cloudco','/investment')

for old,new in (
    ('CLOUDCO_FORM_ENDPOINT','LISTIA_INVESTMENT_FORM_ENDPOINT'),
    ('cloudco_html','investment_html'),
    ('CLOUDCO_HTML','INVESTMENT_HTML'),
    ('cloudcoHeaders','investmentHeaders'),
    ('cloudcoLead','investmentLead'),
    ('CLOUDCO_LOGO_B64','LISTIA_INVESTMENT_LOGO_B64'),
    ('CLOUDCO_LOGO','LISTIA_INVESTMENT_LOGO'),
    ('validate_cloudco','validate_investment'),
    ('cloudco-worker-v3','listia-investment-worker-v1'),
):
    s=s.replace(old,new)

start=s.index('def validate_investment(html:str,footer_js:str)->None:')
end=s.index('\ndef validate_legal',start)
validator='''def validate_investment(html:str,footer_js:str)->None:\n    required=['LISTIA — Inversión y alianzas estratégicas','id="investmentForm"',"fetch('/investment/contact'",'/listia-wordmark-dark.webp','Alianza estratégica','LISTIA no solicita contraseñas']\n    missing=[x for x in required if x not in html]\n    if missing: raise ValueError("LISTIA investment HTML validation failed; missing: "+", ".join(missing))\n    if 'cloudco' in html.lower(): raise ValueError("LISTIA investment HTML contains legacy CloudCo branding")\n    if 'Powered by CloudCo' in footer_js: raise ValueError("LISTIA footer contains legacy CloudCo attribution")\n'''
s=s[:start]+validator+s[end:]

old='robots="User-agent: *\\nAllow: /\\nDisallow: /investment\\nDisallow: /investment/\\nSitemap: https://listiaapp.com/sitemap.xml\\n"'
new='robots="User-agent: *\\nAllow: /\\nSitemap: https://listiaapp.com/sitemap.xml\\n"'
if old not in s:
    raise SystemExit('robots anchor missing after route migration')
s=s.replace(old,new,1)
s=s.replace('"https://listiaapp.com/affiliate"]','"https://listiaapp.com/affiliate","https://listiaapp.com/investment"]',1)

# Only the first special-page robots header becomes indexable; API headers stay noindex.
s=s.replace("'x-robots-tag':'noindex, nofollow, noarchive, nosnippet, noimageindex'", "'x-robots-tag':'index, follow, max-image-preview:large'",1)

anchor="if(url.pathname.length>1&&url.pathname.endsWith('/')){url.pathname=url.pathname.replace(/\\/+$/,'');return Response.redirect(url.toString(),308)}"
compat="if(url.pathname==='/cloudco'||url.pathname==='/cloudco/index.html'){url.pathname='/investment';return Response.redirect(url.toString(),308)}if(url.pathname==='/cloudco/investment-plan'){if(method==='OPTIONS')return new Response(null,{status:204,headers:{...investmentHeaders,allow:'POST, OPTIONS','cache-control':'no-store'}});if(method!=='POST')return new Response(null,{status:405,headers:{...investmentHeaders,allow:'POST, OPTIONS','cache-control':'no-store'}});return investmentLead(request)}"
if anchor not in s:
    raise SystemExit('router anchor missing')
s=s.replace(anchor,anchor+compat,1)

# Remove duplicate special logo route produced by the old landing implementation.
dup="if(url.pathname==='/listia-mark-transparent.webp'||url.pathname==='/listia-mark-transparent.webp')return response(decodeBase64(LISTIA_INVESTMENT_LOGO_B64),200,'image/webp',method,investmentHeaders,'public, max-age=31536000, immutable');"
s=s.replace(dup,'')

p.write_text(s,encoding='utf-8')

a=Path('commercial/affiliate.html')
a.write_text(a.read_text(encoding='utf-8').replace(' · Powered by CloudCo','').replace('Powered by CloudCo',''),encoding='utf-8')
print('LISTIA commercial isolation transform applied')
