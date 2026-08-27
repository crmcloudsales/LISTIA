(() => {
  const copy = {
    es: {
      freeDesc: 'Incluye hasta 3 propiedades. Empieza con LISTIA y paga solo las Gestiones que apruebes.',
      freeNote: 'Free incluye hasta 3 propiedades.',
      freeLimit: 'Tu plan Free incluye hasta 3 propiedades. Para agregar otra, cambia a Pro o Premium.'
    },
    en: {
      freeDesc: 'Includes up to 3 properties. Start with LISTIA and pay only for the Gestiones you approve.',
      freeNote: 'Free includes up to 3 properties.',
      freeLimit: 'Your Free plan includes up to 3 properties. To add another, upgrade to Pro or Premium.'
    },
    fr: {
      freeDesc: 'Inclut jusqu’à 3 biens. Commencez avec LISTIA et payez uniquement les Gestiones que vous approuvez.',
      freeNote: 'Free inclut jusqu’à 3 biens.',
      freeLimit: 'Votre forfait Free inclut jusqu’à 3 biens. Pour en ajouter un autre, passez à Pro ou Premium.'
    },
    it: {
      freeDesc: 'Include fino a 3 immobili. Inizia con LISTIA e paga solo le Gestiones che approvi.',
      freeNote: 'Free include fino a 3 immobili.',
      freeLimit: 'Il piano Free include fino a 3 immobili. Per aggiungerne un altro, passa a Pro o Premium.'
    },
    'pt-BR': {
      freeDesc: 'Inclui até 3 imóveis. Comece com a LISTIA e pague somente pelas Gestiones que você aprovar.',
      freeNote: 'Free inclui até 3 imóveis.',
      freeLimit: 'Seu plano Free inclui até 3 imóveis. Para adicionar outro, mude para Pro ou Premium.'
    },
    de: {
      freeDesc: 'Enthält bis zu 3 Immobilien. Starten Sie mit LISTIA und zahlen Sie nur für Gestiones, die Sie freigeben.',
      freeNote: 'Free enthält bis zu 3 Immobilien.',
      freeLimit: 'Ihr Free-Plan enthält bis zu 3 Immobilien. Für eine weitere Immobilie wechseln Sie zu Pro oder Premium.'
    },
    'ar-AE': {
      freeDesc: 'يشمل حتى 3 عقارات. ابدأ مع LISTIA وادفع فقط مقابل الإجراءات التي توافق عليها.',
      freeNote: 'تشمل الخطة المجانية حتى 3 عقارات.',
      freeLimit: 'تشمل خطتك المجانية حتى 3 عقارات. لإضافة عقار آخر، انتقل إلى Pro أو Premium.'
    },
    ru: {
      freeDesc: 'Включает до 3 объектов. Начните с LISTIA и оплачивайте только те Gestiones, которые вы одобрили.',
      freeNote: 'Free включает до 3 объектов.',
      freeLimit: 'Ваш план Free включает до 3 объектов. Чтобы добавить ещё один, перейдите на Pro или Premium.'
    },
    he: {
      freeDesc: 'כולל עד 3 נכסים. התחילו עם LISTIA ושלמו רק עבור Gestiones שאישרתם.',
      freeNote: 'Free כולל עד 3 נכסים.',
      freeLimit: 'מסלול Free כולל עד 3 נכסים. כדי להוסיף נכס נוסף, עברו ל-Pro או Premium.'
    },
    'zh-CN': {
      freeDesc: '最多包含 3 个房源。使用 LISTIA 开始工作，只为您批准的 Gestiones 付费。',
      freeNote: 'Free 最多包含 3 个房源。',
      freeLimit: 'Free 最多包含 3 个房源。要添加更多房源，请升级到 Pro 或 Premium。'
    }
  };

  function locale() {
    const api = window.LISTIA_I18N;
    const raw = String(api?.getLanguage?.() || document.documentElement.dataset.listiaLanguage || document.documentElement.lang || 'en');
    const value = raw.toLowerCase();
    if (value.startsWith('es')) return 'es';
    if (value.startsWith('fr')) return 'fr';
    if (value.startsWith('it')) return 'it';
    if (value.startsWith('pt')) return 'pt-BR';
    if (value.startsWith('de')) return 'de';
    if (value.startsWith('ar')) return 'ar-AE';
    if (value.startsWith('ru')) return 'ru';
    if (value.startsWith('he') || value.startsWith('iw')) return 'he';
    if (value.startsWith('zh')) return 'zh-CN';
    return 'en';
  }

  function applyVisibleCopy() {
    const c = copy[locale()] || copy.en;
    const freeDesc = document.querySelector('#screen-plan [data-i18n="plan.free_desc"]');
    if (freeDesc) freeDesc.textContent = c.freeDesc;
    const note = document.getElementById('intakePlanNote');
    if (note && note.textContent.trim()) note.textContent = c.freeNote;
  }

  function patchI18n() {
    const api = window.LISTIA_I18N;
    if (!api?.t || api.__listiaPricingPolicyPatched) return false;
    const originalT = api.t.bind(api);
    api.t = (key, vars = {}) => {
      const c = copy[locale()] || copy.en;
      if (key === 'intake.free_note') return c.freeNote;
      if (key === 'msg.free_property_limit') return c.freeLimit;
      if (key === 'plan.free_desc') return c.freeDesc;
      return originalT(key, vars);
    };
    api.__listiaPricingPolicyPatched = true;
    applyVisibleCopy();
    return true;
  }

  const style = document.createElement('style');
  style.dataset.listiaPricingPolicy = '1';
  style.textContent = `
    #screen-plan .plan-copy small{font-size:12px!important;line-height:1.5!important;color:#aaa7b2!important}
    #screen-plan .plan-price small{font-size:12px!important;color:#96929d!important}
    .plan-note{font-size:12px!important;line-height:1.5!important;color:#aaa8b3!important;font-weight:650!important;margin-top:2px!important}
  `;
  document.head.append(style);

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (patchI18n() || attempts > 100) window.clearInterval(timer);
  }, 50);

  window.addEventListener('listia:languagechange', () => window.setTimeout(applyVisibleCopy, 0));
  document.addEventListener('DOMContentLoaded', () => {
    patchI18n();
    applyVisibleCopy();
  }, { once: true });
})();
