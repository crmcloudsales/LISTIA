(() => {
  const cfg = window.LISTIA_CONFIG || {};
  const API_KEY = cfg.SUPABASE_PUBLISHABLE_KEY || cfg.SUPABASE_ANON_KEY || '';
  const SESSION_KEY = 'listia_session';
  let mountedCheckout = null;

  const copy = {
    es: {
      legalPrefix: 'Acepto los ', terms: 'Términos y Condiciones', legalAnd: ' y la ', privacy: 'Política de Privacidad', legalSuffix: ' de LISTIA.',
      planSubtitle: 'Free empieza de inmediato. Pro y Premium continúan a un checkout seguro dentro de LISTIA.',
      title: 'Activa tu plan LISTIA', preparing: 'Preparando checkout seguro…', secure: 'El pago se procesa de forma segura con Stripe dentro de LISTIA.',
      pendingTitle: 'Confirmando tu suscripción', pending: 'Stripe confirmó el regreso a LISTIA. Estamos esperando la confirmación segura del webhook.',
      notReadyTitle: 'Billing todavía no está habilitado', notReady: 'La integración está preparada, pero falta completar la credencial pública/servidor de Stripe TEST.',
      retry: 'Volver a comprobar', back: 'Volver al plan', close: 'Cerrar', error: 'No pudimos iniciar el checkout. Intenta nuevamente.'
    },
    en: {
      legalPrefix: 'I accept LISTIA’s ', terms: 'Terms and Conditions', legalAnd: ' and ', privacy: 'Privacy Policy', legalSuffix: '.',
      planSubtitle: 'Free starts immediately. Pro and Premium continue to secure checkout inside LISTIA.',
      title: 'Activate your LISTIA plan', preparing: 'Preparing secure checkout…', secure: 'Payment is securely processed by Stripe inside LISTIA.',
      pendingTitle: 'Confirming your subscription', pending: 'Stripe returned you to LISTIA. We are waiting for the secure webhook confirmation.',
      notReadyTitle: 'Billing is not enabled yet', notReady: 'The integration is ready, but the Stripe TEST public/server credential still needs to be completed.',
      retry: 'Check again', back: 'Back to plan', close: 'Close', error: 'We could not start checkout. Please try again.'
    },
    fr: {
      legalPrefix: 'J’accepte les ', terms: 'Conditions générales', legalAnd: ' et la ', privacy: 'Politique de confidentialité', legalSuffix: ' de LISTIA.',
      planSubtitle: 'Free démarre immédiatement. Pro et Premium continuent vers un paiement sécurisé dans LISTIA.',
      title: 'Activez votre forfait LISTIA', preparing: 'Préparation du paiement sécurisé…', secure: 'Le paiement est traité en toute sécurité par Stripe dans LISTIA.',
      pendingTitle: 'Confirmation de votre abonnement', pending: 'Stripe vous a renvoyé vers LISTIA. Nous attendons la confirmation sécurisée du webhook.',
      notReadyTitle: 'La facturation n’est pas encore activée', notReady: 'L’intégration est prête, mais les identifiants Stripe TEST public/serveur doivent encore être finalisés.',
      retry: 'Vérifier à nouveau', back: 'Retour au forfait', close: 'Fermer', error: 'Impossible de démarrer le paiement. Réessayez.'
    },
    it: {
      legalPrefix: 'Accetto i ', terms: 'Termini e Condizioni', legalAnd: ' e la ', privacy: 'Privacy Policy', legalSuffix: ' di LISTIA.',
      planSubtitle: 'Free parte subito. Pro e Premium continuano con un checkout sicuro dentro LISTIA.',
      title: 'Attiva il tuo piano LISTIA', preparing: 'Preparazione del checkout sicuro…', secure: 'Il pagamento viene elaborato in sicurezza da Stripe dentro LISTIA.',
      pendingTitle: 'Conferma dell’abbonamento', pending: 'Stripe ti ha riportato a LISTIA. Attendiamo la conferma sicura del webhook.',
      notReadyTitle: 'La fatturazione non è ancora attiva', notReady: 'L’integrazione è pronta, ma manca la credenziale Stripe TEST pubblica/server.',
      retry: 'Controlla di nuovo', back: 'Torna al piano', close: 'Chiudi', error: 'Impossibile avviare il checkout. Riprova.'
    },
    'pt-BR': {
      legalPrefix: 'Aceito os ', terms: 'Termos e Condições', legalAnd: ' e a ', privacy: 'Política de Privacidade', legalSuffix: ' da LISTIA.',
      planSubtitle: 'Free começa imediatamente. Pro e Premium seguem para um checkout seguro dentro da LISTIA.',
      title: 'Ative seu plano LISTIA', preparing: 'Preparando checkout seguro…', secure: 'O pagamento é processado com segurança pela Stripe dentro da LISTIA.',
      pendingTitle: 'Confirmando sua assinatura', pending: 'A Stripe retornou você à LISTIA. Estamos aguardando a confirmação segura do webhook.',
      notReadyTitle: 'O billing ainda não está ativado', notReady: 'A integração está pronta, mas falta concluir a credencial Stripe TEST pública/servidor.',
      retry: 'Verificar novamente', back: 'Voltar ao plano', close: 'Fechar', error: 'Não foi possível iniciar o checkout. Tente novamente.'
    },
    de: {
      legalPrefix: 'Ich akzeptiere die ', terms: 'Allgemeinen Geschäftsbedingungen', legalAnd: ' und die ', privacy: 'Datenschutzerklärung', legalSuffix: ' von LISTIA.',
      planSubtitle: 'Free startet sofort. Pro und Premium führen zu einem sicheren Checkout innerhalb von LISTIA.',
      title: 'LISTIA-Plan aktivieren', preparing: 'Sicherer Checkout wird vorbereitet…', secure: 'Die Zahlung wird sicher über Stripe innerhalb von LISTIA verarbeitet.',
      pendingTitle: 'Abonnement wird bestätigt', pending: 'Stripe hat Sie zu LISTIA zurückgeführt. Wir warten auf die sichere Webhook-Bestätigung.',
      notReadyTitle: 'Billing ist noch nicht aktiviert', notReady: 'Die Integration ist vorbereitet; die öffentliche/serverseitige Stripe-TEST-Zugangsdaten fehlen noch.',
      retry: 'Erneut prüfen', back: 'Zurück zum Plan', close: 'Schließen', error: 'Checkout konnte nicht gestartet werden. Bitte erneut versuchen.'
    },
    'ar-AE': {
      legalPrefix: 'أوافق على ', terms: 'الشروط والأحكام', legalAnd: ' و', privacy: 'سياسة الخصوصية', legalSuffix: ' الخاصة بـ LISTIA.',
      planSubtitle: 'تبدأ Free فورًا، بينما تنتقل Pro وPremium إلى دفع آمن داخل LISTIA.',
      title: 'فعّل خطة LISTIA', preparing: 'جارٍ تجهيز الدفع الآمن…', secure: 'تتم معالجة الدفع بأمان عبر Stripe داخل LISTIA.',
      pendingTitle: 'جارٍ تأكيد الاشتراك', pending: 'أعادتك Stripe إلى LISTIA. ننتظر تأكيد الـ webhook الآمن.',
      notReadyTitle: 'الفوترة غير مفعّلة بعد', notReady: 'التكامل جاهز، لكن ما زال يلزم إكمال بيانات Stripe TEST العامة/الخاصة بالخادم.',
      retry: 'تحقق مرة أخرى', back: 'العودة إلى الخطة', close: 'إغلاق', error: 'تعذر بدء الدفع. حاول مرة أخرى.'
    }
  };

  function locale() {
    const raw = String(document.documentElement.lang || localStorage.getItem('listia_language') || 'en').toLowerCase();
    if (raw.startsWith('es')) return 'es';
    if (raw.startsWith('fr')) return 'fr';
    if (raw.startsWith('it')) return 'it';
    if (raw.startsWith('pt')) return 'pt-BR';
    if (raw.startsWith('de')) return 'de';
    if (raw.startsWith('ar')) return 'ar-AE';
    return 'en';
  }

  const s = () => copy[locale()] || copy.en;
  const billingEnabled = () => cfg.BILLING_ENABLED === true;

  function ensureCss() {
    if (document.querySelector('link[data-listia-billing-css]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/billing.css?v=1';
    link.dataset.listiaBillingCss = '1';
    document.head.append(link);
  }

  function ensureLegalLinks() {
    const checkbox = document.getElementById('termsCheck');
    const target = checkbox?.closest('.checkrow')?.querySelector('span');
    if (!target) return;
    const c = s();
    const terms = document.createElement('a');
    terms.href = '/terms.html';
    terms.target = '_blank';
    terms.rel = 'noopener';
    terms.textContent = c.terms;
    const privacy = document.createElement('a');
    privacy.href = '/privacy.html';
    privacy.target = '_blank';
    privacy.rel = 'noopener';
    privacy.textContent = c.privacy;
    target.replaceChildren(document.createTextNode(c.legalPrefix), terms, document.createTextNode(c.legalAnd), privacy, document.createTextNode(c.legalSuffix));
  }

  function syncPlanCopy() {
    if (!billingEnabled()) return;
    const subtitle = document.querySelector('#screen-plan [data-i18n="plan.subtitle"]');
    if (subtitle) subtitle.textContent = s().planSubtitle;
  }

  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { return null; }
  }

  async function request(path, { method = 'GET', body, token, prefer } = {}) {
    if (!cfg.SUPABASE_URL || !API_KEY) throw new Error('supabase_not_configured');
    const headers = { apikey: API_KEY };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (prefer) headers.Prefer = prefer;
    const response = await fetch(`${cfg.SUPABASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    let data = {};
    if (text) {
      try { data = JSON.parse(text); }
      catch { data = { message: text }; }
    }
    if (!response.ok) throw new Error(data.error || data.message || `HTTP_${response.status}`);
    return data;
  }

  async function context() {
    const session = readSession();
    if (!session?.access_token) throw new Error('session_required');
    const user = await request('/auth/v1/user', { token: session.access_token });
    const memberships = await request(`/rest/v1/organization_members?select=organization_id,role,status&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&limit=1`, { token: session.access_token });
    const member = Array.isArray(memberships) ? memberships[0] : null;
    if (!member?.organization_id) throw new Error('organization_required');
    return { token: session.access_token, user, organizationId: member.organization_id, role: member.role };
  }

  async function savePlanIntent(ctx, plan, advance = false) {
    const body = {
      selected_plan: plan,
      updated_at: new Date().toISOString()
    };
    if (advance) {
      body.current_step = 3;
      body.completed_steps = [1, 2];
    }
    await request(`/rest/v1/organization_onboarding?organization_id=eq.${encodeURIComponent(ctx.organizationId)}`, {
      method: 'PATCH', token: ctx.token, prefer: 'return=minimal', body
    });
  }

  function closeOverlay() {
    try { mountedCheckout?.destroy?.(); } catch {}
    mountedCheckout = null;
    document.getElementById('listiaBillingOverlay')?.remove();
  }

  function overlay({ title, body, closable = true } = {}) {
    ensureCss();
    closeOverlay();
    const root = document.createElement('div');
    root.className = 'listia-billing-overlay';
    root.id = 'listiaBillingOverlay';
    const shell = document.createElement('div');
    shell.className = 'listia-billing-shell';
    const head = document.createElement('div');
    head.className = 'listia-billing-head';
    const copyWrap = document.createElement('div');
    const eyebrow = document.createElement('small');
    eyebrow.textContent = 'LISTIA · BILLING';
    const heading = document.createElement('h2');
    heading.textContent = title || s().title;
    const intro = document.createElement('p');
    intro.textContent = body || s().secure;
    copyWrap.append(eyebrow, heading, intro);
    head.append(copyWrap);
    if (closable) {
      const close = document.createElement('button');
      close.className = 'listia-billing-close';
      close.type = 'button';
      close.setAttribute('aria-label', s().close);
      close.textContent = '×';
      close.addEventListener('click', closeOverlay);
      head.append(close);
    }
    const content = document.createElement('div');
    content.id = 'listiaBillingContent';
    const legal = document.createElement('p');
    legal.className = 'listia-billing-legal';
    const terms = document.createElement('a'); terms.href = '/terms.html'; terms.target = '_blank'; terms.rel = 'noopener'; terms.textContent = s().terms;
    const privacy = document.createElement('a'); privacy.href = '/privacy.html'; privacy.target = '_blank'; privacy.rel = 'noopener'; privacy.textContent = s().privacy;
    legal.append(terms, document.createTextNode(' · '), privacy);
    shell.append(head, content, legal);
    root.append(shell);
    document.body.append(root);
    return content;
  }

  function loading(content, text = s().preparing) {
    const wrap = document.createElement('div');
    wrap.className = 'listia-billing-loading';
    const inner = document.createElement('div');
    const spinner = document.createElement('div'); spinner.className = 'listia-billing-spinner';
    const label = document.createElement('div'); label.textContent = text;
    inner.append(spinner, label); wrap.append(inner); content.replaceChildren(wrap);
  }

  function status(content, title, body, actions = []) {
    const card = document.createElement('div'); card.className = 'listia-billing-status';
    const strong = document.createElement('strong'); strong.textContent = title;
    const text = document.createElement('span'); text.textContent = body;
    card.append(strong, text);
    const buttons = document.createElement('div'); buttons.className = 'listia-billing-actions';
    actions.forEach(({ label, onClick, primary }) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = primary ? 'primary' : 'secondary'; button.textContent = label; button.addEventListener('click', onClick); buttons.append(button);
    });
    content.replaceChildren(card, buttons);
  }

  function loadStripeJs() {
    if (window.Stripe) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-listia-stripe-js]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/dahlia/stripe.js';
      script.async = true;
      script.dataset.listiaStripeJs = '1';
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
  }

  async function createCheckout(ctx, plan) {
    return request('/functions/v1/billing-checkout-create', {
      method: 'POST', token: ctx.token,
      body: { organization_id: ctx.organizationId, plan, extra_seats: 0 }
    });
  }

  async function launchCheckout(plan) {
    const content = overlay({ title: s().title, body: s().secure });
    loading(content);
    try {
      if (!cfg.STRIPE_PUBLISHABLE_KEY) {
        status(content, s().notReadyTitle, s().notReady, [{ label: s().back, onClick: closeOverlay }]);
        return;
      }
      const ctx = await context();
      await savePlanIntent(ctx, plan, false);
      await loadStripeJs();
      if (!window.Stripe) throw new Error('stripe_js_unavailable');
      const stripe = window.Stripe(cfg.STRIPE_PUBLISHABLE_KEY);
      const host = document.createElement('div');
      host.className = 'listia-billing-checkout';
      host.id = 'listiaBillingCheckout';
      content.replaceChildren(host);
      mountedCheckout = await stripe.createEmbeddedCheckoutPage({
        fetchClientSecret: async () => {
          const data = await createCheckout(ctx, plan);
          if (!data?.client_secret) throw new Error('checkout_client_secret_missing');
          return data.client_secret;
        }
      });
      mountedCheckout.mount('#listiaBillingCheckout');
    } catch (error) {
      console.error('LISTIA billing checkout', error);
      status(content, s().title, s().error, [
        { label: s().retry, primary: true, onClick: () => launchCheckout(plan) },
        { label: s().back, onClick: closeOverlay }
      ]);
    }
  }

  async function effectiveBilling(ctx) {
    const rows = await request(`/rest/v1/organization_billing?select=plan_key,billing_status,access_state,current_period_end&organization_id=eq.${encodeURIComponent(ctx.organizationId)}&limit=1`, { token: ctx.token });
    return Array.isArray(rows) ? rows[0] || null : null;
  }

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  async function handleBillingReturn() {
    const params = new URLSearchParams(location.search);
    if (params.get('billing') !== 'return' || !params.get('session_id') || !billingEnabled()) return;
    const content = overlay({ title: s().pendingTitle, body: s().pending, closable: false });
    loading(content, s().pending);
    try {
      const ctx = await context();
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const billing = await effectiveBilling(ctx);
        if (billing && ['pro', 'premium'].includes(String(billing.plan_key)) && billing.access_state !== 'payment_blocked') {
          await savePlanIntent(ctx, billing.plan_key, true);
          history.replaceState(null, '', location.pathname);
          location.reload();
          return;
        }
        await sleep(750);
      }
      status(content, s().pendingTitle, s().pending, [
        { label: s().retry, primary: true, onClick: () => location.reload() },
        { label: s().back, onClick: () => { history.replaceState(null, '', location.pathname); location.reload(); } }
      ]);
    } catch (error) {
      console.error('LISTIA billing return', error);
      status(content, s().pendingTitle, s().error, [
        { label: s().retry, primary: true, onClick: () => location.reload() },
        { label: s().back, onClick: () => { history.replaceState(null, '', location.pathname); location.reload(); } }
      ]);
    }
  }

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'planForm' || !billingEnabled()) return;
    const plan = String(document.getElementById('selectedPlan')?.value || 'free').toLowerCase();
    if (!['pro', 'premium'].includes(plan)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    launchCheckout(plan);
  }, true);

  function synchronizeUi() {
    ensureLegalLinks();
    syncPlanCopy();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', synchronizeUi, { once: true });
  else synchronizeUi();
  window.addEventListener('listia:languagechange', () => setTimeout(synchronizeUi, 0));
  window.addEventListener('load', handleBillingReturn, { once: true });
})();
