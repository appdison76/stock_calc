/**
 * 알림 발송 관리자 웹 서버
 *
 * 사용법:
 * node scripts/notification-server.js
 *
 * 브라우저에서 http://localhost:3000 접속
 *
 * 실시간 이슈 키워드: Firestore `issueKeywords/current`
 * 메인 기준금리: Firestore `interestRates/current`
 * 추천 바로가기: Firestore `recommendedShortcuts/current`
 * (send-notification 과 동일한 FIREBASE_ADMIN_KEY / 서비스 계정 필요)
 */

const express = require('express');
const path = require('path');
const { sendNotificationToAll } = require('./send-notification');

const app = express();
const PORT = 3000;

/** Firestore: 공개 읽기 문서 (관리자 서버는 Admin으로만 쓰기) */
const ISSUE_KEYWORDS_COLLECTION = 'issueKeywords';
const ISSUE_KEYWORDS_DOC_ID = 'current';
/** 저장 시 허용 최대 개수 */
const ISSUE_KEYWORDS_MAX = 20;

const INTEREST_RATES_COLLECTION = 'interestRates';
const INTEREST_RATES_DOC_ID = 'current';

const RECOMMENDED_SHORTCUTS_COLLECTION = 'recommendedShortcuts';
const RECOMMENDED_SHORTCUTS_DOC_ID = 'current';
/** 저장 시 최대 개수 */
const RECOMMENDED_SHORTCUTS_MAX = 12;

function getAdminFirestore() {
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    throw new Error(
      'Firebase Admin이 초기화되지 않았습니다. send-notification과 동일한 서비스 계정 키가 필요합니다.'
    );
  }
  return admin.firestore();
}

// 정적 파일 제공 (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true }));

function normalizeIssueKeywords(rawKeywords) {
  if (!Array.isArray(rawKeywords)) {
    throw new Error('keywords는 배열이어야 합니다.');
  }
  const items = [];
  for (const entry of rawKeywords) {
    if (!entry || typeof entry !== 'object') continue;
    const keyword =
      typeof entry.keyword === 'string' ? entry.keyword.trim() : '';
    if (!keyword) continue;
    let rank =
      typeof entry.rank === 'number' && Number.isFinite(entry.rank)
        ? Math.floor(entry.rank)
        : items.length + 1;
    let count;
    if (
      typeof entry.count === 'number' &&
      Number.isFinite(entry.count)
    ) {
      count = Math.floor(entry.count);
    }
    items.push({ rank, keyword, ...(count !== undefined ? { count } : {}) });
  }
  items.sort((a, b) => a.rank - b.rank);
  return items.slice(0, ISSUE_KEYWORDS_MAX).map((item, i) => ({
    rank: i + 1,
    keyword: item.keyword,
    ...(item.count !== undefined ? { count: item.count } : {}),
  }));
}

function normalizeInterestRates(body) {
  const o = body && typeof body === 'object' ? body : {};
  const usRaw = o.us;
  let us;
  if (typeof usRaw === 'string') {
    us = usRaw.trim();
  } else if (typeof usRaw === 'number' && Number.isFinite(usRaw)) {
    us = String(usRaw);
  } else {
    throw new Error('미국(us)은 문자열 또는 숫자여야 합니다.');
  }
  if (!us) throw new Error('미국(us) 값이 비어 있습니다.');

  const krRaw = o.kr;
  const kr =
    typeof krRaw === 'number' ? krRaw : typeof krRaw === 'string' ? parseFloat(krRaw) : NaN;
  if (!Number.isFinite(kr)) throw new Error('한국(kr)은 숫자여야 합니다.');

  const jpRaw = o.jp;
  const jp =
    typeof jpRaw === 'number' ? jpRaw : typeof jpRaw === 'string' ? parseFloat(jpRaw) : NaN;
  if (!Number.isFinite(jp)) throw new Error('일본(jp)은 숫자여야 합니다.');

  return { us, kr, jp };
}

