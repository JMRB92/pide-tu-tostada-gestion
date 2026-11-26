const PREFIX="tostada-pages-gestion-",CACHE=PREFIX+'103';
const FILES=["./", "./index.html", "./style.css", "./core.js", "./firebase.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./admin.js", "./seed.json", "./bootstrap.js"];
const scope=new URL(self.registration.scope);
const allowed=new Set(FILES.map(p=>new URL(p,scope).href));
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==scope.origin||!u.pathname.startsWith(scope.pathname)||!allowed.has(u.href))return;
 e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));}return r;}).catch(()=>caches.open(CACHE).then(c=>c.match(e.request)).then(r=>r||Response.error())));
});
