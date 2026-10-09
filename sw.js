const CACHE='loyara-lobo-v12';
const ASSETS=['./','./index.html','./app.js','./manifest.json','./icon.svg','./%C3%8Dcone%20Luxuoso%20Loyara%20Lobo.png','./Elegância em Rosa e Ouro (1).png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 event.respondWith(fetch(event.request).then(response=>{
  const copy=response.clone();
  caches.open(CACHE).then(cache=>cache.put(event.request,copy));
  return response;
 }).catch(()=>caches.match(event.request).then(hit=>hit||caches.match('./index.html'))));
});