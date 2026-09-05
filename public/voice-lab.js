(() => {
  'use strict';

  const synth = window.speechSynthesis || null;
  const Utterance = window.SpeechSynthesisUtterance || null;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
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

  function normalize(tag) {
    return String(tag || '').replace('_', '-').toLowerCase();
  }

  function getCandidates(target) {
    const all = synth ? synth.getVoices() : [];
    const exact = normalize(target);
    const family = exact.split('-')[0];
    return all
      .filter(voice => {
        const lang = normalize(voice.lang);
        return lang === exact || lang.split('-')[0] === family;
      })
      .sort((a, b) =>
        Number(!!b.localService) - Number(!!a.localService) ||
        Number(normalize(b.lang) === exact) - Number(normalize(a.lang) === exact) ||
        a.name.localeCompare(b.name)
      );
  }

  function badge(text) {
    const el = document.createElement('span');
    el.className = 'badge';
    el.textContent = text;
    return el;
  }

  function policySummary(candidates) {
    const local = candidates.filter(voice => !!voice.localService).length;
    const tts = !!(synth && Utterance);
    const stt = !!Recognition;
    if (!tts) return `TTS: texto solamente · Dictado: ${stt ? 'administrado por navegador' : 'no disponible'} · API de voz facturable LISTIA: no`;
    return `TTS nativo: activo · ${local} voz${local === 1 ? '' : 'es'} local${local === 1 ? '' : 'es'} · Dictado: ${stt ? 'disponible' : 'no disponible'} · API de voz facturable LISTIA: no`;
  }

  function speakWith(voice) {
    if (!synth || !Utterance) {
      statusEl.textContent = 'Este navegador no expone TTS nativo. LISTIA conserva el texto como fallback y no llama a una API de voz de pago.';
      return;
    }
    synth.cancel();
    const utterance = new Utterance(sample.value.trim() || samples[language.value]);
    utterance.lang = language.value;
    utterance.voice = voice;
    utterance.rate = 0.96;
    utterance.pitch = 1;
    utterance.volume = 1;
    const transport = voice.localService ? 'voz local del dispositivo' : 'voz administrada por el navegador/sistema';
    statusEl.textContent = `Reproduciendo: ${voice.name} · ${voice.lang} · ${transport} · sin API de voz facturable integrada por LISTIA.`;
    utterance.onerror = () => {
      statusEl.textContent = 'Esta voz no pudo reproducirse. LISTIA no cambia a una API de voz de pago; prueba otra voz o usa el fallback de texto.';
    };
    synth.speak(utterance);
  }

  function chooseVoice(voice) {
    localStorage.setItem(`listia_voice_${language.value}`, JSON.stringify({
      name: voice.name,
      lang: voice.lang,
      localService: !!voice.localService
    }));
    statusEl.textContent = `Voz guardada en este dispositivo: ${voice.name} · ${voice.lang}. La selección no configura credenciales ni proveedores de voz de pago.`;
    render();
  }

  function render() {
    voicesEl.replaceChildren();
    if (!synth || !Utterance) {
      statusEl.textContent = 'SpeechSynthesis no está disponible. LISTIA queda en modo texto y no intenta una API de voz facturable.';
      return;
    }

    const target = language.value;
    const candidates = getCandidates(target);
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(`listia_voice_${target}`) || 'null'); }
    catch { saved = null; }

    statusEl.textContent = candidates.length
      ? `${policySummary(candidates)} · ${candidates.length} candidata${candidates.length === 1 ? '' : 's'} para ${target}. Las voces locales aparecen primero.`
      : `${policySummary(candidates)} · No hay una voz compatible ${target} expuesta en este dispositivo.`;

    candidates.forEach((voice, index) => {
      const row = document.createElement('article');
      row.className = 'voice';

      const head = document.createElement('div');
      head.className = 'voice-head';
      const info = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'voice-name';
      name.textContent = `${index + 1}. ${voice.name}`;
      const meta = document.createElement('div');
      meta.className = 'meta';
      const exact = normalize(voice.lang) === normalize(target);
      const chosen = saved && saved.name === voice.name && saved.lang === voice.lang;

      meta.append(
        badge(voice.lang),
        badge(exact ? 'REGIÓN EXACTA' : 'FALLBACK'),
        badge(voice.localService ? 'LOCAL' : 'NAVEGADOR/SISTEMA'),
        badge('SIN API FACTURABLE LISTIA')
      );
      if (chosen) meta.append(badge('ELEGIDA'));

      info.append(name, meta);
      const play = document.createElement('button');
      play.className = 'speak';
      play.type = 'button';
      play.textContent = '▶ Escuchar';
      play.addEventListener('click', () => speakWith(voice));
      head.append(info, play);

      const choose = document.createElement('button');
      choose.className = 'secondary';
      choose.type = 'button';
      choose.textContent = voice.localService ? 'Elegir voz local' : 'Elegir voz del sistema';
      choose.addEventListener('click', () => chooseVoice(voice));
      row.append(head, choose);
      voicesEl.append(row);
    });
  }

  const requestedLang = new URLSearchParams(window.location.search).get('lang');
  if (requestedLang && samples[requestedLang] && language.querySelector(`option[value="${requestedLang}"]`)) {
    language.value = requestedLang;
    sample.value = samples[requestedLang];
    document.documentElement.dir = ['ar-AE', 'he-IL'].includes(requestedLang) ? 'rtl' : 'ltr';
  }

  language.addEventListener('change', () => {
    sample.value = samples[language.value] || '';
    document.documentElement.dir = ['ar-AE', 'he-IL'].includes(language.value) ? 'rtl' : 'ltr';
    render();
  });
  refreshBtn.addEventListener('click', render);
  stopBtn.addEventListener('click', () => synth?.cancel());

  render();
  if (synth && 'onvoiceschanged' in synth) synth.onvoiceschanged = render;
  setTimeout(render, 500);
  setTimeout(render, 1500);
})();