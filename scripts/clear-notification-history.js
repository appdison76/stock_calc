/**
 * Firestore notificationHistory 컬렉션의 모든 알림 삭제 스크립트
 * 
 * 사용법:
 * node scripts/clear-notification-history.js
 */

const admin = require('firebase-admin');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Firebase Admin SDK 초기화
const serviceAccountPath = process.env.FIREBASE_ADMIN_KEY || 
  'c:\\projects\\firebase_secretkey\\stock-calculator-e6190-firebase-adminsdk-fbsvc-1bfb538791.json';

let serviceAccount;
try {
  const absolutePath = path.isAbsolute(serviceAccountPath) 
    ? serviceAccountPath 
    : path.resolve(__dirname, serviceAccountPath);
  
  const fileContent = fs.readFileSync(absolutePath, 'utf8');
  serviceAccount = JSON.parse(fileContent);
} catch (error) {
  console.error('❌ Firebase Admin SDK 비밀 키 파일을 찾을 수 없습니다.');
  console.error('경로:', serviceAccountPath);
  console.error('오류:', error.message);
  process.exit(1);
}

// Firebase Admin 초기화
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

/**
 * notificationHistory 컬렉션의 모든 문서 삭제
 */
async function clearNotificationHistory() {
  try {
    console.log('🗑️ Firestore notificationHistory 컬렉션 삭제 시작...');
    
    const notificationsRef = db.collection('notificationHistory');
    const snapshot = await notificationsRef.get();
    
    if (snapshot.empty) {
      console.log('ℹ️ 삭제할 알림이 없습니다.');
      return;
    }
    
    console.log(`📋 총 ${snapshot.size}개의 알림 발견`);
    
    // 배치 삭제 (한 번에 최대 500개)
    const batch = db.batch();
    let count = 0;
    let totalDeleted = 0;
    
    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
      count++;
      totalDeleted++;
      
      // 500개마다 배치 커밋
      if (count >= 500) {
        batch.commit();
        count = 0;
        console.log(`✅ ${totalDeleted}개 삭제 중...`);
      }
    });
    
    // 남은 배치 커밋
    if (count > 0) {
      await batch.commit();
    }
    
    console.log(`✅ 총 ${totalDeleted}개의 알림이 삭제되었습니다.`);
    
  } catch (error) {
    console.error('❌ 알림 삭제 오류:', error);
    throw error;
  }
}

// 확인 메시지
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('⚠️ Firestore의 모든 알림을 삭제하시겠습니까? (yes/no): ', async (answer) => {
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    try {
      await clearNotificationHistory();
      console.log('✅ 완료되었습니다.');
    } catch (error) {
      console.error('❌ 오류 발생:', error);
      process.exit(1);
    }
  } else {
    console.log('❌ 취소되었습니다.');
  }
  
  rl.close();
  process.exit(0);
});
