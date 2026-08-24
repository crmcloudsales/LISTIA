(() => {
  const synth=window.speechSynthesis;
  const LANGS={es:'es-MX',en:'en-US',fr:'fr-FR',it:'it-IT','pt-BR':'pt-BR',de:'de-DE','ar-AE':'ar-AE',ru:'ru-RU',he:'he-IL','zh-CN':'zh-CN',ja:'ja-JP'};
  const normalize=v=>String(v||'').replace('_','-').toLowerCase();
  const current=()=>window.LISTIA_I18N?.getLanguage?.()||document.documentElement.dataset.listiaLanguage||'en';
  function candidates(tag){if(!synth)return[];const exact=normalize(tag),family=exact.split('-')[0];return synth.getVoices().filter(v=>{const x=normalize(v.lang);return x===exact||x.split('-')[0]===family}).sort((a,b)=>Number(normalize(b.lang)===exact)-Number(normalize(a.lang)===exact)||Number(b.localService)-Number(a.localService));}
  function selected(tag){const list=candidates(tag);let saved=null;try{saved=JSON.parse(localStorage.getItem(`listia_voice_${tag}`)||'null')}catch{}return list.find(v=>saved&&v.name===saved.name&&v.lang===saved.lang)||list[0]||null;}
  function speak(text,language=current()){if(!synth||!String(text||'').trim())return false;const tag=LANGS[language]||LANGS.en,voice=selected(tag);synth.cancel();const u=new SpeechSynthesisUtterance(String(text).trim());u.lang=tag;if(voice)u.voice=voice;u.rate=.96;u.pitch=1;u.volume=1;synth.speak(u);return true;}
  function stop(){synth?.cancel();}
  function screenText(){const screen=document.querySelector('.screen.active')||document.querySelector('main');if(!screen)return'';const parts=[];const h=screen.querySelector('h1');const sub=screen.querySelector('.sub,.context-line,.discovery-summary');if(h?.textContent)parts.push(h.textContent.trim());if(sub?.textContent)parts.push(sub.textContent.trim());return parts.join('. ');}
  function inject(){if(document.getElementById('listiaVoiceButton')||!synth)return;const b=document.createElement('button');b.id='listiaVoiceButton';b.type='button';b.setAttribute('aria-label','LISTIA Voice');b.title='LISTIA Voice';b.innerHTML='🔊';b.style.cssText='position:fixed;right:16px;bottom:16px;z-index:80;width:44px;height:44px;border:1px solid rgba(255,255,255,.18);border-radius:50%;background:#6D35F2;color:#fff;font-size:18px;display:grid;place-items:center;box-shadow:0 10px 28px rgba(0,0,0,.25);cursor:pointer';b.addEventListener('click',()=>speak(screenText()));document.body.append(b);}
  window.LISTIA_VOICE={speak,stop,getLanguageTag:l=>LANGS[l||current()]||LANGS.en,getVoice:l=>selected(LANGS[l||current()]||LANGS.en),supported:Object.keys(LANGS)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject,{once:true});else inject();
})();
