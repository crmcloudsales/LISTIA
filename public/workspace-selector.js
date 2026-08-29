(() => {
  'use strict';

  const COPY = {
    es:{title:'Espacio de trabajo',body:'Elige con qué organización quieres trabajar.',owner:'Propietario',admin:'Administrador',member:'Miembro',switching:'Cambiando…',error:'No pudimos cambiar de organización.'},
    en:{title:'Workspace',body:'Choose which organization you want to work with.',owner:'Owner',admin:'Admin',member:'Member',switching:'Switching…',error:'We could not switch organizations.'},
    fr:{title:'Espace de travail',body:'Choisissez l’organisation avec laquelle vous souhaitez travailler.',owner:'Propriétaire',admin:'Administrateur',member:'Membre',switching:'Changement…',error:'Impossible de changer d’organisation.'},
    it:{title:'Spazio di lavoro',body:'Scegli l’organizzazione con cui vuoi lavorare.',owner:'Proprietario',admin:'Amministratore',member:'Membro',switching:'Cambio…',error:'Impossibile cambiare organizzazione.'},
    'pt-BR':{title:'Espaço de trabalho',body:'Escolha a organização com a qual deseja trabalhar.',owner:'Proprietário',admin:'Administrador',member:'Membro',switching:'Alterando…',error:'Não foi possível trocar de organização.'},
    de:{title:'Arbeitsbereich',body:'Wähle die Organisation, mit der du arbeiten möchtest.',owner:'Inhaber',admin:'Administrator',member:'Mitglied',switching:'Wechsel…',error:'Organisation konnte nicht gewechselt werden.'},
    'ar-AE':{title:'مساحة العمل',body:'اختر المؤسسة التي تريد العمل معها.',owner:'مالك',admin:'مسؤول',member:'عضو',switching:'جارٍ التبديل…',error:'تعذر تبديل المؤسسة.'},
    ru:{title:'Рабочее пространство',body:'Выберите организацию, с которой хотите работать.',owner:'Владелец',admin:'Администратор',member:'Участник',switching:'Переключение…',error:'Не удалось сменить организацию.'},
    he:{title:'סביבת עבודה',body:'בחרו את הארגון שאיתו תרצו לעבוד.',owner:'בעלים',admin:'מנהל',member:'חבר',switching:'מחליף…',error:'לא הצלחנו להחליף ארגון.'},
    'zh-CN':{title:'工作空间',body:'选择你要使用的组织。',owner:'所有者',admin:'管理员',member:'成员',switching:'正在切换…',error:'无法切换组织。'},
    ja:{title:'ワークスペース',body:'作業する組織を選択してください。',owner:'オーナー',admin:'管理者',member:'メンバー',switching:'切り替え中…',error:'組織を切り替えられませんでした。'}
  };

  function locale(){
    const raw=String(window.LISTIA_I18N?.getLanguage?.()||localStorage.getItem('listia_language')||document.documentElement.lang||'en').toLowerCase();
    if(raw.startsWith('pt'))return'pt-BR'; if(raw.startsWith('ar'))return'ar-AE'; if(raw.startsWith('zh'))return'zh-CN';
    if(raw.startsWith('es'))return'es'; if(raw.startsWith('fr'))return'fr'; if(raw.startsWith('it'))return'it'; if(raw.startsWith('de'))return'de';
    if(raw.startsWith('ru'))return'ru'; if(raw.startsWith('he'))return'he'; if(raw.startsWith('ja'))return'ja'; return'en';
  }
  const text=()=>COPY[locale()]||COPY.en;
  const role=(value,c)=>value==='owner'?c.owner:value==='admin'?c.admin:c.member;

  function accountBody(){return document.querySelector('#screen-account-v2 .listia-account-body')}
  function remove(){document.getElementById('listiaWorkspaceSelectorCard')?.remove()}

  async function render(){
    const api=window.LISTIA_WORKSPACE;
    if(!api?.getContext){remove();return}
    let context;
    try{context=await api.getContext({force:true})}catch{remove();return}
    const workspaces=Array.isArray(context?.workspaces)?context.workspaces:[];
    const body=accountBody();
    if(!body||workspaces.length<2){remove();return}

    const c=text();
    let card=document.getElementById('listiaWorkspaceSelectorCard');
    if(!card){card=document.createElement('div');card.id='listiaWorkspaceSelectorCard';card.className='listia-account-card';body.prepend(card)}
    const activeId=context.active_organization_id||context.active?.organization_id||'';
    card.innerHTML=`<strong>${c.title}</strong><span>${c.body}</span><select id="listiaWorkspaceSelector" aria-label="${c.title}">${workspaces.map(item=>{const id=String(item.organization_id||'');const name=String(item.name||id).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));const label=role(item.role,c);return `<option value="${id}" ${id===activeId?'selected':''}>${name} · ${label}</option>`}).join('')}</select><small id="listiaWorkspaceSelectorStatus"></small>`;
    const select=card.querySelector('#listiaWorkspaceSelector'),status=card.querySelector('#listiaWorkspaceSelectorStatus');
    select.addEventListener('change',async()=>{
      const next=select.value;
      if(!next||next===activeId)return;
      select.disabled=true; status.textContent=c.switching;
      try{await api.setActiveWorkspace(next);location.reload()}catch(error){console.warn('LISTIA workspace switch',error);select.value=activeId;select.disabled=false;status.textContent=c.error}
    });
  }

  function active(){return document.getElementById('screen-account-v2')?.classList.contains('active')}
  function schedule(){setTimeout(()=>{if(active())render()},80)}
  function boot(){
    const screen=document.getElementById('screen-account-v2');
    if(screen)new MutationObserver(()=>{if(active())render()}).observe(screen,{attributes:true,attributeFilter:['class']});
    window.addEventListener('listia:languagechange',schedule);
    window.addEventListener('listia:workspacechange',schedule);
    if(active())render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.LISTIA_WORKSPACE_SELECTOR={refresh:render};
})();
