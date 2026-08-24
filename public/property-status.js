(() => {
  const cfg = window.LISTIA_CONFIG || {};
  const API_KEY = cfg.SUPABASE_PUBLISHABLE_KEY || cfg.SUPABASE_ANON_KEY || '';
  const SESSION_KEY = 'listia_session';
  let syncTimer = 0;
  let running = false;

  const copy = {
    es: {
      material_received: ['Material recibido', 'LISTIA está organizando lo que entregaste.'],
      ready_for_processing: ['Material recibido', 'LISTIA está preparando el expediente.'],
      processing: ['LISTIA preparando', 'Estamos organizando y validando el material.'],
      ready_for_ai: ['LISTIA preparando', 'El expediente está listo para extracción automática.'],
      needs_input: ['Falta información', 'LISTIA te pedirá solamente lo indispensable.'],
      draft_ready: ['Borrador listo', 'Revisa el borrador antes de publicar.'],
      ready: ['Lista', 'La propiedad está lista para trabajar.'],
      failed: ['Requiere atención', 'No pudimos completar este paso automáticamente.'],
      assets: 'archivos',
      missing: 'faltantes',
      preparing: 'LISTIA preparando', needs: 'Necesitan información', drafts: 'Borradores listos'
    },
    en: {
      material_received: ['Material received', 'LISTIA is organizing what you provided.'],
      ready_for_processing: ['Material received', 'LISTIA is preparing the property file.'],
      processing: ['LISTIA preparing', 'We are organizing and validating the material.'],
      ready_for_ai: ['LISTIA preparing', 'The file is ready for automatic extraction.'],
      needs_input: ['Information needed', 'LISTIA will ask only for what is essential.'],
      draft_ready: ['Draft ready', 'Review the draft before publishing.'],
      ready: ['Ready', 'The property is ready to work with.'],
      failed: ['Needs attention', 'We could not complete this step automatically.'],
      assets: 'files', missing: 'missing', preparing: 'LISTIA preparing', needs: 'Need information', drafts: 'Drafts ready'
    },
    fr: {
      material_received: ['Matériel reçu', 'LISTIA organise ce que vous avez fourni.'],
      ready_for_processing: ['Matériel reçu', 'LISTIA prépare le dossier du bien.'],
      processing: ['LISTIA prépare', 'Nous organisons et validons le matériel.'],
      ready_for_ai: ['LISTIA prépare', 'Le dossier est prêt pour l’extraction automatique.'],
      needs_input: ['Informations requises', 'LISTIA ne demandera que l’essentiel.'],
      draft_ready: ['Brouillon prêt', 'Vérifiez le brouillon avant publication.'],
      ready: ['Prêt', 'Le bien est prêt à être utilisé.'],
      failed: ['Attention requise', 'Cette étape n’a pas pu être terminée automatiquement.'],
      assets: 'fichiers', missing: 'manquants', preparing: 'LISTIA prépare', needs: 'Informations requises', drafts: 'Brouillons prêts'
    },
    it: {
      material_received: ['Materiale ricevuto', 'LISTIA sta organizzando ciò che hai fornito.'],
      ready_for_processing: ['Materiale ricevuto', 'LISTIA sta preparando il fascicolo.'],
      processing: ['LISTIA prepara', 'Stiamo organizzando e validando il materiale.'],
      ready_for_ai: ['LISTIA prepara', 'Il fascicolo è pronto per l’estrazione automatica.'],
      needs_input: ['Servono informazioni', 'LISTIA chiederà solo ciò che è indispensabile.'],
      draft_ready: ['Bozza pronta', 'Controlla la bozza prima di pubblicare.'],
      ready: ['Pronta', 'La proprietà è pronta per essere gestita.'],
      failed: ['Richiede attenzione', 'Non è stato possibile completare automaticamente questo passaggio.'],
      assets: 'file', missing: 'mancanti', preparing: 'LISTIA prepara', needs: 'Servono informazioni', drafts: 'Bozze pronte'
    },
    'pt-BR': {
      material_received: ['Material recebido', 'A LISTIA está organizando o que você enviou.'],
      ready_for_processing: ['Material recebido', 'A LISTIA está preparando o dossiê.'],
      processing: ['LISTIA preparando', 'Estamos organizando e validando o material.'],
      ready_for_ai: ['LISTIA preparando', 'O dossiê está pronto para extração automática.'],
      needs_input: ['Faltam informações', 'A LISTIA pedirá somente o indispensável.'],
      draft_ready: ['Rascunho pronto', 'Revise o rascunho antes de publicar.'],
      ready: ['Pronta', 'A propriedade está pronta para trabalhar.'],
      failed: ['Requer atenção', 'Não foi possível concluir esta etapa automaticamente.'],
      assets: 'arquivos', missing: 'faltantes', preparing: 'LISTIA preparando', needs: 'Faltam informações', drafts: 'Rascunhos prontos'
    },
    de: {
      material_received: ['Material erhalten', 'LISTIA organisiert die bereitgestellten Unterlagen.'],
      ready_for_processing: ['Material erhalten', 'LISTIA bereitet die Objektakte vor.'],
      processing: ['LISTIA bereitet vor', 'Wir organisieren und prüfen das Material.'],
      ready_for_ai: ['LISTIA bereitet vor', 'Die Akte ist für die automatische Extraktion bereit.'],
      needs_input: ['Informationen fehlen', 'LISTIA fragt nur das unbedingt Notwendige ab.'],
      draft_ready: ['Entwurf bereit', 'Prüfe den Entwurf vor der Veröffentlichung.'],
      ready: ['Bereit', 'Die Immobilie ist einsatzbereit.'],
      failed: ['Aufmerksamkeit erforderlich', 'Dieser Schritt konnte nicht automatisch abgeschlossen werden.'],
      assets: 'Dateien', missing: 'fehlend', preparing: 'LISTIA bereitet vor', needs: 'Informationen fehlen', drafts: 'Entwürfe bereit'
    },
    'ar-AE': {
      material_received: ['تم استلام المواد', 'تقوم LISTIA بتنظيم ما قدمته.'],
      ready_for_processing: ['تم استلام المواد', 'تقوم LISTIA بإعداد ملف العقار.'],
      processing: ['LISTIA تُجهّز', 'نقوم بتنظيم المواد والتحقق منها.'],
      ready_for_ai: ['LISTIA تُجهّز', 'الملف جاهز للاستخراج التلقائي.'],
      needs_input: ['معلومات مطلوبة', 'ستطلب LISTIA الضروري فقط.'],
      draft_ready: ['المسودة جاهزة', 'راجع المسودة قبل النشر.'],
      ready: ['جاهز', 'العقار جاهز للعمل عليه.'],
      failed: ['يتطلب الانتباه', 'تعذر إكمال هذه الخطوة تلقائيًا.'],
      assets: 'ملفات', missing: 'ناقص', preparing: 'LISTIA تُجهّز', needs: 'معلومات مطلوبة', drafts: 'مسودات جاهزة'
    }
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
    if (!cfg.SUPABASE_URL || !API_KEY || !token) return null;
    const response = await fetch(`${cfg.SUPABASE_URL}${path}`, {
      headers: { apikey: API_KEY, Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });
    if (!response.ok) return null;
    return response.json().catch(() => null);
  }

  async function context() {
    const session = readSession();
    if (!session?.access_token) return null;
    let userId = session.user?.id || null;
    if (!userId) {
      const user = await get('/auth/v1/user', session.access_token);
      userId = user?.id || null;
    }
    if (!userId) return null;
    const memberships = await get(`/rest/v1/organization_members?select=organization_id&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&limit=1`, session.access_token);
    const organizationId = Array.isArray(memberships) ? memberships[0]?.organization_id : null;
    if (!organizationId) return null;
    return { token: session.access_token, organizationId };
  }

  function ensureStyles() {
    if (document.getElementById('listiaPropertyWorkflowStyles')) return;
    const style = document.createElement('style');
    style.id = 'listiaPropertyWorkflowStyles';
    style.textContent = `
      .property-workflow{margin-top:12px;padding-top:12px;border-top:1px solid rgba(127,127,127,.18);display:grid;gap:5px}
      .property-workflow strong{font-size:.82rem;letter-spacing:.01em}
      .property-workflow small{opacity:.72;line-height:1.35}
      .property-workflow-meta{font-size:.72rem;opacity:.62}
      .office-pipeline-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}
      .office-pipeline-summary div{padding:11px;border:1px solid rgba(127,127,127,.18);border-radius:14px;display:grid;gap:2px}
      .office-pipeline-summary strong{font-size:1.15rem}
      .office-pipeline-summary span{font-size:.72rem;opacity:.72;line-height:1.2}
      @media(max-width:520px){.office-pipeline-summary{grid-template-columns:1fr 1fr 1fr}.office-pipeline-summary div{padding:9px 7px}}
    `;
    document.head.append(style);
  }

  function stageCopy(stage) {
    return c()[stage] || c().material_received;
  }

  function decorateCards(properties, states) {
    const cards = [...document.querySelectorAll('#propertyList .property-card')];
    if (!cards.length) return;
    const byId = new Map(states.map(row => [String(row.property_id), row]));
    cards.forEach((card, index) => {
      card.querySelector('.property-workflow')?.remove();
      const property = properties[index];
      if (!property) return;
      const state = byId.get(String(property.id));
      const stage = String(state?.stage || property?.processing_state?.stage || property?.status || 'material_received');
      const [label, detail] = stageCopy(stage);
      const wrap = document.createElement('div');
      wrap.className = `property-workflow workflow-${stage}`;
      const strong = document.createElement('strong');
      strong.textContent = label;
      const small = document.createElement('small');
      small.textContent = detail;
      const meta = document.createElement('span');
      meta.className = 'property-workflow-meta';
      const parts = [];
      if (Number(state?.asset_count || 0) > 0) parts.push(`${state.asset_count} ${c().assets}`);
      if (Array.isArray(state?.missing_fields) && state.missing_fields.length) parts.push(`${state.missing_fields.length} ${c().missing}`);
      meta.textContent = parts.join(' · ');
      wrap.append(strong, small);
      if (meta.textContent) wrap.append(meta);
      card.append(wrap);

      const badge = card.querySelector('.property-status');
      if (badge) {
        badge.textContent = label;
        badge.className = `property-status status-${stage}`;
      }
    });
  }

  function renderOfficeSummary(states) {
    const panel = document.querySelector('#screen-ready .office-panel');
    const actions = panel?.querySelector('.office-actions');
    if (!panel || !actions) return;
    let wrap = document.getElementById('officePipelineSummary');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'officePipelineSummary';
      wrap.className = 'office-pipeline-summary';
      panel.insertBefore(wrap, actions);
    }
    const preparingStages = new Set(['material_received','ready_for_processing','processing','ready_for_ai']);
    const preparing = states.filter(row => preparingStages.has(String(row.stage))).length;
    const needs = states.filter(row => String(row.stage) === 'needs_input').length;
    const drafts = states.filter(row => String(row.stage) === 'draft_ready').length;
    wrap.replaceChildren();
    [[preparing,c().preparing],[needs,c().needs],[drafts,c().drafts]].forEach(([count,label]) => {
      const box = document.createElement('div');
      const strong = document.createElement('strong'); strong.textContent = String(count);
      const span = document.createElement('span'); span.textContent = String(label);
      box.append(strong, span); wrap.append(box);
    });
  }

  async function sync() {
    if (running) return;
    const propertiesScreen = document.getElementById('screen-properties');
    const officeScreen = document.getElementById('screen-ready');
    if (!propertiesScreen?.classList.contains('active') && !officeScreen?.classList.contains('active')) return;
    running = true;
    try {
      const ctx = await context();
      if (!ctx) return;
      const properties = await get(`/rest/v1/properties?select=id,status,processing_state,created_at&organization_id=eq.${encodeURIComponent(ctx.organizationId)}&status=neq.archived&order=created_at.desc`, ctx.token);
      const states = await get(`/rest/v1/property_processing_state?select=property_id,stage,asset_count,missing_fields,updated_at&organization_id=eq.${encodeURIComponent(ctx.organizationId)}&order=updated_at.desc`, ctx.token);
      const propertyRows = Array.isArray(properties) ? properties : [];
      const stateRows = Array.isArray(states) ? states : [];
      decorateCards(propertyRows, stateRows);
      renderOfficeSummary(stateRows);
    } finally {
      running = false;
    }
  }

  function schedule() {
    clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => sync().catch(() => {}), 80);
  }

  function boot() {
    ensureStyles();
    const list = document.getElementById('propertyList');
    if (list) new MutationObserver(schedule).observe(list, { childList: true, subtree: true });
    ['screen-properties','screen-ready'].forEach(id => {
      const screen = document.getElementById(id);
      if (screen) new MutationObserver(schedule).observe(screen, { attributes: true, attributeFilter: ['class'] });
    });
    window.addEventListener('listia:languagechange', schedule);
    window.addEventListener('focus', schedule);
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
