from pathlib import Path

worker_path = Path('listia-app-worker/index.js')
provision_path = Path('supabase/functions/website-provision/index.ts')
worker = worker_path.read_text()
provision = provision_path.read_text()

old_boundary = "async function siteData(sub,env){if(!env.MARKETPLACE_EDGE_PROOF)return null;const r=await fetch(`${SUPABASE_SITE_DATA}?subdomain=${encodeURIComponent(sub)}`,{headers:{accept:'application/json','x-listia-edge-proof':env.MARKETPLACE_EDGE_PROOF},cache:'no-store'}).catch(()=>null);if(!r)return null;const d=await r.json().catch(()=>null);return{status:r.status,data:d}}\nfunction siteHeaders()"
new_boundary = "async function siteData(sub,env){if(!env.MARKETPLACE_EDGE_PROOF)return null;const r=await fetch(`${SUPABASE_SITE_DATA}?subdomain=${encodeURIComponent(sub)}`,{headers:{accept:'application/json','x-listia-edge-proof':env.MARKETPLACE_EDGE_PROOF},cache:'no-store'}).catch(()=>null);if(!r)return null;const d=await r.json().catch(()=>null);return{status:r.status,data:d}}\nasync function pennyworthHealth(env){if(!env.MARKETPLACE_EDGE_PROOF)return false;const r=await fetch(SUPABASE_SITE_INQUIRY,{method:'POST',headers:{'content-type':'application/json','x-listia-edge-proof':env.MARKETPLACE_EDGE_PROOF,'x-listia-client-ip':'127.0.0.1','x-listia-client-ua':'LISTIA-Managed-Site-Health/2'},body:'{}'}).catch(()=>null);if(!r)return false;const d=await r.json().catch(()=>null);return r.status===400&&d?.error==='required_fields_missing'}\nfunction siteHeaders()"

old_health = "if(url.pathname==='/.well-known/listia-infra-health'){return json({ok:lookup.status===200,host,service:'listia-managed-sites',route:true,tls:true,turnstile_configured:Boolean(env.TURNSTILE_SITE_KEY)},lookup.status===200?200:503)}"
new_health = "if(url.pathname==='/.well-known/listia-infra-health'){const firewall=await pennyworthHealth(env);const ok=lookup.status===200&&firewall;return json({ok,host,service:'listia-managed-sites',route:true,tls:true,turnstile_configured:Boolean(env.TURNSTILE_SITE_KEY),pennyworth_v2:firewall},ok?200:503)}"

old_provision = "if (last?.ok && d?.ok === true && d?.host === host && d?.service === 'listia-managed-sites' && d?.route === true && d?.tls === true && d?.turnstile_configured === true) {"
new_provision = "if (last?.ok && d?.ok === true && d?.host === host && d?.service === 'listia-managed-sites' && d?.route === true && d?.tls === true && d?.turnstile_configured === true && d?.pennyworth_v2 === true) {"

for label, old, new in [
    ('worker private Pennyworth health probe', old_boundary, new_boundary),
    ('worker infrastructure health gate', old_health, new_health),
]:
    if new in worker:
        print(f'{label}: already applied')
    else:
        count = worker.count(old)
        if count != 1:
            raise SystemExit(f'{label}: expected one match, found {count}')
        worker = worker.replace(old, new, 1)
        print(f'{label}: applied')

if new_provision in provision:
    print('website provisioning Pennyworth gate: already applied')
else:
    count = provision.count(old_provision)
    if count != 1:
        raise SystemExit(f'website provisioning Pennyworth gate: expected one match, found {count}')
    provision = provision.replace(old_provision, new_provision, 1)
    print('website provisioning Pennyworth gate: applied')

required_worker = [
    'async function pennyworthHealth(env)',
    "d?.error==='required_fields_missing'",
    'pennyworth_v2:firewall',
]
required_provision = ["d?.pennyworth_v2 === true"]
for needle in required_worker:
    if needle not in worker:
        raise SystemExit(f'missing worker health contract: {needle}')
for needle in required_provision:
    if needle not in provision:
        raise SystemExit(f'missing provisioning health contract: {needle}')

worker_path.write_text(worker)
provision_path.write_text(provision)
