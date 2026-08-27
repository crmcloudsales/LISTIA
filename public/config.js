/*
  LISTIA public browser configuration.
  These values are intentionally public browser configuration.
  NEVER place service_role keys, database passwords, OAuth secrets,
  Stripe secret/restricted keys, webhook signing secrets or provider API secrets here.
*/
window.LISTIA_CONFIG = {
  SUPABASE_URL: "https://zvzafiarwerbuoaccnoz.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_aY9AjGa59GQ5rNGZlGAJpw_uhgVZfb1",
  BILLING_ENABLED: true,
  BILLING_ENV: "live",
  STRIPE_PUBLISHABLE_KEY: "pk_live_51U5BGR0falgc3pBvgIUoHEp5kwm2pRSRrTfubFkeQjGmopTbFd0ZmEIhjqeyOfzpGpziH2IzYn24d62og1eTyOVd00z8tLsz8A"
};

(() => {
  const styles = [
    ["listiaReadabilityStyles", "/readability.css?v=3"],
    ["listiaPwaComponentStyles", "/pwa-components.css?v=1"],
    ["listiaAccountMarketplaceStyles", "/account-marketplace.css?v=1"],
    ["listiaMarketplaceFeedStyles", "/marketplace-feed.css?v=1"],
    ["listiaContactEngineStyles", "/contact-engine.css?v=1"],
    ["listiaAppShellV2Styles", "/app-shell-v2.css?v=1"],
    ["listiaPwaPolishStyles", "/pwa-polish.css?v=1"],
    ["listiaPwaPolishHotfixStyles", "/pwa-polish-hotfix.css?v=2"],
    ["listiaPremiumShellStyles", "/premium-shell.css?v=1"],
    ["listiaPwaFinalHotfixStyles", "/pwa-final-hotfix.css?v=1"]
  ];
  for (const [id, href] of styles) {
    if (document.getElementById(id)) continue;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.append(link);
  }
})();

(() => {
  const modules = [
    ["/global-locales.js?v=2", "listiaGlobalLocalesLoader"],
    ["/japanese-locale.js?v=1", "listiaJapaneseLocaleLoader"],
    ["/pricing-policy.js?v=3", "listiaPricingPolicyLoader"],
    ["/billing.js?v=1", "listiaBillingLoader"],
    ["/runtime.js?v=2", "listiaRuntimeLoader"],
    ["/affiliate-attribution.js?v=1", "listiaAffiliateAttributionLoader"],
    ["/property-status.js?v=1", "listiaPropertyStatusLoader"],
    ["/draft-actions.js?v=1", "listiaDraftActionsLoader"],
    ["/office-modules.js?v=1", "listiaOfficeModulesLoader"],
    ["/contact-engine.js?v=1", "listiaContactEngineLoader"],
    ["/listia-voice.js?v=3", "listiaVoiceLoader"],
    ["/marketplace-assistant.js?v=1", "listiaMarketplaceAssistantLoader"],
    ["/marketplace-feed-enhancements.js?v=2", "listiaMarketplaceFeedLoader"],
    ["/marketplace.js?v=1", "listiaMarketplaceLoader"],
    ["/account-mode.js?v=1", "listiaAccountModeLoader"],
    ["/pwa-fixes.js?v=1", "listiaPwaFixesLoader"],
    ["/app-shell-v2.js?v=1", "listiaAppShellV2Loader"],
    ["/listing-workspace.js?v=1", "listiaListingWorkspaceLoader"],
    ["/billing-management.js?v=1", "listiaBillingManagementLoader"],
    ["/assistant-intelligence.js?v=2", "listiaAssistantIntelligenceLoader"],
    ["/onboarding-hardening.js?v=1", "listiaOnboardingHardeningLoader"],
    ["/premium-shell.js?v=2", "listiaPremiumShellLoader"]
  ];

  for (const [src, datasetKey] of modules) {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset[datasetKey] = "1";
    document.head.append(script);
  }
})();