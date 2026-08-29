(() => {
  'use strict';

  const CLIENT_VERSION = '1.0.0';
  const CFG = window.LISTIA_CONFIG || {};
  const API_KEY = CFG.SUPABASE_PUBLISHABLE_KEY || CFG.SUPABASE_ANON_KEY || '';
  const SESSION_KEY = 'listia_session';
  let cached = null;
  let cachedAt = 0;
  const CACHE_MS = 5000;

  function session() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { return null; }
  }

  async function rpc(name, body = {}) {
    const current = session();
    if (!current?.access_token) throw new Error('workspace_session_required');
    const response = await fetch(`${CFG.SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: API_KEY,
        Authorization: `Bearer ${current.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      cache: 'no-store'
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; }
    catch { data = text; }
    if (!response.ok) throw new Error(data?.message || data?.error || `workspace_${response.status}`);
    return data;
  }

  function normalize(data) {
    const workspaces = Array.isArray(data?.workspaces) ? data.workspaces : [];
    const activeId = data?.active_organization_id || null;
    const active = workspaces.find(item => item.organization_id === activeId) || workspaces[0] || null;
    return {
      active_organization_id: active?.organization_id || activeId,
      active,
      workspaces
    };
  }

  async function getContext({ force = false } = {}) {
    const now = Date.now();
    if (!force && cached && now - cachedAt < CACHE_MS) return cached;
    cached = normalize(await rpc('get_my_workspace_context'));
    cachedAt = now;
    return cached;
  }

  async function getActiveWorkspace(options = {}) {
    return (await getContext(options)).active;
  }

  async function setActiveWorkspace(organizationId) {
    if (!organizationId) throw new Error('workspace_required');
    const result = normalize(await rpc('set_my_active_organization', { p_organization_id: organizationId }));
    cached = result;
    cachedAt = Date.now();
    window.dispatchEvent(new CustomEvent('listia:workspacechange', {
      detail: {
        organization_id: result.active_organization_id,
        workspace: result.active,
        workspaces: result.workspaces
      }
    }));
    return result;
  }

  function clearCache() {
    cached = null;
    cachedAt = 0;
  }

  window.addEventListener('storage', event => {
    if (event.key === SESSION_KEY) clearCache();
  });

  window.LISTIA_WORKSPACE = Object.freeze({
    version: CLIENT_VERSION,
    getContext,
    getActiveWorkspace,
    setActiveWorkspace,
    clearCache
  });
})();
