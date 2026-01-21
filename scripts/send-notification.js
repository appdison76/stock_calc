/**
 * Expo Push 알림 발송 관리자 스크립트
 * 
 * 사용법:
 * node scripts/send-notification.js "알림 제목" "알림 내용"
 * 
 * 또는 대화형 모드:
 * node scripts/send-notification.js
 */

const { Expo } = require('expo-server-sdk');
const admin = require('firebase-admin');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Firebase Admin SDK 초기화
// 비밀 키 파일 경로를 환경변수나 직접 지정
const serviceAccountPath = process.env.FIREBASE_ADMIN_KEY || 
  'c:\\projects\\firebase_secretkey\\stock-calculator-e6190-firebase-adminsdk-fbsvc-1bfb538791.json';

let serviceAccount;
try {
  // 절대 경로로 변환
  const absolutePath = path.isAbsolute(serviceAccountPath) 
    ? serviceAccountPath 
    : path.resolve(__dirname, serviceAccountPath);
  
  const fileContent = fs.readFileSync(absolutePath, 'utf8');
  serviceAccount = JSON.parse(fileContent);
} catch (error) {
  console.error('❌ Firebase Admin SDK 비밀 키 파일을 찾을 수 없습니다.');
  console.error('경로:', serviceAccountPath);
  console.error('오류:', error.message);
  console.error('\n해결 방법:');
  console.error('1. Firebase Console → 프로젝트 설정 → 서비스 계정에서 비밀 키 다운로드');
  console.error('2. 파일을 scripts/ 폴더에 저장하거나');
  console.error('3. 환경변수 FIREBASE_ADMIN_KEY에 파일 경로 설정');
  process.exit(1);
}

// Firebase Admin 초기화
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Expo Push Notification 클라이언트 생성
const expo = new Expo();

/**
 * 모든 사용자에게 알림 발송
 * @param {string} title - 알림 제목
 * @param {string} body - 알림 내용
 * @param {object} data - 추가 데이터
 * @param {string} imageUrl - 이미지 URL (선택사항)
 */
async function sendNotificationToAll(title, body, data = {}, imageUrl = null) {
  try {
    console.log('📡 Firestore에서 알림 토큰 조회 중...');
    
    // Firestore에서 모든 토큰 가져오기
    const tokensSnapshot = await db.collection('notificationTokens').get();
    
    if (tokensSnapshot.empty) {
      console.log('⚠️ 등록된 알림 토큰이 없습니다.');
      return;
    }

    const tokens = [];
    tokensSnapshot.forEach((doc) => {
      const tokenData = doc.data();
      if (tokenData.token) {
        tokens.push(tokenData.token);
      }
    });

    console.log(`📱 총 ${tokens.length}개의 토큰 발견`);

    if (tokens.length === 0) {
      console.log('⚠️ 유효한 토큰이 없습니다.');
      return;
    }

    // Expo Push Token 형식 검증 및 필터링
    const validTokens = tokens.filter(token => {
      return Expo.isExpoPushToken(token);
    });

    if (validTokens.length === 0) {
      console.log('⚠️ 유효한 Expo Push Token이 없습니다.');
      console.log('토큰 형식 확인:', tokens[0]?.substring(0, 20) + '...');
      return;
    }

    console.log(`✅ 유효한 Expo Push Token: ${validTokens.length}개`);

    // Expo Push 알림 메시지 생성
    const messages = validTokens.map(token => {
      const message = {
        to: token,
        sound: 'default',
        title,
        body,
        data: data || {},
      };
      
      // 이미지가 있으면 추가
      if (imageUrl) {
        console.log('🖼️ 이미지 URL 추가:', imageUrl);
        // Android에서 큰 이미지를 아래에 표시하기 위한 설정
        message.android = {
          priority: 'high',
          channelId: 'default',
          // BigPicture 스타일을 위한 추가 설정
          style: {
            type: 'bigpicture',
            picture: imageUrl,
            largeIcon: imageUrl,  // 큰 아이콘으로도 사용
          }
        };
        // richContent에도 이미지 포함
        message.richContent = {
          image: imageUrl
        };
        // iOS에서도 이미지 표시를 위한 image 필드
        message.image = imageUrl;
        console.log('📝 메시지 형식:', JSON.stringify(message, null, 2));
      }
      
      return message;
    });

    // Expo Push Notification API로 발송
    console.log('📤 알림 발송 중...');
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('❌ 알림 발송 중 오류:', error);
      }
    }

    // 결과 확인
    let successCount = 0;
    let failureCount = 0;
    const errors = [];

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket.status === 'ok') {
        successCount++;
      } else {
        failureCount++;
        errors.push({
          token: validTokens[i],
          error: ticket.message || 'Unknown error',
        });
      }
    }

    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${failureCount}개`);
    
    if (errors.length > 0) {
      errors.forEach((err, idx) => {
        console.error(`  토큰 ${idx + 1} 실패:`, err.error);
      });
    }

    // 발송 이력 저장
    await db.collection('notificationHistory').add({
      title,
      body,
      data,
      imageUrl: imageUrl || null,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      totalTokens: validTokens.length,
      successCount,
      failureCount,
      errors: errors.length > 0 ? errors.map(e => ({ token: e.token.substring(0, 20) + '...', error: e.error })) : [],
    });

    console.log('📝 발송 이력 저장 완료');

    // 결과 반환 (Express 서버에서 사용)
    return {
      successCount,
      failureCount,
      totalTokens: validTokens.length,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    console.error('❌ 알림 발송 오류:', error);
    throw error;
  }
}

/**
 * 대화형 모드
 */
function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('알림 제목: ', (title) => {
    rl.question('알림 내용: ', async (body) => {
      rl.question('추가 데이터 (JSON 형식, 선택사항): ', async (dataStr) => {
        let data = {};
        if (dataStr.trim()) {
          try {
            data = JSON.parse(dataStr);
          } catch (e) {
            console.error('❌ JSON 파싱 오류:', e.message);
            rl.close();
            return;
          }
        }

        await sendNotificationToAll(title, body, data);
        rl.close();
      });
    });
  });
}

// 메인 실행
const args = process.argv.slice(2);

if (args.length >= 2) {
  // 명령줄 인자로 실행
  const title = args[0];
  const body = args[1];
  let data = {};
  if (args[2]) {
    try {
      data = JSON.parse(args[2]);
    } catch (e) {
      console.warn('⚠️ 세 번째 인자가 유효한 JSON이 아닙니다. 빈 객체를 사용합니다.');
    }
  }
  
  sendNotificationToAll(title, body, data)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
} else {
  // 대화형 모드
  console.log('📢 Firebase 알림 발송 관리자');
  console.log('대화형 모드로 실행합니다.\n');
  interactiveMode();
}

// sendNotificationToAll 함수를 export (Express 서버에서 사용)
module.exports = { sendNotificationToAll };
