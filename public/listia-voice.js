(() => {
  'use strict';

  const synth = window.speechSynthesis || null;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const Utterance = window.SpeechSynthesisUtterance || null;

  const POLICY = Object.freeze({
    id: 'zero-billable-v1',
    directProviderApi: false,
    directApiBilling: false,
    preferDeviceLocalTts: true,
    allowBrowserManagedTts: true,
    allowBrowserManagedStt: true,
    textFallback: true
  });

  const LANGS = {
    es: 'es-MX', en: 'en-US', fr: 'fr-FR', it: 'it-IT', 'pt-BR': 'pt-BR',
    de: 'de-DE', 'ar-AE': 'ar-AE', ru: 'ru-RU', he: 'he-IL', 'zh-CN': 'zh-CN', ja: 'ja-JP'
  };

  const COPY = {
    es: { ready: 'Lista. ¿Qué necesitas?', listening: 'Te escucho…', thinking: 'Pensando…', start: 'Hablar con LISTIA', stop: 'Pausar LISTIA', mic: 'Necesito permiso de micrófono para escucharte.', noStt: 'El dictado por voz no está disponible en este navegador. LISTIA sigue disponible por texto.' },
    en: { ready: 'Ready. What do you need?', listening: 'I’m listening…', thinking: 'Thinking…', start: 'Talk to LISTIA', stop: 'Pause LISTIA', mic: 'I need microphone permission to hear you.', noStt: 'Voice dictation is not available in this browser. LISTIA is still available by text.' },
    fr: { ready: 'Prête. Que puis-je faire ?', listening: 'Je vous écoute…', thinking: 'Je réfléchis…', start: 'Parler à LISTIA', stop: 'Mettre LISTIA en pause', mic: 'J’ai besoin de l’autorisation du microphone pour vous entendre.', noStt: 'La dictée vocale n’est pas disponible dans ce navigateur. LISTIA reste disponible par texte.' },
    it: { ready: 'Pronta. Di cosa hai bisogno?', listening: 'Ti ascolto…', thinking: 'Sto pensando…', start: 'Parla con LISTIA', stop: 'Metti LISTIA in pausa', mic: 'Ho bisogno del permesso del microfono per ascoltarti.', noStt: 'La dettatura vocale non è disponibile in questo browser. LISTIA resta disponibile tramite testo.' },
    'pt-BR': { ready: 'Pronta. O que você precisa?', listening: 'Estou ouvindo…', thinking: 'Pensando…', start: 'Falar com a LISTIA', stop: 'Pausar LISTIA', mic: 'Preciso da permissão do microfone para ouvir você.', noStt: 'O ditado por voz não está disponível neste navegador. A LISTIA continua disponível por texto.' },
    de: { ready: 'Bereit. Was brauchst du?', listening: 'Ich höre zu…', thinking: 'Ich denke nach…', start: 'Mit LISTIA sprechen', stop: 'LISTIA pausieren', mic: 'Ich benötige die Mikrofonberechtigung, um dich zu hören.', noStt: 'Spracheingabe ist in diesem Browser nicht verfügbar. LISTIA bleibt per Text verfügbar.' },
    'ar-AE': { ready: 'جاهزة. ماذا تحتاج؟', listening: 'أنا أستمع…', thinking: 'أفكر…', start: 'تحدث مع LISTIA', stop: 'إيقاف LISTIA مؤقتاً', mic: 'أحتاج إلى إذن الميكروفون لأسمعك.', noStt: 'الإملاء الصوتي غير متاح في هذا المتصفح. تظل LISTIA متاحة عبر النص.' },
    ru: { ready: 'Готова. Что вам нужно?', listening: 'Я слушаю…', thinking: 'Думаю…', start: 'Говорить с LISTIA', stop: 'Приостановить LISTIA', mic: 'Мне нужен доступ к микрофону, чтобы вас слышать.', noStt: 'Голосовой ввод недоступен в этом браузере. LISTIA по-прежнему доступна в текстовом режиме.' },
    he: { ready: 'מוכנה. מה צריך?', listening: 'אני מקשיבה…', thinking: 'חושבת…', start: 'לדבר עם LISTIA', stop: 'להשהות את LISTIA', mic: 'אני צריכה הרשאת מיקרופון כדי לשמוע אותך.', noStt: 'הכתבה קולית אינה זמינה בדפדפן הזה. LISTIA עדיין זמינה בטקסט.' },
    'zh-CN': { ready: '准备好了。你需要什么？', listening: '我在听…', thinking: '思考中…', start: '与 LISTIA 对话', stop: '暂停 LISTIA', mic: '我需要麦克风权限才能听到你。', noStt: '此浏览器不支持语音听写。LISTIA 仍可通过文字使用。' },
    ja: { ready: '準備できました。何が必要ですか？', listening: '聞いています…', thinking: '考えています…', start: 'LISTIA と話す', stop: 'LISTIA を一時停止', mic: '音声を聞くにはマイクの許可が必要です。', noStt: 'このブラウザでは音声入力を利用できません。LISTIA はテキストで引き続き利用できます。' }
  };

  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[_-]/g, ' ').toLowerCase().replace(/\s+/g, ' ').trim();
  const current = () => window.LISTIA_I18N?.getLanguage?.() || document.documentElement.dataset.listiaLanguage || document.documentElement.lang || 'en';
  const keyFor = value => {
    const s = String(value || 'en').toLowerCase();
    if (s.startsWith('pt')) return 'pt-BR';
    if (s.startsWith('ar')) return 'ar-AE';
    if (s.startsWith('zh')) return 'zh-CN';
    if (s.startsWith('he')) return 'he';
    if (s.startsWith('ja')) return 'ja';
    if (s.startsWith('ru')) return 'ru';
    if (s.startsWith('fr')) return 'fr';
    if (s.startsWith('it')) return 'it';
    if (s.startsWith('de')) return 'de';
    if (s.startsWith('es')) return 'es';
    return 'en';
  };
  const langKey = () => keyFor(current());
  const c = () => COPY[langKey()] || COPY.en;
  const languageTag = language => LANGS[keyFor(language || current())] || 'en-US';

  let voiceCache = [];
  let recognition = null;
  let conversationActive = false;
  let speaking = false;
  let processing = false;
  let orb = null;
  let statusNode = null;
  let decisionNode = null;
  let statusTimer = 0;
  let listenTimer = 0;
  let heard = false;
  let lastTranscript = '';
  let lastTranscriptAt = 0;
  let lastSpoken = '';
  let lastSpokenAt = 0;
  let lastSpeechEndedAt = 0;
  let speechGeneration = 0;
  const customActions = [];

  function compatibleVoices(tag) {
    const target = normalize(tag);
    const family = target.split(' ')[0];
    return (voiceCache.length ? voiceCache : (synth?.getVoices?.() || [])).filter(voice => {
      const lang = normalize(voice?.lang);
      return lang === target || lang.split(' ')[0] === family;
    });
  }

  function voiceScore(voice, tag) {
    const lang = normalize(voice?.lang);
    const target = normalize(tag);
    const family = target.split(' ')[0];
    let score = 0;
    if (lang === target) score += 100;
    else if (lang.split(' ')[0] === family) score += 45;
    else return -999;
    if (voice?.localService) score += 120;
    if (/mexic|latin|latam|español.*méxico|espanol.*mexico/i.test(voice?.name || '')) score += 20;
    if (/female|mujer|femenin|paulina|dalia|sabina|monica|luciana|sofia|isabela|helena|elvira|paloma|maria/i.test(voice?.name || '')) score += 8;
    if (/compact|espeak|robot|classic/i.test(voice?.name || '')) score -= 20;
    return score;
  }

  function savedVoice(tag) {
    try { return JSON.parse(localStorage.getItem(`listia_voice_${tag}`) || 'null'); }
    catch { return null; }
  }

  function selected(tag) {
    const saved = savedVoice(tag);
    const pool = compatibleVoices(tag).sort((a, b) => voiceScore(b, tag) - voiceScore(a, tag));
    const explicit = pool.find(voice => saved && voice.name === saved.name && voice.lang === saved.lang);
    return explicit || pool[0] || null;
  }

  function getReadiness(language = current()) {
    const tag = languageTag(language);
    const voices = compatibleVoices(tag);
    const local = voices.filter(voice => !!voice.localService);
    const voice = selected(tag);
    const ttsSupported = !!(synth && Utterance);
    const sttSupported = !!Recognition;
    return Object.freeze({
      engine: 'native-zero-billable-v3',
      policy: POLICY.id,
      directProviderApi: false,
      directApiBilling: false,
      language: tag,
      ready: ttsSupported || sttSupported,
      degraded: !ttsSupported || !sttSupported,
      fallback: ttsSupported ? 'native-speech' : 'text-only',
      tts: {
        supported: ttsSupported,
        mode: !ttsSupported ? 'text-only' : (voice?.localService ? 'device-local' : 'browser-managed'),
        voiceCount: voices.length,
        localVoiceCount: local.length,
        selected: voice ? { name: voice.name, lang: voice.lang, localService: !!voice.localService } : null
      },
      stt: {
        supported: sttSupported,
        mode: sttSupported ? 'browser-managed' : 'text-only',
        directProviderApi: false
      }
    });
  }

  function announceReadiness() {
    try { window.dispatchEvent(new CustomEvent('listia:voice-readiness', { detail: getReadiness() })); }
    catch { /* Older embedded webviews may not support CustomEvent construction. */ }
  }

  function refreshVoices() {
    try { voiceCache = synth?.getVoices?.() || []; }
    catch { voiceCache = []; }
    announceReadiness();
    return voiceCache.slice();
  }

  refreshVoices();
  if (synth) {
    synth.addEventListener?.('voiceschanged', refreshVoices);
    setTimeout(refreshVoices, 250);
    setTimeout(refreshVoices, 1200);
  }

  function setOrbState(state = 'idle') {
    if (!orb) return;
    orb.dataset.state = state;
    orb.classList.toggle('active', conversationActive);
    orb.setAttribute('aria-label', conversationActive ? c().stop : c().start);
  }

  function setStatus(text, { persist = false } = {}) {
    if (!statusNode) return;
    clearTimeout(statusTimer);
    statusNode.textContent = String(text || '');
    statusNode.hidden = !text;
    if (text && !persist) {
      statusTimer = setTimeout(() => {
        statusNode.hidden = true;
        statusNode.textContent = '';
      }, 1800);
    }
  }

  function stopRecognition() {
    clearTimeout(listenTimer);
    try { recognition?.abort(); }
    catch { /* No-op. */ }
  }

  function stopSpeaking() {
    speechGeneration += 1;
    try { synth?.cancel(); }
    catch { /* No-op. */ }
    speaking = false;
    lastSpeechEndedAt = Date.now();
  }

  function nearDuplicate(a, b) {
    const x = normalize(a), y = normalize(b);
    if (!x || !y) return false;
    if (x === y) return true;
    return x.length > 18 && y.length > 18 && (x.includes(y) || y.includes(x));
  }

  function duplicateTranscript(text) {
    const normalized = normalize(text), now = Date.now();
    if (!normalized) return true;
    if (now - lastSpeechEndedAt < 950 && nearDuplicate(normalized, lastSpoken)) return true;
    if (normalized === lastTranscript && now - lastTranscriptAt < 1800) return true;
    lastTranscript = normalized;
    lastTranscriptAt = now;
    return false;
  }

  function listenOnce(delay = 0) {
    clearTimeout(listenTimer);
    if (!conversationActive || speaking || processing) return;
    if (!Recognition) {
      setOrbState('active');
      setStatus(c().noStt, { persist: true });
      return;
    }
    listenTimer = setTimeout(() => {
      if (!conversationActive || speaking || processing) return;
      heard = false;
      if (!recognition) {
        recognition = new Recognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.onstart = () => {
          setOrbState('listening');
          setStatus(c().listening, { persist: true });
        };
        recognition.onresult = event => {
          let interim = '', final = '';
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const transcript = event.results[i][0]?.transcript || '';
            if (event.results[i].isFinal) final += transcript;
            else interim += transcript;
          }
          if (interim) setStatus(interim, { persist: true });
          if (final.trim()) {
            heard = true;
            const said = final.trim();
            stopRecognition();
            if (duplicateTranscript(said)) {
              setStatus('');
              setOrbState('active');
              listenOnce(420);
              return;
            }
            executeCommand(said);
          }
        };
        recognition.onerror = event => {
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            conversationActive = false;
            setOrbState('idle');
            setStatus(c().mic);
          }
        };
        recognition.onend = () => {
          if (conversationActive && !speaking && !processing && !heard) {
            setStatus(c().ready);
            setOrbState('active');
            listenOnce(500);
          }
        };
      }
      recognition.lang = languageTag();
      try { recognition.start(); }
      catch {
        setOrbState('active');
        listenOnce(650);
      }
    }, delay);
  }

  function finishSpeech(resume = true) {
    speaking = false;
    lastSpeechEndedAt = Date.now();
    setStatus('');
    setOrbState(conversationActive ? 'active' : 'idle');
    if (conversationActive && resume) listenOnce(650);
  }

  function humanize(text) {
    let value = String(text || '').replace(/\s+/g, ' ').trim();
    value = value.replace(/([,;:])\s*/g, '$1 ').replace(/([.!?])(?=\S)/g, '$1 ');
    return value.slice(0, 520);
  }

  function textFallback(text, resume = true) {
    speaking = false;
    lastSpeechEndedAt = Date.now();
    setStatus(text, { persist: true });
    setOrbState(conversationActive ? 'active' : 'idle');
    if (conversationActive && resume && Recognition) listenOnce(1400);
    return false;
  }

  function nativeSpeak(text, language, resume, generation) {
    if (generation !== speechGeneration) return false;
    if (!synth || !Utterance) return textFallback(text, resume);
    refreshVoices();
    const tag = languageTag(language);
    const voice = selected(tag);
    const utterance = new Utterance(humanize(text));
    utterance.lang = tag;
    if (voice) utterance.voice = voice;
    utterance.rate = 1.03;
    utterance.pitch = 1.02;
    utterance.volume = 1;
    speaking = true;
    utterance.onend = () => { if (generation === speechGeneration) finishSpeech(resume); };
    utterance.onerror = () => { if (generation === speechGeneration) textFallback(text, resume); };
    try {
      synth.cancel();
      synth.speak(utterance);
      return true;
    } catch {
      return textFallback(text, resume);
    }
  }

  function speak(text, language = current(), { resume = true } = {}) {
    const clean = humanize(text);
    processing = false;
    if (!clean) {
      setOrbState('active');
      if (resume) listenOnce(350);
      return false;
    }
    const now = Date.now();
    if (nearDuplicate(clean, lastSpoken) && now - lastSpokenAt < 3500) {
      setStatus('');
      setOrbState(conversationActive ? 'active' : 'idle');
      if (conversationActive && resume) listenOnce(500);
      return false;
    }
    stopRecognition();
    stopSpeaking();
    const generation = speechGeneration;
    lastSpoken = clean;
    lastSpokenAt = now;
    setStatus(clean, { persist: true });
    setOrbState('speaking');
    return nativeSpeak(clean, language, resume, generation);
  }

  async function executeCommand(raw) {
    const text = normalize(raw);
    if (!text || processing) return;
    processing = true;
    setOrbState('thinking');
    setStatus(c().thinking, { persist: true });
    for (const action of customActions) {
      try {
        if (await action.matcher(text, raw)) {
          const result = await action.handler({ text: raw, normalized: text });
          processing = false;
          speak(typeof result === 'string' ? result : result?.response || c().ready);
          return;
        }
      } catch (error) {
        console.warn('LISTIA voice action', error);
      }
    }
    processing = false;
    speak(c().ready);
  }

  function openConversation(startMic = true) {
    conversationActive = true;
    setOrbState('active');
    setStatus(c().ready);
    if (startMic) listenOnce(120);
  }

  function closeConversation() {
    conversationActive = false;
    processing = false;
    stopRecognition();
    stopSpeaking();
    setStatus('');
    setOrbState('idle');
  }

  function toggle() {
    if (speaking) {
      stopSpeaking();
      conversationActive = true;
      setOrbState('active');
      if (Recognition) {
        setStatus(c().listening, { persist: true });
        listenOnce(180);
      } else {
        setStatus(c().noStt, { persist: true });
      }
      return;
    }
    conversationActive ? closeConversation() : openConversation(true);
  }

  function decision({ title = '', message = '', choices = [] } = {}) {
    stopRecognition();
    if (!decisionNode) return Promise.resolve(null);
    decisionNode.replaceChildren();
    const copy = document.createElement('div');
    copy.className = 'listia-decision-copy';
    if (title) {
      const strong = document.createElement('strong');
      strong.textContent = title;
      copy.append(strong);
    }
    if (message) {
      const span = document.createElement('span');
      span.textContent = message;
      copy.append(span);
    }
    const actions = document.createElement('div');
    actions.className = 'listia-decision-actions';
    copy.append(actions);
    decisionNode.append(copy);
    decisionNode.hidden = false;
    return new Promise(resolve => {
      const finish = value => {
        decisionNode.hidden = true;
        decisionNode.replaceChildren();
        resolve(value);
        if (conversationActive) listenOnce(650);
      };
      choices.slice(0, 3).forEach(choice => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = String(choice.label || choice.value || choice);
        button.onclick = () => finish(choice.value ?? choice.label ?? choice);
        actions.append(button);
      });
    });
  }

  function inject() {
    if (document.getElementById('listiaVoiceButton')) return;
    statusNode = document.createElement('div');
    statusNode.id = 'listiaVoiceStatus';
    statusNode.className = 'listia-ambient-status';
    statusNode.hidden = true;
    statusNode.setAttribute('aria-live', 'polite');
    document.body.append(statusNode);

    decisionNode = document.createElement('section');
    decisionNode.id = 'listiaVoiceDecision';
    decisionNode.className = 'listia-decision-sheet';
    decisionNode.hidden = true;
    document.body.append(decisionNode);

    orb = document.createElement('button');
    orb.id = 'listiaVoiceButton';
    orb.type = 'button';
    orb.className = 'listia-orb';
    orb.dataset.state = 'idle';
    orb.innerHTML = '<span class="listia-orb-core" aria-hidden="true"><span class="listia-orb-star">✦</span></span>';
    orb.onclick = toggle;
    document.body.append(orb);
    setOrbState();
  }

  window.LISTIA_VOICE = {
    speak,
    stop: closeConversation,
    open: () => openConversation(true),
    close: closeConversation,
    execute: executeCommand,
    decide: decision,
    isActive: () => conversationActive,
    getLanguageTag: language => languageTag(language),
    getVoice: language => selected(languageTag(language)),
    getReadiness,
    refreshVoices,
    supported: Object.keys(LANGS),
    policy: POLICY,
    engine: 'native-zero-billable-v3',
    registerAction(name, matcher, handler) {
      if (typeof matcher !== 'function' || typeof handler !== 'function') return false;
      customActions.push({ name: String(name || ''), matcher, handler });
      return true;
    }
  };

  window.addEventListener('listia:languagechange', () => {
    if (recognition) recognition.lang = languageTag();
    refreshVoices();
    setOrbState();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject, { once: true });
  else inject();
})();