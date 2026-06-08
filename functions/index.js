const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
admin.initializeApp();

// 30분마다 실행 — 사료를 8시간 이상 안 줬으면 전체 푸시 알림
exports.checkFeedingAlert = onSchedule(
  { schedule: 'every 30 minutes', timeZone: 'Asia/Seoul' },
  async () => {
    const db = admin.firestore();
    const kst = new Date(Date.now() + 9 * 3600 * 1000);
    const today = kst.toISOString().slice(0, 10);

    const snap = await db.doc(`feedings/${today}`).get();
    const data = snap.exists ? snap.data() : {};

    const lastFoodMs = data.lastFoodTs ? data.lastFoodTs.toMillis() : 0;
    const nowMs = Date.now();
    const hoursSince = (nowMs - lastFoodMs) / 3600000;

    if (hoursSince < 8) return null;

    const tokensSnap = await db.collection('tokens')
      .where('enabled', '==', true).get();
    const tokens = tokensSnap.docs
      .map(d => d.data().token)
      .filter(Boolean);

    if (tokens.length === 0) return null;

    const h = Math.floor(hoursSince);
    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: '🐾 단추 밥 알림',
        body:  `단추가 ${h}시간째 밥을 못 먹었어요!`,
      },
      webpush: {
        notification: {
          icon:  'https://aniastro11-nova.github.io/animation-quiz/icon-192.png',
          badge: 'https://aniastro11-nova.github.io/animation-quiz/icon-192.png',
          requireInteraction: true,
          vibrate: [200, 100, 200],
        },
        fcmOptions: {
          link: 'https://aniastro11-nova.github.io/animation-quiz/',
        },
      },
    });

    return null;
  }
);
