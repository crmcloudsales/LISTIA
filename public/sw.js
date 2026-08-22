const CACHE="listia-pwa-v0.8.6";
const CORE=["/","/index.html","/styles.css","/i18n.js","/app.js","/config.js","/manifest.webmanifest","/manifest-es.webmanifest","/manifest-en.webmanifest","/manifest-fr.webmanifest","/listia-logo-transparent.webp","/listia-mark-transparent.webp","/icon-192.png","/icon-512.png","/icon-maskable-512.png","/apple-touch-icon.png","/favicon-32.png"];
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
