(() => {
  const synth = window.speechSynthesis;
  const language = document.getElementById('language');
  const sample = document.getElementById('sample');
  const voicesEl = document.getElementById('voices');
  const statusEl = document.getElementById('status');
  const refreshBtn = document.getElementById('refresh');
  const stopBtn = document.getElementById('stop');

  const samples = {
    'es-MX': 'Hola, soy LISTIA. Estoy aquí para ayudarte de forma clara, cercana y profesional. Cuéntame qué necesitas y lo resolvemos juntos.',
    'en-US': 'Hi, I’m LISTIA. I’m here to help you in a clear, warm, and professional way. Tell me what you need and we’ll work through it together.',
    'fr-FR': 'Bonjour, je suis LISTIA. Je suis là pour vous aider de manière claire, chaleureuse et professionnelle. Dites-moi ce dont vous avez besoin.',
    'it-IT': 'Ciao, sono LISTIA. Sono qui per aiutarti in modo chiaro, cordiale e professionale. Dimmi di cosa hai bisogno e lo risolviamo insieme.',
    'pt-BR': 'Olá, eu sou a LISTIA. Estou aqui para ajudar você de forma clara, próxima e profissional. Diga o que você precisa e resolvemos juntos.',
    'de-DE': 'Hallo, ich bin LISTIA. Ich helfe dir klar, freundlich und professionell. Sag mir, was du brauchst, und wir lösen es gemeinsam.',
    'ar-AE': 'مرحباً، أنا ليستيا. أنا هنا لمساعدتك بطريقة واضحة وودودة واحترافية. أخبرني بما تحتاج إليه وسنعمل عليه معاً.',
    'ru-RU': 'Здравствуйте, я LISTIA. Я помогу вам понятно, профессионально и по делу. Расскажите, что вам нужно, и мы решим это вместе.',
    'he-IL': 'שלום, אני LISTIA. אני כאן כדי לעזור בצורה ברורה, מקצועית ונעימה. ספרו לי מה אתם צריכים ונפתור את זה יחד.',
    'zh-CN': '你好，我是 LISTIA。我会以清晰、专业和友好的方式帮助你。告诉我你需要什么，我们一起完成。',
    'ja-JP': 'こんにちは、LISTIAです。分かりやすく、親しみやすく、プロフェッショナルにお手伝いします。必要なことを教えてください。'
  };

  function normalize(tag) { return String(tag || '').replace('_', '-').toLowerCase(); }
  function getCandidates(target) {
    const all = synth ? synth.getVoices() : [];
    const exact = normalize(target), family = exact.split('-')[0];
    return all.filter(v => { const lang = normalize(v.lang); return lang === exact || lang.split('-')[0] === family; })
      .sort((a,b) => Number(normalize(b.lang)===exact)-Number(normalize(a.lang)===exact) || Number(b.localService)-Number(a.localService) || a.name.localeCompare(b.name));
  }
  function speakWith(voice) {
    if (!synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(sample.value.trim() || samples[language.value]);
    utterance.lang = language.value; utterance.voice = voice; utterance.rate = 0.96; utterance.pitch = 1; utterance.volume = 1;
    statusEl.textContent = `Reproduciendo: ${voice.name} · ${voice.lang}${voice.localService ? ' · local' : ' · servicio del sistema'}`;
    utterance.onerror = () => { statusEl.textContent = 'Esta voz no pudo reproducirse en este navegador. Prueba otra candidata.'; };
    synth.speak(utterance);
  }
  function chooseVoice(voice) {
    localStorage.setItem(`listia_voice_${language.value}`, JSON.stringify({ name: voice.name, lang: voice.lang, localService: !!voice.localService }));
    statusEl.textContent = `Candidata guardada en este dispositivo: ${voice.name} · ${voice.lang}.`;
    render();
  }
  function render() {
    if (!synth) { statusEl.textContent = 'Este navegador no expone SpeechSynthesis. Abre esta página en Chrome, Edge o Safari actualizado.'; voicesEl.innerHTML=''; return; }
    const target=language.value,candidates=getCandidates(target);let saved=null;try{saved=JSON.parse(localStorage.getItem(`listia_voice_${target}`)||'null')}catch{}
    statusEl.textContent=candidates.length?`Encontré ${candidates.length} voz${candidates.length===1?'':'es'} compatible${candidates.length===1?'':'s'}. La variante exacta ${target} aparece primero.`:`No encontré una voz ${target} instalada o expuesta en este dispositivo.`;
    voicesEl.innerHTML='';
    candidates.forEach((voice,index)=>{
      const row=document.createElement('article');row.className='voice';const head=document.createElement('div');head.className='voice-head';const info=document.createElement('div');const name=document.createElement('div');name.className='voice-name';name.textContent=`${index+1}. ${voice.name}`;const meta=document.createElement('div');meta.className='meta';const exact=normalize(voice.lang)===normalize(target);meta.innerHTML=`<span class="badge">${voice.lang}</span>${exact?'<span class="badge">REGIÓN EXACTA</span>':'<span class="badge">FALLBACK</span>'}${voice.localService?'<span class="badge">LOCAL</span>':'<span class="badge">SISTEMA</span>'}${saved&&saved.name===voice.name&&saved.lang===voice.lang?'<span class="badge">ELEGIDA</span>':''}`;info.append(name,meta);const play=document.createElement('button');play.className='speak';play.type='button';play.textContent='▶ Escuchar';play.addEventListener('click',()=>speakWith(voice));head.append(info,play);const choose=document.createElement('button');choose.className='secondary';choose.type='button';choose.textContent='Elegir como candidata';choose.addEventListener('click',()=>chooseVoice(voice));row.append(head,choose);voicesEl.append(row);
    });
  }
  const requestedLang=new URLSearchParams(window.location.search).get('lang');
  if(requestedLang&&samples[requestedLang]&&language.querySelector(`option[value="${requestedLang}"]`)){language.value=requestedLang;sample.value=samples[requestedLang];document.documentElement.dir=['ar-AE','he-IL'].includes(requestedLang)?'rtl':'ltr';}
  language.addEventListener('change',()=>{sample.value=samples[language.value]||'';document.documentElement.dir=['ar-AE','he-IL'].includes(language.value)?'rtl':'ltr';render();});
  refreshBtn.addEventListener('click',render);stopBtn.addEventListener('click',()=>synth&&synth.cancel());render();if(synth&&'onvoiceschanged'in synth)synth.onvoiceschanged=render;setTimeout(render,500);setTimeout(render,1500);
})();
