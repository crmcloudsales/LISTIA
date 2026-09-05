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
      install: 'Instalar LISTIA', continue: 'Continuar en LISTIA', close: 'Cerrar',
      already: 'LISTIA ya está instalada en este dispositivo.', success: 'LISTIA quedó instalada correctamente.'
    },
    en: {
      title: 'Install LISTIA on your device', iosTitle: 'Install LISTIA on your iPhone or iPad',
      androidBody: 'Tap Install LISTIA to add the app to your Home Screen.',
      desktopBody: 'Tap Install LISTIA to open it as a standalone app on your computer.',
      iosBody: 'Install LISTIA directly from Safari:',
      iosSteps: ['Tap Share.', 'Choose Add to Home Screen.', 'Turn on Open as Web App and tap Add.'],
      iosBrowser: 'If you are using another browser, open this page in Safari to install LISTIA.',
      androidFallback: 'If the window does not appear, open the browser menu ⋮ and choose Install app or Add to Home screen.',
      desktopFallback: 'Use the Install icon in the address bar or open the Chrome or Edge menu and choose Install LISTIA.',
      install: 'Install LISTIA', continue: 'Continue in LISTIA', close: 'Close',
      already: 'LISTIA is already installed on this device.', success: 'LISTIA was installed successfully.'
    },
    fr: {
      title: 'Installez LISTIA sur votre appareil', iosTitle: 'Installez LISTIA sur votre iPhone ou iPad',
      androidBody: 'Touchez Installer LISTIA pour ajouter l’application à votre écran d’accueil.',
      desktopBody: 'Cliquez sur Installer LISTIA pour l’ouvrir comme une application indépendante sur votre ordinateur.',
      iosBody: 'Installez LISTIA directement depuis Safari :',
      iosSteps: ['Touchez Partager.', 'Choisissez Sur l’écran d’accueil.', 'Activez Ouvrir comme app web, puis touchez Ajouter.'],
      iosBrowser: 'Si vous utilisez un autre navigateur, ouvrez cette page dans Safari pour installer LISTIA.',
      androidFallback: 'Si la fenêtre ne s’affiche pas, ouvrez le menu ⋮ du navigateur et choisissez Installer l’application ou Ajouter à l’écran d’accueil.',
      desktopFallback: 'Utilisez l’icône Installer dans la barre d’adresse ou le menu Chrome ou Edge, puis choisissez Installer LISTIA.',
      install: 'Installer LISTIA', continue: 'Continuer dans LISTIA', close: 'Fermer',
      already: 'LISTIA est déjà installée sur cet appareil.', success: 'LISTIA a été installée correctement.'
    },
    it: {
      title: 'Installa LISTIA sul tuo dispositivo', iosTitle: 'Installa LISTIA sul tuo iPhone o iPad',
      androidBody: 'Tocca Installa LISTIA per aggiungere l’app alla schermata Home.',
      desktopBody: 'Fai clic su Installa LISTIA per aprirla come app indipendente sul computer.',
      iosBody: 'Installa LISTIA direttamente da Safari:',
      iosSteps: ['Tocca Condividi.', 'Scegli Aggiungi alla schermata Home.', 'Attiva Apri come app web e tocca Aggiungi.'],
      iosBrowser: 'Se usi un altro browser, apri questa pagina in Safari per installare LISTIA.',
      androidFallback: 'Se la finestra non appare, apri il menu ⋮ del browser e scegli Installa app o Aggiungi a schermata Home.',
      desktopFallback: 'Usa l’icona Installa nella barra degli indirizzi o il menu di Chrome o Edge e scegli Installa LISTIA.',
      install: 'Installa LISTIA', continue: 'Continua in LISTIA', close: 'Chiudi',
      already: 'LISTIA è già installata su questo dispositivo.', success: 'LISTIA è stata installata correttamente.'
    },
    'pt-BR': {
      title: 'Instale a LISTIA no seu dispositivo', iosTitle: 'Instale a LISTIA no seu iPhone ou iPad',
      androidBody: 'Toque em Instalar LISTIA para adicionar o aplicativo à Tela de Início.',
      desktopBody: 'Clique em Instalar LISTIA para abri-la como um aplicativo independente no computador.',
      iosBody: 'Instale a LISTIA diretamente pelo Safari:',
      iosSteps: ['Toque em Compartilhar.', 'Escolha Adicionar à Tela de Início.', 'Ative Abrir como App da Web e toque em Adicionar.'],
      iosBrowser: 'Se estiver usando outro navegador, abra esta página no Safari para instalar a LISTIA.',
      androidFallback: 'Se a janela não aparecer, abra o menu ⋮ do navegador e escolha Instalar app ou Adicionar à tela inicial.',
      desktopFallback: 'Use o ícone Instalar na barra de endereço ou o menu do Chrome ou Edge e escolha Instalar LISTIA.',
      install: 'Instalar LISTIA', continue: 'Continuar na LISTIA', close: 'Fechar',
      already: 'A LISTIA já está instalada neste dispositivo.', success: 'A LISTIA foi instalada corretamente.'
    },
    de: {
      title: 'LISTIA auf diesem Gerät installieren', iosTitle: 'LISTIA auf Ihrem iPhone oder iPad installieren',
      androidBody: 'Tippen Sie auf LISTIA installieren, um die App zum Home-Bildschirm hinzuzufügen.',
      desktopBody: 'Klicken Sie auf LISTIA installieren, um sie als eigenständige App auf Ihrem Computer zu öffnen.',
      iosBody: 'Installieren Sie LISTIA direkt aus Safari:',
      iosSteps: ['Tippen Sie auf Teilen.', 'Wählen Sie Zum Home-Bildschirm.', 'Aktivieren Sie Als Web-App öffnen und tippen Sie auf Hinzufügen.'],
      iosBrowser: 'Wenn Sie einen anderen Browser verwenden, öffnen Sie diese Seite in Safari, um LISTIA zu installieren.',
      androidFallback: 'Falls das Fenster nicht erscheint, öffnen Sie das Browsermenü ⋮ und wählen Sie App installieren oder Zum Startbildschirm hinzufügen.',
      desktopFallback: 'Verwenden Sie das Installieren-Symbol in der Adressleiste oder das Chrome- bzw. Edge-Menü und wählen Sie LISTIA installieren.',
      install: 'LISTIA installieren', continue: 'In LISTIA fortfahren', close: 'Schließen',
      already: 'LISTIA ist auf diesem Gerät bereits installiert.', success: 'LISTIA wurde erfolgreich installiert.'
    },
    'ar-AE': {
      title: 'ثبّت LISTIA على جهازك', iosTitle: 'ثبّت LISTIA على iPhone أو iPad',
      androidBody: 'اضغط تثبيت LISTIA لإضافة التطبيق إلى الشاشة الرئيسية.',
      desktopBody: 'اضغط تثبيت LISTIA لفتحها كتطبيق مستقل على الكمبيوتر.',
      iosBody: 'ثبّت LISTIA مباشرة من Safari:',
      iosSteps: ['اضغط مشاركة.', 'اختر إضافة إلى الشاشة الرئيسية.', 'فعّل فتح كتطبيق ويب ثم اضغط إضافة.'],
      iosBrowser: 'إذا كنت تستخدم متصفحاً آخر، افتح هذه الصفحة في Safari لتثبيت LISTIA.',
      androidFallback: 'إذا لم تظهر نافذة التثبيت، افتح قائمة المتصفح ⋮ واختر تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية.',
      desktopFallback: 'استخدم رمز التثبيت في شريط العنوان أو افتح قائمة Chrome أو Edge واختر تثبيت LISTIA.',
      install: 'تثبيت LISTIA', continue: 'المتابعة في LISTIA', close: 'إغلاق',
      already: 'LISTIA مثبتة بالفعل على هذا الجهاز.', success: 'تم تثبيت LISTIA بنجاح.'
    },
    ru: {
      title: 'Установите LISTIA на устройство', iosTitle: 'Установите LISTIA на iPhone или iPad',
      androidBody: 'Нажмите «Установить LISTIA», чтобы добавить приложение на главный экран.',
      desktopBody: 'Нажмите «Установить LISTIA», чтобы открыть приложение в отдельном окне на компьютере.',
      iosBody: 'Установите LISTIA прямо из Safari:',
      iosSteps: ['Нажмите «Поделиться».', 'Выберите «На экран Домой».', 'Включите «Открывать как веб‑приложение» и нажмите «Добавить».'],
      iosBrowser: 'Если вы используете другой браузер, откройте эту страницу в Safari, чтобы установить LISTIA.',
      androidFallback: 'Если окно не появилось, откройте меню ⋮ браузера и выберите «Установить приложение» или «Добавить на главный экран».',
      desktopFallback: 'Используйте значок установки в адресной строке или меню Chrome/Edge и выберите «Установить LISTIA».',
      install: 'Установить LISTIA', continue: 'Продолжить в LISTIA', close: 'Закрыть',
      already: 'LISTIA уже установлена на этом устройстве.', success: 'LISTIA успешно установлена.'
    },
    he: {
      title: 'התקנת LISTIA במכשיר', iosTitle: 'התקנת LISTIA ב‑iPhone או ב‑iPad',
      androidBody: 'לחצו על התקנת LISTIA כדי להוסיף את האפליקציה למסך הבית.',
      desktopBody: 'לחצו על התקנת LISTIA כדי לפתוח אותה כאפליקציה עצמאית במחשב.',
      iosBody: 'התקינו את LISTIA ישירות מ‑Safari:',
      iosSteps: ['לחצו על שיתוף.', 'בחרו הוספה למסך הבית.', 'הפעילו פתיחה כיישום אינטרנט ולחצו על הוספה.'],
      iosBrowser: 'אם אתם משתמשים בדפדפן אחר, פתחו את הדף הזה ב‑Safari כדי להתקין את LISTIA.',
      androidFallback: 'אם חלון ההתקנה לא מופיע, פתחו את תפריט ⋮ ובחרו התקנת אפליקציה או הוספה למסך הבית.',
      desktopFallback: 'השתמשו בסמל ההתקנה בשורת הכתובת או בתפריט Chrome/Edge ובחרו התקנת LISTIA.',
      install: 'התקנת LISTIA', continue: 'המשך ב‑LISTIA', close: 'סגירה',
      already: 'LISTIA כבר מותקנת במכשיר הזה.', success: 'LISTIA הותקנה בהצלחה.'
    },
    'zh-CN': {
      title: '在设备上安装 LISTIA', iosTitle: '在 iPhone 或 iPad 上安装 LISTIA',
      androidBody: '点击“安装 LISTIA”，将应用添加到主屏幕。',
      desktopBody: '点击“安装 LISTIA”，在电脑上以独立应用方式打开。',
      iosBody: '直接通过 Safari 安装 LISTIA：',
      iosSteps: ['点击“分享”。', '选择“添加到主屏幕”。', '开启“作为网页 App 打开”，然后点击“添加”。'],
      iosBrowser: '如果你正在使用其他浏览器，请在 Safari 中打开此页面以安装 LISTIA。',
      androidFallback: '如果没有出现安装窗口，请打开浏览器的 ⋮ 菜单并选择“安装应用”或“添加到主屏幕”。',
      desktopFallback: '使用地址栏中的安装图标，或打开 Chrome/Edge 菜单并选择“安装 LISTIA”。',
      install: '安装 LISTIA', continue: '继续使用 LISTIA', close: '关闭',
      already: '此设备已安装 LISTIA。', success: 'LISTIA 已成功安装。'
    },
    ja: {
      title: 'LISTIA をデバイスにインストール', iosTitle: 'LISTIA を iPhone または iPad にインストール',
      androidBody: '「LISTIA をインストール」をタップしてホーム画面に追加します。',
      desktopBody: '「LISTIA をインストール」をクリックして、パソコンで独立したアプリとして開きます。',
      iosBody: 'Safari から LISTIA を直接インストールできます：',
      iosSteps: ['「共有」をタップします。', '「ホーム画面に追加」を選びます。', '「Web Appとして開く」を有効にして「追加」をタップします。'],
      iosBrowser: '別のブラウザを使用している場合は、このページを Safari で開いて LISTIA をインストールしてください。',
      androidFallback: '画面が表示されない場合は、ブラウザの ⋮ メニューから「アプリをインストール」または「ホーム画面に追加」を選びます。',
      desktopFallback: 'アドレスバーのインストールアイコン、または Chrome/Edge のメニューから「LISTIA をインストール」を選びます。',
      install: 'LISTIA をインストール', continue: 'LISTIA を続ける', close: '閉じる',
      already: 'LISTIA はこのデバイスにすでにインストールされています。', success: 'LISTIA を正常にインストールしました。'
    }
  };

  let deferredPrompt = null;
  let overlay = null;
  let titleNode = null;
  let bodyNode = null;
  let primaryButton = null;
  let closeButton = null;
  let fallbackVisible = false;
  let previousFocus = null;

  function languageKey() {
    const raw = String(window.LISTIA_I18N?.getLanguage?.() || document.documentElement.dataset.listiaLanguage || document.documentElement.lang || 'en');
    if (COPY[raw]) return raw;
    const lower = raw.toLowerCase();
    if (lower.startsWith('pt')) return 'pt-BR';
    if (lower.startsWith('ar')) return 'ar-AE';
    if (lower.startsWith('zh')) return 'zh-CN';
    if (lower.startsWith('he')) return 'he';
    if (lower.startsWith('ja')) return 'ja';
    if (lower.startsWith('ru')) return 'ru';
    if (lower.startsWith('fr')) return 'fr';
    if (lower.startsWith('it')) return 'it';
    if (lower.startsWith('de')) return 'de';
    if (lower.startsWith('es')) return 'es';
    return 'en';
  }

  const copy = () => COPY[languageKey()] || COPY.en;
  const make = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = String(text);
    return el;
  };

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
    overlay = make('div', 'install-overlay');
    const card = make('section', 'install-card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'installTitle');

    closeButton = make('button', 'install-close', '×');
    closeButton.type = 'button';
    const mark = make('img', 'install-mark');
    mark.src = '/listia-mark-transparent.webp';
    mark.alt = '';
    titleNode = make('h2');
    titleNode.id = 'installTitle';
    bodyNode = make('div', 'install-body');
    bodyNode.setAttribute('aria-live', 'polite');
    primaryButton = make('button', 'primary full install-primary');
    primaryButton.type = 'button';

    card.append(closeButton, mark, titleNode, bodyNode, primaryButton);
    overlay.append(card);
    document.body.append(overlay);

    closeButton.addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && overlay?.classList.contains('visible')) close();
    });
    primaryButton.addEventListener('click', handlePrimary);
  }

  function close() {
    overlay?.classList.remove('visible');
    document.body.classList.remove('install-open');
    if (previousFocus instanceof HTMLElement && document.contains(previousFocus)) previousFocus.focus({ preventScroll: true });
  }

  function show() {
    if (!overlay) createOverlay();
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    render();
    overlay.classList.add('visible');
    document.body.classList.add('install-open');
    window.setTimeout(() => primaryButton?.focus({ preventScroll: true }), 50);
    const url = new URL(window.location.href);
    url.searchParams.delete('install');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }

  function showParagraph(text, className = '') {
    bodyNode.replaceChildren(make('p', className, text));
  }

  function showIOSInstructions(t) {
    const intro = make('p', '', t.iosBody);
    const list = make('ol');
    for (const step of t.iosSteps) list.append(make('li', '', step));
    const parts = [intro, list];
    if (!isSafariOnIOS()) parts.push(make('p', 'install-note', t.iosBrowser));
    bodyNode.replaceChildren(...parts);
  }

  function render() {
    const t = copy();
    closeButton?.setAttribute('aria-label', t.close);
    primaryButton.hidden = false;
    primaryButton.textContent = t.install;

    if (isStandalone()) {
      titleNode.textContent = t.title;
      showParagraph(t.already);
      primaryButton.textContent = t.continue;
      return;
    }

    if (requestedTarget === 'ios') {
      titleNode.textContent = t.iosTitle;
      showIOSInstructions(t);
      primaryButton.textContent = t.continue;
      return;
    }

    titleNode.textContent = t.title;
    const standardBody = requestedTarget === 'android' ? t.androidBody : t.desktopBody;
    const fallback = requestedTarget === 'android' ? t.androidFallback : t.desktopFallback;
    showParagraph(fallbackVisible ? fallback : standardBody);
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
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice.catch(() => ({ outcome: 'dismissed' }));
      if (choice.outcome === 'accepted') close();
      else {
        fallbackVisible = true;
        render();
      }
    } catch {
      fallbackVisible = true;
      render();
    }
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    fallbackVisible = false;
    if (overlay?.classList.contains('visible')) render();
  });

  window.addEventListener('appinstalled', () => {
    if (!overlay) return;
    deferredPrompt = null;
    const t = copy();
    titleNode.textContent = t.title;
    showParagraph(t.success);
    primaryButton.textContent = t.continue;
    window.setTimeout(close, 1800);
  });

  window.addEventListener('listia:languagechange', () => {
    if (overlay?.classList.contains('visible')) render();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show, { once: true });
  else show();
})();
