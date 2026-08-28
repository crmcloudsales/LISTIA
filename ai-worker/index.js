const SUPABASE_URL = 'https://zvzafiarwerbuoaccnoz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_aY9AjGa59GQ5rNGZlGAJpw_uhgVZfb1';
const MODEL = '@cf/zai-org/glm-4.7-flash';
const ALLOWED_ORIGINS = new Set([
  'https://app.listiaapp.com',
  'https://listiaapp.com',
  'https://www.listiaapp.com',
  'https://listia-pwa.pages.dev'
]);

const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max);
const cors = request => {
  const origin = request.headers.get('origin') || '';
  return {
    'access-control-allow-origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://app.listiaapp.com',
    'access-control-allow-methods': 'POST, GET, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
    'vary': 'Origin'
  };
};
const json = (request, body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors(request), 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
});

async function supabase(path, jwt) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${jwt}` },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`supabase_${response.status}`);
  return response.json();
}

async function authenticatedUser(jwt) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${jwt}` },
    cache: 'no-store'
  });
  if (!response.ok) return null;
  return response.json();
}

function safeAction(action) {
  const type = String(action?.type || 'none');
  const allowed = new Set(['none','open_screen','marketplace_search','add_property','open_leads','open_agenda']);
  if (!allowed.has(type)) return { type: 'none' };
  if (type === 'marketplace_search') {
    const criteria = action?.criteria && typeof action.criteria === 'object' ? action.criteria : {};
    return { type, criteria: {
      location: clean(criteria.location, 120) || null,
      min: Number.isFinite(Number(criteria.min)) ? Number(criteria.min) : null,
      max: Number.isFinite(Number(criteria.max)) ? Number(criteria.max) : null,
      bedrooms: Number.isFinite(Number(criteria.bedrooms)) ? Number(criteria.bedrooms) : null,
      operation: ['sale','rent'].includes(criteria.operation) ? criteria.operation : null,
      propertyType: clean(criteria.propertyType, 50) || null
    }};
  }
  if (type === 'open_screen') return { type, screen: clean(action?.screen, 80) };
  return { type };
}

function parseModelOutput(raw) {
  const text = typeof raw === 'string' ? raw : String(raw?.response ?? raw?.result?.response ?? '');
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const parsed = JSON.parse(stripped);
    return { reply: clean(parsed?.reply, 3500), action: safeAction(parsed?.action) };
  } catch {
    return { reply: clean(stripped, 3500), action: { type: 'none' } };
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return json(request, { ok: true, service: 'listia-ai', model: MODEL });
    }
    if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405);

    const origin = request.headers.get('origin') || '';
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json(request, { error: 'origin_not_allowed' }, 403);
    const jwt = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json(request, { error: 'unauthorized' }, 401);

    try {
      const user = await authenticatedUser(jwt);
      if (!user?.id) return json(request, { error: 'unauthorized' }, 401);
      const body = await request.json().catch(() => ({}));
      const message = clean(body?.message, 4000);
      if (!message) return json(request, { error: 'message_required' }, 400);
      const requestedLocale = clean(body?.locale, 16) || clean(user?.user_metadata?.locale, 16) || 'es';
      const history = (Array.isArray(body?.history) ? body.history : []).slice(-10)
        .map(item => ({ role: item?.role === 'assistant' ? 'assistant' : 'user', content: clean(item?.content, 1200) }))
        .filter(item => item.content);

      const members = await supabase(`/rest/v1/organization_members?select=organization_id,role,status&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&limit=1`, jwt);
      const member = members?.[0];
      if (!member?.organization_id) return json(request, { error: 'organization_access_denied' }, 403);
      const orgId = member.organization_id;

      const [profiles, orgs, billings, properties, leads, appointments] = await Promise.all([
        supabase(`/rest/v1/profiles?select=full_name,locale&id=eq.${encodeURIComponent(user.id)}&limit=1`, jwt).catch(() => []),
        supabase(`/rest/v1/organizations?select=id,name,business_type,primary_market,country_code&id=eq.${encodeURIComponent(orgId)}&limit=1`, jwt).catch(() => []),
        supabase(`/rest/v1/organization_billing?select=plan_key,billing_status,access_state&organization_id=eq.${encodeURIComponent(orgId)}&limit=1`, jwt).catch(() => []),
        supabase(`/rest/v1/properties?select=id,title,status,operation_type,property_type,price,currency,location_text&organization_id=eq.${encodeURIComponent(orgId)}&status=neq.archived&order=updated_at.desc&limit=20`, jwt).catch(() => []),
        supabase(`/rest/v1/leads?select=id,name,status,source,created_at&organization_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc&limit=20`, jwt).catch(() => []),
        supabase(`/rest/v1/appointments?select=id,title,status,starts_at,ends_at&organization_id=eq.${encodeURIComponent(orgId)}&order=starts_at.asc&limit=20`, jwt).catch(() => [])
      ]);

      const profile = profiles?.[0] || {};
      const org = orgs?.[0] || {};
      const billing = billings?.[0] || {};
      if (String(billing?.access_state || 'active') === 'payment_blocked') return json(request, { error: 'payment_blocked' }, 402);
      const firstName = clean(profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name, 80).split(/\s+/)[0] || '';
      const locale = clean(profile?.locale || requestedLocale, 16) || 'es';
      const context = {
        user: { first_name: firstName || null, role: member.role || null },
        organization: org || null,
        billing: billing || null,
        properties: Array.isArray(properties) ? properties : [],
        leads: Array.isArray(leads) ? leads : [],
        appointments: Array.isArray(appointments) ? appointments : []
      };

      const system = `You are LISTIA, the user's intelligent real-estate operating assistant. You are not a bot, phone tree, command parser, or scripted customer-service recording. Speak naturally, warmly, efficiently and conversationally, like a highly capable human assistant. The user's language is ${locale}. The user's first name is ${firstName || 'unknown'}; use it occasionally when natural, never in every reply. Use only facts present in ACCOUNT_CONTEXT and never invent listings, leads, appointments, prices, or account data. Remember the recent conversation. Do not repeat the same sentence unless the user asks. Keep spoken-friendly replies concise, normally 1-4 sentences. Ask at most one useful follow-up question when genuinely necessary. If the user requests a browser action, select one allowed action: none, open_screen, marketplace_search, add_property, open_leads, open_agenda. For marketplace_search, return explicit criteria only when stated. Output ONLY valid JSON with this shape: {"reply":"natural response","action":{"type":"none"}}.`;

      const messages = [
        { role: 'system', content: system },
        { role: 'system', content: `ACCOUNT_CONTEXT=${JSON.stringify(context)}` },
        ...history,
        { role: 'user', content: message }
      ];
      const result = await env.AI.run(MODEL, { messages, temperature: 0.35, max_tokens: 650 });
      const parsed = parseModelOutput(result);
      if (!parsed.reply) return json(request, { error: 'empty_model_response' }, 502);
      return json(request, { ok: true, provider: 'listia_edge_ai', model: MODEL, reply: parsed.reply, action: parsed.action });
    } catch (error) {
      console.error('LISTIA AI gateway', error);
      return json(request, { error: 'ai_gateway_error' }, 502);
    }
  }
};
