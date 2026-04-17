/**
 * Firestore recommendedShortcuts/current 에 메인 추천 바로가기 목록을 올립니다.
 *
 * 사용법:
 *   node scripts/seed-recommended-shortcuts-firestore.js
 *   node scripts/seed-recommended-shortcuts-firestore.js path/to/custom.json
 *
 * custom.json 예: { "items": [ { "title": "...", "url": "https://...", "iconEmoji": "📺" } ] }
 *
 * FIREBASE_ADMIN_KEY 환경변수로 서비스 계정 JSON 경로를 줄 수 있습니다.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const DEFAULT_ITEMS = [];

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

function normalizeItems(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (let i = 0; i < raw.length && i < 12; i++) {
    const entry = raw[i];
    if (!entry || typeof entry !== 'object') continue;
    const title = typeof entry.title === 'string' ? entry.title.trim() : '';
    const url = typeof entry.url === 'string' ? entry.url.trim() : '';
    if (!title || !url || !/^https:\/\//i.test(url)) continue;
    const iconEmoji =
      typeof entry.iconEmoji === 'string' && entry.iconEmoji.trim()
        ? entry.iconEmoji.trim()
        : undefined;
    let showOnMain = true;
    if (typeof entry.showOnMain === 'boolean') showOnMain = entry.showOnMain;
    else if (typeof entry.enabled === 'boolean') showOnMain = entry.enabled;
    out.push({
      id: typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : `rs-${out.length}`,
      title,
      url,
      ...(iconEmoji ? { iconEmoji } : {}),
      showOnMain,
      enabled: showOnMain,
      sortOrder: out.length,
    });
  }
  return out;
}

async function main() {
  const customPath = process.argv[2];
  let items = [...DEFAULT_ITEMS];

  if (customPath) {
    const abs = path.isAbsolute(customPath) ? customPath : path.resolve(process.cwd(), customPath);
    if (!fs.existsSync(abs)) {
      console.error('❌ 파일 없음:', abs);
      process.exit(1);
    }
    const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
    if (!data || typeof data !== 'object' || !Array.isArray(data.items)) {
      console.error('❌ JSON에 items 배열이 필요합니다.');
      process.exit(1);
    }
    items = normalizeItems(data.items);
  }

  await db.collection('recommendedShortcuts').doc('current').set(
    {
      items,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log('✅ Firestore recommendedShortcuts/current 시드 완료', items.length, '건');
}

main().catch((e) => {
  console.error('❌ 시드 실패:', e);
  process.exit(1);
});
