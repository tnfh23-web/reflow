/* Replaced with content-hashed production assets by the Vite build plugin.
   Development intentionally leaves PRECACHE empty so HMR is never cached. */
const VERSION='__REFLOW_BUILD__';
const PRECACHE=/*__REFLOW_PRECACHE__*/[];
const CACHE='reflow-shell-'+VERSION;
const allowed=new Set(PRECACHE);
self.addEventListener('install',event=>{
  if(PRECACHE.length)event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE)));
});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith('reflow-shell-')&&name!==CACHE)await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const {request}=event,url=new URL(request.url);
  if(!PRECACHE.length||request.method!=='GET'||url.origin!==self.location.origin)return;
  // API, authenticated captures, uploads and remote sites are never intercepted.
  const path=url.pathname;
  const navigation=request.mode==='navigate'&&(path==='/'||path==='/index.html');
  if(!navigation&&!allowed.has(path))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const saved=await cache.match(navigation?'/index.html':path);
    const response=saved||await fetch(request);
    // Static hosts may redirect /index.html to /. A cached redirected response
    // is invalid for Chrome navigation's manual redirect mode (ERR_FAILED).
    // Return its bytes as a fresh response without the redirected flag.
    return navigation&&response.redirected?new Response(response.body,{status:response.status,statusText:response.statusText,headers:response.headers}):response;
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const route = event.notification.data?.route === '#projects' ? '#projects' : '#library';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate('/' + route);
      await existing.focus();
    } else {
      await self.clients.openWindow('/' + route);
    }
  })());
});
