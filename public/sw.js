const CACHE="listia-pwa-v0.9.1";
const CORE=["/","/index.html","/styles.css","/i18n-extra.js","/i18n.js","/app.js","/config.js","/manifest.webmanifest","/manifest-es.webmanifest","/manifest-en.webmanifest","/manifest-fr.webmanifest","/manifest-it.webmanifest","/manifest-pt-br.webmanifest","/manifest-de.webmanifest","/manifest-ar-ae.webmanifest","/listia-logo-transparent.webp","/listia-mark-transparent.webp","/listia-isotipo-192-v2.png","/listia-isotipo-512-v2.png","/listia-isotipo-180-v2.png","/listia-isotipo-32-v2.png"];
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
