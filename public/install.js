(() => {
  'use strict';

  const INSTALL_TARGETS = new Set(['ios', 'android', 'desktop']);
  const requestedTarget = new URLSearchParams(window.location.search).get('install');
  if (!INSTALL_TARGETS.has(requestedTarget)) return;

  const COPY = {
    es: {
      title: 'Instala LISTIA en tu dispositivo',
      iosTitle: 'Instala LISTIA en tu iPhone o iPad',
      androidBody: 'Toca Instalar LISTIA para añadir la aplicación a tu pantalla de inicio.',
      desktopBody: 'Toca Instalar LISTIA para abrirla como una aplicación independiente en tu computadora.',
      iosBody: 'LISTIA se instala directamente desde Safari:',
      iosSteps: ['Toca Compartir.', 'Selecciona Agregar a Inicio.', 'Activa Abrir como app web y toca Agregar.'],
      iosBrowser: 'Si estás en otro navegador, abre esta página en Safari para instalar LISTIA.',
      androidFallback: 'Si no aparece la ventana, abre el menú ⋮ del navegador y elige Instalar aplicación o Agregar a pantalla principal.',
      desktopFallback: 'Usa el icono Instalar de la barra de direcciones o el menú de Chrome o Edge y selecciona Instalar LISTIA.',
      install: 'Instalar LISTIA',
      continue: 'Continuar en LISTIA',
      close: 'Cerrar',
      already: 'LISTIA ya está instalada en este dispositivo.',
      success: 'LISTIA quedó instalada correctamente.'
    },
    en: {
      title: 'Install LISTIA on your device',
      iosTitle: 'Install LISTIA on your iPhone or iPad',
      androidBody: 'Tap Install LISTIA to add the app to your Home Screen.',
      desktopBody: 'Tap Install LISTIA to open it as a standalone app on your computer.',
      iosBody: 'Install LISTIA directly from Safari:',
      iosSteps: ['Tap Share.', 'Choose Add to Home Screen.', 'Turn on Open as Web App and tap Add.'],
      iosBrowser: 'If you are using another browser, open this page in Safari to install LISTIA.',
      androidFallback: 'If the window does not appear, open the browser menu ⋮ and choose Install app or Add to Home screen.',
      desktopFallback: 'Use the Install icon in the address bar or open the Chrome or Edge menu and choose Install LISTIA.',
      install: 'Install LISTIA',
      continue: 'Continue in LISTIA',
      close: 'Close',
      already: 'LISTIA is already installed on this device.',
      success: 'LISTIA was installed successfully.'
    },
    fr: {
      title: 'Installez LISTIA sur votre appareil',
      iosTitle: 'Installez LISTIA sur votre iPhone ou iPad',
      androidBody: 'Touchez Installer LISTIA pour ajouter l’application à votre écran d’accueil.',
      desktopBody: 'Cliquez sur Installer LISTIA pour l’ouvrir comme une application indépendante sur votre ordinateur.',
      iosBody: 'Installez LISTIA directement depuis Safari :',
      iosSteps: ['Touchez Partager.', 'Choisissez Sur l’écran d’accueil.', 'Activez Ouvrir comme app web, puis touchez Ajouter.'],
      iosBrowser: 'Si vous utilisez un autre navigateur, ouvrez cette page dans Safari pour installer LISTIA.',
      androidFallback: 'Si la fenêtre ne s’affiche pas, ouvrez le menu ⋮ du navigateur et choisissez Installer l’application ou Ajouter à l’écran d’accueil.',
      desktopFallback: 'Utilisez l’icône Installer dans la barre d’adresse ou le menu Chrome ou Edge, puis choisissez Installer LISTIA.',
      install: 'Installer LISTIA',
      continue: 'Continuer dans LISTIA',
      close: 'Fermer',
      already: 'LISTIA est déjà installée sur cet appareil.',
      success: 'LISTIA a été installée correctement.'
    },
    it: {
      title: 'Installa LISTIA sul tuo dispositivo',
      iosTitle: 'Installa LISTIA sul tuo iPhone o iPad',
      androidBody: 'Tocca Installa LISTIA per aggiungere l’app alla schermata Home.',
      desktopBody: 'Fai clic su Installa LISTIA per aprirla come app indipendente sul computer.',
      iosBody: 'Installa LISTIA direttamente da Safari:',
      iosSteps: ['Tocca Condividi.', 'Scegli Aggiungi alla schermata Home.', 'Attiva Apri come app web e tocca Aggiungi.'],
      iosBrowser: 'Se usi un altro browser, apri questa pagina in Safari per installare LISTIA.',
      androidFallback: 'Se la finestra non appare, apri il menu ⋮ del browser e scegli Installa app o Aggiungi a schermata Home.',
      desktopFallback: 'Usa l’icona Installa nella barra degli indirizzi o il menu di Chrome o Edge e scegli Installa LISTIA.',
      install: 'Installa LISTIA',
      continue: 'Continua in LISTIA',
      close: 'Chiudi',
      already: 'LISTIA è già installata su questo dispositivo.',
      success: 'LISTIA è stata installata correttamente.'
    },
    'pt-BR': {
      title: 'Instale a LISTIA no seu dispositivo',
      iosTitle: 'Instale a LISTIA no seu iPhone ou iPad',
      androidBody: 'Toque em Instalar LISTIA para adicionar o aplicativo à Tela de Início.',
      desktopBody: 'Clique em Instalar LISTIA para abri-la como um aplicativo independente no computador.',
      iosBody: 'Instale a LISTIA diretamente pelo Safari:',
      iosSteps: ['Toque em Compartilhar.', 'Escolha Adicionar à Tela de Início.', 'Ative Abrir como App da Web e toque em Adicionar.'],
      iosBrowser: 'Se estiver usando outro navegador, abra esta página no Safari para instalar a LISTIA.',
      androidFallback: 'Se a janela não aparecer, abra o menu ⋮ do navegador e escolha Instalar app ou Adicionar à tela inicial.',
      desktopFallback: 'Use o ícone Instalar na barra de endereço ou o menu do Chrome ou Edge e escolha Instalar LISTIA.',
      install: 'Instalar LISTIA',
      continue: 'Continuar na LISTIA',
      close: 'Fechar',
      already: 'A LISTIA já está instalada neste dispositivo.',
      success: 'A LISTIA foi instalada corretamente.'
    },
    de: {
      title: 'LISTIA auf diesem Gerät installieren',
      iosTitle: 'LISTIA auf Ihrem iPhone oder iPad installieren',
      androidBody: 'Tippen Sie auf LISTIA installieren, um die App zum Home-Bildschirm hinzuzufügen.',
      desktopBody: 'Klicken Sie auf LISTIA installieren, um sie als eigenständige App auf Ihrem Computer zu öffnen.',
      iosBody: 'Installieren Sie LISTIA direkt aus Safari:',
      iosSteps: ['Tippen Sie auf Teilen.', 'Wählen Sie Zum Home-Bildschirm.', 'Aktivieren Sie Als Web-App öffnen und tippen Sie auf Hinzufügen.'],
      iosBrowser: 'Wenn Sie einen anderen Browser verwenden, öffnen Sie diese Seite in Safari, um LISTIA zu installieren.',
      androidFallback: 'Falls das Fenster nicht erscheint, öffnen Sie das Browsermenü ⋮ und wählen Sie App installieren oder Zum Startbildschirm hinzufügen.',
      desktopFallback: 'Verwenden Sie das Installieren-Symbol in der Adressleiste oder das Chrome- bzw. Edge-Menü und wählen Sie LISTIA installieren.',
      install: 'LISTIA installieren',
      continue: 'In LISTIA fortfahren',
      close: 'Schließen',
      already: 'LISTIA ist auf diesem Gerät bereits installiert.',
      success: 'LISTIA wurde erfolgreich installiert.'
    },
    'ar-AE': {
      title: 'ثبّت LISTIA على جهازك',
      iosTitle: 'ثبّت LISTIA على iPhone أو iPad',
      androidBody: 'اضغط تثبيت LISTIA لإضافة التطبيق إلى الشاشة الرئيسية.',
      desktopBody: 'اضغط تثبيت LISTIA لفتحها كتطبيق مستقل على الكمبيوتر.',
      iosBody: 'ثبّت LISTIA مباشرة من Safari:',
      iosSteps: ['اضغط مشاركة.', 'اختر إضافة إلى الشاشة الرئيسية.', 'فعّل فتح كتطبيق ويب ثم اضغط إضافة.'],
      iosBrowser: 'إذا كنت تستخدم متصفحاً آخر، افتح هذه الصفحة في Safari لتثبيت LISTIA.',
      androidFallback: 'إذا لم تظهر نافذة التثبيت، افتح قائمة المتصفح ⋮ واختر تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية.',
      desktopFallback: 'استخدم رمز التثبيت في شريط العنوان أو افتح قائمة Chrome أو Edge واختر تثبيت LISTIA.',
      install: 'تثبيت LISTIA',
      continue: 'المتابعة في LISTIA',
      close: 'إغلاق',
      already: 'LISTIA مثبتة بالفعل على هذا الجهاز.',
      success: 'تم تثبيت LISTIA بنجاح.'
    }
  };

  let deferredPrompt = null;
  let overlay = null;
  let titleNode = null;
  let bodyNode = null;
  let primaryButton = null;
  let closeButton = null;
  let fallbackVisible = false;

  function language() {
    return window.LISTIA_I18N?.getLanguage?.() || 'en';
  }

  function copy() {
    return COPY[language()] || COPY.en;
  }

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isSafariOnIOS() {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const webkit = /WebKit/i.test(ua);
    const alternate = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua);
    return ios && webkit && !alternate;
  }

  function createOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'install-overlay';
    overlay.innerHTML = `
      <section class="install-card" role="dialog" aria-modal="true" aria-labelledby="installTitle">
        <button class="install-close" type="button" aria-label="Close">×</button>
        <img class="install-mark" src="/listia-mark-transparent.webp" alt="" />
        <h2 id="installTitle"></h2>
        <div class="install-body"></div>
        <button class="primary full install-primary" type="button"></button>
      </section>`;
    document.body.appendChild(overlay);
    titleNode = overlay.querySelector('#installTitle');
    bodyNode = overlay.querySelector('.install-body');
    primaryButton = overlay.querySelector('.install-primary');
    closeButton = overlay.querySelector('.install-close');
    closeButton.addEventListener('click', close);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) close();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && overlay?.classList.contains('visible')) close();
    });
    primaryButton.addEventListener('click', handlePrimary);
  }

  function close() {
    overlay?.classList.remove('visible');
    document.body.classList.remove('install-open');
  }

  function show() {
    if (!overlay) createOverlay();
    render();
    overlay.classList.add('visible');
    document.body.classList.add('install-open');
    window.setTimeout(() => primaryButton?.focus(), 50);
    const url = new URL(window.location.href);
    url.searchParams.delete('install');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }

  function render() {
    const t = copy();
    closeButton?.setAttribute('aria-label', t.close);
    primaryButton.hidden = false;
    primaryButton.textContent = t.install;

    if (isStandalone()) {
      titleNode.textContent = t.title;
      bodyNode.innerHTML = `<p>${t.already}</p>`;
      primaryButton.textContent = t.continue;
      return;
    }

    if (requestedTarget === 'ios') {
      titleNode.textContent = t.iosTitle;
      const browserNote = isSafariOnIOS() ? '' : `<p class="install-note">${t.iosBrowser}</p>`;
      bodyNode.innerHTML = `<p>${t.iosBody}</p><ol>${t.iosSteps.map(step => `<li>${step}</li>`).join('')}</ol>${browserNote}`;
      primaryButton.textContent = t.continue;
      return;
    }

    titleNode.textContent = t.title;
    const standardBody = requestedTarget === 'android' ? t.androidBody : t.desktopBody;
    const fallback = requestedTarget === 'android' ? t.androidFallback : t.desktopFallback;
    bodyNode.innerHTML = `<p>${fallbackVisible ? fallback : standardBody}</p>`;
    primaryButton.textContent = fallbackVisible ? t.continue : t.install;
  }

  async function handlePrimary() {
    if (isStandalone() || requestedTarget === 'ios' || fallbackVisible) {
      close();
      return;
    }

    if (!deferredPrompt) {
      fallbackVisible = true;
      render();
      return;
    }

    const prompt = deferredPrompt;
    deferredPrompt = null;
    await prompt.prompt();
    const choice = await prompt.userChoice.catch(() => ({ outcome: 'dismissed' }));
    if (choice.outcome === 'accepted') close();
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    fallbackVisible = false;
    if (overlay?.classList.contains('visible')) render();
  });

  window.addEventListener('appinstalled', () => {
    if (!overlay) return;
    const t = copy();
    titleNode.textContent = t.title;
    bodyNode.innerHTML = `<p>${t.success}</p>`;
    primaryButton.textContent = t.continue;
    window.setTimeout(close, 1800);
  });

  window.addEventListener('listia:languagechange', () => {
    if (overlay?.classList.contains('visible')) render();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', show, { once: true });
  } else {
    show();
  }
})();
