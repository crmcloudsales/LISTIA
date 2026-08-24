(() => {
  const copy = {
    es: {
      rights: '© 2026 LISTIA. Todos los derechos reservados.',
      privacy: 'Aviso de privacidad',
      terms: 'Términos y condiciones'
    },
    en: {
      rights: '© 2026 LISTIA. All rights reserved.',
      privacy: 'Privacy Notice',
      terms: 'Terms & Conditions'
    },
    fr: {
      rights: '© 2026 LISTIA. Tous droits réservés.',
      privacy: 'Avis de confidentialité',
      terms: 'Conditions générales'
    },
    it: {
      rights: '© 2026 LISTIA. Tutti i diritti riservati.',
      privacy: 'Informativa sulla privacy',
      terms: 'Termini e condizioni'
    },
    'pt-BR': {
      rights: '© 2026 LISTIA. Todos os direitos reservados.',
      privacy: 'Aviso de privacidade',
      terms: 'Termos e condições'
    },
    de: {
      rights: '© 2026 LISTIA. Alle Rechte vorbehalten.',
      privacy: 'Datenschutzhinweis',
      terms: 'Nutzungsbedingungen'
    },
    'ar-AE': {
      rights: '© 2026 LISTIA. جميع الحقوق محفوظة.',
      privacy: 'إشعار الخصوصية',
      terms: 'الشروط والأحكام'
    }
  };

  const normalize = (value) => {
    if (!value) return 'en';
    const code = String(value).toLowerCase();
    if (code.startsWith('pt')) return 'pt-BR';
    if (code.startsWith('ar')) return 'ar-AE';
    if (code.startsWith('es')) return 'es';
    if (code.startsWith('fr')) return 'fr';
    if (code.startsWith('it')) return 'it';
    if (code.startsWith('de')) return 'de';
    return 'en';
  };

  function ensureStyles() {
    if (document.getElementById('listiaLegalFooterStyles')) return;
    const style = document.createElement('style');
    style.id = 'listiaLegalFooterStyles';
    style.textContent = `
      footer .wrap{align-items:flex-start;}
      .listia-footer-main{display:flex;flex-direction:column;gap:7px;min-width:240px;}
      .listia-footer-meta{display:flex;flex-wrap:wrap;align-items:center;gap:7px 14px;}
      .listia-footer-links{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;}
      .listia-footer-links a,.listia-powered a{font-size:.78rem;color:var(--muted);text-decoration:none;transition:color .15s ease;}
      .listia-footer-links a:hover,.listia-powered a:hover{color:var(--paper);}
      .listia-footer-links a:focus-visible,.listia-powered a:focus-visible{color:var(--paper);}
      .listia-powered{font-size:.78rem;color:var(--muted);}
      .listia-powered a{font-weight:600;color:var(--paper);}
      .listia-footer-right{display:flex;flex-direction:column;gap:7px;align-items:flex-end;}
      @media(max-width:680px){
        footer .wrap{flex-direction:column;align-items:flex-start;}
        .listia-footer-right{align-items:flex-start;}
      }
      html[dir="rtl"] .listia-footer-right{align-items:flex-start;}
    `;
    document.head.appendChild(style);
  }

  function ensureFooter() {
    const footer = document.querySelector('footer .wrap');
    if (!footer) return null;

    let main = document.getElementById('listiaFooterMain');
    if (!main) {
      const oldDomain = Array.from(footer.children).find((node) => node.textContent.trim() === 'listiaapp.com');
      const oldTagline = document.getElementById('footerTagline');

      main = document.createElement('div');
      main.id = 'listiaFooterMain';
      main.className = 'listia-footer-main';
      main.innerHTML = `
        <span id="listiaFooterRights"></span>
        <div class="listia-footer-meta">
          <nav class="listia-footer-links" aria-label="Legal">
            <a id="listiaPrivacyLink" href="https://app.listiaapp.com/privacy.html">Privacy Notice</a>
            <a id="listiaTermsLink" href="https://app.listiaapp.com/terms.html">Terms &amp; Conditions</a>
          </nav>
          <span class="listia-powered">Powered by <a href="https://cloudsales.app" target="_blank" rel="noopener noreferrer">CloudSales</a></span>
        </div>
      `;

      const right = document.createElement('div');
      right.className = 'listia-footer-right';
      if (oldDomain) right.appendChild(oldDomain);
      if (oldTagline) right.appendChild(oldTagline);

      footer.replaceChildren(main, right);
    }

    return main;
  }

  function apply(language) {
    ensureStyles();
    if (!ensureFooter()) return;
    const lang = normalize(language || document.documentElement.dataset.listiaLanguage || document.documentElement.lang);
    const t = copy[lang] || copy.en;
    const rights = document.getElementById('listiaFooterRights');
    const privacy = document.getElementById('listiaPrivacyLink');
    const terms = document.getElementById('listiaTermsLink');
    if (rights) rights.textContent = t.rights;
    if (privacy) privacy.textContent = t.privacy;
    if (terms) terms.textContent = t.terms;
  }

  function init() {
    apply(window.ListiaI18n?.get?.() || document.documentElement.dataset.listiaLanguage || document.documentElement.lang);
    window.addEventListener('listia:languagechange', (event) => apply(event.detail?.language));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
