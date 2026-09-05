(() => {
  'use strict';

  const CLIENT_VERSION = '1.1.0';
  const CFG = window.LISTIA_CONFIG || {};
  const API_KEY = CFG.SUPABASE_PUBLISHABLE_KEY || CFG.SUPABASE_ANON_KEY || '';
  const SESSION_KEY = 'listia_session';
  const CACHE_MS = 5000;
  const REQUEST_TIMEOUT_MS = 6000;

  let cached = null;
  let cachedAt = 0;
  let cachedSessionKey = '';
  let inflight = null;
  let inflightSessionKey = '';
  let generation = 0;

  function session() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { return null; }
  }

  function sessionKey(current = session()) {
    if (!current?.access_token) return '';
    const userId = String(current?.user?.id || 'anonymous-session');
    return `${userId}:${String(current.access_token).slice(-24)}`;
  }

  function assertConfigured() {
    if (!CFG.SUPABASE_URL || !API_KEY) throw new Error('workspace_not_configured');
  }

  async function rpc(name, body = {}, current = session()) {
    assertConfigured();
    if (!current?.access_token) throw new Error('workspace_session_required');
    const expectedSessionKey = sessionKey(current);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;

    try {
      response = await fetch(`${CFG.SUPABASE_URL}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
          apikey: API_KEY,
          Authorization: `Bearer ${current.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        cache: 'no-store',
        credentials: 'omit',
        signal: controller.signal
      });
    } catch (error) {
      if (controller.signal.aborted) throw new Error('workspace_request_timeout');
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; }
    catch { data = text; }

    if (sessionKey() !== expectedSessionKey) throw new Error('workspace_session_changed');
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
    const current = session();
    const currentSessionKey = sessionKey(current);
    if (!currentSessionKey) {
      clearCache();
      throw new Error('workspace_session_required');
    }

    const now = Date.now();
    if (!force && cached && cachedSessionKey === currentSessionKey && now - cachedAt < CACHE_MS) return cached;
    if (!force && inflight && inflightSessionKey === currentSessionKey) return inflight;

    const requestGeneration = generation;
    const request = rpc('get_my_workspace_context', {}, current).then(data => {
      if (requestGeneration !== generation) throw new Error('workspace_context_superseded');
      if (sessionKey() !== currentSessionKey) throw new Error('workspace_session_changed');
      const normalized = normalize(data);
      cached = normalized;
      cachedAt = Date.now();
      cachedSessionKey = currentSessionKey;
      return normalized;
    }).finally(() => {
      if (inflight === request) {
        inflight = null;
        inflightSessionKey = '';
      }
    });

    inflight = request;
    inflightSessionKey = currentSessionKey;
    return request;
  }

  async function getActiveWorkspace(options = {}) {
    return (await getContext(options)).active;
  }

  async function setActiveWorkspace(organizationId) {
    if (!organizationId) throw new Error('workspace_required');
    const current = session();
    const currentSessionKey = sessionKey(current);
    if (!currentSessionKey) throw new Error('workspace_session_required');

    generation += 1;
    cached = null;
    cachedAt = 0;
    cachedSessionKey = '';
    inflight = null;
    inflightSessionKey = '';

    const result = normalize(await rpc('set_my_active_organization', { p_organization_id: organizationId }, current));
    if (sessionKey() !== currentSessionKey) throw new Error('workspace_session_changed');
    cached = result;
    cachedAt = Date.now();
    cachedSessionKey = currentSessionKey;

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
    generation += 1;
    cached = null;
    cachedAt = 0;
    cachedSessionKey = '';
    inflight = null;
    inflightSessionKey = '';
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
