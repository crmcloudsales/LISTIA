(()=>{
'use strict';
if(window.__LISTIA_ADVANCED_BOOTSTRAP__)return;
window.__LISTIA_ADVANCED_BOOTSTRAP__=true;

const CSS=[
  '/readability.css?v=3','/pwa-components.css?v=1','/account-marketplace.css?v=1','/marketplace.css?v=7','/marketplace-feed.css?v=1','/marketplace-experience-v8.css?v=3','/marketplace-saved.css?v=2','/marketplace-qroo-map.css?v=1','/marketplace-pro-mobile.css?v=1','/contact-engine.css?v=1','/app-shell-v2.css?v=1','/listings-v2.css?v=3','/ai-chat.css?v=1','/control-center.css?v=1','/property-complete.css?v=1','/pwa-polish.css?v=1','/pwa-polish-hotfix.css?v=2','/premium-shell.css?v=1','/pwa-final-hotfix.css?v=1','/mobile-ui-repair.css?v=1','/website-status-repair.css?v=1','/website-language-settings.css?v=1','/account-edit.css?v=1','/lead-workspace.css?v=1'
];

const JS=[
  '/global-locales.js?v=2','/japanese-locale.js?v=1','/legal-consent.js?v=1','/workspace-context.js?v=1','/workspace-selector.js?v=1','/pricing-hold.js?v=1','/runtime.js?v=3','/analytics.js?v=2','/affiliate-attribution.js?v=1','/property-status.js?v=3','/property-complete.js?v=1','/draft-actions.js?v=4','/property-complete-integration.js?v=3','/property-processing-auto.js?v=2','/office-modules.js?v=3','/lead-stage-actions.js?v=2','/lead-workspace.js?v=2','/appointment-actions.js?v=3','/contact-engine.js?v=2','/listia-voice.js?v=7','/marketplace-assistant.js?v=2','/marketplace-gateway-v9.js?v=1','/marketplace-feed-enhancements.js?v=4','/marketplace-experience-v8.js?v=3','/marketplace.js?v=10','/marketplace-demand-events.js?v=2','/marketplace-qroo-map.js?v=2','/marketplace-interest-gateway.js?v=1','/marketplace-saved.js?v=3','/marketplace-alerts.js?v=1','/marketplace-saved-manager.js?v=2','/marketplace-push.js?v=1','/marketplace-notification-center.js?v=1','/account-mode.js?v=3','/account-mode-auth-sync.js?v=1','/marketplace-auth-bridge.js?v=2','/pwa-fixes.js?v=2','/app-shell-v2.js?v=2','/listing-workspace.js?v=2','/listings-v2.js?v=6','/external-domain-guard.js?v=2','/website-status.js?v=3','/website-language-settings.js?v=2','/website-provision-bridge.js?v=2','/managed-site-health.js?v=2','/developments.js?v=3','/development-property-bridge.js?v=5','/account-center.js?v=3','/account-resilience.js?v=2','/account-edit.js?v=2','/assistant-intelligence.js?v=5','/ai-chat.js?v=3','/control-center.js?v=5','/control-health.js?v=1','/control-attention.js?v=3','/ui-state-labels.js?v=2','/onboarding-hardening.js?v=1','/premium-shell.js?v=2'
];

const pathOf=u=>{try{return new URL(u,location.href).pathname}catch{return String(u).split('?')[0]}};
const hasStyle=u=>[...document.querySelectorAll('link[rel="stylesheet"]')].some(n=>pathOf(n.href)===pathOf(u));
const hasScript=u=>[...document.scripts].some(n=>pathOf(n.src)===pathOf(u));

for(const href of CSS){
  if(hasStyle(href))continue;
  const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.append(l);
}

function loadScript(src){
  if(hasScript(src))return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script');s.src=src;s.async=false;s.defer=false;
    s.onload=()=>resolve();
    s.onerror=()=>reject(new Error(`LISTIA module failed: ${src}`));
    document.head.append(s);
  });
}

(async()=>{
  const failures=[];
  for(const src of JS){
    try{await loadScript(src)}catch(error){failures.push(src);console.error(error)}
  }
  window.LISTIA_BOOTSTRAP_STATE={ready:failures.length===0,failures,loadedAt:new Date().toISOString()};
  window.dispatchEvent(new CustomEvent('listia:bootstrap-ready',{detail:window.LISTIA_BOOTSTRAP_STATE}));
})();
})();
