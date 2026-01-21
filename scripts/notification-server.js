/**
 * 알림 발송 관리자 웹 서버
 * 
 * 사용법:
 * node scripts/notification-server.js
 * 
 * 브라우저에서 http://localhost:3000 접속
 */

const express = require('express');
const path = require('path');
const { sendNotificationToAll } = require('./send-notification');

const app = express();
const PORT = 3000;

// 정적 파일 제공 (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
