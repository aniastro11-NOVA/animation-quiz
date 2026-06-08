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
