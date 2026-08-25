(() => {
  'use strict';

  const LABELS = {
    es:{search:'Buscar',operation:'Operación',type:'Tipo de propiedad',min:'Precio mínimo',max:'Precio máximo',results:'propiedades',sent:'Tu solicitud fue enviada, se pondrán en contacto contigo por esta propiedad.',signup:'Crea tu cuenta gratis para enviar tu solicitud por esta propiedad.'},
    en:{search:'Search',operation:'Operation',type:'Property type',min:'Minimum price',max:'Maximum price',results:'properties',sent:'Your request was sent. They will contact you about this property.',signup:'Create your free account to send your request for this property.'},
    fr:{search:'Recherche',operation:'Opération',type:'Type de bien',min:'Prix minimum',max:'Prix maximum',results:'biens',sent:'Votre demande a été envoyée. On vous contactera au sujet de ce bien.',signup:'Créez votre compte gratuit pour envoyer votre demande.'},
    it:{search:'Cerca',operation:'Operazione',type:'Tipo di proprietà',min:'Prezzo minimo',max:'Prezzo massimo',results:'proprietà',sent:'La tua richiesta è stata inviata. Ti contatteranno per questa proprietà.',signup:'Crea il tuo account gratuito per inviare la richiesta.'},
    'pt-BR':{search:'Buscar',operation:'Operação',type:'Tipo de imóvel',min:'Preço mínimo',max:'Preço máximo',results:'imóveis',sent:'Sua solicitação foi enviada. Entrarão em contato com você sobre este imóvel.',signup:'Crie sua conta gratuita para enviar sua solicitação.'},
    de:{search:'Suche',operation:'Vorgang',type:'Immobilientyp',min:'Mindestpreis',max:'Höchstpreis',results:'Immobilien',sent:'Deine Anfrage wurde gesendet. Du wirst zu dieser Immobilie kontaktiert.',signup:'Erstelle dein kostenloses Konto, um deine Anfrage zu senden.'},
    'ar-AE':{search:'بحث',operation:'العملية',type:'نوع العقار',min:'أقل سعر',max:'أعلى سعر',results:'عقارات',sent:'تم إرسال طلبك. سيتم التواصل معك بخصوص هذا العقار.',signup:'أنشئ حسابك المجاني لإرسال طلبك بخصوص هذا العقار.'}
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

  function showInterestToast(text,kind='success'){
    let toast=document.getElementById('marketplaceInterestToast');
    if(!toast){
      toast=document.createElement('div');
      toast.id='marketplaceInterestToast';
      toast.className='marketplace-interest-toast';
      toast.setAttribute('role','status');
      toast.setAttribute('aria-live','polite');
      document.body.append(toast);
    }
    toast.className=`marketplace-interest-toast ${kind}`;
    toast.textContent=text;
    toast.classList.add('show');
    clearTimeout(window.__listiaInterestToastTimer);
    window.__listiaInterestToastTimer=setTimeout(()=>toast.classList.remove('show'),5200);
  }

  function readSession(){
    try{return JSON.parse(localStorage.getItem('listia_session')||'null')}catch{return null}
  }

  async function resolveSignedInContact(){
    const session=readSession();
    if(!session?.access_token) return null;
    let user=session.user||null;
    const cfg=window.LISTIA_CONFIG||{};
    const apiKey=cfg.SUPABASE_PUBLISHABLE_KEY||cfg.SUPABASE_ANON_KEY||'';
    if((!user?.email||!user?.id)&&cfg.SUPABASE_URL&&apiKey){
      try{
        const r=await fetch(`${cfg.SUPABASE_URL}/auth/v1/user`,{headers:{apikey:apiKey,Authorization:`Bearer ${session.access_token}`},cache:'no-store'});
        if(r.ok) user=await r.json();
      }catch{}
    }
    if(!user) return null;
    const meta=user.user_metadata||{};
    const name=String(meta.full_name||meta.name||meta.display_name||user.email?.split('@')[0]||'').trim();
    const email=String(user.email||meta.email||'').trim();
    const whatsapp=String(meta.whatsapp||meta.phone||user.phone||'').trim();
    if(!email&&!whatsapp) return null;
    return {name,email,whatsapp};
  }

  function waitForInterestResult(form){
    return new Promise(resolve=>{
      const check=()=>{
        const success=form.querySelector('.marketplace-success');
        const error=form.querySelector('.marketplace-error');
        if(success?.textContent?.trim()) return resolve(true);
        if(error?.textContent?.trim()) return resolve(false);
      };
      const observer=new MutationObserver(()=>{const result=check();if(result!==undefined){observer.disconnect();resolve(result)}});
      observer.observe(form,{childList:true,subtree:true,characterData:true,attributes:true});
      setTimeout(()=>{observer.disconnect();resolve(false)},9000);
    });
  }

  async function autoSendMarketplaceInterest(){
    const form=document.querySelector('#screen-marketplace-detail .marketplace-interest-grid');
    if(!form||form.dataset.listiaAutoSent==='1') return;
    form.dataset.listiaAutoSent='1';
    const contact=await resolveSignedInContact();
    if(!contact){
      form.dataset.listiaAutoSent='0';
      showInterestToast(t().signup,'info');
      return;
    }
    const set=(name,value)=>{const input=form.elements?.namedItem?.(name);if(input&&value&&!input.value)input.value=value};
    set('name',contact.name); set('email',contact.email); set('whatsapp',contact.whatsapp);
    const resultPromise=waitForInterestResult(form);
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    if(await resultPromise) showInterestToast(t().sent,'success');
    else form.dataset.listiaAutoSent='0';
  }

  function installInterestFlow(){
    if(document.documentElement.dataset.listiaInterestFlow==='1') return;
    document.documentElement.dataset.listiaInterestFlow='1';
    document.addEventListener('click',event=>{
      const button=event.target.closest?.('.marketplace-card .marketplace-actions .primary');
      if(!button) return;
      setTimeout(autoSendMarketplaceInterest,90);
    },true);
  }

  function repair(){repairMarketplace();repairOffice();repairVoice()}
  let timer=0;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(repair,30)};
  const observer=new MutationObserver(schedule);
  function boot(){
    repair(); installInterestFlow(); observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('listia:languagechange',()=>setTimeout(repair,0));
    window.addEventListener('focus',schedule);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
