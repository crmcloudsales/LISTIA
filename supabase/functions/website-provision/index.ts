import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U = Deno.env.get('SUPABASE_URL') || '';
const A = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const S = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const EXTERNAL_DOMAINS_ENABLED = Deno.env.get('LISTIA_EXTERNAL_DOMAINS_ENABLED') === 'true';
const allowed = new Set(['https://app.listiaapp.com', 'http://localhost', 'http://127.0.0.1']);
const reserved = new Set(['app','www','api','admin','mail','smtp','ftp','marketplace','web','brain','ai']);

const reply = (body: unknown, status = 200, origin = '') => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...(origin && allowed.has(origin) ? {'access-control-allow-origin': origin, 'vary': 'Origin'} : {})
  }
});

Deno.serve(async req => {
  const origin = req.headers.get('origin') || '';
  if (req.method === 'OPTIONS') {
    if (!allowed.has(origin)) return new Response(null, {status: 403});
    return new Response(null, {status: 204, headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-headers': 'authorization,apikey,content-type',
      'access-control-allow-methods': 'POST,OPTIONS',
      'vary': 'Origin'
    }});
  }
  if (req.method !== 'POST') return reply({error: 'method_not_allowed'}, 405, origin);
  if (origin && !allowed.has(origin)) return reply({error: 'origin_not_allowed'}, 403, origin);

  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ') || !U || !A || !S) return reply({error: 'unauthorized'}, 401, origin);
  const userResponse = await fetch(`${U}/auth/v1/user`, {headers: {apikey: A, authorization: auth}});
  if (!userResponse.ok) return reply({error: 'unauthorized'}, 401, origin);
  const user = await userResponse.json();
  const uid = String(user?.id || '');

  let body: any = {};
  try { body = await req.json(); }
  catch { return reply({error: 'invalid_json'}, 400, origin); }

  const oid = String(body.organization_id || '');
  const mode = String(body.mode || '');
  if (!oid) return reply({error: 'organization_required'}, 400, origin);

  const adminHeaders = {apikey: S, authorization: `Bearer ${S}`};
  const memberResponse = await fetch(`${U}/rest/v1/organization_members?select=role,status&organization_id=eq.${encodeURIComponent(oid)}&user_id=eq.${encodeURIComponent(uid)}&status=eq.active&limit=1`, {headers: adminHeaders});
  const member = memberResponse.ok ? (await memberResponse.json())?.[0] : null;
  if (!member || !['owner','admin'].includes(String(member.role))) return reply({error: 'forbidden'}, 403, origin);

  if (mode === 'listia_subdomain') {
    const subdomain = String(body.subdomain || '').trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain) || reserved.has(subdomain)) {
      return reply({error: 'invalid_subdomain'}, 400, origin);
    }

    const conflictResponse = await fetch(`${U}/rest/v1/organization_websites?select=organization_id&mode=eq.listia_subdomain&subdomain=ilike.${encodeURIComponent(subdomain)}&organization_id=neq.${encodeURIComponent(oid)}&limit=1`, {headers: adminHeaders});
    if (conflictResponse.ok && (await conflictResponse.json()).length) return reply({error: 'subdomain_taken'}, 409, origin);

    const existingResponse = await fetch(`${U}/rest/v1/organization_websites?select=mode,subdomain,status,configuration&organization_id=eq.${encodeURIComponent(oid)}&limit=1`, {headers: adminHeaders});
    const existing = existingResponse.ok ? (await existingResponse.json())?.[0] : null;
    const existingConfiguration = existing?.mode === 'listia_subdomain' && String(existing?.subdomain || '').toLowerCase() === subdomain && existing?.configuration && typeof existing.configuration === 'object'
      ? existing.configuration
      : {};
    const now = new Date().toISOString();
    const configuration = {
      ...existingConfiguration,
      managed_by: 'LISTIA',
      seo_continuous: true,
      junk_lead_firewall: true,
      waf: true,
      turnstile: true,
      web_events: true,
      pixel_ready: true,
      provisioned_via: 'wildcard',
      activated_at: existingConfiguration.activated_at || now,
      last_verified_at: now
    };
    const row = {
      organization_id: oid,
      mode: 'listia_subdomain',
      domain: null,
      subdomain,
      status: 'active',
      connect_fee_usd: null,
      domain_markup_percent: null,
      provider_cost_usd: null,
      final_price_usd: null,
      configuration
    };
    const writeResponse = await fetch(`${U}/rest/v1/organization_websites?on_conflict=organization_id`, {
      method: 'POST',
      headers: {...adminHeaders, 'content-type': 'application/json', 'prefer': 'resolution=merge-duplicates,return=representation'},
      body: JSON.stringify(row)
    });
    if (!writeResponse.ok) return reply({error: 'provision_failed'}, 502, origin);
    return reply({ok: true, status: 'active', hostname: `${subdomain}.listiaapp.com`, website: (await writeResponse.json())?.[0] || null}, 200, origin);
  }

  if (mode === 'connect_existing' || mode === 'buy_website') {
    if (!EXTERNAL_DOMAINS_ENABLED) return reply({
      error: 'external_domains_temporarily_unavailable',
      reason: 'secure_ssl_provisioning_not_enabled',
      listia_subdomain_available: true,
      charge_created: false
    }, 503, origin);

    const domain = String(body.domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
    if (!/^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)) {
      return reply({error: 'invalid_domain'}, 400, origin);
    }
    const row = {
      organization_id: oid,
      mode,
      domain,
      subdomain: null,
      status: 'selected',
      connect_fee_usd: mode === 'connect_existing' ? 10 : null,
      domain_markup_percent: mode === 'buy_website' ? 100 : null,
      provider_cost_usd: null,
      final_price_usd: null,
      configuration: {managed_by: 'LISTIA', seo_continuous: true, junk_lead_firewall: true, waf: true, turnstile: true, web_events: true, pixel_ready: true}
    };
    const writeResponse = await fetch(`${U}/rest/v1/organization_websites?on_conflict=organization_id`, {
      method: 'POST',
      headers: {...adminHeaders, 'content-type': 'application/json', 'prefer': 'resolution=merge-duplicates,return=representation'},
      body: JSON.stringify(row)
    });
    if (!writeResponse.ok) return reply({error: 'save_failed'}, 502, origin);
    return reply({ok: true, status: 'selected', hostname: domain, website: (await writeResponse.json())?.[0] || null}, 200, origin);
  }

  return reply({error: 'unsupported_mode'}, 400, origin);
});
