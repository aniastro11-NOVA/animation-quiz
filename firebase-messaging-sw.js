self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));

// index.html은 항상 네트워크에서 새로 가져옴 (캐시된 구버전 방지)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isHtml = event.request.mode === 'navigate'
    || url.pathname.endsWith('index.html')
    || url.pathname.endsWith('/animation-quiz/')
    || url.pathname.endsWith('/animation-quiz');
  if (isHtml) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => fetch(event.request))
    );
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data.json(); } catch(e) {}
  event.waitUntil(
    self.registration.showNotification(data.title || '🐾 패밀리로그 알림', {
      body:              data.body  || '알림을 확인해 주세요!',
      icon:              data.icon  || '/icon-192.png',
      badge:             data.badge || '/notification-badge.png',
      requireInteraction: true,
      vibrate:           [200, 100, 200],
      data:              { url: data.url || 'https://danchu-feeding.web.app/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || 'https://danchu-feeding.web.app/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // 앱이 이미 열려있으면 포커스만 (navigate X → 리셋 방지)
      for (const client of clientList) {
        if (client.url.startsWith('https://danchu-feeding.web.app') && 'focus' in client) {
          return client.focus();
        }
      }
      // 앱이 닫혀있으면 새로 열기
      return clients.openWindow(url);
    })
  );
});
