(() => {
  const cfg = window.LISTIA_CONFIG || {};
  const API_KEY = cfg.SUPABASE_PUBLISHABLE_KEY || cfg.SUPABASE_ANON_KEY || '';
  const SESSION_KEY = 'listia_session';
  let timer = 0;
  let busy = false;

  const copy = {
    es: { approve: 'Aprobar borrador', approving: 'Aprobando…', approved: 'Propiedad lista', error: 'No pudimos aprobar el borrador.' },
    en: { approve: 'Approve draft', approving: 'Approving…', approved: 'Property ready', error: 'We could not approve the draft.' },
    fr: { approve: 'Approuver le brouillon', approving: 'Approbation…', approved: 'Bien prêt', error: 'Impossible d’approuver le brouillon.' },
    it: { approve: 'Approva bozza', approving: 'Approvazione…', approved: 'Proprietà pronta', error: 'Impossibile approvare la bozza.' },
    'pt-BR': { approve: 'Aprovar rascunho', approving: 'Aprovando…', approved: 'Propriedade pronta', error: 'Não foi possível aprovar o rascunho.' },
    de: { approve: 'Entwurf freigeben', approving: 'Freigabe…', approved: 'Immobilie bereit', error: 'Der Entwurf konnte nicht freigegeben werden.' },
    'ar-AE': { approve: 'اعتماد المسودة', approving: 'جارٍ الاعتماد…', approved: 'العقار جاهز', error: 'تعذر اعتماد المسودة.' }
  };

  function locale() {
    const raw = String(localStorage.getItem('listia_language') || document.documentElement.lang || 'en').toLowerCase();
    if (raw.startsWith('es')) return 'es';
    if (raw.startsWith('fr')) return 'fr';
    if (raw.startsWith('it')) return 'it';
    if (raw.startsWith('pt')) return 'pt-BR';
    if (raw.startsWith('de')) return 'de';
    if (raw.startsWith('ar')) return 'ar-AE';
    return 'en';
  }
  const c = () => copy[locale()] || copy.en;

  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { return null; }
  }

  async function get(path, token) {
    const response = await fetch(`${cfg.SUPABASE_URL}${path}`, {
      headers: { apikey: API_KEY, Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });
    if (!response.ok) return null;
    return response.json().catch(() => null);
  }

  async function context() {
    const session = readSession();
    if (!session?.access_token || !cfg.SUPABASE_URL || !API_KEY) return null;
    let userId = session.user?.id || null;
    if (!userId) {
      const user = await get('/auth/v1/user', session.access_token);
      userId = user?.id || null;
    }
    if (!userId) return null;
    const memberships = await get(`/rest/v1/organization_members?select=organization_id&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&limit=1`, session.access_token);
    const organizationId = Array.isArray(memberships) ? memberships[0]?.organization_id : null;
    return organizationId ? { token: session.access_token, organizationId } : null;
  }

  function ensureStyles() {
    if (document.getElementById('listiaDraftActionStyles')) return;
    const style = document.createElement('style');
    style.id = 'listiaDraftActionStyles';
    style.textContent = `
      .property-draft-action{margin-top:8px;border:0;border-radius:12px;padding:10px 13px;font:inherit;font-weight:700;cursor:pointer;width:100%}
      .property-draft-action:disabled{cursor:wait;opacity:.65}
    `;
    document.head.append(style);
  }

  async function approve(propertyId, button) {
    const session = readSession();
    if (!session?.access_token) return;
    button.disabled = true;
    button.textContent = c().approving;
    try {
      const response = await fetch(`${cfg.SUPABASE_URL}/functions/v1/property-draft-approve`, {
        method: 'POST',
        headers: {
          apikey: API_KEY,
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ property_id: propertyId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'approval_failed');
      button.textContent = c().approved;
      window.setTimeout(() => location.reload(), 450);
    } catch (error) {
      console.error('LISTIA draft approval', error);
      button.disabled = false;
      button.textContent = c().approve;
      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = c().error;
        toast.className = 'toast error';
        toast.hidden = false;
        window.setTimeout(() => { toast.hidden = true; }, 4200);
      }
    }
  }

  async function sync() {
    if (busy || !document.getElementById('screen-properties')?.classList.contains('active')) return;
    busy = true;
    try {
      const ctx = await context();
      if (!ctx) return;
      const properties = await get(`/rest/v1/properties?select=id,created_at&organization_id=eq.${encodeURIComponent(ctx.organizationId)}&status=neq.archived&order=created_at.desc`, ctx.token);
      const drafts = await get(`/rest/v1/property_drafts?select=property_id,status,missing_fields&organization_id=eq.${encodeURIComponent(ctx.organizationId)}&status=eq.draft`, ctx.token);
      const cards = [...document.querySelectorAll('#propertyList .property-card')];
      const propertyRows = Array.isArray(properties) ? properties : [];
      const byId = new Map((Array.isArray(drafts) ? drafts : []).map(draft => [String(draft.property_id), draft]));

      cards.forEach((card, index) => {
        card.querySelector('.property-draft-action')?.remove();
        const property = propertyRows[index];
        if (!property) return;
        const draft = byId.get(String(property.id));
        if (!draft || (Array.isArray(draft.missing_fields) && draft.missing_fields.length)) return;
        const workflow = card.querySelector('.property-workflow');
        if (!workflow) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'property-draft-action secondary';
        button.textContent = c().approve;
        button.addEventListener('click', () => approve(String(property.id), button));
        workflow.append(button);
      });
    } finally {
      busy = false;
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = window.setTimeout(() => sync().catch(() => {}), 180);
  }

  function boot() {
    ensureStyles();
    const list = document.getElementById('propertyList');
    if (list) new MutationObserver(schedule).observe(list, { childList: true, subtree: false });
    const screen = document.getElementById('screen-properties');
    if (screen) new MutationObserver(schedule).observe(screen, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('listia:languagechange', schedule);
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
