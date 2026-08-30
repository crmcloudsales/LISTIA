from pathlib import Path
import re

p = Path('sites-worker/index.js')
s = p.read_text(encoding='utf-8')

if 'MANAGED_SITE_EDGE_PROOF' in s and 'function siteBrand(data)' in s:
    print('Pennyworth managed-site patch already present')
    raise SystemExit(0)

marker = 'const baseCss=`:root{color-scheme:dark;--p:#7c3cff}'
if marker not in s:
    raise SystemExit('Expected baseCss marker not found')

helpers = r'''function safeBrandHex(v,fallback){const x=String(v||'');return /^#[0-9a-f]{6}$/i.test(x)?x:fallback}
function siteBrand(data){const b=data?.website?.configuration?.branding||{};const font=/^[A-Za-z0-9 _-]{1,50}$/.test(String(b.font_family||''))?String(b.font_family):'Inter';const logo=/^https:\/\//i.test(String(b.logo_url||''))?String(b.logo_url):'';return{name:String(b.business_name||data?.organization?.name||'LISTIA').slice(0,120),primary:safeBrandHex(b.primary_color,'#7c3cff'),secondary:safeBrandHex(b.secondary_color,'#a982ff'),font,logo}}
function brandStyle(data){const b=siteBrand(data);return `--p:${b.primary};--accent:${b.secondary};font-family:${b.font},Inter,system-ui,-apple-system,sans-serif`}
'''
s = s.replace(marker, helpers + 'const baseCss=`:root{color-scheme:dark;--p:#7c3cff;--accent:#a982ff}', 1)
s = s.replace('.brand i{color:#9a68ff;', '.brand i{color:var(--accent);')
s = s.replace('.hero small{color:#a982ff;', '.hero small{color:var(--accent);')
s = s.replace('.pc span{color:#aa83ff;', '.pc span{color:var(--accent);')
s = s.replace('border-color:#7c3cff88;background:#7c3cff18', 'border-color:var(--p);background:#ffffff0b')

new_header = r'''function header(org,locale,settings,path,branding={}){const home=localePath(locale,settings.defaultLocale,'/'),logo=branding.logo?`<img src="${esc(branding.logo)}" alt="${esc(branding.name||org.name||'')}" style="height:34px;max-width:150px;object-fit:contain;margin-right:9px">`:'';return `<header><a class="brand" href="${esc(home)}">${logo}<i>◆</i> ${esc(branding.name||org.name||'LISTIA')}</a><div class="market">${esc(org.primary_market||'Real Estate')}</div></header><nav class="langs" aria-label="Language">${settings.enabled.map(l=>`<a href="${esc(localePath(l,settings.defaultLocale,path))}" ${l===locale?'aria-current="true"':''}>${esc(l)}</a>`).join('')}</nav>`}'''
s, n = re.subn(r'function header\(org,locale,settings,path\)\{.*?\}\nfunction interestModal', new_header + '\nfunction interestModal', s, count=1, flags=re.S)
if n != 1:
    raise SystemExit('header patch failed')

new_modal = r'''function interestModal(sitekey,enabled,locale){const x=T[locale]||T.es;if(!enabled)return `<div class="modal" id="m"><div class="sheet"><h3>${esc(x.protected)}</h3><p>${esc(x.activation)}</p><button class="close" type="button" onclick="document.getElementById('m').classList.remove('open')">${esc(x.close)}</button></div></div><script>document.querySelectorAll('[data-interest]').forEach(b=>b.onclick=()=>document.getElementById('m').classList.add('open'));</script>`;return `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script><div class="modal" id="m"><form class="sheet" id="f"><h3 id="ft">${esc(x.interest)}</h3><p>${esc(x.leave)}</p><input id="n" placeholder="${esc(x.name)}" required minlength="2"><input id="e" type="email" placeholder="${esc(x.email)}"><input id="w" placeholder="${esc(x.whatsapp)}"><textarea id="msg" placeholder="${esc(x.message)}"></textarea><input class="hp" id="hp" tabindex="-1" autocomplete="off"><input id="lid" type="hidden"><div class="turnstile cf-turnstile" data-sitekey="${esc(sitekey)}" data-theme="dark"></div><button class="send" type="submit">${esc(x.send)}</button><button class="close" type="button" id="close">${esc(x.cancel)}</button></form></div><script>const m=document.getElementById('m'),f=document.getElementById('f'),L=${JSON.stringify(locale)},TX=${JSON.stringify({verify:x.verify,contact:x.contact,sending:x.sending,thanks:x.thanks,failed:x.failed,send:x.send})};let openedAt=Date.now();const uuid=()=>crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36);let aid=localStorage.getItem('listia_aid');if(!aid){aid=uuid();localStorage.setItem('listia_aid',aid)}let sid=sessionStorage.getItem('listia_sid');if(!sid){sid=uuid();sessionStorage.setItem('listia_sid',sid)}const attribution=()=>{const q=new URLSearchParams(location.search),o={};['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid','gbraid','wbraid','ttclid','li_fat_id','msclkid'].forEach(k=>{const v=q.get(k);if(v)o[k]=v});return o};document.querySelectorAll('[data-interest]').forEach(b=>b.onclick=()=>{openedAt=Date.now();document.getElementById('lid').value=b.dataset.interest;document.getElementById('ft').textContent=b.dataset.title;m.classList.add('open')});document.getElementById('close').onclick=()=>m.classList.remove('open');f.onsubmit=async e=>{e.preventDefault();const token=f.querySelector('[name="cf-turnstile-response"]')?.value||'';if(!token){alert(TX.verify);return}const body={listing_id:document.getElementById('lid').value,name:document.getElementById('n').value,email:document.getElementById('e').value||null,whatsapp:document.getElementById('w').value||null,message:document.getElementById('msg').value||null,locale:L,website:document.getElementById('hp').value||null,turnstile_token:token,form_elapsed_ms:Math.max(0,Date.now()-openedAt),attribution:attribution(),page_url:location.href,referrer:document.referrer||null,anonymous_id:aid,session_id:sid};if(!body.email&&!body.whatsapp){alert(TX.contact);return}const b=f.querySelector('.send');b.disabled=true;b.textContent=TX.sending;try{const r=await fetch('/api/interest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'same-origin'});if(!r.ok)throw new Error('blocked');m.classList.remove('open');f.reset();if(window.turnstile)turnstile.reset();alert(TX.thanks)}catch{alert(TX.failed)}finally{b.disabled=false;b.textContent=TX.send}};</script>`}'''
s, n = re.subn(r'function interestModal\(sitekey,enabled,locale\)\{.*?\}\nfunction card', new_modal + '\nfunction card', s, count=1, flags=re.S)
if n != 1:
    raise SystemExit('interestModal patch failed')

