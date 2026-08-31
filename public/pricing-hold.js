(()=>{
'use strict';
function neutralize(){
 const screen=document.getElementById('screen-plan');
 if(!screen)return false;
 const title=document.getElementById('planTitle');if(title){title.removeAttribute('data-i18n');title.textContent='Configuración de LISTIA'}
 const sub=screen.querySelector('.sub');if(sub){sub.removeAttribute('data-i18n');sub.textContent='La estructura comercial y los planes se definirán más adelante. Puedes continuar configurando tu cuenta sin seleccionar un precio.'}
 const eyebrow=screen.querySelector('.eyebrow');if(eyebrow){eyebrow.removeAttribute('data-i18n');eyebrow.textContent='CONFIGURACIÓN'}
 screen.querySelectorAll('.plan-card').forEach(n=>n.hidden=true);
 screen.querySelectorAll('.plan-price').forEach(n=>n.remove());
 const input=document.getElementById('selectedPlan');if(input)input.value='free';
 const form=document.getElementById('planForm');
 if(form&&!form.querySelector('.listia-pricing-hold-note')){
  const note=document.createElement('div');note.className='permission-note listia-pricing-hold-note';note.innerHTML='<strong>Precios pendientes de análisis.</strong><span>LISTIA no muestra ni aplica precios, markups o cargos de suscripción en esta etapa.</span>';
  const submit=form.querySelector('button[type="submit"]');form.insertBefore(note,submit||null);
 }
 return true;
}
let tries=0;const boot=()=>{if(!neutralize()&&tries++<60)setTimeout(boot,200)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
new MutationObserver(()=>neutralize()).observe(document.documentElement,{subtree:true,childList:true});
})();
