(() => {
  'use strict';
  /* Compatibility shim. LISTIA Listings V2 owns the listings UI.
     This file intentionally does not create or intercept a second listings screen. */
  function open() {
    const legacy = document.getElementById('screen-listing-v2');
    if (legacy) legacy.remove();
    if (window.LISTIA_APP_SHELL?.showScreen) {
      window.LISTIA_APP_SHELL.showScreen('screen-properties');
    } else {
      document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.toggle('active', screen.id === 'screen-properties');
      });
    }
    document.querySelectorAll('.listia-nav-btn').forEach(button => {
      button.classList.toggle('active', button.dataset.listiaTab === 'listing');
    });
    window.dispatchEvent(new CustomEvent('listia:listings-open'));
  }

  function load() {
    window.dispatchEvent(new CustomEvent('listia:listings-refresh'));
  }

  function cleanup() {
    document.getElementById('screen-listing-v2')?.remove();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cleanup, { once: true });
  } else {
    cleanup();
  }

  window.LISTIA_LISTING_WORKSPACE = { open, load };
})();