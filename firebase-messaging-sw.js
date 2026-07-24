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

const NUDGE_URL = 'https://nudgeall-ldf5zfstvq-uc.a.run.app';

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data.json(); } catch(e) {}
  const options = {
    body:              data.body  || '알림을 확인해 주세요!',
    icon:              data.icon  || '/icon-192.png',
    badge:             data.badge || '/notification-badge.png',
    requireInteraction: true,
    vibrate:           [200, 100, 200],
    data:              { url: data.url || 'https://danchu-feeding.web.app/', ack: data.ack || null },
  };
  // 확인 정보(ack)가 있으면 알림창에 "확인" 버튼 표시
  if (data.ack) {
    options.actions = [{ action: 'ack', title: '✅ 확인' }];
  }
  event.waitUntil(self.registration.showNotification(data.title || '🐾 패밀리로그 알림', options));
});

self.addEventListener('notificationclick', (event) => {
  const ack = event.notification.data && event.notification.data.ack;
  event.notification.close();

  // "확인" 버튼 → 보낸 사람에게 확인 알림 전송, 앱은 열지 않음
  if (event.action === 'ack' && ack) {
    event.waitUntil(
      fetch(NUDGE_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ household: ack.household, ackTo: ack.ackTo, ackFrom: ack.ackFrom }),
      }).catch(() => {})
    );
    return;
  }

  // 알림 본문 클릭 → 앱 열기(이미 열려있으면 포커스)
  const url = event.notification.data?.url || 'https://danchu-feeding.web.app/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.startsWith('https://danchu-feeding.web.app') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
