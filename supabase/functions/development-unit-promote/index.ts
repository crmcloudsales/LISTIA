import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U = Deno.env.get('SUPABASE_URL') || '';
const A = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const S = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const allowed = new Set(['https://app.listiaapp.com', 'http://localhost', 'http://127.0.0.1']);

const out = (body: unknown, status = 200, origin = '') => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...(origin && allowed.has(origin) ? { 'access-control-allow-origin': origin, 'vary': 'Origin' } : {}),
  },
});

async function postgrestError(response: Response) {
  const raw = await response.text().catch(() => '');
  try {
    const parsed = JSON.parse(raw || '{}');
    return {
      message: String(parsed?.message || ''),
      details: String(parsed?.details || ''),
      code: String(parsed?.code || ''),
    };
  } catch {
    return { message: raw, details: '', code: '' };
  }
}

Deno.serve(async req => {
  const origin = req.headers.get('origin') || '';
  if (req.method === 'OPTIONS') {
    if (!allowed.has(origin)) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': origin,
        'access-control-allow-headers': 'authorization,apikey,content-type',
        'access-control-allow-methods': 'POST,OPTIONS',
        'vary': 'Origin',
      },
    });
  }
  if (req.method !== 'POST') return out({ error: 'method_not_allowed' }, 405, origin);
  if (origin && !allowed.has(origin)) return out({ error: 'origin_not_allowed' }, 403, origin);

  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ') || !U || !A || !S) return out({ error: 'unauthorized' }, 401, origin);
  const userResponse = await fetch(`${U}/auth/v1/user`, { headers: { apikey: A, authorization: auth } });
  if (!userResponse.ok) return out({ error: 'unauthorized' }, 401, origin);
  const user = await userResponse.json();
  const uid = String(user?.id || '');

  let body: any = {};
  try { body = await req.json(); } catch { return out({ error: 'invalid_json' }, 400, origin); }
  const unitId = String(body.unit_id || '');
  if (!unitId) return out({ error: 'unit_required' }, 400, origin);

  const serviceHeaders = { apikey: S, authorization: `Bearer ${S}` };
  const unitResponse = await fetch(
    `${U}/rest/v1/development_units?select=id,organization_id,project_id,property_id,unit_code,price,currency,status&id=eq.${encodeURIComponent(unitId)}&limit=1`,
    { headers: serviceHeaders },
  );
  const unit = unitResponse.ok ? (await unitResponse.json())?.[0] : null;
  if (!unit) return out({ error: 'unit_not_found' }, 404, origin);

  const memberResponse = await fetch(
    `${U}/rest/v1/organization_members?select=role&organization_id=eq.${encodeURIComponent(unit.organization_id)}&user_id=eq.${encodeURIComponent(uid)}&status=eq.active&limit=1`,
    { headers: serviceHeaders },
  );
  const member = memberResponse.ok ? (await memberResponse.json())?.[0] : null;
  if (!member || !['owner', 'admin'].includes(String(member.role))) return out({ error: 'forbidden' }, 403, origin);
  if (unit.property_id) return out({ ok: true, created: false, property_id: unit.property_id }, 200, origin);

  const projectResponse = await fetch(
    `${U}/rest/v1/development_projects?select=id,name,location_text,description&organization_id=eq.${encodeURIComponent(unit.organization_id)}&id=eq.${encodeURIComponent(unit.project_id)}&limit=1`,
    { headers: serviceHeaders },
  );
  const project = projectResponse.ok ? (await projectResponse.json())?.[0] : null;
  if (!project) return out({ error: 'project_not_found' }, 404, origin);

  const profileResponse = await fetch(`${U}/rest/v1/profiles?select=locale&id=eq.${encodeURIComponent(uid)}&limit=1`, { headers: serviceHeaders });
  const locale = (profileResponse.ok ? (await profileResponse.json())?.[0]?.locale : null) || 'es';
  const title = `${String(project.name || 'LISTIA').trim()} · ${String(unit.unit_code).trim()}`;
  const row = {
    organization_id: unit.organization_id,
    created_by: uid,
    title,
    description: project.description || null,
    price: unit.price ?? null,
    currency: unit.currency || 'MXN',
    location_text: project.location_text || null,
    status: 'material_received',
    source: 'development_unit',
    locale,
    processing_state: {
      development_project_id: unit.project_id,
      development_unit_id: unit.id,
      unit_status: unit.status,
    },
  };

  const insertResponse = await fetch(`${U}/rest/v1/properties`, {
    method: 'POST',
    headers: { ...serviceHeaders, 'content-type': 'application/json', 'prefer': 'return=representation' },
    body: JSON.stringify(row),
  });
  if (!insertResponse.ok) {
    const failure = await postgrestError(insertResponse);
    const diagnostic = `${failure.message} ${failure.details} ${failure.code}`.toLowerCase();
    if (diagnostic.includes('property_limit_reached')) {
      return out({ error: 'property_limit_reached' }, 409, origin);
    }
    if (diagnostic.includes('plan_entitlement_unavailable')) {
      return out({ error: 'plan_entitlement_unavailable' }, 503, origin);
    }
    console.error('development-unit-promote property insert failed', failure.code || 'unknown');
    return out({ error: 'property_create_failed' }, 502, origin);
  }

  const property = (await insertResponse.json())?.[0];
  if (!property?.id) return out({ error: 'property_create_failed' }, 502, origin);

  const linkResponse = await fetch(
    `${U}/rest/v1/development_units?id=eq.${encodeURIComponent(unit.id)}&property_id=is.null`,
    {
      method: 'PATCH',
      headers: { ...serviceHeaders, 'content-type': 'application/json', 'prefer': 'return=minimal' },
      body: JSON.stringify({ property_id: property.id, updated_at: new Date().toISOString() }),
    },
  );
  if (!linkResponse.ok) {
    await fetch(`${U}/rest/v1/properties?id=eq.${encodeURIComponent(property.id)}`, { method: 'DELETE', headers: serviceHeaders });
    return out({ error: 'unit_link_failed' }, 409, origin);
  }

  try {
    await fetch(`${U}/functions/v1/property-processing-start`, {
      method: 'POST',
      headers: { apikey: A, authorization: auth, 'content-type': 'application/json' },
      body: JSON.stringify({ organization_id: unit.organization_id, property_id: property.id }),
    });
  } catch {}

  return out({ ok: true, created: true, property_id: property.id }, 200, origin);
});
