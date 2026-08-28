(() => {
  'use strict';

  const synth = window.speechSynthesis;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const LANGS = { es:'es-MX', en:'en-US', fr:'fr-FR', it:'it-IT', 'pt-BR':'pt-BR', de:'de-DE', 'ar-AE':'ar-AE', ru:'ru-RU', he:'he-IL', 'zh-CN':'zh-CN', ja:'ja-JP' };
  const COPY = {
    es:{ready:'Lista. ¿Qué necesitas?',listening:'Te escucho…',thinking:'Dame un momento…',start:'Hablar con LISTIA',stop:'Pausar LISTIA',mic:'Necesito permiso de micrófono para escucharte.'},
    en:{ready:'Ready. What do you need?',listening:'I’m listening…',thinking:'Give me a moment…',start:'Talk to LISTIA',stop:'Pause LISTIA',mic:'I need microphone permission to hear you.'},
    fr:{ready:'Prête. De quoi avez-vous besoin ?',listening:'Je vous écoute…',thinking:'Un instant…',start:'Parler à LISTIA',stop:'Mettre LISTIA en pause',mic:'J’ai besoin de l’autorisation du microphone.'},
    it:{ready:'Pronta. Di cosa hai bisogno?',listening:'Ti ascolto…',thinking:'Un momento…',start:'Parla con LISTIA',stop:'Metti in pausa LISTIA',mic:'Ho bisogno del permesso per il microfono.'},
    'pt-BR':{ready:'Pronta. O que você precisa?',listening:'Estou ouvindo…',thinking:'Só um momento…',start:'Falar com LISTIA',stop:'Pausar LISTIA',mic:'Preciso de permissão para usar o microfone.'},
    de:{ready:'Bereit. Was brauchst du?',listening:'Ich höre zu…',thinking:'Einen Moment…',start:'Mit LISTIA sprechen',stop:'LISTIA pausieren',mic:'Ich brauche Mikrofonzugriff.'},
    'ar-AE':{ready:'أنا جاهزة. ماذا تحتاج؟',listening:'أنا أستمع…',thinking:'لحظة واحدة…',start:'تحدث مع LISTIA',stop:'إيقاف LISTIA مؤقتاً',mic:'أحتاج إلى إذن الميكروفون.'},
    ru:{ready:'Готова. Что вам нужно?',listening:'Я слушаю…',thinking:'Одну минуту…',start:'Говорить с LISTIA',stop:'Приостановить LISTIA',mic:'Мне нужен доступ к микрофону.'},
    he:{ready:'מוכנה. מה צריך?',listening:'אני מקשיבה…',thinking:'רגע אחד…',start:'לדבר עם LISTIA',stop:'להשהות את LISTIA',mic:'אני צריכה הרשאת מיקרופון.'},
    'zh-CN':{ready:'准备好了。你需要什么？',listening:'我在听…',thinking:'稍等一下…',start:'与 LISTIA 对话',stop:'暂停 LISTIA',mic:'我需要麦克风权限。'},
    ja:{ready:'準備できています。何をしますか？',listening:'聞いています…',thinking:'少し待ってください…',start:'LISTIAと話す',stop:'LISTIAを一時停止',mic:'マイクの許可が必要です。'}
  };

  const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[_-]/g,' ').toLowerCase().replace(/\s+/g,' ').trim();
  const current=()=>window.LISTIA_I18N?.getLanguage?.()||document.documentElement.dataset.listiaLanguage||document.documentElement.lang||'en';
  const langKey=()=>COPY[current()]?current():(String(current()).toLowerCase().startsWith('es')?'es':'en');
  const c=()=>COPY[langKey()]||COPY.en;
  const languageTag=language=>LANGS[language||current()]||LANGS[langKey()]||'en-US';

  function candidates(tag){
    if(!synth)return[];
    const exact=normalize(tag),family=exact.split(' ')[0];
    const quality=name=>/natural|neural|enhanced|premium|google|microsoft|samsung|apple/i.test(name||'')?1:0;
    return synth.getVoices().filter(v=>{const x=normalize(v.lang);return x===exact||x.split(' ')[0]===family;})
      .sort((a,b)=>Number(normalize(b.lang)===exact)-Number(normalize(a.lang)===exact)||quality(b.name)-quality(a.name)||Number(b.localService)-Number(a.localService));
  }
  function selected(tag){
    const list=candidates(tag);let saved=null;
    try{saved=JSON.parse(localStorage.getItem(`listia_voice_${tag}`)||'null')}catch{}
    return list.find(v=>saved&&v.name===saved.name&&v.lang===saved.lang)||list[0]||null;
  }

  let recognition=null,conversationActive=false,speaking=false,processing=false;
  let orb=null,statusNode=null,decisionNode=null,statusTimer=0,listenTimer=0;
  let heardThisTurn=false,lastTranscript='',lastTranscriptAt=0,lastSpoken='',lastSpokenAt=0;
  const customActions=[];

  function setOrbState(state='idle'){
    if(!orb)return;
    orb.dataset.state=state;orb.classList.toggle('active',conversationActive);
    orb.setAttribute('aria-label',conversationActive?c().stop:c().start);orb.title=conversationActive?c().stop:c().start;
  }
  function setStatus(text,{persist=false}={}){
    if(!statusNode)return;clearTimeout(statusTimer);statusNode.textContent=String(text||'');statusNode.hidden=!text;
    if(text&&!persist)statusTimer=setTimeout(()=>{if(statusNode){statusNode.hidden=true;statusNode.textContent='';}},2600);
  }
  function stopRecognition(){clearTimeout(listenTimer);try{recognition?.abort();}catch{try{recognition?.stop();}catch{}}}
  function stopSpeaking(){try{synth?.cancel();}catch{}speaking=false;}
  function isEcho(text){const n=normalize(text),now=Date.now();return Boolean(n&&normalize(lastSpoken)===n&&now-lastSpokenAt<5000);}
  function isDuplicate(text){const n=normalize(text),now=Date.now();const duplicate=n&&n===lastTranscript&&now-lastTranscriptAt<3500;if(!duplicate){lastTranscript=n;lastTranscriptAt=now;}return duplicate;}

  function listenOnce(delay=0){
    clearTimeout(listenTimer);
    if(!conversationActive||speaking||processing||!Recognition)return;
    listenTimer=setTimeout(()=>{
      if(!conversationActive||speaking||processing)return;
      heardThisTurn=false;
      if(!recognition){
        recognition=new Recognition();recognition.continuous=false;recognition.interimResults=true;recognition.maxAlternatives=1;
        recognition.onstart=()=>{setOrbState('listening');setStatus(c().listening,{persist:true});};
        recognition.onresult=e=>{
          let interim='',final='';
          for(let i=e.resultIndex;i<e.results.length;i++){const chunk=e.results[i][0]?.transcript||'';if(e.results[i].isFinal)final+=chunk;else interim+=chunk;}
          if(interim)setStatus(interim,{persist:true});
          if(final.trim()){
            const said=final.trim();heardThisTurn=true;stopRecognition();
            if(isEcho(said)||isDuplicate(said)){setStatus('');setOrbState('active');return;}
            executeCommand(said);
          }
        };
        recognition.onerror=e=>{
          if(e.error==='not-allowed'||e.error==='service-not-allowed'){conversationActive=false;setOrbState('idle');setStatus(c().mic);return;}
          if(e.error!=='no-speech'&&e.error!=='aborted')console.warn('LISTIA recognition',e.error);
        };
        recognition.onend=()=>{
          if(!conversationActive||speaking||processing||heardThisTurn)return;
          setStatus(c().ready);setOrbState('active');
        };
      }
      recognition.lang=languageTag();
      try{recognition.start();}catch{setOrbState('active');}
    },delay);
  }

  function speak(text,language=current(),{resume=true}={}){
    const clean=String(text||'').trim();processing=false;
    if(!clean){setStatus(c().ready);setOrbState('active');if(resume)listenOnce(900);return false;}
    stopRecognition();stopSpeaking();lastSpoken=clean;lastSpokenAt=Date.now();setStatus(clean,{persist:true});setOrbState('speaking');
    if(!synth){setOrbState('active');if(resume)listenOnce(900);return false;}
    const tag=languageTag(language),voice=selected(tag),u=new SpeechSynthesisUtterance(clean);u.lang=tag;if(voice)u.voice=voice;u.rate=.93;u.pitch=1.02;u.volume=1;speaking=true;
    const done=()=>{speaking=false;setStatus('');setOrbState(conversationActive?'active':'idle');if(conversationActive&&resume)listenOnce(1100);};
    u.onend=done;u.onerror=done;synth.speak(u);return true;
  }

  async function executeCommand(raw){
    const text=normalize(raw);if(!text||processing)return;processing=true;setOrbState('thinking');setStatus(c().thinking,{persist:true});
    for(const action of customActions){
      try{
        if(await action.matcher(text,raw)){
          const result=await action.handler({text:raw,normalized:text});const response=typeof result==='string'?result:result?.response;
          speak(response||c().ready);return;
        }
      }catch(err){console.warn('LISTIA voice action',err);}
    }
    processing=false;speak(c().ready);
  }

  function openConversation(startMic=true){conversationActive=true;setOrbState('active');setStatus(c().ready);if(startMic)listenOnce(120);}
  function closeConversation(){conversationActive=false;processing=false;stopRecognition();stopSpeaking();setStatus('');setOrbState('idle');}
  function toggle(){if(conversationActive){if(orb?.dataset.state==='active')listenOnce(0);else closeConversation();}else openConversation(true);}

  function decision({title='',message='',choices=[]}={}){
    stopRecognition();if(!decisionNode)return Promise.resolve(null);decisionNode.replaceChildren();const copy=document.createElement('div');copy.className='listia-decision-copy';
    if(title){const strong=document.createElement('strong');strong.textContent=title;copy.append(strong);}if(message){const span=document.createElement('span');span.textContent=message;copy.append(span);}const actions=document.createElement('div');actions.className='listia-decision-actions';copy.append(actions);decisionNode.append(copy);decisionNode.hidden=false;
    return new Promise(resolve=>{let settled=false;const finish=value=>{if(settled)return;settled=true;decisionNode.hidden=true;decisionNode.replaceChildren();resolve(value);if(conversationActive)listenOnce(800);};choices.slice(0,3).forEach(choice=>{const b=document.createElement('button');b.type='button';b.textContent=String(choice.label||choice.value||choice);b.addEventListener('click',()=>finish(choice.value??choice.label??choice));actions.append(b);});setTimeout(()=>finish(null),12000);});
  }

  function inject(){
    if(document.getElementById('listiaVoiceButton'))return;statusNode=document.createElement('div');statusNode.id='listiaVoiceStatus';statusNode.className='listia-ambient-status';statusNode.hidden=true;statusNode.setAttribute('aria-live','polite');document.body.append(statusNode);
    decisionNode=document.createElement('section');decisionNode.id='listiaVoiceDecision';decisionNode.className='listia-decision-sheet';decisionNode.hidden=true;decisionNode.setAttribute('aria-live','polite');document.body.append(decisionNode);
    orb=document.createElement('button');orb.id='listiaVoiceButton';orb.type='button';orb.className='listia-orb';orb.dataset.state='idle';orb.innerHTML='<span class="listia-orb-core" aria-hidden="true"><span class="listia-orb-star">✦</span></span>';orb.addEventListener('click',toggle);document.body.append(orb);setOrbState('idle');
  }
  function syncLanguage(){if(recognition)recognition.lang=languageTag();setOrbState(conversationActive?'active':'idle');}

  window.LISTIA_VOICE={speak,stop:closeConversation,open:()=>openConversation(true),close:closeConversation,execute:executeCommand,decide:decision,isActive:()=>conversationActive,getLanguageTag:l=>languageTag(l),getVoice:l=>selected(languageTag(l)),supported:Object.keys(LANGS),registerAction(name,matcher,handler){if(typeof matcher!=='function'||typeof handler!=='function')throw new TypeError('matcher_and_handler_required');customActions.push({name:String(name||'action'),matcher,handler});}};
  window.addEventListener('listia:languagechange',syncLanguage);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject,{once:true});else inject();
})();