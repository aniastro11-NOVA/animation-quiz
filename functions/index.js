const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const webpush = require('web-push');

admin.initializeApp();

const VAPID_PUBLIC_KEY  = 'BN_SLFzFsA6TntXjvdJm12VhkXo37pOXHhe8BpWYWF06Yo3AtEdeB2e3MBUURA40lJ9IK8COHvusWuMXkxOKVdQ';
const VAPID_PRIVATE_KEY = 'qzfvwRo_Hwe9AntqSg0X9ErlvaAvaUusfiYgrY-iQl0';

webpush.setVapidDetails('mailto:aniastro11@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

async function getSubscriptionDocs(db, household, owner, category) {
  let query = db.collection(`households/${household}/tokens`).where('enabled', '==', true);
  if (owner) query = query.where('owner', '==', owner);
  const snap = await query.get();
  return snap.docs
    .map(d => ({ id: d.id, sub: d.data().subscription, categories: d.data().categories }))
    .filter(item => item.sub && item.sub.endpoint)
    // categories 맵이 없거나 해당 항목이 false가 아니면 기본적으로 알림 받음
    .filter(item => !category || !item.categories || item.categories[category] !== false);
}

// 만료된 구독(410)은 Firestore에서 비활성화, 에러 로그 출력
async function sendToAll(db, household, subDocs, payload) {
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
          db.doc(`households/${household}/tokens/${subDocs[i].id}`)
            .set({ enabled: false }, { merge: true })
            .catch(() => {})
        );
      }
    }
  });

  if (cleanups.length > 0) await Promise.all(cleanups);
  return { sent, failed: results.length - sent };
}

// 30분마다 실행 — 가족별로 사료를 8시간 이상 안 줬으면 해당 가족에게만 푸시 알림
exports.checkFeedingAlert = onSchedule(
  { schedule: 'every 30 minutes', timeZone: 'Asia/Seoul' },
  async () => {
    const db = admin.firestore();
    const kst = new Date(Date.now() + 9 * 3600 * 1000);
    const today = kst.toISOString().slice(0, 10);
    const midnightKst = new Date(kst.toISOString().slice(0, 10) + 'T00:00:00+09:00').getTime();

    const householdDocs = await db.collection('households').listDocuments();

    await Promise.all(householdDocs.map(async (hRef) => {
      const household = hRef.id;
      const [petSnap, feedSnap] = await Promise.all([
        db.doc(`households/${household}/config/pet`).get(),
        db.doc(`households/${household}/feedings/${today}`).get(),
      ]);
      const petEnabled = petSnap.exists ? petSnap.data().enabled !== false : true;
      if (!petEnabled) return;
      const petName = (petSnap.exists && petSnap.data().name) || '단추';

      const data = feedSnap.exists ? feedSnap.data() : {};
      const lastFoodMs = data.lastFoodTs ? data.lastFoodTs.toMillis() : midnightKst;
      const hoursSince = (Date.now() - lastFoodMs) / 3600000;
      if (hoursSince < 8) return;

      const subDocs = await getSubscriptionDocs(db, household, undefined, 'danchu');
      if (subDocs.length === 0) return;

      const h = Math.floor(hoursSince);
      await sendToAll(db, household, subDocs, {
        title: `🐾 ${petName} 밥 알림`,
        body:  `${petName}가 ${h}시간째 밥을 못 먹었어요!`,
        icon:  'https://danchu-feeding.web.app/icon-192.png',
        badge: 'https://danchu-feeding.web.app/icon-192.png',
        url:   'https://danchu-feeding.web.app/',
      });
    }));

    return null;
  }
);

// 부탁 알림
exports.nudgeAll = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { from, to, task, category, household, notice } = req.body || {};
  if (!household) {
    res.status(400).json({ error: 'household is required' });
    return;
  }

  // 공지 브로드캐스트 — 가족 전체(알림 켠 기기)에게 전송
  if (notice) {
    const db = admin.firestore();
    const subDocs = await getSubscriptionDocs(db, household, undefined, 'notice');
    if (subDocs.length === 0) {
      res.json({ success: false, reason: 'no_tokens' });
      return;
    }
    const text = String(notice).slice(0, 200);
    const { sent, failed } = await sendToAll(db, household, subDocs, {
      title: '📢 가족 공지',
      body:  from ? `${from}: ${text}` : text,
      icon:  'https://danchu-feeding.web.app/icon-192.png',
      badge: 'https://danchu-feeding.web.app/icon-192.png',
      url:   'https://danchu-feeding.web.app/',
    });
    res.json({ success: sent > 0, sent, failed, ...(sent === 0 ? { reason: 'no_tokens' } : {}) });
    return;
  }

  if (!to) {
    res.status(400).json({ error: 'to is required' });
    return;
  }

  const db = admin.firestore();
  const subDocs = await getSubscriptionDocs(db, household, to, category);

  if (subDocs.length === 0) {
    res.json({ success: false, reason: 'no_tokens' });
    return;
  }

  const fromStr = from ? `${from}가 ` : '';
  const notifTitle = task ? `🏠 ${task} 부탁` : '🐾 밥을 주세요!';
  const notifBody  = task
    ? `${fromStr}${to}에게 ${task} 부탁했어요`
    : `${fromStr}${to}에게 부탁했어요`;

  const { sent, failed } = await sendToAll(db, household, subDocs, {
    title: notifTitle,
    body:  notifBody,
    icon:  'https://danchu-feeding.web.app/icon-192.png',
    badge: 'https://danchu-feeding.web.app/icon-192.png',
    url:   'https://danchu-feeding.web.app/',
  });

  if (sent === 0) {
    res.json({ success: false, reason: 'no_tokens' });
  } else {
    res.json({ success: true, sent, failed });
  }
});
