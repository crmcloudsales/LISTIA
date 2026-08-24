/*
  LISTIA public browser configuration.
  These values are intentionally public browser configuration.
  NEVER place service_role keys, database passwords, OAuth secrets,
  Stripe secret/restricted keys, webhook signing secrets or provider API secrets here.
*/
window.LISTIA_CONFIG = {
  SUPABASE_URL: "https://zvzafiarwerbuoaccnoz.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_aY9AjGa59GQ5rNGZlGAJpw_uhgVZfb1",

  // LISTIA LIVE billing. Secret credentials stay server-side in Supabase.
  BILLING_ENABLED: true,
  BILLING_ENV: "live",
  STRIPE_PUBLISHABLE_KEY: "pk_live_51U5BGR0falgc3pBvgIUoHEp5kwm2pRSRrTfubFkeQjGmopTbFd0ZmEIhjqeyOfzpGpziH2IzYn24d62og1eTyOVd00z8tLsz8A"
};

// Keep optional runtime modules isolated from the core PWA.
(() => {
  const modules = [
    ["/billing.js?v=1", "listiaBillingLoader"],
    ["/runtime.js?v=1", "listiaRuntimeLoader"],
    ["/property-status.js?v=1", "listiaPropertyStatusLoader"],
    ["/draft-actions.js?v=1", "listiaDraftActionsLoader"],
    ["/office-modules.js?v=1", "listiaOfficeModulesLoader"]
  ];

  for (const [src, datasetKey] of modules) {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset[datasetKey] = "1";
    document.head.append(script);
  }
})();
