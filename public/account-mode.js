(() => {
  'use strict';
  const cfg=window.LISTIA_CONFIG||{};
  const API_KEY=cfg.SUPABASE_PUBLISHABLE_KEY||cfg.SUPABASE_ANON_KEY||'';
  const SESSION_KEY='listia_session';
  const PENDING_KEY='listia_pending_account_mode';
  let mode='guest';

  const readSession=()=>{try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}};
  async function api(path,{method='GET',token,body}={}){
    const headers={apikey:API_KEY}; if(token)headers.Authorization=`Bearer ${token}`; if(body!==undefined)headers['Content-Type']='application/json';
    const r=await fetch(`${cfg.SUPABASE_URL}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
    if(!r.ok)return null; return r.status===204?{}:r.json().catch(()=>({}));
  }
  function setMode(next){
    mode=next||'guest'; document.documentElement.dataset.listiaAccountMode=mode;
    document.body?.classList.toggle('listia-professional',mode==='professional');
    document.body?.classList.toggle('listia-seeker',mode==='seeker');
    window.dispatchEvent(new CustomEvent('listia:accountmode',{detail:{mode}}));
    ensureChatMode();
  }
  function injectSignupChoice(){
    const form=document.getElementById('signupForm'); if(!form||document.getElementById('listiaAccountModeChoice'))return;
    const box=document.createElement('fieldset'); box.id='listiaAccountModeChoice'; box.className='account-mode-choice';
    box.innerHTML=`<legend>¿Cómo quieres usar LISTIA?</legend>
      <label class="account-mode-option selected"><input type="radio" name="listiaAccountMode" value="professional" checked><span><strong>Trabajar con LISTIA</strong><small>Publicar propiedades y gestionar mi operación.</small></span></label>
      <label class="account-mode-option"><input type="radio" name="listiaAccountMode" value="seeker"><span><strong>Buscar propiedades</strong><small>Cuenta gratuita para siempre. Buscar, guardar y contactar inmobiliarios.</small></span></label>`;
    const terms=document.getElementById('termsCheck')?.closest('label'); form.insertBefore(box,terms||form.lastElementChild);
    box.addEventListener('change',()=>{const chosen=box.querySelector('input:checked')?.value||'professional';localStorage.setItem(PENDING_KEY,chosen);box.querySelectorAll('.account-mode-option').forEach(x=>x.classList.toggle('selected',x.querySelector('input')?.checked));});
    localStorage.setItem(PENDING_KEY,box.querySelector('input:checked')?.value||'professional');
  }
  async function resolveMode(){
    const session=readSession();
    if(!session?.access_token){setMode('guest');return}
    let user=session.user;
    if(!user?.id)user=await api('/auth/v1/user',{token:session.access_token});
    if(!user?.id){setMode('guest');return}
    const pending=localStorage.getItem(PENDING_KEY);
    if(pending==='seeker'||pending==='professional'){
      await api(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`,{method:'PATCH',token:session.access_token,body:{account_mode:pending}});
      localStorage.removeItem(PENDING_KEY);
    }
    const rows=await api(`/rest/v1/profiles?select=account_mode&id=eq.${encodeURIComponent(user.id)}&limit=1`,{token:session.access_token});
    const resolved=Array.isArray(rows)&&rows[0]?.account_mode?rows[0].account_mode:'professional'; setMode(resolved);
    if(resolved==='seeker')setTimeout(routeSeeker,80);
  }
  function routeSeeker(){
    const active=document.querySelector('.screen.active'); if(!active)return;
    if(['screen-login','screen-signup','screen-forgot','screen-reset','screen-marketplace','screen-marketplace-detail'].includes(active.id))return;
    const entry=document.getElementById('marketplaceEntry'); if(entry)entry.click();
  }
  function ensureChatMode(){
    const panel=document.querySelector('.listia-voice-panel'); if(!panel)return;
    const marketplaceActive=!!document.getElementById('screen-marketplace')?.classList.contains('active')||!!document.getElementById('screen-marketplace-detail')?.classList.contains('active');
    const allowChat=mode==='seeker'||(mode==='guest'&&marketplaceActive);
    panel.classList.toggle('voice-only',mode==='professional'); panel.classList.toggle('voice-chat',allowChat);
    let form=panel.querySelector('.listia-chat-form');
    if(allowChat&&!form){
      form=document.createElement('form');form.className='listia-chat-form';form.innerHTML='<input class="listia-chat-input" type="text" maxlength="500" placeholder="Escribe lo que buscas…" aria-label="Escribe a LISTIA"><button type="submit">Enviar</button>';
      panel.append(form);
      form.addEventListener('submit',e=>{e.preventDefault();const input=form.querySelector('input');const text=input.value.trim();if(!text)return;const transcript=panel.querySelector('.listia-voice-transcript');if(transcript){const row=document.createElement('div');row.className='listia-voice-turn user';row.textContent=text;transcript.append(row);transcript.scrollTop=transcript.scrollHeight}input.value='';window.LISTIA_VOICE?.execute?.(text);});
    } else if(form){form.hidden=!allowChat}
  }
  function boot(){
    injectSignupChoice(); resolveMode();
    const observer=new MutationObserver(()=>{injectSignupChoice();ensureChatMode();if(mode==='seeker')routeSeeker()});
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    window.addEventListener('focus',resolveMode); window.addEventListener('storage',resolveMode);
  }
  window.LISTIA_ACCOUNT={getMode:()=>mode,refresh:resolveMode};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();