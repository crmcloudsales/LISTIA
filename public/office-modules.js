(() => {
  const cfg = window.LISTIA_CONFIG || {};
  const API_KEY = cfg.SUPABASE_PUBLISHABLE_KEY || cfg.SUPABASE_ANON_KEY || '';
  const SESSION_KEY = 'listia_session';

  const copy = {
    es: { leads:'Leads', leadsHint:'Prospectos y seguimiento', agenda:'Agenda', agendaHint:'Citas y reuniones', back:'Volver', leadsTitle:'Tus leads', leadsSub:'Prospectos que LISTIA está gestionando.', agendaTitle:'Tu agenda', agendaSub:'Citas conectadas a tu operación.', emptyLeads:'Todavía no hay leads.', emptyAgenda:'Todavía no hay citas.', new:'Nuevo', active:'Activo', qualified:'Calificado', appointment:'Cita', cold:'Frío', closed:'Cerrado', scheduled:'Programada', confirmed:'Confirmada', completed:'Completada', cancelled:'Cancelada', no_show:'No asistió', noContact:'Sin datos de contacto', whatsappAction:'WhatsApp', emailAction:'Correo' },
    en: { leads:'Leads', leadsHint:'Prospects and follow-up', agenda:'Schedule', agendaHint:'Appointments and meetings', back:'Back', leadsTitle:'Your leads', leadsSub:'Prospects LISTIA is managing.', agendaTitle:'Your schedule', agendaSub:'Appointments connected to your operation.', emptyLeads:'No leads yet.', emptyAgenda:'No appointments yet.', new:'New', active:'Active', qualified:'Qualified', appointment:'Appointment', cold:'Cold', closed:'Closed', scheduled:'Scheduled', confirmed:'Confirmed', completed:'Completed', cancelled:'Cancelled', no_show:'No show', noContact:'No contact details', whatsappAction:'WhatsApp', emailAction:'Email' },
    fr: { leads:'Leads', leadsHint:'Prospects et suivi', agenda:'Agenda', agendaHint:'Rendez-vous et réunions', back:'Retour', leadsTitle:'Vos leads', leadsSub:'Prospects gérés par LISTIA.', agendaTitle:'Votre agenda', agendaSub:'Rendez-vous liés à votre activité.', emptyLeads:'Aucun lead pour le moment.', emptyAgenda:'Aucun rendez-vous pour le moment.', new:'Nouveau', active:'Actif', qualified:'Qualifié', appointment:'Rendez-vous', cold:'Froid', closed:'Clôturé', scheduled:'Planifié', confirmed:'Confirmé', completed:'Terminé', cancelled:'Annulé', no_show:'Absent', noContact:'Aucune coordonnée', whatsappAction:'WhatsApp', emailAction:'E-mail' },
    it: { leads:'Lead', leadsHint:'Contatti e follow-up', agenda:'Agenda', agendaHint:'Appuntamenti e riunioni', back:'Indietro', leadsTitle:'I tuoi lead', leadsSub:'Contatti gestiti da LISTIA.', agendaTitle:'La tua agenda', agendaSub:'Appuntamenti collegati alla tua attività.', emptyLeads:'Nessun lead per ora.', emptyAgenda:'Nessun appuntamento per ora.', new:'Nuovo', active:'Attivo', qualified:'Qualificato', appointment:'Appuntamento', cold:'Freddo', closed:'Chiuso', scheduled:'Programmato', confirmed:'Confermato', completed:'Completato', cancelled:'Annullato', no_show:'Assente', noContact:'Nessun contatto', whatsappAction:'WhatsApp', emailAction:'Email' },
    'pt-BR': { leads:'Leads', leadsHint:'Prospectos e acompanhamento', agenda:'Agenda', agendaHint:'Compromissos e reuniões', back:'Voltar', leadsTitle:'Seus leads', leadsSub:'Prospectos gerenciados pela LISTIA.', agendaTitle:'Sua agenda', agendaSub:'Compromissos conectados à sua operação.', emptyLeads:'Ainda não há leads.', emptyAgenda:'Ainda não há compromissos.', new:'Novo', active:'Ativo', qualified:'Qualificado', appointment:'Compromisso', cold:'Frio', closed:'Fechado', scheduled:'Agendado', confirmed:'Confirmado', completed:'Concluído', cancelled:'Cancelado', no_show:'Não compareceu', noContact:'Sem contato', whatsappAction:'WhatsApp', emailAction:'E-mail' },
    de: { leads:'Leads', leadsHint:'Interessenten und Follow-up', agenda:'Agenda', agendaHint:'Termine und Meetings', back:'Zurück', leadsTitle:'Deine Leads', leadsSub:'Interessenten, die LISTIA verwaltet.', agendaTitle:'Deine Agenda', agendaSub:'Termine für deine Arbeit.', emptyLeads:'Noch keine Leads.', emptyAgenda:'Noch keine Termine.', new:'Neu', active:'Aktiv', qualified:'Qualifiziert', appointment:'Termin', cold:'Kalt', closed:'Abgeschlossen', scheduled:'Geplant', confirmed:'Bestätigt', completed:'Abgeschlossen', cancelled:'Abgesagt', no_show:'Nicht erschienen', noContact:'Keine Kontaktdaten', whatsappAction:'WhatsApp', emailAction:'E-Mail' },
    'ar-AE': { leads:'العملاء المحتملون', leadsHint:'العملاء والمتابعة', agenda:'الجدول', agendaHint:'المواعيد والاجتماعات', back:'رجوع', leadsTitle:'عملاؤك المحتملون', leadsSub:'العملاء المحتملون الذين تديرهم LISTIA.', agendaTitle:'جدولك', agendaSub:'المواعيد المرتبطة بعملك.', emptyLeads:'لا يوجد عملاء محتملون بعد.', emptyAgenda:'لا توجد مواعيد بعد.', new:'جديد', active:'نشط', qualified:'مؤهل', appointment:'موعد', cold:'بارد', closed:'مغلق', scheduled:'مجدول', confirmed:'مؤكد', completed:'مكتمل', cancelled:'ملغي', no_show:'لم يحضر', noContact:'لا توجد بيانات اتصال', whatsappAction:'واتساب', emailAction:'البريد' },
    ru: { leads:'Лиды', leadsHint:'Клиенты и сопровождение', agenda:'Расписание', agendaHint:'Встречи и звонки', back:'Назад', leadsTitle:'Ваши лиды', leadsSub:'Клиенты, которыми управляет LISTIA.', agendaTitle:'Ваше расписание', agendaSub:'Встречи, связанные с вашей работой.', emptyLeads:'Лидов пока нет.', emptyAgenda:'Встреч пока нет.', new:'Новый', active:'Активный', qualified:'Квалифицирован', appointment:'Встреча', cold:'Холодный', closed:'Закрыт', scheduled:'Запланирована', confirmed:'Подтверждена', completed:'Завершена', cancelled:'Отменена', no_show:'Не пришёл', noContact:'Нет контактов', whatsappAction:'WhatsApp', emailAction:'Email' },
    he: { leads:'לידים', leadsHint:'לקוחות ומעקב', agenda:'יומן', agendaHint:'פגישות ושיחות', back:'חזרה', leadsTitle:'הלידים שלך', leadsSub:'לקוחות פוטנציאליים ש-LISTIA מנהלת.', agendaTitle:'היומן שלך', agendaSub:'פגישות המחוברות לפעילות שלך.', emptyLeads:'אין עדיין לידים.', emptyAgenda:'אין עדיין פגישות.', new:'חדש', active:'פעיל', qualified:'מתאים', appointment:'פגישה', cold:'קר', closed:'סגור', scheduled:'מתוזמן', confirmed:'מאושר', completed:'הושלם', cancelled:'בוטל', no_show:'לא הגיע', noContact:'אין פרטי קשר', whatsappAction:'WhatsApp', emailAction:'אימייל' },
    'zh-CN': { leads:'线索', leadsHint:'客户与跟进', agenda:'日程', agendaHint:'预约与会议', back:'返回', leadsTitle:'你的线索', leadsSub:'LISTIA 正在管理的潜在客户。', agendaTitle:'你的日程', agendaSub:'与你的业务关联的预约。', emptyLeads:'暂无线索。', emptyAgenda:'暂无预约。', new:'新线索', active:'活跃', qualified:'已筛选', appointment:'预约', cold:'冷线索', closed:'已关闭', scheduled:'已安排', confirmed:'已确认', completed:'已完成', cancelled:'已取消', no_show:'未到场', noContact:'无联系方式', whatsappAction:'WhatsApp', emailAction:'邮箱' },
    ja: { leads:'リード', leadsHint:'見込み客とフォロー', agenda:'予定', agendaHint:'予約とミーティング', back:'戻る', leadsTitle:'リード', leadsSub:'LISTIAが管理している見込み客です。', agendaTitle:'予定', agendaSub:'業務に紐づく予約です。', emptyLeads:'リードはまだありません。', emptyAgenda:'予約はまだありません。', new:'新規', active:'進行中', qualified:'見込みあり', appointment:'予約', cold:'低温', closed:'完了', scheduled:'予定', confirmed:'確認済み', completed:'完了', cancelled:'キャンセル', no_show:'不参加', noContact:'連絡先なし', whatsappAction:'WhatsApp', emailAction:'メール' }
  };

  function locale() {
    const raw = String(window.LISTIA_I18N?.getLanguage?.() || localStorage.getItem('listia_language') || document.documentElement.lang || 'en').toLowerCase();
    if (raw.startsWith('es')) return 'es'; if (raw.startsWith('fr')) return 'fr'; if (raw.startsWith('it')) return 'it';
    if (raw.startsWith('pt')) return 'pt-BR'; if (raw.startsWith('de')) return 'de'; if (raw.startsWith('ar')) return 'ar-AE';
    if (raw.startsWith('ru')) return 'ru'; if (raw.startsWith('he')) return 'he'; if (raw.startsWith('zh')) return 'zh-CN'; if (raw.startsWith('ja')) return 'ja'; return 'en';
  }
  const c = () => copy[locale()] || copy.en;

  function readSession(){ try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null} }
  async function get(path,token){
    if(!cfg.SUPABASE_URL||!API_KEY||!token) return null;
    const r=await fetch(`${cfg.SUPABASE_URL}${path}`,{headers:{apikey:API_KEY,Authorization:`Bearer ${token}`},cache:'no-store'});
    if(!r.ok) return null; return r.json().catch(()=>null);
  }
  async function context(){
    const session=readSession(); if(!session?.access_token) return null;
    let userId=session.user?.id||null; if(!userId){const u=await get('/auth/v1/user',session.access_token);userId=u?.id||null}
    if(!userId)return null;
    const m=await get(`/rest/v1/organization_members?select=organization_id&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&limit=1`,session.access_token);
    const organizationId=Array.isArray(m)?m[0]?.organization_id:null; return organizationId?{token:session.access_token,organizationId}:null;
  }

  function show(id){ document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===id)); window.scrollTo({top:0,behavior:'instant'}); }

  function ensureStyles(){
    if(document.getElementById('listiaOfficeModuleStyles'))return;
    const s=document.createElement('style');s.id='listiaOfficeModuleStyles';s.textContent=`
      .listia-module-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
      .listia-module-button{display:grid;text-align:left;gap:3px;padding:14px;border-radius:16px}
      .listia-module-button small{opacity:.68;font-weight:500}
      .listia-module-screen{max-width:760px;margin:0 auto}.listia-module-list{display:grid;gap:10px;margin-top:16px}
      .listia-module-card{border:1px solid rgba(127,127,127,.18);border-radius:16px;padding:14px;display:grid;gap:8px}
      .listia-module-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.listia-module-head strong{font-size:1rem}.listia-module-head span{font-size:.72rem;opacity:.72}
      .listia-module-meta{display:flex;flex-wrap:wrap;gap:8px;font-size:.8rem;opacity:.78}.listia-module-message{font-size:.86rem;line-height:1.45;opacity:.82}
      .listia-module-contact-actions{display:flex;flex-wrap:wrap;gap:8px}.listia-module-contact-actions a{min-height:38px;display:inline-flex;align-items:center;padding:8px 12px;border-radius:11px;border:1px solid rgba(127,127,127,.2);font-size:.82rem;font-weight:750;text-decoration:none;color:inherit}
      .listia-module-empty{text-align:center;padding:30px 14px;opacity:.7}
      @media(max-width:520px){.listia-module-actions{grid-template-columns:1fr 1fr}.listia-module-button{padding:12px}}
    `;document.head.append(s);
  }

  function makeScreen(id,titleKey,subKey){
    if(document.getElementById(id))return;
    const section=document.createElement('section');section.className='screen';section.id=id;
    const panel=document.createElement('div');panel.className='panel inventory-panel listia-module-screen';
    const back=document.createElement('button');back.type='button';back.className='back';back.textContent='←';back.setAttribute('aria-label',c().back);back.addEventListener('click',()=>show('screen-ready'));
    const eyebrow=document.createElement('span');eyebrow.className='eyebrow';eyebrow.textContent='LISTIA · OFFICE';
    const h=document.createElement('h1');h.dataset.copyKey=titleKey;h.textContent=c()[titleKey];
    const sub=document.createElement('p');sub.className='sub';sub.dataset.copyKey=subKey;sub.textContent=c()[subKey];
    const list=document.createElement('div');list.className='listia-module-list';list.id=`${id}List`;
    panel.append(back,eyebrow,h,sub,list);section.append(panel);document.querySelector('main.main')?.append(section);
  }

  function ensureButtons(){
    const actions=document.querySelector('#screen-ready .office-actions');if(!actions||document.getElementById('listiaModuleActions'))return;
    const wrap=document.createElement('div');wrap.id='listiaModuleActions';wrap.className='listia-module-actions';
    const leads=document.createElement('button');leads.type='button';leads.className='secondary listia-module-button';
    leads.innerHTML=`<strong></strong><small></small>`;leads.querySelector('strong').textContent=c().leads;leads.querySelector('small').textContent=c().leadsHint;leads.dataset.module='leads';
    leads.addEventListener('click',()=>openLeads());
    const agenda=document.createElement('button');agenda.type='button';agenda.className='secondary listia-module-button';
    agenda.innerHTML=`<strong></strong><small></small>`;agenda.querySelector('strong').textContent=c().agenda;agenda.querySelector('small').textContent=c().agendaHint;agenda.dataset.module='agenda';
    agenda.addEventListener('click',()=>openAgenda());wrap.append(leads,agenda);actions.before(wrap);
  }

  function statusLabel(status){return c()[status]||String(status||'')}
  function dateLabel(value){try{return new Intl.DateTimeFormat(locale(),{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}catch{return String(value||'')}}

  async function openLeads(){
    show('screen-listia-leads');const list=document.getElementById('screen-listia-leadsList');if(!list)return;list.textContent='…';
    const ctx=await context();if(!ctx){list.textContent=c().emptyLeads;return}
    const rows=await get(`/rest/v1/leads?select=id,name,whatsapp,email,message,status,source,created_at&organization_id=eq.${encodeURIComponent(ctx.organizationId)}&order=created_at.desc&limit=100`,ctx.token);
    list.replaceChildren();const data=Array.isArray(rows)?rows:[];if(!data.length){const e=document.createElement('div');e.className='listia-module-empty';e.textContent=c().emptyLeads;list.append(e);return}
    data.forEach(lead=>{const card=document.createElement('article');card.className='listia-module-card';const head=document.createElement('div');head.className='listia-module-head';const name=document.createElement('strong');name.textContent=lead.name||'Lead';const status=document.createElement('span');status.textContent=statusLabel(lead.status);head.append(name,status);const meta=document.createElement('div');meta.className='listia-module-meta';const contacts=[lead.whatsapp,lead.email].filter(Boolean);meta.textContent=contacts.length?contacts.join(' · '):c().noContact;card.append(head,meta);if(lead.message){const m=document.createElement('div');m.className='listia-module-message';m.textContent=lead.message;card.append(m)}if(lead.whatsapp||lead.email){const actions=document.createElement('div');actions.className='listia-module-contact-actions';if(lead.whatsapp){const digits=String(lead.whatsapp).replace(/[^0-9]/g,'');if(digits){const a=document.createElement('a');a.href=`https://wa.me/${digits}`;a.target='_blank';a.rel='noopener noreferrer';a.textContent=c().whatsappAction;actions.append(a)}}if(lead.email){const a=document.createElement('a');a.href=`mailto:${encodeURIComponent(String(lead.email))}`;a.textContent=c().emailAction;actions.append(a)}if(actions.children.length)card.append(actions)}list.append(card)})
  }

  async function openAgenda(){
    show('screen-listia-agenda');const list=document.getElementById('screen-listia-agendaList');if(!list)return;list.textContent='…';
    const ctx=await context();if(!ctx){list.textContent=c().emptyAgenda;return}
    const rows=await get(`/rest/v1/appointments?select=id,title,starts_at,ends_at,meeting_type,status,external_event_id&organization_id=eq.${encodeURIComponent(ctx.organizationId)}&order=starts_at.asc&limit=100`,ctx.token);
    list.replaceChildren();const data=Array.isArray(rows)?rows:[];if(!data.length){const e=document.createElement('div');e.className='listia-module-empty';e.textContent=c().emptyAgenda;list.append(e);return}
    data.forEach(appt=>{const card=document.createElement('article');card.className='listia-module-card';const head=document.createElement('div');head.className='listia-module-head';const title=document.createElement('strong');title.textContent=appt.title||c().appointment;const status=document.createElement('span');status.textContent=statusLabel(appt.status);head.append(title,status);const meta=document.createElement('div');meta.className='listia-module-meta';meta.textContent=[dateLabel(appt.starts_at),appt.meeting_type].filter(Boolean).join(' · ');card.append(head,meta);list.append(card)})
  }

  function syncCopy(){
    document.querySelectorAll('[data-copy-key]').forEach(el=>{const key=el.dataset.copyKey;if(key)el.textContent=c()[key]||''});
    document.querySelectorAll('#listiaModuleActions [data-module]').forEach(btn=>{const key=btn.dataset.module;const strong=btn.querySelector('strong');const small=btn.querySelector('small');if(key==='leads'){strong.textContent=c().leads;small.textContent=c().leadsHint}else{strong.textContent=c().agenda;small.textContent=c().agendaHint}});
  }

  function boot(){ensureStyles();makeScreen('screen-listia-leads','leadsTitle','leadsSub');makeScreen('screen-listia-agenda','agendaTitle','agendaSub');ensureButtons();window.addEventListener('listia:languagechange',syncCopy)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
