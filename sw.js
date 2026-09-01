const CACHE='enthousiasmes-v39';
const ASSETS=[
  './','./index.html','./manifest.json','./icon-192.svg','./icon-512.svg',
  './vendor/react.js','./vendor/react-dom.js','./vendor/babel.min.js','./vendor/supabase.js',
  './src/styles.css','./src/db.js','./src/data.js','./src/images.js','./src/clusters.js','./src/descriptions.js','./src/components.jsx','./src/antechamber.jsx','./src/views.jsx','./src/discover-insights.jsx',
];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  const u=e.request.url;
  // Never intercept non-GET or /api/ calls. Proxying a long streaming POST
  // (/api/claude) through the SW lets the browser kill it when it terminates
  // the idle service worker (~30s), dropping Discover mid-request. Let the
  // browser handle these directly.
  if(e.request.method!=='GET'){return}
  if(u.includes('/api/')){return}
  // Supabase (auth + data) must never be answered from cache.
  if(u.includes('supabase.co')){return}
  if(u.includes('/.netlify/functions/')){e.respondWith(fetch(e.request));return}
  if(u.includes('fonts.googleapis.com')||u.includes('fonts.gstatic.com')||u.includes('unpkg.com')){
    // Cache-first, but never cache an error: a CDN 5xx stored here would be
    // served forever and brick the app on that device. Opaque responses
    // (no-cors font CSS) always report status 0, so let those through.
    e.respondWith(caches.open(CACHE).then(c=>c.match(e.request).then(r=>r||fetch(e.request).then(res=>{if(res.ok||res.type==='opaque'){c.put(e.request,res.clone())}return res}).catch(()=>r))));
    return;
  }
  // Network-first for the app's own assets: always try the network, fall back to
  // cache offline, and refresh the cache copy. New deploys then apply on a single
  // reopen instead of needing a second one.
  e.respondWith(
    fetch(e.request).then(res=>{
      if(res.ok){
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});
      }
      return res;
    }).catch(()=>caches.match(e.request))
  );
});
