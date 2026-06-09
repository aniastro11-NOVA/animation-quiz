const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const webpush = require('web-push');

admin.initializeApp();

const VAPID_PUBLIC_KEY  = 'BN_SLFzFsA6TntXjvdJm12VhkXo37pOXHhe8BpWYWF06Yo3AtEdeB2e3MBUURA40lJ9IK8COHvusWuMXkxOKVdQ';
const VAPID_PRIVATE_KEY = 'qzfvwRo_Hwe9AntqSg0X9ErlvaAvaUusfiYgrY-iQl0';

webpush.setVapidDetails('mailto:aniastro11@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

async function getSubscriptionDocs(db) {
  const snap = await db.collection('tokens').where('enabled', '==', true).get();
  return snap.docs
    .map(d => ({ id: d.id, sub: d.data().subscription }))
    .filter(item => item.sub && item.sub.endpoint);
}

// 만료된 구독(410)은 Firestore에서 비활성화, 에러 로그 출력
async function sendToAll(db, subDocs, payload) {
  const msg = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subDocs.map(({ sub }) => webpush.sendNotification(sub, msg))
  );

  let sent = 0;
  const cleanups = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      sent++;
    } else {
      const status = r.reason?.statusCode;
      console.error(`push failed for ${subDocs[i].id}: ${status} ${r.reason?.body}`);
      if (status === 410 || status === 404) {
        // 구독 만료 — Firestore에서 비활성화
        cleanups.push(
          db.doc(`tokens/${subDocs[i].id}`)
            .set({ enabled: false }, { merge: true })
            .catch(() => {})
        );
      }
    }
  });

  if (cleanups.length > 0) await Promise.all(cleanups);
  return { sent, failed: results.length - sent };
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

    const subDocs = await getSubscriptionDocs(db);
    if (subDocs.length === 0) return null;

    const h = Math.floor(hoursSince);
    await sendToAll(db, subDocs, {
      title: '🐾 단추 밥 알림',
      body:  `단추가 ${h}시간째 밥을 못 먹었어요!`,
      icon:  'https://aniastro11-nova.github.io/animation-quiz/icon-192.png',
      badge: 'https://aniastro11-nova.github.io/animation-quiz/icon-192.png',
      url:   'https://aniastro11-nova.github.io/animation-quiz/',
    });

    return null;
  }
);

// 부탁 알림
exports.nudgeAll = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { from, to, task } = req.body || {};
  if (!to) {
    res.status(400).json({ error: 'to is required' });
    return;
  }

  const db = admin.firestore();
  const subDocs = await getSubscriptionDocs(db);

  if (subDocs.length === 0) {
    res.json({ success: false, reason: 'no_tokens' });
    return;
  }

  const fromStr = from ? `${from}가 ` : '';
  const notifTitle = task ? `🏠 ${task} 부탁` : '🐾 단추에게 밥을 주세요!';
  const notifBody  = task
    ? `${fromStr}${to}에게 ${task} 부탁했어요`
    : `${fromStr}${to}에게 부탁했어요`;

  const { sent, failed } = await sendToAll(db, subDocs, {
    title: notifTitle,
    body:  notifBody,
    icon:  'https://aniastro11-nova.github.io/animation-quiz/icon-192.png',
    badge: 'https://aniastro11-nova.github.io/animation-quiz/icon-192.png',
    url:   'https://aniastro11-nova.github.io/animation-quiz/',
  });

  if (sent === 0) {
    res.json({ success: false, reason: 'no_tokens' });
  } else {
    res.json({ success: true, sent, failed });
  }
});
