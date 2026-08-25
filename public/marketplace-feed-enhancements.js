(() => {
  'use strict';
  const nativeFetch=window.fetch.bind(window);
  const MARKETPLACE_MARK='marketplace_listings?select=';
  window.LISTIA_MARKETPLACE_DATA=[];

  window.fetch=async function(input,init){
    let target=input;
    const raw=typeof input==='string'?input:(input?.url||'');
    if(raw.includes(MARKETPLACE_MARK)&&raw.includes('limit=200')){
      target=raw.replace('limit=200','limit=1000');
    }
    const response=await nativeFetch(target,init);
    const finalUrl=typeof target==='string'?target:(target?.url||raw);
    if(finalUrl.includes(MARKETPLACE_MARK)&&response.ok){
      response.clone().json().then(rows=>{
        if(Array.isArray(rows)) window.LISTIA_MARKETPLACE_DATA=rows;
      }).catch(()=>{});
    }
    return response;
  };

  const text=v=>String(v||'').trim();
  function selectedListing(){
    const title=text(document.querySelector('#screen-marketplace-detail .marketplace-detail-title')?.textContent);
    if(!title)return null;
    return (window.LISTIA_MARKETPLACE_DATA||[]).find(x=>text(x.title)===title)||null;
  }
  function contactCopy(){
    const lang=String(window.LISTIA_I18N?.getLanguage?.()||document.documentElement.lang||'es').toLowerCase();
    if(lang.startsWith('es'))return{title:'Inmobiliaria anunciante',verify:'Verifica disponibilidad directamente con el anunciante.',phone:'Llamar',email:'Correo',source:'Fuente autorizada'};
    if(lang.startsWith('pt'))return{title:'Imobiliária anunciante',verify:'Confirme a disponibilidade diretamente com o anunciante.',phone:'Ligar',email:'E-mail',source:'Fonte autorizada'};
    return{title:'Listing brokerage',verify:'Verify availability directly with the listing source.',phone:'Call',email:'Email',source:'Authorized source'};
  }
  function addSourceContact(){
    const screen=document.getElementById('screen-marketplace-detail');
    if(!screen?.classList.contains('active'))return;
    const root=document.getElementById('marketplaceDetailBody');
    if(!root||root.querySelector('.marketplace-source-contact'))return;
    const listing=selectedListing();
    const seller=listing?.features?.seller;
    if(!seller||(!seller.phone&&!seller.email&&!seller.company_name&&!seller.branch_name))return;
    const c=contactCopy();
    const card=document.createElement('section');card.className='marketplace-source-contact';
    const name=text(seller.company_name||seller.branch_name||c.title);
    const phone=text([seller.phone_country_code,seller.phone].filter(Boolean).join(' '));
    const email=text(seller.email);
    const title=document.createElement('strong');title.textContent=name;
    const note=document.createElement('span');note.textContent=c.verify;
    const actions=document.createElement('div');actions.className='marketplace-source-actions';
    if(phone){const a=document.createElement('a');a.href=`tel:${phone.replace(/[^+\d]/g,'')}`;a.textContent=`${c.phone}: ${phone}`;actions.append(a)}
    if(email){const a=document.createElement('a');a.href=`mailto:${email}`;a.textContent=`${c.email}: ${email}`;actions.append(a)}
    const badge=document.createElement('small');badge.textContent=c.source;
    card.append(title,note,actions,badge);
    const form=root.querySelector('.marketplace-interest');
    root.insertBefore(card,form||null);
  }
  function markAuthorizedCards(){
    const data=window.LISTIA_MARKETPLACE_DATA||[];
    if(!data.length)return;
    const cards=[...document.querySelectorAll('#marketplaceGrid .marketplace-card')];
    cards.forEach(card=>{
      if(card.querySelector('.marketplace-source-pill'))return;
      const title=text(card.querySelector('.marketplace-title')?.textContent);
      const row=data.find(x=>text(x.title)===title);
      if(row?.features?.source==='tokko_broker'){
        const pill=document.createElement('span');pill.className='marketplace-source-pill';pill.textContent='Fuente autorizada';
        card.querySelector('.marketplace-body')?.append(pill);
      }
    });
  }
  let timer=0;
  const repair=()=>{clearTimeout(timer);timer=setTimeout(()=>{addSourceContact();markAuthorizedCards()},40)};
  const mo=new MutationObserver(repair);
  function boot(){mo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});repair();window.addEventListener('listia:languagechange',repair)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();