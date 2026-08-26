(() => {
  'use strict';
  const ICONS={
    office:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h12a2 2 0 0 1 2 2V20H6a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z"/><path d="M8 3.5V20"/><path d="M11 8h6M11 12h6M11 16h4"/></svg>',
    listing:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V8l8-5 8 5v12"/><path d="M8 20v-6h8v6"/><path d="M9 10h6"/></svg>',
    control:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-8"/><path d="M22 19H2"/></svg>',
    ai:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-5.5 4v-4.5A2.5 2.5 0 0 1 4 13.5Z"/><path d="M8 8h8M8 11.5h5"/></svg>',
    account:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05-2.83 2.83-.05-.05A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.05.05-2.83-2.83.05-.05A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.05-.05 2.83-2.83.05.05A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4a1.7 1.7 0 0 0 1.88-.34l.05-.05 2.83 2.83-.05.05A1.7 1.7 0 0 0 19.4 9c.37.29.78.5 1.2.6h.4v4h-.1a1.7 1.7 0 0 0-1.5 1.4Z"/></svg>'
  };
  const LABELS={
    es:{office:'OFICINA',listing:'LISTADOS',control:'CONTROL',ai:'IA CHAT',account:'CUENTA'},
    en:{office:'OFFICE',listing:'LISTINGS',control:'CONTROL',ai:'AI CHAT',account:'ACCOUNT'},
    fr:{office:'BUREAU',listing:'ANNONCES',control:'CONTRÔLE',ai:'CHAT IA',account:'COMPTE'},
    it:{office:'UFFICIO',listing:'ANNUNCI',control:'CONTROLLO',ai:'CHAT IA',account:'ACCOUNT'},
    'pt-BR':{office:'ESCRITÓRIO',listing:'ANÚNCIOS',control:'CONTROLE',ai:'CHAT IA',account:'CONTA'},
    de:{office:'BÜRO',listing:'OBJEKTE',control:'KONTROLLE',ai:'KI CHAT',account:'KONTO'},
    'ar-AE':{office:'المكتب',listing:'العقارات',control:'التحكم',ai:'محادثة AI',account:'الحساب'}
  };
  const language=()=>window.LISTIA_I18N?.getLanguage?.()||'en';
  function localCopy(){return LABELS[language()]||LABELS.en}
  function polishNav(){
    const nav=document.getElementById('listiaBottomNav'); if(!nav)return;
    const labels=localCopy();
    nav.querySelectorAll('.listia-nav-btn').forEach(btn=>{
      const key=btn.dataset.listiaTab;
      if(!key||!ICONS[key])return;
      const span=btn.querySelector('span');
      btn.querySelector('svg')?.remove();
      btn.insertAdjacentHTML('afterbegin',ICONS[key]);
      if(span) span.textContent=labels[key]||key;
      btn.setAttribute('aria-label',labels[key]||key);
    });
  }
  function polishOffice(){
    const dash=document.getElementById('listiaOfficeDashboardV2'); if(!dash)return;
    const lang=language();
    const greeting=dash.querySelector('#v2Greeting');
    const business=dash.querySelector('#v2Business');
    if(greeting){greeting.textContent=lang==='es'?'Tu operación':lang==='en'?'Your operation':greeting.textContent}
    if(business&&!business.textContent.trim()) business.textContent=lang==='es'?'Tu espacio de trabajo':'Your workspace';
  }
  function run(){polishNav();polishOffice()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,0),{once:true});else setTimeout(run,0);
  new MutationObserver(run).observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('listia:languagechange',run);
})();
