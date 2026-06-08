const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const webpush = require('web-push');

admin.initializeApp();

const VAPID_PUBLIC_KEY  = 'BN_SLFzFsA6TntXjvdJm12VhkXo37pOXHhe8BpWYWF06Yo3AtEdeB2e3MBUURA40lJ9IK8COHvusWuMXkxOKVdQ';
const VAPID_PRIVATE_KEY = 'qzfvwRo_Hwe9AntqSg0X9ErlvaAvaUusfiYgrY-iQl0';

webpush.setVapidDetails('mailto:aniastro11@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

async function getSubscriptions(db) {
  const snap = await db.collection('tokens').where('enabled', '==', true).get();
  return snap.docs.map(d => d.data().subscription).filter(Boolean);
}

async function sendToAll(subscriptions, payload) {
  const msg = JSON.stringify(payload);
  await Promise.all(subscriptions.map(sub =>
    webpush.sendNotification(sub, msg).catch(() => {})
  ));
}

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
    const hoursSince = (Date.now() - lastFoodMs) / 3600000;

    if (hoursSince < 8) return null;

    const subscriptions = await getSubscriptions(db);
    if (subscriptions.length === 0) return null;

    const h = Math.floor(hoursSince);
    await sendToAll(subscriptions, {
      title: '🐾 단추 밥 알림',
      body:  `단추가 ${h}시간째 밥을 못 먹었어요!`,
      icon:  'https://aniastro11-nova.github.io/animation-quiz/icon-192.png',
      badge: 'https://aniastro11-nova.github.io/animation-quiz/icon-192.png',
      url:   'https://aniastro11-nova.github.io/animation-quiz/',
    });

    return null;
  }
);

// 밥 부탁 알림
exports.nudgeAll = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { from, to } = req.body || {};
  if (!to) {
    res.status(400).json({ error: 'to is required' });
    return;
  }

  const db = admin.firestore();
  const subscriptions = await getSubscriptions(db);

  if (subscriptions.length === 0) {
    res.json({ success: false, reason: 'no_tokens' });
    return;
  }

  const fromStr = from ? `${from}가 ` : '';
  await sendToAll(subscriptions, {
    title: '🐾 단추에게 밥을 주세요!',
    body:  `${fromStr}${to}에게 부탁했어요`,
    icon:  'https://aniastro11-nova.github.io/animation-quiz/icon-192.png',
    badge: 'https://aniastro11-nova.github.io/animation-quiz/icon-192.png',
    url:   'https://aniastro11-nova.github.io/animation-quiz/',
  });

  res.json({ success: true });
});
