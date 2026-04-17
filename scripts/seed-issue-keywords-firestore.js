/**
 * Firestore issueKeywords/current 에 기본 키워드 목록을 올립니다.
 *
 * 사용법:
 *   node scripts/seed-issue-keywords-firestore.js
 *   node scripts/seed-issue-keywords-firestore.js path/to/custom.json   (keywords 배열 포함 JSON)
 *
 * FIREBASE_ADMIN_KEY 환경변수로 서비스 계정 JSON 경로를 줄 수 있습니다.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

/** 저장소에 두었던 기본 목록 (docs/issue-keywords.json 제거 후 내장) */
const DEFAULT_KEYWORDS = [
  { rank: 1, keyword: '이란', count: 1038 },
  { rank: 2, keyword: '트럼프', count: 218 },
  { rank: 3, keyword: '양자컴퓨터', count: 69 },
  { rank: 4, keyword: '원전', count: 50 },
  { rank: 5, keyword: '코로나', count: 43 },
  { rank: 6, keyword: '스테이블코인', count: 40 },
  { rank: 7, keyword: '스페이스x', count: 37 },
  { rank: 8, keyword: '미래에셋증권', count: 32 },
  { rank: 9, keyword: '일동제약', count: 28 },
  { rank: 10, keyword: '네이버', count: 25 },
  { rank: 11, keyword: '비료', count: 19 },
  { rank: 12, keyword: '후성', count: 18 },
  { rank: 13, keyword: '초전도체', count: 17 },
  { rank: 14, keyword: '양자', count: 15 },
  { rank: 15, keyword: '삼성sdi', count: 12 },
  { rank: 16, keyword: '고영', count: 12 },
  { rank: 17, keyword: '보안', count: 12 },
  { rank: 18, keyword: '전고체', count: 11 },
  { rank: 19, keyword: '아모레', count: 10 },
  { rank: 20, keyword: '폴더블', count: 9 },
];

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
  let keywords = DEFAULT_KEYWORDS;

  if (customPath) {
    const abs = path.isAbsolute(customPath) ? customPath : path.resolve(process.cwd(), customPath);
    if (!fs.existsSync(abs)) {
      console.error('❌ 파일 없음:', abs);
      process.exit(1);
    }
    const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
    if (!Array.isArray(data.keywords)) {
      console.error('❌ JSON에 keywords 배열이 없습니다.');
      process.exit(1);
    }
    keywords = data.keywords;
  }

  await db.collection('issueKeywords').doc('current').set(
    {
      keywords,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log('✅ Firestore issueKeywords/current 시드 완료 (', keywords.length, '건)');
}

main().catch((e) => {
  console.error('❌ 시드 실패:', e);
  process.exit(1);
});
