(() => {
  const custom = {
    ru: {
      htmlLang:'ru-RU',dir:'ltr',label:'Русский',aliases:['ru','ru-ru'],
      title:'Listia — ИИ для недвижимости',description:'Откройте Listia или установите её на iPhone, Android или компьютер.',languageLabel:'Выбрать язык',
      heroEyebrow:'ИИ для недвижимости',heroTitle:'Откройте <span class="accent">Listia</span><br>или установите её на своё устройство',heroLede:'Платформа недвижимости с искусственным интеллектом. Доступна на iPhone, Android и компьютере.',access:'Открыть Listia',freeTag:'Скачать приложение бесплатно',desktop:'Скачать для компьютера',
      brandTitle:'Платформа <span class="accent">недвижимости</span> с искусственным интеллектом',brandLede:'Экономьте время, получайте больше лидов, автоматизируйте процессы и <strong>закрывайте больше сделок</strong> — всё в одном месте.',devicesEyebrow:'Одна Listia на любом экране',devicesTitle:'Listia на ноутбуке, планшете и смартфоне',devicesAlt:'Listia на ноутбуке, планшете и смартфоне',footerTagline:'ИИ для недвижимости'
    },
    he: {
      htmlLang:'he-IL',dir:'rtl',label:'עברית',aliases:['he','he-il','iw','iw-il'],
      title:'Listia — בינה מלאכותית לנדל״ן',description:'היכנסו ל-Listia או הורידו אותה ל-iPhone, Android או מחשב.',languageLabel:'בחירת שפה',
      heroEyebrow:'בינה מלאכותית לנדל״ן',heroTitle:'היכנסו ל-<span class="accent">Listia</span><br>או הורידו אותה למכשיר שלכם',heroLede:'פלטפורמת נדל״ן המופעלת באמצעות בינה מלאכותית. זמינה ל-iPhone, Android ולמחשב.',access:'כניסה ל-Listia',freeTag:'הורדת האפליקציה בחינם',desktop:'הורדה למחשב',
      brandTitle:'פלטפורמת <span class="accent">הנדל״ן</span> המופעלת באמצעות בינה מלאכותית',brandLede:'חסכו זמן, צרו יותר לידים, הפכו תהליכים לאוטומטיים ו<strong>סגרו יותר עסקאות</strong> — הכול במקום אחד.',devicesEyebrow:'Listia אחת בכל מסך',devicesTitle:'כך נראית Listia במחשב נייד, בטאבלט ובנייד',devicesAlt:'Listia במחשב נייד, בטאבלט ובנייד',footerTagline:'בינה מלאכותית לנדל״ן'
    },
    'zh-CN': {
      htmlLang:'zh-CN',dir:'ltr',label:'简体中文',aliases:['zh','zh-cn','zh-hans','zh-sg'],
      title:'Listia — AI 房地产平台',description:'访问 Listia，或下载到 iPhone、Android 或电脑。',languageLabel:'选择语言',
      heroEyebrow:'AI 房地产',heroTitle:'访问 <span class="accent">Listia</span><br>或下载安装到您的设备',heroLede:'AI 驱动的房地产平台。支持 iPhone、Android 和电脑。',access:'访问 Listia',freeTag:'免费下载应用',desktop:'下载桌面版',
      brandTitle:'AI 驱动的<span class="accent">房地产</span>平台',brandLede:'节省时间，获得更多潜在客户，自动化流程，并<strong>完成更多成交</strong>——全部集中在一个平台。',devicesEyebrow:'一个 Listia，适配所有屏幕',devicesTitle:'在笔记本、平板和手机上使用 Listia',devicesAlt:'笔记本、平板和手机上的 Listia',footerTagline:'AI 房地产'
    }
  };

  const baseAliases = {
    es:'es','es-mx':'es',
    en:'en','en-us':'en','en-gb':'en',
    fr:'fr','fr-fr':'fr','fr-ca':'fr',
    it:'it','it-it':'it',
    pt:'pt-BR','pt-br':'pt-BR','pt-pt':'pt-BR',
    de:'de','de-de':'de','de-at':'de','de-ch':'de',
    ar:'ar-AE','ar-ae':'ar-AE'
  };

  let currentCustom = null;
  const normalize = value => {
    const code=String(value||'').trim().toLowerCase().replaceAll('_','-');
    for(const [key,cfg] of Object.entries(custom)){
      if(cfg.aliases.includes(code)||cfg.aliases.includes(code.split('-')[0])) return key;
    }
    return null;
  };
  const normalizeBase = value => {
    const code=String(value||'').trim().toLowerCase().replaceAll('_','-');
    return baseAliases[code] || baseAliases[code.split('-')[0]] || null;
  };
  const setText=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};
  const setHTML=(id,value)=>{const el=document.getElementById(id);if(el)el.innerHTML=value};
  const persist=lang=>{try{localStorage.setItem('listia_language',lang)}catch{}document.cookie=`listia_lang=${encodeURIComponent(lang)};path=/;max-age=31536000;SameSite=Lax`};

  function ensureOfficialFavicon(){
    let favicon=document.getElementById('favicon') || document.querySelector('link[rel="icon"]');
    if(!favicon){
      favicon=document.createElement('link');
      favicon.rel='icon';
      favicon.id='favicon';
      document.head.append(favicon);
    }
    favicon.type='image/png';
    favicon.sizes='32x32';
    favicon.href='https://app.listiaapp.com/listia-app-icon-32.png?v=2';
  }

  function ensureOptions(){
    const selector=document.getElementById('languageSelect'); if(!selector)return;
    for(const [key,cfg] of Object.entries(custom)){
      if(selector.querySelector(`option[value="${key}"]`))continue;
      const option=document.createElement('option');option.value=key;option.textContent=cfg.label;selector.append(option);
    }
  }

  function ensureHreflang(){
    const head=document.head;
    for(const lang of ['ru','he','zh-CN']){
      if(head.querySelector(`link[rel="alternate"][hreflang="${lang}"]`))continue;
      const link=document.createElement('link');link.rel='alternate';link.hreflang=lang;link.href=`https://listiaapp.com/?lang=${encodeURIComponent(lang)}`;head.append(link);
    }
  }

  function apply(lang,{persistChoice=false}={}){
    const key=normalize(lang); if(!key)return false;
    const t=custom[key];currentCustom=key;
    if(persistChoice)persist(key);
    document.documentElement.lang=t.htmlLang;document.documentElement.dir=t.dir;document.documentElement.dataset.listiaLanguage=key;
    document.title=t.title;
    const description=document.querySelector('meta[name="description"]');if(description)description.content=t.description;
    const canonical=document.getElementById('canonicalUrl');if(canonical)canonical.href=`https://listiaapp.com/?lang=${encodeURIComponent(key)}`;
    setText('languageLabel',t.languageLabel);setText('heroEyebrow',t.heroEyebrow);setHTML('heroTitle',t.heroTitle);setText('heroLede',t.heroLede);setText('accederBtn',t.access);setText('freeTag',t.freeTag);setText('desktopBtnLabel',t.desktop);setHTML('brandTitle',t.brandTitle);setHTML('brandLede',t.brandLede);setText('devicesEyebrow',t.devicesEyebrow);setText('devicesTitle',t.devicesTitle);setText('footerTagline',t.footerTagline);
    const shot=document.getElementById('devicesShot');if(shot)shot.alt=t.devicesAlt;
    const selector=document.getElementById('languageSelect');if(selector){selector.value=key;selector.setAttribute('aria-label',t.languageLabel);selector.title=t.languageLabel;}
    const access=document.getElementById('accederBtn');if(access){try{const u=new URL(access.href,location.href);if(u.hostname.includes('listiaapp.com')){u.searchParams.set('lang',key);access.href=u.toString()}}catch{}}
    window.LISTIA_LANGUAGE=key;
    window.dispatchEvent(new CustomEvent('listia:languagechange',{detail:{language:key,htmlLanguage:t.htmlLang,direction:t.dir}}));
    return true;
  }

  function explicitLanguage(){
    let raw=null;
    try{
      raw=new URLSearchParams(location.search).get('lang');
      if(!raw){const m=document.cookie.match(/(?:^|;\s*)listia_lang=([^;]+)/);if(m)raw=decodeURIComponent(m[1]);}
      if(!raw)raw=localStorage.getItem('listia_language');
    }catch{}
    if(!raw)return null;
    return normalize(raw)||normalizeBase(raw);
  }

  function patchApi(){
    const api=window.ListiaI18n;if(!api||api.__listiaCommercialGlobalPatched)return;
    const baseSet=api.set?.bind(api),baseApply=api.apply?.bind(api),baseGet=api.get?.bind(api);
    api.set=language=>{if(normalize(language))return apply(language,{persistChoice:true});currentCustom=null;return baseSet?.(language)};
    api.apply=language=>{if(normalize(language))return apply(language);currentCustom=null;return baseApply?.(language)};
    api.get=()=>currentCustom||baseGet?.()||'en';
    api.supported=[...new Set([...(api.supported||[]),...Object.keys(custom)])];api.__listiaCommercialGlobalPatched=true;
  }

  function init(){
    ensureOfficialFavicon();
    ensureOptions();ensureHreflang();patchApi();
    const selector=document.getElementById('languageSelect');
    if(selector&&!selector.dataset.globalLocalesBound){selector.dataset.globalLocalesBound='1';selector.addEventListener('change',e=>{const key=normalize(e.target.value);if(key){e.stopImmediatePropagation();apply(key,{persistChoice:true})}},true);}

    const explicit=explicitLanguage();
    if(explicit){
      if(normalize(explicit)) apply(explicit);
      else window.ListiaI18n?.apply?.(explicit);
    }else{
      // First-visit commercial default is always English, independent of browser locale.
      window.ListiaI18n?.apply?.('en');
      // The language control advertises Spanish as the default alternative.
      if(selector) selector.value='es';
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
