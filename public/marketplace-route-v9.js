(() => {
  'use strict';
  if(window.__LISTIA_MARKETPLACE_ROUTE_V9__)return;window.__LISTIA_MARKETPLACE_ROUTE_V9__=true;
  const wantsMarketplace=()=>/^\/marketplace\/?$/i.test(location.pathname)||location.hash==='#marketplace'||new URLSearchParams(location.search).get('marketplace')==='1';
  const wantsVoice=()=>new URLSearchParams(location.search).get('voice')==='1';
  function open(attempt=0){
    if(!wantsMarketplace())return;
    const screen=document.getElementById('screen-marketplace'),entry=document.getElementById('marketplaceEntry');
    if(screen){document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s===screen));window.LISTIA_MARKETPLACE?.reload?.();if(wantsVoice())setTimeout(()=>window.LISTIA_VOICE?.open?.(),450);return}
    if(entry){entry.click();if(wantsVoice())setTimeout(()=>window.LISTIA_VOICE?.open?.(),450);return}
    if(attempt<80)setTimeout(()=>open(attempt+1),100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>open(),{once:true});else open();
  window.addEventListener('popstate',()=>open());
})();
