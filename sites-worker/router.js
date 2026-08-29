import managedSites from './index.js';

const PASSTHROUGH_HOSTS = new Set(['www.listiaapp.com']);
const BLOCKED_LABELS = new Set(['api','admin','mail','smtp','ftp','marketplace','web','brain','ai']);
const MANAGED_HOST = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.listiaapp\.com$/;
const HEALTH_PATH = '/.well-known/listia-health';
const INFRA_HEALTH_PATH = '/.well-known/listia-infra-health';
const APP_ORIGIN = 'https://app.listiaapp.com';

const healthHeaders = request => {
  const origin = request.headers.get('Origin') || '';
  const headers = {
    'content-type': 'application/json;charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer'
  };
  if (origin === APP_ORIGIN) {
    headers['access-control-allow-origin'] = APP_ORIGIN;
    headers.vary = 'Origin';
  }
  return headers;
};

const healthResponse = (request, host, ok, status = ok ? 200 : 404) =>
  new Response(JSON.stringify({ok, managed: ok, host: ok ? host : null, service: 'listia-managed-sites'}), {
    status,
    headers: healthHeaders(request)
  });

const infraHealthResponse = (request, env, host, protocol) => {
  const tls = protocol === 'https:';
  const turnstile = Boolean(env?.TURNSTILE_SITE_KEY && env?.TURNSTILE_SECRET);
  const ok = tls;
  return new Response(JSON.stringify({
    ok,
    host,
    service: 'listia-managed-sites',
    route: true,
    tls,
    turnstile_configured: turnstile
  }), {
    status: ok ? 200 : 503,
    headers: healthHeaders(request)
  });
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();

    // Keep LISTIA's commercial site on its existing Worker Custom Domain.
    if (PASSTHROUGH_HOSTS.has(host)) return fetch(request);

    // The wildcard renderer supports exactly one safe customer label.
    if (!MANAGED_HOST.test(host)) {
      return new Response('Not found', {status: 404, headers: {'cache-control': 'no-store'}});
    }

    const label = host.split('.')[0];
    if (BLOCKED_LABELS.has(label)) {
      return new Response('Not found', {status: 404, headers: {'cache-control': 'no-store'}});
    }

    // Infrastructure-only probe: proves DNS/TLS/wildcard Worker routing without
    // requiring an already-active organization_websites row. It exposes no site data.
    if (url.pathname === INFRA_HEALTH_PATH) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', {status: 405, headers: {'cache-control': 'no-store'}});
      }
      return infraHealthResponse(request, env, host, url.protocol);
    }

    // Full E2E probe: only returns 200 once the managed site resolver can render root.
    if (url.pathname === HEALTH_PATH) {
      const probeUrl = new URL('/', url);
      const probe = new Request(probeUrl, {method: 'GET', headers: request.headers});
      const result = await managedSites.fetch(probe, env, ctx);
      return healthResponse(request, host, result.status === 200);
    }

    return managedSites.fetch(request, env, ctx);
  }
};