function normalizeRecommendedShortcuts(rawItems) {
  if (!Array.isArray(rawItems)) {
    throw new Error('items는 배열이어야 합니다.');
  }
  const rows = [];
  for (const entry of rawItems) {
    if (!entry || typeof entry !== 'object') continue;
    const title = typeof entry.title === 'string' ? entry.title.trim() : '';
    const url = typeof entry.url === 'string' ? entry.url.trim() : '';
    if (!title || !url) continue;
    if (!/^https:\/\//i.test(url)) {
      throw new Error(`URL은 https:// 로 시작해야 합니다: "${title}"`);
    }
    const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : '';
    const iconEmoji = typeof entry.iconEmoji === 'string' ? entry.iconEmoji.trim() : '';
    let showOnMain = true;
    if (typeof entry.showOnMain === 'boolean') {
      showOnMain = entry.showOnMain;
    } else if (typeof entry.enabled === 'boolean') {
      showOnMain = entry.enabled;
    }
    let sortOrder =
      typeof entry.sortOrder === 'number' && Number.isFinite(entry.sortOrder)
        ? Math.floor(entry.sortOrder)
        : rows.length;
    rows.push({
      id,
      title,
      url,
      ...(iconEmoji ? { iconEmoji } : {}),
      showOnMain,
      enabled: showOnMain,
      sortOrder,
    });
  }
  rows.sort((a, b) => a.sortOrder - b.sortOrder);
  const capped = rows.slice(0, RECOMMENDED_SHORTCUTS_MAX);
  return capped.map((r, idx) => ({
    id: r.id || `rs-${idx}`,
    title: r.title,
    url: r.url,
    ...(r.iconEmoji ? { iconEmoji: r.iconEmoji } : {}),
    showOnMain: r.showOnMain,
    enabled: r.showOnMain,
    sortOrder: idx,
  }));
}

/** Firestore issueKeywords/current 읽기 (관리자 UI) */
app.get('/api/issue-keywords', async (req, res) => {
  try {
    const db = getAdminFirestore();
    const snap = await db.collection(ISSUE_KEYWORDS_COLLECTION).doc(ISSUE_KEYWORDS_DOC_ID).get();
    if (!snap.exists) {
      return res.json({ keywords: [] });
    }
    const data = snap.data() || {};
    const keywords = Array.isArray(data.keywords) ? data.keywords : [];
    res.json({ keywords });
  } catch (error) {
    console.error('❌ issue-keywords Firestore 읽기 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message || '읽기에 실패했습니다.',
    });
  }
});

