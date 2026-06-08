importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

// ★ Firebase 콘솔에서 복사한 값으로 교체하세요
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDPR7zOjALkx0qlW6lZ3uHskZmFP1QzDtU",
  authDomain:        "danchu-feeding.firebaseapp.com",
  projectId:         "danchu-feeding",
  storageBucket:     "danchu-feeding.firebasestorage.app",
  messagingSenderId: "1081324392813",
  appId:             "1:1081324392813:web:299bb2f67314aeb0bf8a64",
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
