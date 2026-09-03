(()=>{
'use strict';
if(window.__LISTIA_OAUTH_AUTH__)return;
window.__LISTIA_OAUTH_AUTH__=true;

const CFG=window.LISTIA_CONFIG||{};
const CANONICAL_REDIRECT='https://app.listiaapp.com/';
const PROVIDERS={
  google:{provider:'google',label:'Google'},
  microsoft:{provider:'azure',label:'Microsoft',scopes:'email'}
};
const COPY={
  es:{continueWith:'Continuar con',divider:'o continúa con correo electrónico',terms:'Al continuar aceptas los Términos y el Aviso de privacidad.',error:'No se pudo iniciar sesión con este proveedor.'},
  en:{continueWith:'Continue with',divider:'or continue with email',terms:'By continuing you agree to the Terms and Privacy Notice.',error:'Could not start sign-in with this provider.'},
  fr:{continueWith:'Continuer avec',divider:'ou continuer avec votre e-mail',terms:'En continuant, vous acceptez les Conditions et l’Avis de confidentialité.',error:'Impossible de démarrer la connexion avec ce fournisseur.'},
  it:{continueWith:'Continua con',divider:'oppure continua con e-mail',terms:'Continuando accetti i Termini e l’Informativa sulla privacy.',error:'Impossibile avviare l’accesso con questo provider.'},
  'pt-BR':{continueWith:'Continuar com',divider:'ou continue com e-mail',terms:'Ao continuar, você aceita os Termos e o Aviso de Privacidade.',error:'Não foi possível iniciar o acesso com este provedor.'},
  de:{continueWith:'Weiter mit',divider:'oder mit E-Mail fortfahren',terms:'Mit dem Fortfahren akzeptierst du die Bedingungen und den Datenschutzhinweis.',error:'Die Anmeldung mit diesem Anbieter konnte nicht gestartet werden.'},
  'ar-AE':{continueWith:'المتابعة باستخدام',divider:'أو المتابعة بالبريد الإلكتروني',terms:'بالمتابعة، فإنك توافق على الشروط وإشعار الخصوصية.',error:'تعذر بدء تسجيل الدخول باستخدام هذا المزوّد.'},
  ru:{continueWith:'Продолжить с',divider:'или продолжить с электронной почтой',terms:'Продолжая, вы принимаете Условия и Уведомление о конфиденциальности.',error:'Не удалось начать вход через этого провайдера.'},
  he:{continueWith:'המשך עם',divider:'או המשך עם דוא״ל',terms:'בהמשך, הנך מסכים לתנאים ולהודעת הפרטיות.',error:'לא ניתן להתחיל התחברות עם ספק זה.'},
  'zh-CN':{continueWith:'使用以下方式继续',divider:'或使用电子邮件继续',terms:'继续即表示你同意条款和隐私声明。',error:'无法使用此提供商开始登录。'},
  ja:{continueWith:'次で続行',divider:'またはメールで続行',terms:'続行すると、利用規約とプライバシー通知に同意したものとみなされます。',error:'このプロバイダーでログインを開始できませんでした。'}
};

function language(){
  const value=window.LISTIA_I18N?.getLanguage?.()||document.documentElement.dataset.listiaLanguage||document.documentElement.lang||new URLSearchParams(location.search).get('lang')||'es';
  if(COPY[value])return value;
  const base=String(value).split('-')[0];
  if(base==='pt')return 'pt-BR';
  if(base==='ar')return 'ar-AE';
  if(base==='zh')return 'zh-CN';
  return COPY[base]?base:'en';
}
function text(){return COPY[language()]||COPY.en}
function icon(kind){
  if(kind==='google')return '<svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.24-.2-1.79H12v3.4h5.52a4.72 4.72 0 0 1-2.05 3.1v2.2h3.31c1.94-1.78 3.06-4.4 3.06-7.51z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.89 6.61-2.42l-3.31-2.2c-.92.61-2.09.98-3.3.98-2.6 0-4.8-1.76-5.59-4.12H2.99v2.27A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.41 14.24A6.02 6.02 0 0 1 6.1 12c0-.78.14-1.54.31-2.24V7.49H2.99A10 10 0 0 0 2 12c0 1.61.38 3.14.99 4.51l3.42-2.27z"/><path fill="#EA4335" d="M12 5.64c1.47 0 2.78.5 3.82 1.49l2.86-2.86A9.65 9.65 0 0 0 12 2a10 10 0 0 0-9.01 5.49l3.42 2.27C7.2 7.4 9.4 5.64 12 5.64z"/></svg>';
  return '<svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#F25022" d="M2 2h9.4v9.4H2z"/><path fill="#7FBA00" d="M12.6 2H22v9.4h-9.4z"/><path fill="#00A4EF" d="M2 12.6h9.4V22H2z"/><path fill="#FFB900" d="M12.6 12.6H22V22h-9.4z"/></svg>';
}
function authorize(kind){
  const item=PROVIDERS[kind];
  if(!item||!CFG.SUPABASE_URL)return;
  try{
    sessionStorage.setItem('listia_oauth_provider',kind);
    sessionStorage.setItem('listia_oauth_started_at',String(Date.now()));
    const url=new URL(`${CFG.SUPABASE_URL}/auth/v1/authorize`);
    url.searchParams.set('provider',item.provider);
    url.searchParams.set('redirect_to',CANONICAL_REDIRECT);
    if(item.scopes)url.searchParams.set('scopes',item.scopes);
    location.assign(url.toString());
  }catch(error){
    console.error('LISTIA OAuth start failed',error);
    const toast=document.getElementById('toast');
    if(toast){toast.textContent=text().error;toast.className='toast error';toast.hidden=false}
  }
}
function style(){
  if(document.getElementById('listiaOauthStyles'))return;
  const el=document.createElement('style');
  el.id='listiaOauthStyles';
  el.textContent='.listia-oauth{display:grid;gap:9px;margin:18px 0 16px}.listia-oauth-btn{width:100%;min-height:48px;display:flex;align-items:center;justify-content:center;gap:10px;padding:0 16px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(255,255,255,.055);color:inherit;font:700 14px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer;transition:transform .14s ease,border-color .14s ease,background .14s ease}.listia-oauth-btn:hover{background:rgba(255,255,255,.085);border-color:rgba(255,255,255,.23)}.listia-oauth-btn:active{transform:scale(.985)}.listia-oauth-btn svg{width:20px;height:20px;flex:0 0 20px}.listia-oauth-divider{display:flex;align-items:center;gap:10px;margin:2px 0 14px;color:rgba(255,255,255,.5);font-size:11px;text-align:center}.listia-oauth-divider:before,.listia-oauth-divider:after{content:"";height:1px;flex:1;background:rgba(255,255,255,.1)}.listia-oauth-terms{margin:2px 4px 0;color:rgba(255,255,255,.48);font-size:10px;line-height:1.45;text-align:center}.listia-oauth-terms a{color:inherit;text-decoration:underline;text-underline-offset:2px}@media(max-width:520px){.listia-oauth-btn{min-height:50px;border-radius:13px}}';
  document.head.appendChild(el);
}
function group(){
  const c=text(),wrap=document.createElement('div');
  wrap.className='listia-oauth';wrap.dataset.listiaOauth='1';
  for(const kind of ['google','microsoft']){
    const item=PROVIDERS[kind],btn=document.createElement('button');
    btn.type='button';btn.className='listia-oauth-btn';btn.dataset.oauthProvider=kind;
    btn.setAttribute('aria-label',`${c.continueWith} ${item.label}`);
    btn.innerHTML=`${icon(kind)}<span>${c.continueWith} ${item.label}</span>`;
    btn.addEventListener('click',()=>authorize(kind));wrap.appendChild(btn);
  }
  const note=document.createElement('p');note.className='listia-oauth-terms';
  note.innerHTML=`${c.terms.replace('Términos','<a href="/terms.html">Términos</a>').replace('Aviso de privacidad','<a href="/privacy.html">Aviso de privacidad</a>')}`;
  wrap.appendChild(note);return wrap;
}
function divider(){const d=document.createElement('div');d.className='listia-oauth-divider';d.dataset.listiaOauthDivider='1';d.textContent=text().divider;return d}
function inject(){
  style();
  for(const id of ['screen-login','screen-signup']){
    const screen=document.getElementById(id),panel=screen?.querySelector('.auth-panel'),form=panel?.querySelector('form');
    if(!panel||!form)continue;
    panel.querySelector('[data-listia-oauth]')?.remove();panel.querySelector('[data-listia-oauth-divider]')?.remove();
    form.before(group(),divider());
  }
}
function handleError(){
  const hash=new URLSearchParams(location.hash.replace(/^#/,''));
  const query=new URLSearchParams(location.search);
  const error=hash.get('error_description')||query.get('error_description')||hash.get('error')||query.get('error');
  if(!error)return;
  console.warn('LISTIA OAuth callback error',error);
  const toast=document.getElementById('toast');
  if(toast){toast.textContent=text().error;toast.className='toast error';toast.hidden=false}
}
function boot(){inject();handleError()}
window.LISTIA_OAUTH_AUTH=Object.freeze({start:authorize,refresh:inject});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('listia:languagechange',inject);
})();
