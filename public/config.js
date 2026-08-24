/*
  LISTIA public browser configuration.
  These values are intentionally public browser configuration.
  NEVER place service_role keys, database passwords, OAuth secrets,
  Stripe secret/restricted keys, webhook signing secrets or provider API secrets here.
*/
window.LISTIA_CONFIG = {
  SUPABASE_URL: "https://zvzafiarwerbuoaccnoz.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_aY9AjGa59GQ5rNGZlGAJpw_uhgVZfb1",

  // Billing stays staged until the Stripe TEST publishable key and the
  // server-side restricted key have both been configured.
  BILLING_ENABLED: false,
  BILLING_ENV: "test",
  STRIPE_PUBLISHABLE_KEY: ""
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
