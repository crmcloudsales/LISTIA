(()=>{
'use strict';
if(window.__LISTIA_AUTH_SECURITY__)return;
window.__LISTIA_AUTH_SECURITY__=true;

const MIN_LENGTH=12;
const MAX_LENGTH=72;
const COMMON=new Set([
  'password','password1','password123','password1234','contraseña','contrasena','contrasena123',
  '123456789012','1234567890','qwerty123456','qwertyuiop','asdfghjkl','letmein123456',
  'admin123456','welcome123456','bienvenido123','iloveyou123','listia123456','listiaapp123'
].map(v=>compact(v)));
const SEQUENCES=['0123456789','1234567890','9876543210','abcdefghijklmnopqrstuvwxyz','zyxwvutsrqponmlkjihgfedcba','qwertyuiop','poiuytrewq','asdfghjkl','lkjhgfdsa','zxcvbnm','mnbvcxz'];
const COPY={
  es:{weak:'Usa una contraseña más fuerte: mínimo 12 caracteres y evita palabras comunes, secuencias o datos personales.',hint:'12+ caracteres; evita contraseñas comunes o predecibles.'},
  en:{weak:'Use a stronger password: at least 12 characters and avoid common words, sequences, or personal details.',hint:'12+ characters; avoid common or predictable passwords.'},
  fr:{weak:'Utilisez un mot de passe plus sûr : au moins 12 caractères, sans mots courants, suites ni données personnelles.',hint:'12+ caractères ; évitez les mots de passe courants ou prévisibles.'},
  it:{weak:'Usa una password più sicura: almeno 12 caratteri, evitando parole comuni, sequenze o dati personali.',hint:'12+ caratteri; evita password comuni o prevedibili.'},
  'pt-BR':{weak:'Use uma senha mais forte: pelo menos 12 caracteres e evite palavras comuns, sequências ou dados pessoais.',hint:'12+ caracteres; evite senhas comuns ou previsíveis.'},
  de:{weak:'Verwende ein stärkeres Passwort: mindestens 12 Zeichen und keine häufigen Wörter, Folgen oder persönlichen Daten.',hint:'12+ Zeichen; häufige oder vorhersehbare Passwörter vermeiden.'},
  'ar-AE':{weak:'استخدم كلمة مرور أقوى: 12 حرفًا على الأقل وتجنب الكلمات الشائعة أو التسلسلات أو البيانات الشخصية.',hint:'12+ حرفًا؛ تجنب كلمات المرور الشائعة أو المتوقعة.'},
  ru:{weak:'Используйте более надежный пароль: не менее 12 символов, без распространенных слов, последовательностей и личных данных.',hint:'12+ символов; избегайте распространенных и предсказуемых паролей.'},
  he:{weak:'יש להשתמש בסיסמה חזקה יותר: לפחות 12 תווים, ללא מילים נפוצות, רצפים או פרטים אישיים.',hint:'12+ תווים; הימנעו מסיסמאות נפוצות או צפויות.'},
  'zh-CN':{weak:'请使用更强的密码：至少 12 个字符，并避免常见词、连续字符或个人信息。',hint:'至少 12 个字符；避免常见或容易猜到的密码。'},
  ja:{weak:'より強いパスワードを使用してください。12文字以上にし、一般的な語句・連続文字・個人情報は避けてください。',hint:'12文字以上。一般的または推測しやすいパスワードは避けてください。'}
};

function compact(v){return String(v||'').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'')}
function words(v){return String(v||'').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').split(/[^a-z0-9]+/).map(compact).filter(Boolean)}
function language(){const raw=window.LISTIA_I18N?.getLanguage?.()||document.documentElement.dataset.listiaLanguage||document.documentElement.lang||'es';if(COPY[raw])return raw;const base=String(raw).split('-')[0];if(base==='pt')return'pt-BR';if(base==='ar')return'ar-AE';if(base==='zh')return'zh-CN';return COPY[base]?base:'en'}
function copy(){return COPY[language()]||COPY.en}
function personalTokens(context={}){const emailLocal=String(context.email||'').split('@')[0];return [...words(context.name),...words(emailLocal)].filter(v=>v.length>=4)}
function hasSequence(flat){for(const seq of SEQUENCES){for(let i=0;i<=seq.length-6;i++){if(flat.includes(seq.slice(i,i+6)))return true}}return false}
function evaluate(password,context={}){
  const raw=String(password||''),flat=compact(raw);
  if(raw.length<MIN_LENGTH)return{ok:false,reason:'too_short'};
  if(raw.length>MAX_LENGTH)return{ok:false,reason:'too_long'};
  if(new Set(raw).size<6)return{ok:false,reason:'low_variety'};
  if(/(.)\1{5,}/i.test(raw))return{ok:false,reason:'repeated'};
  if(COMMON.has(flat))return{ok:false,reason:'common'};
  if(hasSequence(flat))return{ok:false,reason:'sequence'};
  for(const token of personalTokens(context)){
    const i=flat.indexOf(token);
    if(i>=0&&flat.length-token.length<6)return{ok:false,reason:'personal'};
  }
  return{ok:true,reason:'ok'};
}
function showWeak(){const toast=document.getElementById('toast');if(!toast)return;toast.textContent=copy().weak;toast.className='toast error';toast.hidden=false;clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>{toast.hidden=true},5200)}
function hardenInputs(){
  for(const id of ['signupPassword','resetPassword','resetPasswordConfirm']){
    const input=document.getElementById(id);if(!input)continue;input.minLength=MIN_LENGTH;input.maxLength=MAX_LENGTH;input.setAttribute('aria-describedby',`${id}SecurityHint`);
    let hint=document.getElementById(`${id}SecurityHint`);if(!hint){hint=document.createElement('small');hint.id=`${id}SecurityHint`;hint.className='listia-password-security-hint';input.closest('.password-wrap')?.after(hint)||input.after(hint)}
    hint.textContent=copy().hint;
  }
}
function intercept(event){
  const form=event.target;if(!(form instanceof HTMLFormElement))return;
  if(form.id!=='signupForm'&&form.id!=='resetForm')return;
  const input=document.getElementById(form.id==='signupForm'?'signupPassword':'resetPassword');if(!input)return;
  const context=form.id==='signupForm'?{name:document.getElementById('signupName')?.value||'',email:document.getElementById('signupEmail')?.value||''}:{};
  const result=evaluate(input.value,context);if(result.ok)return;
  event.preventDefault();event.stopImmediatePropagation();showWeak();input.focus();
}
function init(){hardenInputs();document.addEventListener('submit',intercept,true)}
window.LISTIA_AUTH_SECURITY=Object.freeze({MIN_LENGTH,MAX_LENGTH,evaluate});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.addEventListener('listia:languagechange',hardenInputs);
})();
