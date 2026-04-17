/**
 * Firestore interestRates/current 에 메인 대시보드용 기준금리를 올립니다.
 *
 * 사용법:
 *   node scripts/seed-interest-rates-firestore.js
 *   node scripts/seed-interest-rates-firestore.js path/to/custom.json
 *
 * FIREBASE_ADMIN_KEY 환경변수로 서비스 계정 JSON 경로를 줄 수 있습니다.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const DEFAULT_PAYLOAD = {
  us: '3.50~3.75',
  kr: 2.5,
  jp: 0.75,
};

const serviceAccountPath =
  process.env.FIREBASE_ADMIN_KEY ||
  'c:\\projects\\firebase_secretkey\\stock-calculator-e6190-firebase-adminsdk-fbsvc-1bfb538791.json';

let serviceAccount;
try {
  const absolutePath = path.isAbsolute(serviceAccountPath)
    ? serviceAccountPath
    : path.resolve(__dirname, serviceAccountPath);
  serviceAccount = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
} catch (error) {
  console.error('❌ 서비스 계정 키를 읽을 수 없습니다:', error.message);
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function main() {
  const customPath = process.argv[2];
  let payload = { ...DEFAULT_PAYLOAD };

  if (customPath) {
    const abs = path.isAbsolute(customPath) ? customPath : path.resolve(process.cwd(), customPath);
    if (!fs.existsSync(abs)) {
      console.error('❌ 파일 없음:', abs);
      process.exit(1);
    }
    const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
    if (typeof data.us === 'undefined' || typeof data.kr === 'undefined' || typeof data.jp === 'undefined') {
      console.error('❌ JSON에 us, kr, jp 가 필요합니다.');
      process.exit(1);
    }
    payload = { us: data.us, kr: data.kr, jp: data.jp };
  }

  await db.collection('interestRates').doc('current').set(
    {
      ...payload,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log('✅ Firestore interestRates/current 시드 완료', payload);
}

main().catch((e) => {
  console.error('❌ 시드 실패:', e);
  process.exit(1);
});
