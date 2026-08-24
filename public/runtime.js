(() => {
  const cfg = window.LISTIA_CONFIG || {};
  const API_KEY = cfg.SUPABASE_PUBLISHABLE_KEY || cfg.SUPABASE_ANON_KEY || '';
  const SESSION_KEY = 'listia_session';
  let syncTimer = 0;

  const text = {
    es: { free: 'Free incluye 1 propiedad.', blocked: 'Tu suscripción tiene un pago pendiente. Regulariza el pago para continuar.' },
    en: { free: 'Free includes 1 property.', blocked: 'Your subscription has a pending payment. Bring the account current to continue.' },
    fr: { free: 'Free inclut 1 bien.', blocked: 'Votre abonnement comporte un paiement en attente. Régularisez-le pour continuer.' },
    it: { free: 'Free include 1 proprietà.', blocked: 'Il tuo abbonamento ha un pagamento in sospeso. Regolarizzalo per continuare.' },
    'pt-BR': { free: 'Free inclui 1 imóvel.', blocked: 'Sua assinatura tem um pagamento pendente. Regularize o pagamento para continuar.' },
    de: { free: 'Free enthält 1 Immobilie.', blocked: 'Für dein Abonnement ist eine Zahlung ausstehend. Bitte begleiche sie, um fortzufahren.' },
    'ar-AE': { free: 'تتضمن Free عقارًا واحدًا.', blocked: 'يوجد دفع مستحق على اشتراكك. يرجى تسوية الدفع للمتابعة.' },
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

  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { return null; }
  }

  async function get(path, token) {
    if (!cfg.SUPABASE_URL || !API_KEY || !token) return null;
    const response = await fetch(`${cfg.SUPABASE_URL}${path}`, {
      headers: { apikey: API_KEY, Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return response.json().catch(() => null);
  }

  async function effectiveBilling() {
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
    const rows = await get(`/rest/v1/organization_billing?select=plan_key,billing_status,access_state,usage_markup_percent&organization_id=eq.${encodeURIComponent(organizationId)}&limit=1`, session.access_token);
    return Array.isArray(rows) ? rows[0] || null : null;
  }

  async function syncIntakePlanNote() {
    const screen = document.getElementById('screen-property-intake');
    const note = document.getElementById('intakePlanNote');
    if (!screen?.classList.contains('active') || !note) return;
    const billing = await effectiveBilling();
    if (!billing) return;
    const c = text[locale()] || text.en;
    if (billing.access_state === 'payment_blocked') note.textContent = c.blocked;
    else if (String(billing.plan_key || 'free') === 'free') note.textContent = c.free;
    else note.textContent = '';
  }

  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => syncIntakePlanNote().catch(() => {}), 30);
  }

  function boot() {
    const screen = document.getElementById('screen-property-intake');
    if (!screen) return;
    new MutationObserver(scheduleSync).observe(screen, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('listia:languagechange', scheduleSync);
    scheduleSync();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
