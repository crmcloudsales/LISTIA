/*
  LISTIA public browser configuration.
  These values are intentionally public browser configuration.
  NEVER place service_role keys, database passwords, OAuth secrets,
  Stripe secret/restricted keys, webhook signing secrets or provider API secrets here.
*/
window.LISTIA_CONFIG = {
  SUPABASE_URL: "https://zvzafiarwerbuoaccnoz.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_aY9AjGa59GQ5rNGZlGAJpw_uhgVZfb1",

  // LIVE catalog is staged. Keep checkout disabled until the LIVE webhook
  // signing secret has been configured server-side and verified end-to-end.
  BILLING_ENABLED: false,
  BILLING_ENV: "live",
  STRIPE_PUBLISHABLE_KEY: "pk_live_51U5BGR0falgc3pBvgIUoHEp5kwm2pRSRrTfubFkeQjGmopTbFd0ZmEIhjqeyOfzpGpziH2IzYn24d62og1eTyOVd00z8tLsz8A"
};

// Keep billing code isolated from the core PWA. When billing is disabled it
// only adds the Terms / Privacy links and does not intercept plan selection.
(() => {
  const billing = document.createElement("script");
  billing.src = "/billing.js?v=1";
  billing.async = false;
  billing.dataset.listiaBillingLoader = "1";
  document.head.append(billing);

  const runtime = document.createElement("script");
  runtime.src = "/runtime.js?v=1";
  runtime.async = false;
  runtime.dataset.listiaRuntimeLoader = "1";
  document.head.append(runtime);
})();
