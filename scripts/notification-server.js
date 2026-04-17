/**
 * 알림 발송 관리자 웹 서버
 * 
 * 사용법:
 * node scripts/notification-server.js
 * 
 * 브라우저에서 http://localhost:3000 접속
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { sendNotificationToAll } = require('./send-notification');

const app = express();
const PORT = 3000;

const ISSUE_KEYWORDS_PATH = path.join(__dirname, '../docs/issue-keywords.json');

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
  return items.slice(0, 10).map((item, i) => ({
    rank: i + 1,
    keyword: item.keyword,
    ...(item.count !== undefined ? { count: item.count } : {}),
  }));
}

/** 로컬 docs/issue-keywords.json 읽기·저장 (Git 커밋·푸시는 별도) */
app.get('/api/issue-keywords', (req, res) => {
  try {
    if (!fs.existsSync(ISSUE_KEYWORDS_PATH)) {
      return res.json({ keywords: [] });
    }
    const raw = fs.readFileSync(ISSUE_KEYWORDS_PATH, 'utf8');
    const data = JSON.parse(raw);
    const keywords = Array.isArray(data.keywords) ? data.keywords : [];
    res.json({ keywords });
  } catch (error) {
    console.error('❌ issue-keywords 읽기 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message || '파일을 읽을 수 없습니다.',
    });
  }
});

app.put('/api/issue-keywords', (req, res) => {
  try {
    const body = req.body || {};
    const normalized = normalizeIssueKeywords(body.keywords);
    const payload = { keywords: normalized };
    const dir = path.dirname(ISSUE_KEYWORDS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      ISSUE_KEYWORDS_PATH,
      JSON.stringify(payload, null, 2) + '\n',
      'utf8'
    );
    console.log('💾 issue-keywords.json 저장:', normalized.length, '건');
    res.json({ success: true, keywords: normalized });
  } catch (error) {
    console.error('❌ issue-keywords 저장 오류:', error);
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
