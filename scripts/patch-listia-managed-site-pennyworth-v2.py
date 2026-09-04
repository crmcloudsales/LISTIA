from pathlib import Path

path = Path('listia-app-worker/index.js')
text = path.read_text()

old_body = "const body={listing_id:document.getElementById('listingId').value,name:fd.get('name'),email:fd.get('email'),whatsapp:fd.get('whatsapp'),message:fd.get('message'),turnstile_token:token};"
new_body = "const body={listing_id:document.getElementById('listingId').value,name:fd.get('name'),email:fd.get('email'),whatsapp:fd.get('whatsapp'),message:fd.get('message'),website:fd.get('company')||'',form_elapsed_ms:Math.max(0,Date.now()-opened),turnstile_token:token};"

old_gateway = "const clean={subdomain:sub,listing_id:body.listing_id,name:body.name,email:body.email,whatsapp:body.whatsapp,message:body.message,locale:'es'};const up=await fetch(SUPABASE_SITE_INQUIRY,{method:'POST',headers:{'content-type':'application/json','x-listia-edge-proof':env.MARKETPLACE_EDGE_PROOF,'x-listia-client-ip':clientIp(req)},body:JSON.stringify(clean)}).catch(()=>null);"
new_gateway = "const clean={subdomain:sub,listing_id:body.listing_id,name:body.name,email:body.email,whatsapp:body.whatsapp,message:body.message,website:body.website,form_elapsed_ms:body.form_elapsed_ms,locale:'es'};const up=await fetch(SUPABASE_SITE_INQUIRY,{method:'POST',headers:{'content-type':'application/json','x-listia-edge-proof':env.MARKETPLACE_EDGE_PROOF,'x-listia-client-ip':clientIp(req),'x-listia-client-ua':String(req.headers.get('user-agent')||'').slice(0,500),'x-listia-country':String(req.cf?.country||'').slice(0,8)},body:JSON.stringify(clean)}).catch(()=>null);"

for label, old, new in [
    ('browser signals', old_body, new_body),
    ('gateway signals', old_gateway, new_gateway),
]:
    if new in text:
        print(f'{label}: already applied')
        continue
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one canonical match, found {count}')
    text = text.replace(old, new, 1)
    print(f'{label}: applied')

required = [
    'form_elapsed_ms:Math.max(0,Date.now()-opened)',
    "website:body.website,form_elapsed_ms:body.form_elapsed_ms",
    "'x-listia-client-ua':String(req.headers.get('user-agent')||'').slice(0,500)",
    "'x-listia-country':String(req.cf?.country||'').slice(0,8)",
]
for needle in required:
    if needle not in text:
        raise SystemExit(f'missing required Pennyworth signal: {needle}')

path.write_text(text)
