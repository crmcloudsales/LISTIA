(()=>{
  'use strict';
  const cfg=window.LISTIA_CONFIG||{};
  cfg.BILLING_ENABLED=false;
  cfg.BILLING_ENV='disabled';

  const neutralMessage={
    es:'Continúa configurando LISTIA. La configuración comercial se definirá más adelante.',
    en:'Continue configuring LISTIA. Commercial settings will be defined later.'
  };
  function spanish(){return String(window.LISTIA_I18N?.getLanguage?.()||document.documentElement.lang||'es').toLowerCase().startsWith('es')}
  function copy(){return spanish()?neutralMessage.es:neutralMessage.en}

  function neutralize(){
    const screen=document.getElementById('screen-plan');
    if(screen){
      const title=document.getElementById('planTitle');
      if(title){title.removeAttribute('data-i18n');title.textContent=spanish()?'Configuración de LISTIA':'LISTIA setup'}
      const sub=screen.querySelector('.sub');
      if(sub){sub.removeAttribute('data-i18n');sub.textContent=copy()}
      const eyebrow=screen.querySelector('.eyebrow');
      if(eyebrow){eyebrow.removeAttribute('data-i18n');eyebrow.textContent=spanish()?'CONFIGURACIÓN':'SETUP'}
      screen.querySelectorAll('.plan-card,.plan-price').forEach(node=>{node.hidden=true;node.setAttribute('aria-hidden','true')});
      const context=screen.querySelector('.context-line');if(context)context.hidden=true;
    }
    const intake=document.getElementById('intakePlanNote');if(intake){intake.textContent='';intake.hidden=true}
    document.querySelectorAll('[data-billing],[data-price],[data-plan-price]').forEach(node=>node.hidden=true);
  }

  function patchI18n(){
    const api=window.LISTIA_I18N;
    if(!api?.t||api.__listiaCommercialHold)return false;
    const original=api.t.bind(api);
    api.t=(key,vars={})=>{
      if(key==='msg.free_property_limit')return spanish()?'Esta función todavía no tiene límites comerciales definidos.':'Commercial limits for this feature are not defined yet.';
      if(key==='intake.free_note'||key==='plan.free_desc'||key==='plan.pro_desc'||key==='plan.premium_desc')return '';
      return original(key,vars);
    };
    api.__listiaCommercialHold=true;
    return true;
  }

  const style=document.createElement('style');
  style.dataset.listiaCommercialHold='1';
  style.textContent='#screen-plan .plan-card,#screen-plan .plan-price{display:none!important}.plan-note:empty{display:none!important}';
  document.head.append(style);

  let attempts=0;
  const boot=()=>{patchI18n();neutralize();if(attempts++<80&&!window.LISTIA_I18N)setTimeout(boot,100)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('listia:languagechange',()=>setTimeout(()=>{patchI18n();neutralize()},0));
})();
