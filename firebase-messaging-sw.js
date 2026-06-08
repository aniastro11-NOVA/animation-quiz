importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// ★ Firebase 콘솔에서 복사한 값으로 교체하세요
const FIREBASE_CONFIG = {
  apiKey:            "REPLACE_API_KEY",
  authDomain:        "REPLACE_AUTH_DOMAIN",
  projectId:         "REPLACE_PROJECT_ID",
  storageBucket:     "REPLACE_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_SENDER_ID",
  appId:             "REPLACE_APP_ID",
};

firebase.initializeApp(FIREBASE_CONFIG);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || '🐾 단추 알림', {
    body: body || '단추 배식을 확인해 주세요!',
    icon:  '/animation-quiz/icon-192.png',
    badge: '/animation-quiz/icon-192.png',
    requireInteraction: true,
    vibrate: [200, 100, 200],
  });
});
