(() => {
  'use strict';

  const LABELS = {
    es:{search:'Buscar',operation:'Operación',type:'Tipo de propiedad',min:'Precio mínimo',max:'Precio máximo',results:'propiedades'},
    en:{search:'Search',operation:'Operation',type:'Property type',min:'Minimum price',max:'Maximum price',results:'properties'},
    fr:{search:'Recherche',operation:'Opération',type:'Type de bien',min:'Prix minimum',max:'Prix maximum',results:'biens'},
    it:{search:'Cerca',operation:'Operazione',type:'Tipo di proprietà',min:'Prezzo minimo',max:'Prezzo massimo',results:'proprietà'},
    'pt-BR':{search:'Buscar',operation:'Operação',type:'Tipo de imóvel',min:'Preço mínimo',max:'Preço máximo',results:'imóveis'},
    de:{search:'Suche',operation:'Vorgang',type:'Immobilientyp',min:'Mindestpreis',max:'Höchstpreis',results:'Immobilien'},
    'ar-AE':{search:'بحث',operation:'العملية',type:'نوع العقار',min:'أقل سعر',max:'أعلى سعر',results:'عقارات'}
  };

  function locale(){
    const raw=window.LISTIA_I18N?.getLanguage?.()||localStorage.getItem('listia_language')||document.documentElement.lang||'en';
    if(LABELS[raw]) return raw;
    const s=String(raw).toLowerCase();
    if(s.startsWith('es'))return'es'; if(s.startsWith('fr'))return'fr'; if(s.startsWith('it'))return'it';
    if(s.startsWith('pt'))return'pt-BR'; if(s.startsWith('de'))return'de'; if(s.startsWith('ar'))return'ar-AE'; return'en';
  }
  const t=()=>LABELS[locale()]||LABELS.en;

  function wrapMarketplaceField(id,key){
    const control=document.getElementById(id); if(!control) return;
    if(control.parentElement?.classList.contains('marketplace-filter-field')){
      const span=control.parentElement.querySelector(':scope > span'); if(span) span.textContent=t()[key];
      control.setAttribute('aria-label',t()[key]); return;
    }
    const wrap=document.createElement('label'); wrap.className='marketplace-filter-field';
    const span=document.createElement('span'); span.textContent=t()[key];
    control.parentNode?.insertBefore(wrap,control); wrap.append(span,control); control.setAttribute('aria-label',t()[key]);
  }

  function repairMarketplace(){
    wrapMarketplaceField('marketplaceSearch','search');
    wrapMarketplaceField('marketplaceOperation','operation');
    wrapMarketplaceField('marketplaceType','type');
    wrapMarketplaceField('marketplaceMin','min');
    wrapMarketplaceField('marketplaceMax','max');
    const count=document.getElementById('marketplaceCount');
    const host=count?.parentElement;
    if(count&&host){
      let suffix=host.querySelector('.marketplace-count-label');
      if(!suffix){suffix=document.createElement('span');suffix.className='marketplace-count-label';host.append(suffix)}
      suffix.textContent=t().results;
      host.setAttribute('aria-live','polite');
    }
    document.querySelectorAll('.marketplace-detail-media img').forEach(img=>{
      if((img.getAttribute('src')||'').includes('listia-mark-transparent')) img.classList.add('marketplace-detail-placeholder');
    });
  }

  function repairOffice(){
    const summary=document.getElementById('officePipelineSummary');
    if(summary){
      summary.setAttribute('aria-label','Property workflow status');
      [...summary.children].forEach(box=>box.setAttribute('role','group'));
    }
    document.querySelectorAll('.office-actions .secondary,.listia-module-button').forEach(btn=>{
      const strong=btn.querySelector('strong')||btn.querySelector('span');
      const small=btn.querySelector('small');
      if(strong&&small){strong.style.removeProperty('display');small.style.removeProperty('display')}
    });
  }

  function repairVoice(){
    const panel=document.querySelector('.listia-voice-panel');
    if(panel){panel.setAttribute('aria-modal','false');panel.setAttribute('tabindex','-1')}
    const btn=document.getElementById('listiaVoiceButton');
    if(btn){btn.setAttribute('aria-haspopup','dialog');btn.setAttribute('aria-expanded',panel?.classList.contains('open')?'true':'false')}
  }

  function repair(){repairMarketplace();repairOffice();repairVoice()}
  let timer=0;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(repair,30)};
  const observer=new MutationObserver(schedule);
  function boot(){
    repair(); observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('listia:languagechange',()=>setTimeout(repair,0));
    window.addEventListener('focus',schedule);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
