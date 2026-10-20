'use strict';
/* Ilova uchun service worker: sahifa va fayllarni keshlaydi, internet yo'qolsa ham sayt ochiladi.
   API so'rovlari (buyurtma, kuzatish, admin) hech qachon keshlanmaydi. */
const CACHE = 'up-v7';
const CORE = ['./', 'index.html', 'assets/css/site.css?v=7', 'assets/js/three.min.js?v=7', 'assets/js/printer3d.js?v=7', 'assets/js/shared.js?v=7',
  'assets/js/i18n.js?v=7', 'assets/js/i18n-plus.js?v=7', 'assets/js/store.js?v=7', 'assets/js/ui.js?v=7', 'assets/js/site.js?v=7', 'data/seed.json', 'manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/') || url.pathname.includes('admin')) return;
  // Sahifa va katalog: avval tarmoq, bo'lmasa kesh
  if (req.mode === 'navigate' || url.pathname.endsWith('.json')) {
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); return r; }).catch(() => caches.match(req).then((m) => m || caches.match('index.html'))));
    return;
  }
  // Rasm, skript, stil: keshdan darhol, fonda yangilanadi
  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
