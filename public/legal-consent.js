(() => {
  'use strict';

  const TERMS_VERSION = '1.4.1';
  const PRIVACY_VERSION = '1.3';
  const TERMS_URL = '/terms.html';
  const PRIVACY_URL = '/privacy.html';

  const copy = {
    es: ['Acepto los ', 'Términos de Servicio', ' y el ', 'Aviso de Privacidad', '.'],
    en: ['I agree to the ', 'Terms of Service', ' and the ', 'Privacy Policy', '.'],
    fr: ["J’accepte les ", 'Conditions d’utilisation', ' et la ', 'Politique de confidentialité', '.'],
    it: ['Accetto i ', 'Termini di Servizio', ' e l’', 'Informativa sulla Privacy', '.'],
    'pt-BR': ['Aceito os ', 'Termos de Serviço', ' e a ', 'Política de Privacidade', '.'],
    de: ['Ich akzeptiere die ', 'Nutzungsbedingungen', ' und die ', 'Datenschutzerklärung', '.'],
    'ar-AE': ['أوافق على ', 'شروط الخدمة', ' و', 'سياسة الخصوصية', '.'],
    ru: ['Я принимаю ', 'Условия использования', ' и ', 'Политику конфиденциальности', '.'],
    he: ['אני מסכים/ה ל', 'תנאי השירות', ' ול', 'מדיניות הפרטיות', '.'],
    'zh-CN': ['我同意', '服务条款', '和', '隐私政策', '。'],
    ja: ['', '利用規約', 'および', 'プライバシーポリシー', 'に同意します。']
  };

  function language() {
    const raw = String(
      window.LISTIA_I18N?.getLanguage?.() ||
      document.documentElement.dataset.listiaLanguage ||
      document.documentElement.lang ||
      'en'
    );
    if (copy[raw]) return raw;
    const lower = raw.toLowerCase();
    if (lower.startsWith('es')) return 'es';
    if (lower.startsWith('fr')) return 'fr';
    if (lower.startsWith('it')) return 'it';
    if (lower.startsWith('pt')) return 'pt-BR';
    if (lower.startsWith('de')) return 'de';
    if (lower.startsWith('ar')) return 'ar-AE';
    if (lower.startsWith('ru')) return 'ru';
    if (lower.startsWith('he')) return 'he';
    if (lower.startsWith('zh')) return 'zh-CN';
    if (lower.startsWith('ja')) return 'ja';
    return 'en';
  }

  function link(label, href) {
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = label;
    a.addEventListener('click', event => event.stopPropagation());
    return a;
  }

  function render() {
    const target = document.querySelector('[data-i18n="signup.terms"], #signupLegalConsent');
    if (!target) return;
    const parts = copy[language()] || copy.en;
    target.id = 'signupLegalConsent';
    target.removeAttribute('data-i18n');
    target.replaceChildren(
      document.createTextNode(parts[0]),
      link(parts[1], TERMS_URL),
      document.createTextNode(parts[2]),
      link(parts[3], PRIVACY_URL),
      document.createTextNode(parts[4])
    );
  }

  window.LISTIA_LEGAL = Object.freeze({
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
    termsUrl: TERMS_URL,
    privacyUrl: PRIVACY_URL,
    acceptanceSource: 'pwa_signup_checkbox'
  });

  window.addEventListener('listia:languagechange', render);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true });
  else render();
})();
