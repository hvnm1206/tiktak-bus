// Thời khoá biểu v2 — service worker: mở được khi mất mạng, nhận thông báo đẩy.
const V = 'tkb-v2-1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname.startsWith('/api/')) return; // dữ liệu luôn lấy từ máy chủ
  if (e.request.mode === 'navigate') { // trang: mạng trước, mất mạng dùng bản lưu
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(x => x.put('/index.html', c)); return r; }).catch(() => caches.match('/index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); }
    return r;
  })));
});
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch { d = { title: 'Thời khoá biểu', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Thời khoá biểu', { body: d.body || '', tag: d.tag, icon: '/icon-192.png', badge: '/icon-192.png', data: { url: d.url || '/' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    const w = ws.find(x => new URL(x.url).origin === location.origin); if (w) return w.focus();
    return clients.openWindow(e.notification.data?.url || '/');
  }));
});
