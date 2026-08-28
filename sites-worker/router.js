import managedSites from './index.js';

const PASSTHROUGH_HOSTS = new Set(['www.listiaapp.com']);
const BLOCKED_LABELS = new Set(['api','admin','mail','smtp','ftp','marketplace','web']);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();

    // A Worker Route can sit in front of a Worker Custom Domain. Passing the
    // original request through here delegates www to LISTIA's existing
    // commercial Custom Domain instead of letting the wildcard site renderer
    // replace it.
    if (PASSTHROUGH_HOSTS.has(host)) {
      return fetch(request);
    }

    const label = host.endsWith('.listiaapp.com') ? host.split('.')[0] : '';
    if (BLOCKED_LABELS.has(label)) {
      return new Response('Not found', {
        status: 404,
        headers: { 'cache-control': 'no-store' }
      });
    }

    return managedSites.fetch(request, env, ctx);
  }
};