app.put('/api/issue-keywords', async (req, res) => {
  try {
    const admin = require('firebase-admin');
    const body = req.body || {};
    const normalized = normalizeIssueKeywords(body.keywords);
    const db = getAdminFirestore();
    await db.collection(ISSUE_KEYWORDS_COLLECTION).doc(ISSUE_KEYWORDS_DOC_ID).set(
      {
        keywords: normalized,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log('💾 issueKeywords/current Firestore 저장:', normalized.length, '건');
    res.json({ success: true, keywords: normalized });
  } catch (error) {
    console.error('❌ issue-keywords Firestore 저장 오류:', error);
    res.status(400).json({
      success: false,
      error: error.message || '저장에 실패했습니다.',
    });
  }
});

/** Firestore interestRates/current 읽기 (관리자 UI) */
app.get('/api/interest-rates', async (req, res) => {
  const defaults = { us: '3.50~3.75', kr: 2.5, jp: 0.75 };
  try {
    const db = getAdminFirestore();
    const snap = await db.collection(INTEREST_RATES_COLLECTION).doc(INTEREST_RATES_DOC_ID).get();
    if (!snap.exists) {
      return res.json(defaults);
    }
    const data = snap.data() || {};
    try {
      const normalized = normalizeInterestRates(data);
      return res.json(normalized);
    } catch (parseErr) {
      console.warn('⚠️ interestRates 필드 불완전, 기본값 반환:', parseErr.message);
      return res.json(defaults);
    }
  } catch (error) {
    console.error('❌ interest-rates Firestore 읽기 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message || '읽기에 실패했습니다.',
    });
  }
});

app.put('/api/interest-rates', async (req, res) => {
  try {
    const admin = require('firebase-admin');
    const normalized = normalizeInterestRates(req.body || {});
    const db = getAdminFirestore();
    await db.collection(INTEREST_RATES_COLLECTION).doc(INTEREST_RATES_DOC_ID).set(
      {
        ...normalized,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log('💾 interestRates/current Firestore 저장:', normalized);
    res.json({ success: true, ...normalized });
  } catch (error) {
    console.error('❌ interest-rates Firestore 저장 오류:', error);
    res.status(400).json({
      success: false,
      error: error.message || '저장에 실패했습니다.',
    });
  }
});

/** Firestore recommendedShortcuts/current 읽기 (관리자 UI) */
app.get('/api/recommended-shortcuts', async (req, res) => {
  try {
    const db = getAdminFirestore();
    const snap = await db
      .collection(RECOMMENDED_SHORTCUTS_COLLECTION)
      .doc(RECOMMENDED_SHORTCUTS_DOC_ID)
      .get();
    if (!snap.exists) {
      return res.json({ items: [] });
    }
    const data = snap.data() || {};
    const items = Array.isArray(data.items) ? data.items : [];
    res.json({ items });
  } catch (error) {
    console.error('❌ recommended-shortcuts Firestore 읽기 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message || '읽기에 실패했습니다.',
    });
  }
});

app.put('/api/recommended-shortcuts', async (req, res) => {
  try {
    const admin = require('firebase-admin');
    const body = req.body || {};
    const rawItems = Array.isArray(body.items) ? body.items : [];
    const normalized = normalizeRecommendedShortcuts(rawItems);
    const db = getAdminFirestore();
    await db
      .collection(RECOMMENDED_SHORTCUTS_COLLECTION)
      .doc(RECOMMENDED_SHORTCUTS_DOC_ID)
      .set(
        {
          items: normalized,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    console.log(
      '💾 recommendedShortcuts/current Firestore 저장:',
      normalized.length,
      '건'
    );
    res.json({ success: true, items: normalized });
  } catch (error) {
    console.error('❌ recommended-shortcuts Firestore 저장 오류:', error);
    res.status(400).json({
      success: false,
      error: error.message || '저장에 실패했습니다.',
    });
  }
});

// 알림 발송 API
app.post('/api/send-notification', async (req, res) => {
  try {
    const { title, body, data } = req.body;
    
    if (!title || !body) {
      return res.status(400).json({
        success: false,
        error: '제목과 내용은 필수입니다.'
      });
    }

    // 이미지 URL 검증
    let imageUrl = null;
    if (req.body.imageUrl) {
      imageUrl = req.body.imageUrl.trim();
      
      if (imageUrl) {
        // HTTPS URL 검증
        if (!imageUrl.startsWith('https://')) {
          return res.status(400).json({
            success: false,
            error: '이미지 URL은 HTTPS로 시작해야 합니다. (예: https://example.com/image.jpg)'
          });
        }
        
        // URL 형식 검증
        try {
          new URL(imageUrl);
        } catch (e) {
          return res.status(400).json({
            success: false,
            error: '유효하지 않은 이미지 URL 형식입니다.'
          });
        }
      }
    }

    // 추가 데이터 파싱
    let notificationData = {};
    if (data) {
      try {
        notificationData = typeof data === 'string' ? JSON.parse(data) : data;
      } catch (e) {
        console.warn('⚠️ 데이터 파싱 오류:', e);
      }
    }

    console.log('📤 알림 발송 요청:', { title, body, imageUrl, data: notificationData });

    // 알림 발송
    const result = await sendNotificationToAll(title, body, notificationData, imageUrl);

    res.json({
      success: true,
      message: '알림이 성공적으로 발송되었습니다.',
      result
    });
  } catch (error) {
    console.error('❌ 알림 발송 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message || '알림 발송 중 오류가 발생했습니다.'
    });
  }
});

// 등록된 토큰 수 조회 API
app.get('/api/token-count', async (req, res) => {
  try {
    const admin = require('firebase-admin');
    const db = admin.firestore();
    
    const tokensSnapshot = await db.collection('notificationTokens').get();
    const count = tokensSnapshot.size;
    
    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('❌ 토큰 수 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`\n🚀 알림 발송 관리자 서버가 시작되었습니다!`);
  console.log(`📱 브라우저에서 http://localhost:${PORT} 접속하세요\n`);
});
