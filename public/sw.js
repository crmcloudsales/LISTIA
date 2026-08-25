const CACHE="listia-pwa-v0.11.0";
const CORE=[
  "/","/index.html","/styles.css?v=0.9.3","/readability.css?v=3","/marketplace.css?v=1","/billing.css?v=1","/billing.js?v=1","/runtime.js?v=1",
  "/i18n-extra.js","/i18n.js?v=0.9.5","/global-locales.js?v=2","/japanese-locale.js?v=1","/listia-voice.js?v=2","/marketplace.js?v=1",
  "/install.js?v=0.9.3","/app.js","/config.js",
  "/manifest.webmanifest?v=0.9.5","/manifest-es.webmanifest?v=0.9.5","/manifest-en.webmanifest?v=0.9.5",
  "/manifest-fr.webmanifest?v=0.9.5","/manifest-it.webmanifest?v=0.9.5","/manifest-pt-br.webmanifest?v=0.9.5",
  "/manifest-de.webmanifest?v=0.9.5","/manifest-ar-ae.webmanifest?v=0.9.5",
  "/manifest-ru.webmanifest","/manifest-he.webmanifest","/manifest-zh-cn.webmanifest","/manifest-ja.webmanifest",
  "/listia-logo-transparent.webp","/listia-mark-transparent.webp",
  "/listia-app-icon-192.png?v=1","/listia-app-icon-512.png?v=1",
  "/listia-app-icon-maskable-192.png?v=1","/listia-app-icon-maskable-512.png?v=1",
  "/listia-app-icon-180.png?v=1","/listia-app-icon-32.png?v=1"
];
self.addEventListener("install",e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)));
});
self.addEventListener("activate",e=>{
  e.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  ]));
});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const u=new URL(e.request.url);
  if(u.origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(resp=>{
    const copy=resp.clone();
    caches.open(CACHE).then(c=>c.put(e.request,copy));
    return resp;
  }).catch(()=>caches.match(e.request).then(r=>r||caches.match("/index.html"))));
});
