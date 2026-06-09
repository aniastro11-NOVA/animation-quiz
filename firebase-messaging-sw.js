// 설치 즉시 활성화 (탭을 모두 닫을 필요 없이 새 SW로 교체)
self.addEventListener('install', () => self.skipWaiting());

// 활성화 시 모든 열린 창 새로고침 → 최신 코드 로드
self.addEventListener('activate', (event) => {
  event.waitUntil(
    clients.claim().then(() =>
      clients.matchAll({ type: 'window' }).then(windowClients =>
        Promise.all(windowClients.map(c => c.navigate(c.url)))
      )
    )
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data.json(); } catch(e) {}
  event.waitUntil(
    self.registration.showNotification(data.title || '🐾 단추 알림', {
      body:              data.body  || '단추 배식을 확인해 주세요!',
      icon:              data.icon  || '/animation-quiz/icon-192.png',
      badge:             data.badge || '/animation-quiz/icon-192.png',
      requireInteraction: true,
      vibrate:           [200, 100, 200],
      data:              { url: data.url || 'https://aniastro11-nova.github.io/animation-quiz/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || 'https://aniastro11-nova.github.io/animation-quiz/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.startsWith('https://aniastro11-nova.github.io/animation-quiz') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