new_interest = r'''async function interest(request,env,host,data){const origin=request.headers.get('Origin')||'';if(origin!==`https://${host}`)return json({error:'origin_blocked'},403);const secSite=request.headers.get('Sec-Fetch-Site');if(secSite&&secSite!=='same-origin')return json({error:'cross_site_blocked'},403);if(!safeListiaHost(host))return json({error:'custom_domain_security_pending'},403);let body;try{body=await request.json()}catch{return json({error:'invalid_json'},400)}const listing=(data.listings||[]).find(x=>String(x.id)===String(body?.listing_id||''));if(!listing)return json({error:'listing_not_allowed'},404);if(String(body?.website||'').trim())return json({ok:true},200);const ip=request.headers.get('CF-Connecting-IP')||'';const verified=await verifyTurnstile(env,body?.turnstile_token,host,ip);if(!verified)return json({error:'turnstile_failed'},403);if(!body?.email&&!body?.whatsapp)return json({error:'contact_required'},400);if(!env?.MANAGED_SITE_EDGE_PROOF)return json({error:'security_gateway_unavailable'},503);const cf=request.cf||{},bm=cf.botManagement||{},gatewayBody={host,ip,listing_id:listing.id,name:String(body?.name||'').slice(0,120),email:body?.email?String(body.email).slice(0,254):null,whatsapp:body?.whatsapp?String(body.whatsapp).slice(0,80):null,message:body?.message?String(body.message).slice(0,2000):null,locale:LOCALES.includes(body?.locale)?body.locale:'es',website:null,turnstile_verified:true,form_elapsed_ms:Number(body?.form_elapsed_ms||0),user_agent:String(request.headers.get('User-Agent')||'').slice(0,500),country_code:String(cf.country||'').slice(0,8),bot_score:Number.isFinite(Number(bm.score))?Number(bm.score):null,verified_bot:Boolean(bm.verifiedBot),attribution:body?.attribution&&typeof body.attribution==='object'?body.attribution:{},page_url:String(body?.page_url||'').slice(0,1200),referrer:String(body?.referrer||'').slice(0,1200),anonymous_id:String(body?.anonymous_id||'').slice(0,120),session_id:String(body?.session_id||'').slice(0,120)};const r=await fetch(`${SUPABASE_URL}/functions/v1/managed-site-interest`,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json','x-listia-edge-proof':env.MANAGED_SITE_EDGE_PROOF},body:JSON.stringify(gatewayBody)});if(!r.ok)return json({error:'submission_failed'},502);return json({ok:true})}'''
s, n = re.subn(r'async function interest\(request,env,host,data\)\{.*?\}\nconst pageHeaders', new_interest + '\nconst pageHeaders', s, count=1, flags=re.S)
if n != 1:
    raise SystemExit('interest gateway patch failed')

old = 'body>${header(org,locale,settings,path)}'
new = 'body style="${brandStyle(data)}">${header(org,locale,settings,path,siteBrand(data))}'
count = s.count(old)
if count < 3:
    raise SystemExit(f'Expected at least 3 branded body/header sites, found {count}')
s = s.replace(old, new)

p.write_text(s, encoding='utf-8')
print('Pennyworth managed-site patch applied')
