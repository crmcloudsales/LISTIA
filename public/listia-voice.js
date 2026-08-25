(() => {
  'use strict';

  const synth = window.speechSynthesis;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const LANGS = { es:'es-MX', en:'en-US', fr:'fr-FR', it:'it-IT', 'pt-BR':'pt-BR', de:'de-DE', 'ar-AE':'ar-AE', ru:'ru-RU', he:'he-IL', 'zh-CN':'zh-CN', ja:'ja-JP' };
  const COPY = {
    es:{ready:'Lista. ¿Qué necesitas?',listening:'Te escucho…',thinking:'Entendido. Estoy trabajando.',unsupported:'Dime el resultado que quieres. Puedo trabajar con propiedades, contactos, leads, citas, marketplace y tu operación.',start:'Hablar con LISTIA',stop:'Pausar LISTIA',properties:'Abriendo tus propiedades.',add:'Perfecto. Entrégame el material y yo hago el resto.',leads:'Abriendo tus leads.',agenda:'Abriendo tu agenda.',summary:'Aquí tienes el estado actual de tu operación.'},
    en:{ready:'Ready. What do you need?',listening:'I’m listening…',thinking:'Got it. I’m working on it.',unsupported:'Tell me the result you want. I can work with properties, contacts, leads, appointments, marketplace and your operation.',start:'Talk to LISTIA',stop:'Pause LISTIA',properties:'Opening your properties.',add:'Perfect. Give me the material and I’ll handle the rest.',leads:'Opening your leads.',agenda:'Opening your schedule.',summary:'Here is the current state of your operation.'},
    fr:{ready:'Prête. De quoi avez-vous besoin ?',listening:'Je vous écoute…',thinking:'Compris. Je m’en occupe.',unsupported:'Dites-moi le résultat souhaité. Je peux travailler sur les biens, contacts, leads, rendez-vous et le marketplace.',start:'Parler à LISTIA',stop:'Mettre LISTIA en pause',properties:'J’ouvre vos biens.',add:'Parfait. Donnez-moi le matériel et je m’occupe du reste.',leads:'J’ouvre vos leads.',agenda:'J’ouvre votre agenda.',summary:'Voici l’état actuel de votre activité.'},
    it:{ready:'Pronta. Di cosa hai bisogno?',listening:'Ti ascolto…',thinking:'Ricevuto. Me ne occupo.',unsupported:'Dimmi il risultato che vuoi. Posso lavorare con proprietà, contatti, lead, appuntamenti e marketplace.',start:'Parla con LISTIA',stop:'Metti in pausa LISTIA',properties:'Apro le tue proprietà.',add:'Perfetto. Dammi il materiale e penso io al resto.',leads:'Apro i tuoi lead.',agenda:'Apro la tua agenda.',summary:'Ecco lo stato attuale della tua attività.'},
    'pt-BR':{ready:'Pronta. O que você precisa?',listening:'Estou ouvindo…',thinking:'Entendi. Estou cuidando disso.',unsupported:'Diga o resultado que você quer. Posso trabalhar com imóveis, contatos, leads, agenda e marketplace.',start:'Falar com a LISTIA',stop:'Pausar LISTIA',properties:'Abrindo seus imóveis.',add:'Perfeito. Entregue o material e eu cuido do resto.',leads:'Abrindo seus leads.',agenda:'Abrindo sua agenda.',summary:'Aqui está o estado atual da sua operação.'},
    de:{ready:'Bereit. Was brauchst du?',listening:'Ich höre zu…',thinking:'Verstanden. Ich kümmere mich darum.',unsupported:'Sag mir das gewünschte Ergebnis. Ich kann mit Immobilien, Kontakten, Leads, Terminen und Marketplace arbeiten.',start:'Mit LISTIA sprechen',stop:'LISTIA pausieren',properties:'Ich öffne deine Immobilien.',add:'Perfekt. Gib mir das Material und ich erledige den Rest.',leads:'Ich öffne deine Leads.',agenda:'Ich öffne deine Agenda.',summary:'Hier ist der aktuelle Stand deiner Arbeit.'},
    'ar-AE':{ready:'أنا جاهزة. ماذا تحتاج؟',listening:'أنا أستمع…',thinking:'تم. أنا أعمل على ذلك.',unsupported:'أخبرني بالنتيجة التي تريدها. يمكنني العمل على العقارات وجهات الاتصال والعملاء والمواعيد والسوق.',start:'تحدث مع LISTIA',stop:'إيقاف LISTIA مؤقتاً',properties:'سأفتح عقاراتك.',add:'ممتاز. أعطني المواد وسأتولى الباقي.',leads:'سأفتح العملاء المحتملين.',agenda:'سأفتح جدولك.',summary:'هذه هي حالة عملك الحالية.'}
  };

  const normalize = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[_-]/g,' ').toLowerCase().trim();
  const current = () => window.LISTIA_I18N?.getLanguage?.() || document.documentElement.dataset.listiaLanguage || document.documentElement.lang || 'en';
  const langKey = () => COPY[current()] ? current() : (String(current()).toLowerCase().startsWith('es') ? 'es' : 'en');
  const c = () => COPY[langKey()] || COPY.en;
  const languageTag = language => LANGS[language || current()] || LANGS[langKey()] || 'en-US';

  function candidates(tag){
    if(!synth) return [];
    const exact=normalize(tag), family=exact.split(' ')[0];
    return synth.getVoices().filter(v=>{const x=normalize(v.lang);return x===exact||x.split(' ')[0]===family;})
      .sort((a,b)=>Number(normalize(b.lang)===exact)-Number(normalize(a.lang)===exact)||Number(b.localService)-Number(a.localService));
  }
  function selected(tag){
    const list=candidates(tag);let saved=null;
    try{saved=JSON.parse(localStorage.getItem(`listia_voice_${tag}`)||'null')}catch{}
    return list.find(v=>saved&&v.name===saved.name&&v.lang===saved.lang)||list[0]||null;
  }

  let recognition=null;
  let conversationActive=false;
  let speaking=false;
  let orb=null;
  let statusNode=null;
  let decisionNode=null;
  let restartTimer=0;
  let statusTimer=0;
  const customActions=[];

  function setOrbState(state='idle'){
    if(!orb)return;
    orb.dataset.state=state;
    orb.classList.toggle('active',conversationActive);
    orb.setAttribute('aria-label',conversationActive?c().stop:c().start);
    orb.title=conversationActive?c().stop:c().start;
  }
  function setStatus(text,{persist=false}={}){
    if(!statusNode)return;
    clearTimeout(statusTimer);
    statusNode.textContent=String(text||'');
    statusNode.hidden=!text;
    if(text&&!persist)statusTimer=setTimeout(()=>{if(statusNode){statusNode.hidden=true;statusNode.textContent='';}},2600);
  }
  function stopSpeaking(){synth?.cancel();speaking=false;}
  function speak(text,language=current(),{resume=true}={}){
    const clean=String(text||'').trim();
    if(!clean){if(resume)scheduleListen();return false;}
    setStatus(clean,{persist:true});
    setOrbState('speaking');
    if(!synth){if(resume)scheduleListen();return false;}
    stopSpeaking();
    const tag=languageTag(language),voice=selected(tag),u=new SpeechSynthesisUtterance(clean);
    u.lang=tag;if(voice)u.voice=voice;u.rate=.98;u.pitch=1;u.volume=1;
    speaking=true;
    const done=()=>{speaking=false;setStatus('');setOrbState(conversationActive?'listening':'idle');if(resume)scheduleListen();};
    u.onend=done;u.onerror=done;synth.speak(u);return true;
  }

  function click(selector){const el=document.querySelector(selector);if(!el)return false;el.click();return true;}
  function showScreen(id){
    if(window.LISTIA_APP_SHELL?.showScreen)return Boolean(window.LISTIA_APP_SHELL.showScreen(id));
    const target=document.getElementById(id);if(!target)return false;
    document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s===target));return true;
  }
  function operationSummary(){
    const ap=document.getElementById('officeAppointmentCount')?.textContent?.trim()||'0';
    const op=document.getElementById('officeOpportunityCount')?.textContent?.trim()||'0';
    const leads=document.getElementById('officeLeadCount')?.textContent?.trim()||'0';
    const props=document.getElementById('officePropertyCount')?.textContent?.trim()||'0';
    if(langKey()==='es')return `${c().summary} Tienes ${ap} citas hoy, ${op} nuevas oportunidades, ${leads} leads gestionados y ${props} propiedades activas.`;
    return `${c().summary} ${ap} appointments today, ${op} new opportunities, ${leads} managed leads and ${props} active properties.`;
  }

  const intentGroups={
    add:[/entregar material/,/subir material/,/agregar propiedad/,/nueva propiedad/,/publicar propiedad/,/add property/,/upload material/,/new property/],
    properties:[/mis propiedades/,/mi inventario/,/my properties/,/inventory/],
    leads:[/leads?/,/prospectos?/,/clientes potenciales/,/prospects?/],
    agenda:[/agenda/,/citas?/,/reuniones?/,/schedule/,/appointments?/,/meetings?/],
    summary:[/resumen/,/como va/,/estado.*operacion/,/que tengo hoy/,/summary/,/status/,/today/]
  };
  const matches=(group,text)=>(intentGroups[group]||[]).some(rx=>rx.test(text));

  async function executeCommand(raw){
    const text=normalize(raw);if(!text)return;
    setOrbState('thinking');setStatus(c().thinking,{persist:true});
    for(const action of customActions){
      try{
        if(await action.matcher(text,raw)){
          const result=await action.handler({text:raw,normalized:text});
          const response=typeof result==='string'?result:result?.response;
          speak(response||c().ready);return;
        }
      }catch(err){console.warn('LISTIA voice action',err);}
    }
    if(matches('add',text)){const ok=click('#officeAddPropertyBtn')||click('#propertiesAddBtn')||showScreen('screen-property-intake');speak(ok?c().add:c().unsupported);return;}
    if(matches('leads',text)){const ok=click('#listiaModuleActions [data-module="leads"]')||showScreen('screen-listia-leads');speak(ok?c().leads:c().unsupported);return;}
    if(matches('agenda',text)){const ok=click('#listiaModuleActions [data-module="agenda"]')||showScreen('screen-listia-agenda');speak(ok?c().agenda:c().unsupported);return;}
    if(matches('properties',text)){const ok=click('#officePropertiesBtn')||showScreen('screen-properties');speak(ok?c().properties:c().unsupported);return;}
    if(matches('summary',text)){if(!document.getElementById('screen-ready')?.classList.contains('active'))showScreen('screen-ready');speak(operationSummary());return;}
    speak(c().unsupported);
  }

  function stopRecognition(){clearTimeout(restartTimer);try{recognition?.stop();}catch{}}
  function scheduleListen(){clearTimeout(restartTimer);if(!conversationActive||speaking)return;restartTimer=setTimeout(startListening,320);}
  function startListening(){
    if(!conversationActive||speaking||!Recognition)return;
    if(!recognition){
      recognition=new Recognition();recognition.continuous=false;recognition.interimResults=true;recognition.maxAlternatives=1;
      recognition.onstart=()=>{setOrbState('listening');setStatus(c().listening,{persist:true});};
      recognition.onresult=e=>{
        let interim='',final='';
        for(let i=e.resultIndex;i<e.results.length;i++){const chunk=e.results[i][0]?.transcript||'';if(e.results[i].isFinal)final+=chunk;else interim+=chunk;}
        if(interim)setStatus(interim,{persist:true});
        if(final.trim()){const said=final.trim();stopRecognition();executeCommand(said);}
      };
      recognition.onerror=e=>{
        if(e.error==='not-allowed'||e.error==='service-not-allowed'){
          conversationActive=false;setOrbState('idle');setStatus(langKey()==='es'?'Necesito permiso de micrófono para escucharte.':'I need microphone permission to hear you.');return;
        }
        if(e.error!=='no-speech')console.warn('LISTIA recognition',e.error);
      };
      recognition.onend=()=>{if(conversationActive&&!speaking)scheduleListen();};
    }
    recognition.lang=languageTag();
    try{recognition.start();}catch{scheduleListen();}
  }

  function openConversation(startMic=true){
    conversationActive=true;setOrbState(startMic?'listening':'active');setStatus(c().ready);
    if(startMic)startListening();
  }
  function closeConversation(){conversationActive=false;stopRecognition();stopSpeaking();setStatus('');setOrbState('idle');}
  function toggle(){conversationActive?closeConversation():openConversation(true);}

  function decision({title='',message='',choices=[]}={}){
    if(!decisionNode)return Promise.resolve(null);
    decisionNode.replaceChildren();
    const copy=document.createElement('div');copy.className='listia-decision-copy';
    if(title){const strong=document.createElement('strong');strong.textContent=title;copy.append(strong);}
    if(message){const span=document.createElement('span');span.textContent=message;copy.append(span);}
    const actions=document.createElement('div');actions.className='listia-decision-actions';copy.append(actions);decisionNode.append(copy);decisionNode.hidden=false;
    return new Promise(resolve=>{
      let settled=false;
      const finish=value=>{if(settled)return;settled=true;decisionNode.hidden=true;decisionNode.replaceChildren();resolve(value);if(conversationActive)scheduleListen();};
      choices.slice(0,3).forEach(choice=>{const b=document.createElement('button');b.type='button';b.textContent=String(choice.label||choice.value||choice);b.addEventListener('click',()=>finish(choice.value??choice.label??choice));actions.append(b);});
      setTimeout(()=>finish(null),12000);
    });
  }

  function inject(){
    if(document.getElementById('listiaVoiceButton'))return;
    statusNode=document.createElement('div');statusNode.id='listiaVoiceStatus';statusNode.className='listia-ambient-status';statusNode.hidden=true;statusNode.setAttribute('aria-live','polite');document.body.append(statusNode);
    decisionNode=document.createElement('section');decisionNode.id='listiaVoiceDecision';decisionNode.className='listia-decision-sheet';decisionNode.hidden=true;decisionNode.setAttribute('aria-live','polite');document.body.append(decisionNode);
    orb=document.createElement('button');orb.id='listiaVoiceButton';orb.type='button';orb.className='listia-orb';orb.dataset.state='idle';orb.innerHTML='<span class="listia-orb-core" aria-hidden="true"><span class="listia-orb-star">✦</span></span>';
    orb.addEventListener('click',toggle);document.body.append(orb);setOrbState('idle');
  }
  function syncLanguage(){if(recognition)recognition.lang=languageTag();setOrbState(conversationActive?'listening':'idle');}

  window.LISTIA_VOICE={
    speak,stop:closeConversation,open:()=>openConversation(true),close:closeConversation,execute:executeCommand,decide:decision,
    isActive:()=>conversationActive,getLanguageTag:l=>languageTag(l),getVoice:l=>selected(languageTag(l)),supported:Object.keys(LANGS),
    registerAction(name,matcher,handler){if(typeof matcher!=='function'||typeof handler!=='function')throw new TypeError('matcher_and_handler_required');customActions.push({name:String(name||'action'),matcher,handler});}
  };

  window.addEventListener('listia:languagechange',syncLanguage);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject,{once:true});else inject();
})();