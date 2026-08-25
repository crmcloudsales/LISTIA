(() => {
  'use strict';

  const synth = window.speechSynthesis;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const LANGS = { es:'es-MX', en:'en-US', fr:'fr-FR', it:'it-IT', 'pt-BR':'pt-BR', de:'de-DE', 'ar-AE':'ar-AE', ru:'ru-RU', he:'he-IL', 'zh-CN':'zh-CN', ja:'ja-JP' };
  const COPY = {
    es:{title:'Habla con LISTIA',hint:'Pídeme algo de tu trabajo.',listening:'Te escucho…',thinking:'Entendido. Déjame hacerlo.',ready:'Estoy lista. ¿Qué necesitas?',unsupported:'Puedo ayudarte con propiedades, leads, agenda, citas y material. Dime qué quieres hacer.',mic:'Hablar con LISTIA',close:'Cerrar conversación',properties:'Abriendo tus propiedades.',add:'Vamos a entregar material de una propiedad.',leads:'Abriendo tus leads.',agenda:'Abriendo tu agenda.',summary:'Aquí tienes el estado actual de tu operación.'},
    en:{title:'Talk to LISTIA',hint:'Ask me to do something for your work.',listening:'I’m listening…',thinking:'Got it. Let me do that.',ready:'I’m ready. What do you need?',unsupported:'I can help with properties, leads, schedule, appointments and property material. Tell me what you want to do.',mic:'Talk to LISTIA',close:'Close conversation',properties:'Opening your properties.',add:'Let’s add material for a property.',leads:'Opening your leads.',agenda:'Opening your schedule.',summary:'Here is the current state of your operation.'},
    fr:{title:'Parler à LISTIA',hint:'Demandez-moi quelque chose pour votre travail.',listening:'Je vous écoute…',thinking:'Compris. Je m’en occupe.',ready:'Je suis prête. De quoi avez-vous besoin ?',unsupported:'Je peux vous aider avec les biens, leads, agenda, rendez-vous et documents.',mic:'Parler à LISTIA',close:'Fermer',properties:'J’ouvre vos biens.',add:'Ajoutons les documents du bien.',leads:'J’ouvre vos leads.',agenda:'J’ouvre votre agenda.',summary:'Voici l’état actuel de votre activité.'},
    it:{title:'Parla con LISTIA',hint:'Chiedimi qualcosa per il tuo lavoro.',listening:'Ti ascolto…',thinking:'Ricevuto. Me ne occupo.',ready:'Sono pronta. Di cosa hai bisogno?',unsupported:'Posso aiutarti con proprietà, lead, agenda, appuntamenti e materiali.',mic:'Parla con LISTIA',close:'Chiudi',properties:'Apro le tue proprietà.',add:'Aggiungiamo il materiale della proprietà.',leads:'Apro i tuoi lead.',agenda:'Apro la tua agenda.',summary:'Ecco lo stato attuale della tua attività.'},
    'pt-BR':{title:'Fale com a LISTIA',hint:'Peça algo relacionado ao seu trabalho.',listening:'Estou ouvindo…',thinking:'Entendi. Vou fazer isso.',ready:'Estou pronta. O que você precisa?',unsupported:'Posso ajudar com imóveis, leads, agenda, compromissos e materiais.',mic:'Falar com a LISTIA',close:'Fechar',properties:'Abrindo seus imóveis.',add:'Vamos adicionar material de um imóvel.',leads:'Abrindo seus leads.',agenda:'Abrindo sua agenda.',summary:'Aqui está o estado atual da sua operação.'},
    de:{title:'Mit LISTIA sprechen',hint:'Sag mir, was ich für deine Arbeit tun soll.',listening:'Ich höre zu…',thinking:'Verstanden. Ich kümmere mich darum.',ready:'Ich bin bereit. Was brauchst du?',unsupported:'Ich kann bei Immobilien, Leads, Agenda, Terminen und Unterlagen helfen.',mic:'Mit LISTIA sprechen',close:'Schließen',properties:'Ich öffne deine Immobilien.',add:'Wir fügen Unterlagen zu einer Immobilie hinzu.',leads:'Ich öffne deine Leads.',agenda:'Ich öffne deine Agenda.',summary:'Hier ist der aktuelle Stand deiner Arbeit.'},
    'ar-AE':{title:'تحدث مع LISTIA',hint:'اطلب مني أي شيء يتعلق بعملك.',listening:'أنا أستمع…',thinking:'تم. سأقوم بذلك.',ready:'أنا جاهزة. ماذا تحتاج؟',unsupported:'يمكنني مساعدتك في العقارات والعملاء المحتملين والجدول والمواعيد والمواد.',mic:'تحدث مع LISTIA',close:'إغلاق',properties:'سأفتح عقاراتك.',add:'لنضف مواد العقار.',leads:'سأفتح العملاء المحتملين.',agenda:'سأفتح جدولك.',summary:'هذه هي حالة عملك الحالية.'}
  };

  const normalize = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[_-]/g,' ').toLowerCase().trim();
  const current = () => window.LISTIA_I18N?.getLanguage?.() || document.documentElement.dataset.listiaLanguage || document.documentElement.lang || 'en';
  const langKey = () => COPY[current()] ? current() : (String(current()).toLowerCase().startsWith('es') ? 'es' : 'en');
  const c = () => COPY[langKey()] || COPY.en;
  const languageTag = language => LANGS[language || current()] || LANGS[langKey()] || 'en-US';

  function candidates(tag){
    if(!synth) return [];
    const exact=normalize(tag), family=exact.split(' ')[0];
    return synth.getVoices().filter(v=>{const x=normalize(v.lang); return x===exact || x.split(' ')[0]===family;})
      .sort((a,b)=>Number(normalize(b.lang)===exact)-Number(normalize(a.lang)===exact)||Number(b.localService)-Number(a.localService));
  }
  function selected(tag){
    const list=candidates(tag); let saved=null;
    try{saved=JSON.parse(localStorage.getItem(`listia_voice_${tag}`)||'null')}catch{}
    return list.find(v=>saved&&v.name===saved.name&&v.lang===saved.lang)||list[0]||null;
  }

  let recognition = null;
  let conversationActive = false;
  let speaking = false;
  let panel = null;
  let transcript = null;
  let statusNode = null;
  let micButton = null;
  let restartTimer = 0;
  const customActions = [];

  function addTurn(role,text){
    if(!transcript || !text) return;
    const row=document.createElement('div'); row.className=`listia-voice-turn ${role}`;
    row.textContent=String(text); transcript.append(row); transcript.scrollTop=transcript.scrollHeight;
  }

  function setStatus(text,active=false){
    if(statusNode) statusNode.textContent=text || '';
    micButton?.classList.toggle('listening',active);
  }

  function stopSpeaking(){ synth?.cancel(); speaking=false; }
  function speak(text, language=current(), {resume=true}={}){
    const clean=String(text||'').trim(); if(!clean){ if(resume) scheduleListen(); return false; }
    addTurn('assistant',clean);
    if(!synth){ if(resume) scheduleListen(); return false; }
    stopSpeaking();
    const tag=languageTag(language), voice=selected(tag), u=new SpeechSynthesisUtterance(clean);
    u.lang=tag; if(voice) u.voice=voice; u.rate=.98; u.pitch=1; u.volume=1;
    speaking=true;
    u.onend=()=>{speaking=false; if(resume) scheduleListen();};
    u.onerror=()=>{speaking=false; if(resume) scheduleListen();};
    synth.speak(u); return true;
  }

  function click(selector){ const el=document.querySelector(selector); if(!el) return false; el.click(); return true; }
  function showScreen(id){
    const target=document.getElementById(id); if(!target) return false;
    document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s===target));
    window.scrollTo({top:0,behavior:'instant'}); return true;
  }

  function operationSummary(){
    const ap=document.getElementById('officeAppointmentCount')?.textContent?.trim()||'0';
    const op=document.getElementById('officeOpportunityCount')?.textContent?.trim()||'0';
    const leads=document.getElementById('officeLeadCount')?.textContent?.trim()||'0';
    const props=document.getElementById('officePropertyCount')?.textContent?.trim()||'0';
    if(langKey()==='es') return `${c().summary} Tienes ${ap} citas hoy, ${op} nuevas oportunidades, ${leads} leads gestionados y ${props} propiedades activas.`;
    return `${c().summary} ${ap} appointments today, ${op} new opportunities, ${leads} managed leads and ${props} active properties.`;
  }

  const intentGroups = {
    add:[/entregar material/,/subir material/,/agregar propiedad/,/nueva propiedad/,/add property/,/upload material/,/new property/,/ajouter.*bien/,/nuova proprieta/,/adicionar.*imovel/,/neue immobilie/,/عقار/],
    properties:[/propiedades/,/inventario/,/properties/,/inventory/,/biens/,/proprieta/,/imoveis/,/immobilien/,/العقارات/],
    leads:[/leads?/,/prospectos?/,/clientes potenciales/,/prospects?/,/interessenten/,/العملاء المحتملين/],
    agenda:[/agenda/,/citas?/,/reuniones?/,/schedule/,/appointments?/,/meetings?/,/rendez vous/,/appuntamenti/,/compromissos/,/termine/,/المواعيد/,/الجدول/],
    summary:[/resumen/,/como va/,/estado.*operacion/,/que tengo hoy/,/summary/,/status/,/today/,/etat/,/riepilogo/,/resumo/,/uberblick/,/ملخص/]
  };
  function matches(group,text){return (intentGroups[group]||[]).some(rx=>rx.test(text));}

  async function executeCommand(raw){
    const text=normalize(raw); if(!text) return;
    setStatus(c().thinking,false);

    for(const action of customActions){
      try{
        if(await action.matcher(text,raw)){
          const result=await action.handler({text:raw,normalized:text});
          const response=typeof result==='string'?result:result?.response;
          speak(response||c().ready); return;
        }
      }catch(err){ console.warn('LISTIA voice action',err); }
    }

    if(matches('add',text)){
      const ok=click('#officeAddPropertyBtn')||click('#propertiesAddBtn')||showScreen('screen-property-intake');
      speak(ok?c().add:c().unsupported); return;
    }
    if(matches('leads',text)){
      const ok=click('#listiaModuleActions [data-module="leads"]')||showScreen('screen-listia-leads');
      speak(ok?c().leads:c().unsupported); return;
    }
    if(matches('agenda',text)){
      const ok=click('#listiaModuleActions [data-module="agenda"]')||showScreen('screen-listia-agenda');
      speak(ok?c().agenda:c().unsupported); return;
    }
    if(matches('properties',text)){
      const ok=click('#officePropertiesBtn')||showScreen('screen-properties');
      speak(ok?c().properties:c().unsupported); return;
    }
    if(matches('summary',text)){
      if(!document.getElementById('screen-ready')?.classList.contains('active')) showScreen('screen-ready');
      speak(operationSummary()); return;
    }

    // Conversational fallback: do not read the page. Ask for a work intent.
    speak(c().unsupported);
  }

  function stopRecognition(){
    clearTimeout(restartTimer);
    try{recognition?.stop();}catch{}
    setStatus('',false);
  }
  function scheduleListen(){
    clearTimeout(restartTimer);
    if(!conversationActive || speaking) return;
    restartTimer=window.setTimeout(startListening,450);
  }
  function startListening(){
    if(!conversationActive || speaking || !Recognition) return;
    if(!recognition){
      recognition=new Recognition();
      recognition.continuous=false; recognition.interimResults=true; recognition.maxAlternatives=1;
      recognition.onstart=()=>setStatus(c().listening,true);
      recognition.onresult=e=>{
        let interim='', final='';
        for(let i=e.resultIndex;i<e.results.length;i++){
          const chunk=e.results[i][0]?.transcript||'';
          if(e.results[i].isFinal) final+=chunk; else interim+=chunk;
        }
        if(interim) setStatus(interim,true);
        if(final.trim()){
          const said=final.trim(); setStatus(c().thinking,false); addTurn('user',said); executeCommand(said);
        }
      };
      recognition.onerror=e=>{
        if(e.error==='not-allowed'||e.error==='service-not-allowed'){
          conversationActive=false; setStatus(c().unsupported,false); micButton?.classList.remove('active'); return;
        }
        setStatus('',false);
      };
      recognition.onend=()=>{setStatus('',false); if(conversationActive&&!speaking) scheduleListen();};
    }
    recognition.lang=languageTag();
    try{recognition.start();}catch{}
  }

  function openConversation(startMic=true){
    conversationActive=true; panel?.classList.add('open'); micButton?.classList.add('active');
    if(!transcript?.children.length) addTurn('assistant',c().ready);
    setStatus(c().hint,false);
    if(startMic) startListening();
  }
  function closeConversation(){
    conversationActive=false; stopRecognition(); stopSpeaking(); panel?.classList.remove('open'); micButton?.classList.remove('active','listening');
  }
  function toggle(){ panel?.classList.contains('open')?closeConversation():openConversation(true); }

  function inject(){
    if(document.getElementById('listiaVoiceButton')) return;
    const style=document.createElement('style'); style.id='listiaVoiceStyles'; style.textContent=`
      #listiaVoiceButton{position:fixed;right:18px;bottom:calc(18px + env(safe-area-inset-bottom));z-index:95;width:58px;height:58px;border:1px solid rgba(255,255,255,.2);border-radius:50%;background:linear-gradient(145deg,#7d45ff,#5d24e8);color:#fff;display:grid;place-items:center;box-shadow:0 14px 34px rgba(56,18,150,.42);cursor:pointer;padding:0}
      #listiaVoiceButton svg{width:30px;height:30px;display:block}#listiaVoiceButton.listening{animation:listiaPulse 1.15s ease-in-out infinite}
      #listiaVoiceButton.active:after{content:'';position:absolute;right:3px;bottom:3px;width:10px;height:10px;border-radius:50%;background:#72f0a0;border:2px solid #5d24e8}
      @keyframes listiaPulse{50%{transform:scale(1.08);box-shadow:0 0 0 10px rgba(125,69,255,.14),0 14px 34px rgba(56,18,150,.42)}}
      .listia-voice-panel{position:fixed;right:16px;bottom:calc(88px + env(safe-area-inset-bottom));z-index:94;width:min(390px,calc(100vw - 32px));max-height:min(620px,72vh);display:none;grid-template-rows:auto minmax(120px,1fr) auto;background:rgba(12,12,18,.97);border:1px solid rgba(255,255,255,.12);border-radius:22px;box-shadow:0 24px 70px rgba(0,0,0,.48);overflow:hidden;backdrop-filter:blur(18px)}
      .listia-voice-panel.open{display:grid}.listia-voice-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 16px 12px;border-bottom:1px solid rgba(255,255,255,.07)}
      .listia-voice-head strong{font-size:16px}.listia-voice-head span{display:block;margin-top:3px;font-size:12px;color:#9793a2}.listia-voice-close{border:0;background:#20202a;color:#fff;border-radius:50%;width:36px;height:36px;font-size:22px;cursor:pointer}
      .listia-voice-transcript{display:grid;align-content:start;gap:9px;padding:14px;overflow:auto}.listia-voice-turn{max-width:86%;padding:10px 12px;border-radius:15px;font-size:14px;line-height:1.45;overflow-wrap:anywhere}.listia-voice-turn.user{justify-self:end;background:#6d35f2}.listia-voice-turn.assistant{justify-self:start;background:#1c1c25;border:1px solid rgba(255,255,255,.07)}
      .listia-voice-status{min-height:48px;padding:12px 15px;border-top:1px solid rgba(255,255,255,.07);font-size:12px;line-height:1.45;color:#b8b4c3;display:flex;align-items:center}
      @media(max-width:520px){#listiaVoiceButton{right:16px;width:56px;height:56px}.listia-voice-panel{left:14px;right:14px;width:auto;bottom:calc(84px + env(safe-area-inset-bottom));max-height:70vh}}
    `; document.head.append(style);

    panel=document.createElement('section'); panel.className='listia-voice-panel'; panel.setAttribute('role','dialog'); panel.setAttribute('aria-label',c().title);
    panel.innerHTML=`<div class="listia-voice-head"><div><strong></strong><span></span></div><button class="listia-voice-close" type="button">×</button></div><div class="listia-voice-transcript" aria-live="polite"></div><div class="listia-voice-status" aria-live="polite"></div>`;
    document.body.append(panel);
    panel.querySelector('.listia-voice-head strong').textContent=c().title;
    panel.querySelector('.listia-voice-head span').textContent=c().hint;
    panel.querySelector('.listia-voice-close').setAttribute('aria-label',c().close);
    panel.querySelector('.listia-voice-close').addEventListener('click',closeConversation);
    transcript=panel.querySelector('.listia-voice-transcript'); statusNode=panel.querySelector('.listia-voice-status');

    micButton=document.createElement('button'); micButton.id='listiaVoiceButton'; micButton.type='button'; micButton.setAttribute('aria-label',c().mic); micButton.title=c().mic;
    micButton.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 18.2a5 5 0 0 0 5-5V8a5 5 0 1 0-10 0v5.2a5 5 0 0 0 5 5Zm-8-5.4a1.3 1.3 0 0 1 2.6 0 5.4 5.4 0 0 0 10.8 0 1.3 1.3 0 0 1 2.6 0 8 8 0 0 1-6.7 7.9v2.5h3a1.3 1.3 0 1 1 0 2.6h-8.6a1.3 1.3 0 1 1 0-2.6h3v-2.5A8 8 0 0 1 8 12.8Z"/><path fill="currentColor" opacity=".72" d="M23.5 21.7h4.2c1.3 0 2.3 1 2.3 2.3v3.1c0 1.3-1 2.3-2.3 2.3h-2.1l-2.8 2v-2h-1.1a2.3 2.3 0 0 1-2.3-2.3V26h.9a3.2 3.2 0 0 0 3.2-3.2v-1.1Z"/></svg>';
    micButton.addEventListener('click',toggle); document.body.append(micButton);
  }

  function syncLanguage(){
    if(recognition) recognition.lang=languageTag();
    panel?.setAttribute('aria-label',c().title);
    const strong=panel?.querySelector('.listia-voice-head strong'); const hint=panel?.querySelector('.listia-voice-head span'); const close=panel?.querySelector('.listia-voice-close');
    if(strong) strong.textContent=c().title; if(hint) hint.textContent=c().hint; if(close) close.setAttribute('aria-label',c().close);
    if(micButton){micButton.setAttribute('aria-label',c().mic); micButton.title=c().mic;}
  }

  window.LISTIA_VOICE = {
    speak,
    stop:()=>{conversationActive=false;stopRecognition();stopSpeaking();},
    open:()=>openConversation(true),
    close:closeConversation,
    execute:executeCommand,
    getLanguageTag:l=>languageTag(l),
    getVoice:l=>selected(languageTag(l)),
    supported:Object.keys(LANGS),
    registerAction(name,matcher,handler){
      if(typeof matcher!=='function'||typeof handler!=='function') throw new TypeError('matcher_and_handler_required');
      customActions.push({name:String(name||'action'),matcher,handler});
    }
  };

  window.addEventListener('listia:languagechange',syncLanguage);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',inject,{once:true}); else inject();
})();
