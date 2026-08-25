(() => {
  'use strict';
  const state={lastIntent:null,lastScreen:null,location:null,min:null,max:null,bedrooms:null,operation:null,propertyType:null};
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const money=(text)=>{const t=norm(text);const vals=[];for(const m of t.matchAll(/(\d+(?:[.,]\d+)?)\s*(millones?|millon|m\b|mil)?/g)){let n=Number(String(m[1]).replace(',','.'));const u=m[2]||'';if(/millon|millones|\bm\b/.test(u))n*=1e6;else if(/mil/.test(u))n*=1e3;if(n>=100000)vals.push(n)}return vals};
  const bedrooms=text=>{const t=norm(text);const m=t.match(/(\d+)\s*(recamaras?|habitaciones?|bedrooms?|beds?)/);return m?Number(m[1]):null};
  const city=text=>{const t=norm(text);const known=['tulum','playa del carmen','cancun','cancún','cdmx','ciudad de mexico','polanco','merida','mérida','monterrey','guadalajara','miami','houston','los angeles','toronto'];return known.find(x=>t.includes(norm(x)))||null};
  const setValue=(id,val)=>{const el=document.getElementById(id);if(!el||val===null||val===undefined)return false;el.value=String(val);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true};
  const click=(sel)=>{const el=document.querySelector(sel);if(!el)return false;el.click();return true};
  const screen=id=>window.LISTIA_APP_SHELL?.showScreen?.(id)||false;

  function parseSearch(raw){const t=norm(raw);const prices=money(raw);return{location:city(raw),min:prices.length>1?Math.min(...prices):(/desde|mas de|minimo/.test(t)?prices[0]||null:null),max:prices.length>1?Math.max(...prices):(/hasta|menos de|maximo/.test(t)?prices[0]||null:null),bedrooms:bedrooms(raw),operation:/renta|alquiler|rent/.test(t)?'rent':(/venta|comprar|buy|sale/.test(t)?'sale':null),propertyType:/casa|house/.test(t)?'house':(/departamento|depto|condo|apartment/.test(t)?'apartment':(/terreno|land/.test(t)?'land':null))}}
  function applySearch(criteria){Object.assign(state,criteria);screen('screen-marketplace');setTimeout(()=>{setValue('marketplaceSearch',criteria.location||state.location);setValue('marketplaceMinPrice',criteria.min||state.min);setValue('marketplaceMaxPrice',criteria.max||state.max);setValue('marketplaceBedrooms',criteria.bedrooms||state.bedrooms);const op=criteria.operation||state.operation;if(op){const select=document.getElementById('marketplaceOperation');if(select){const want=op==='rent'?'renta':'venta';const option=[...select.options].find(o=>norm(o.textContent).includes(want)||norm(o.value).includes(op));if(option){select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}))}}}const type=criteria.propertyType||state.propertyType;if(type){const input=document.getElementById('marketplaceType');if(input){input.value=type==='house'?'Casa':type==='apartment'?'Departamento':'Terreno';input.dispatchEvent(new Event('input',{bubbles:true}))}}},120)}

  function register(){if(!window.LISTIA_VOICE?.registerAction)return false;
    window.LISTIA_VOICE.registerAction('natural-work-assistant',async(text,raw)=>{
      const t=norm(raw);
      const asksSearch=/(busca|buscar|encuentra|quiero|necesito|muestrame|marketplace|comprar|rentar|alquilar)/.test(t)&&/(propiedad|casa|departamento|depto|terreno|inmueble|recamara|habitacion|tulum|cancun|playa|miami|polanco)/.test(t);
      const correction=/(no no|no,|me refiero|las mias no|no las mias)/.test(t)&&state.lastIntent;
      if(asksSearch||correction&&/marketplace|buscar|comprar|rentar/.test(t)){return true}
      if(/(que tengo pendiente|que debo hacer|prioridad|que necesita mi atencion|como va mi negocio|resumen de hoy)/.test(t))return true;
      if(/(publica|sube|crea|prepara).*(propiedad|listing|brochure|pdf|proyecto)/.test(t))return true;
      if(/(contacta|da seguimiento|seguimiento).*(lead|prospecto|contacto)/.test(t))return true;
      if(/(agenda|cita|reunion).*(mañana|hoy|semana|prospecto|cliente)/.test(t))return true;
      if(/(abre|ve a|muestra).*(office|control|listing|account|cuenta)/.test(t))return true;
      return false;
    },async({text,normalized})=>{
      const t=norm(normalized||text);
      if(/(busca|buscar|encuentra|quiero|necesito|marketplace|comprar|rentar|alquilar)/.test(t)||/(no las mias|las mias no)/.test(t)){
        const c=parseSearch(text);applySearch(c);state.lastIntent='marketplace_search';const parts=[];if(c.location)parts.push(`en ${c.location}`);if(c.bedrooms)parts.push(`de ${c.bedrooms} recámaras`);if(c.min||c.max)parts.push('dentro de tu presupuesto');return `Entendido. Estoy buscando ${parts.join(', ')||'en el marketplace'} y voy a ajustar los resultados por ti.`
      }
      if(/que tengo pendiente|que debo hacer|prioridad|necesita mi atencion|como va mi negocio|resumen de hoy/.test(t)){state.lastIntent='summary';window.LISTIA_APP_SHELL?.openTab?.('control');return 'Estoy revisando tu operación. Te llevo al Control Center para mostrarte primero lo que requiere atención.'}
      if(/publica|sube|crea|prepara/.test(t)&&/propiedad|listing|brochure|pdf|proyecto/.test(t)){state.lastIntent='publish';click('#officeAddPropertyBtn')||click('#propertiesAddBtn');return 'Sí. Entrégame el material y yo estructuro la propiedad, preparo el listing y continúo con el trabajo.'}
      if(/contacta|da seguimiento|seguimiento/.test(t)&&/lead|prospecto|contacto/.test(t)){state.lastIntent='leads';click('#listiaModuleActions [data-module="leads"]')||screen('screen-listia-leads');return 'Voy a tus leads. Dime si quieres que priorice los nuevos, los que no han respondido o los más cercanos a una cita.'}
      if(/agenda|cita|reunion/.test(t)){state.lastIntent='agenda';click('#listiaModuleActions [data-module="agenda"]')||screen('screen-listia-agenda');return 'Abro tu agenda. Puedes decirme con quién quieres reunirte o qué disponibilidad quieres revisar.'}
      if(/office/.test(t)){window.LISTIA_APP_SHELL?.openTab?.('office');return 'Te llevo a Office.'}
      if(/control/.test(t)){window.LISTIA_APP_SHELL?.openTab?.('control');return 'Abriendo Control Center.'}
      if(/listing/.test(t)){window.LISTIA_APP_SHELL?.openTab?.('listing');return 'Abriendo Listing.'}
      if(/account|cuenta/.test(t)){window.LISTIA_APP_SHELL?.openTab?.('account');return 'Abriendo tu cuenta.'}
      return 'Entendido. Dime el resultado que quieres y yo me encargo de los pasos.'
    });
    return true
  }

  let attempts=0;const timer=setInterval(()=>{attempts++;if(register()||attempts>30)clearInterval(timer)},250);
  window.LISTIA_ASSISTANT_INTELLIGENCE={state,parseSearch,applySearch};
})();