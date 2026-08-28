(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const LEGACY_MARK = '/rest/v1/marketplace_listings?select=';
  const SAFE_MARK = '/rest/v1/rpc/marketplace_public_feed';
  const SAFE_V2_MARK = '/rest/v1/rpc/marketplace_public_feed_v2';

  window.LISTIA_MARKETPLACE_DATA = [];
  window.LISTIA_MARKETPLACE_COUNTRY = '';

  function shuffle(values) {
    const a = [...values];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  async function detectCountry() {
    try {
      const r = await nativeFetch('/cdn-cgi/trace', { cache: 'no-store' });
      if (!r.ok) return;
      const raw = await r.text();
      const match = raw.match(/(?:^|\n)loc=([A-Z]{2})(?:\n|$)/);
      if (match) window.LISTIA_MARKETPLACE_COUNTRY = match[1];
    } catch (_) {}
  }
  detectCountry();

  function safeMarketplaceUrl(raw) {
    if (!raw.includes(LEGACY_MARK)) return raw;
    const restIndex = raw.indexOf('/rest/v1/');
    if (restIndex < 0) return raw;
    return `${raw.slice(0, restIndex)}${SAFE_MARK}?p_limit=1000`;
  }

  window.fetch = async function(input, init) {
    const raw = typeof input === 'string' ? input : (input?.url || '');
    const safeUrl = safeMarketplaceUrl(raw);
    let target = input;

    if (safeUrl !== raw) {
      target = typeof input === 'string' ? safeUrl : new Request(safeUrl, input);
    }

    const response = await nativeFetch(target, init);
    const finalUrl = typeof target === 'string' ? target : (target?.url || raw);

    if (finalUrl.includes(SAFE_MARK) && !finalUrl.includes(SAFE_V2_MARK) && response.ok) {
      response.clone().json().then(rows => {
        if (Array.isArray(rows)) {
          window.LISTIA_MARKETPLACE_DATA = rows;
          setTimeout(repair, 0);
        }
      }).catch(() => {});
    }

    return response;
  };

  const text = value => String(value || '').trim();

  function neutralEmptyCopy() {
    const empty = document.querySelector('#marketplaceGrid .marketplace-empty span');
    if (!empty) return;
    const lang = String(window.LISTIA_I18N?.getLanguage?.() || document.documentElement.lang || 'es').toLowerCase();
    let value = 'Available properties will appear here as they are published on LISTIA.';
    if (lang.startsWith('es')) value = 'Las propiedades disponibles aparecerán aquí a medida que se publiquen en LISTIA.';
    else if (lang.startsWith('fr')) value = 'Les biens disponibles apparaîtront ici à mesure de leur publication sur LISTIA.';
    else if (lang.startsWith('it')) value = 'Le proprietà disponibili appariranno qui man mano che vengono pubblicate su LISTIA.';
    else if (lang.startsWith('pt')) value = 'Os imóveis disponíveis aparecerão aqui à medida que forem publicados na LISTIA.';
    else if (lang.startsWith('de')) value = 'Verfügbare Immobilien erscheinen hier, sobald sie auf LISTIA veröffentlicht werden.';
    else if (lang.startsWith('ar')) value = 'ستظهر العقارات المتاحة هنا عند نشرها على LISTIA.';
    else if (lang.startsWith('ru')) value = 'Доступные объекты будут появляться здесь по мере публикации в LISTIA.';
    else if (lang.startsWith('he')) value = 'נכסים זמינים יופיעו כאן עם פרסומם ב-LISTIA.';
    else if (lang.startsWith('zh')) value = '可用房源发布到 LISTIA 后会显示在这里。';
    else if (lang.startsWith('ja')) value = 'LISTIAで公開された物件がここに表示されます。';
    if (empty.textContent !== value) empty.textContent = value;
  }

  function removeLegacyProvenanceUI() {
    document.querySelectorAll('.marketplace-source-contact,.marketplace-source-pill').forEach(node => node.remove());
  }

  let lastShuffleFingerprint = '';

  function shuffleVisibleCards() {
    const grid = document.getElementById('marketplaceGrid');
    if (!grid) return;
    const cards = [...grid.querySelectorAll('.marketplace-card')];
    if (cards.length < 2) return;

    const titles = cards.map(card => text(card.querySelector('.marketplace-title')?.textContent));
    const fingerprint = [...titles].sort().join('|');
    if (fingerprint === lastShuffleFingerprint) return;

    const data = window.LISTIA_MARKETPLACE_DATA || [];
    const country = String(window.LISTIA_MARKETPLACE_COUNTRY || '').toUpperCase();
    const rowFor = card => data.find(x => text(x.title) === text(card.querySelector('.marketplace-title')?.textContent));
    const local = [];
    const rest = [];

    for (const card of cards) {
      const row = rowFor(card);
      if (country && String(row?.country_code || '').toUpperCase() === country) local.push(card);
      else rest.push(card);
    }

    lastShuffleFingerprint = fingerprint;
    const fragment = document.createDocumentFragment();
    [...shuffle(local), ...shuffle(rest)].forEach(card => fragment.append(card));
    grid.append(fragment);
  }

  let timer = 0;
  const repair = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      removeLegacyProvenanceUI();
      neutralEmptyCopy();
      shuffleVisibleCards();
    }, 80);
  };

  function installObservers(attempt = 0) {
    const grid = document.getElementById('marketplaceGrid');
    const detail = document.getElementById('screen-marketplace-detail');
    if (!grid || !detail) {
      if (attempt < 30) setTimeout(() => installObservers(attempt + 1), 100);
      return;
    }

    if (grid.dataset.listiaFeedObserver !== '1') {
      grid.dataset.listiaFeedObserver = '1';
      new MutationObserver(repair).observe(grid, { childList: true, subtree: true });
    }
    if (detail.dataset.listiaFeedObserver !== '1') {
      detail.dataset.listiaFeedObserver = '1';
      new MutationObserver(repair).observe(detail, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
    }
    repair();
  }

  function boot() {
    installObservers();
    window.addEventListener('listia:languagechange', () => {
      lastShuffleFingerprint = '';
      repair();
    });
    window.addEventListener('focus', () => {
      lastShuffleFingerprint = '';
      repair();
    });
    window.addEventListener('listia:marketplace-data', () => {
      lastShuffleFingerprint = '';
      repair();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();