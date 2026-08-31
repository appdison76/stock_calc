/**
 * Android 상태바 알림 아이콘 — 흰색 실루엣 / 투명 배경 (96×96)
 * 기본: 한글 「계」 단일 글자 (작은 크기에서도 식별 용이)
 *
 * 사용: node scripts/create-notification-icon.js
 *       node scripts/create-notification-icon.js --from-app-icon  (구: icon.png 실루엣)
 */
const fs = require('fs');
const path = require('path');

const OUTPUT = path.join(__dirname, '../assets/notification-icon.png');
const ANDROID_RES = path.join(__dirname, '../android/app/src/main/res');
const OUT_SIZE = 96;
const CHAR = '계';
/** expo-notifications: baseline 24dp × density */
const ANDROID_DPI = [
  { folder: 'drawable-mdpi', px: 24 },
  { folder: 'drawable-hdpi', px: 36 },
  { folder: 'drawable-xhdpi', px: 48 },
  { folder: 'drawable-xxhdpi', px: 72 },
  { folder: 'drawable-xxxhdpi', px: 96 },
];

async function writeCharIcon() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('sharp 패키지가 필요합니다: npm install --save-dev sharp');
    process.exit(1);
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_SIZE}" height="${OUT_SIZE}" viewBox="0 0 ${OUT_SIZE} ${OUT_SIZE}">
  <text
    x="50%"
    y="54%"
    dominant-baseline="middle"
    text-anchor="middle"
    fill="#FFFFFF"
    font-family="Noto Sans CJK KR, Noto Sans KR, Malgun Gothic, Apple SD Gothic Neo, sans-serif"
    font-size="58"
    font-weight="700"
  >${CHAR}</text>
</svg>`;

  await sharp(Buffer.from(svg))
    .resize(OUT_SIZE, OUT_SIZE)
    .png()
    .toFile(OUTPUT);

  console.log('Wrote', OUTPUT, `(「${CHAR}」)`);
  await syncAndroidDrawables(sharp, svg);
}

async function syncAndroidDrawables(sharp, svg) {
  if (!fs.existsSync(ANDROID_RES)) {
    console.log('Skip android drawables (no android/ folder)');
    return;
  }
  for (const { folder, px } of ANDROID_DPI) {
    const fontSize = Math.round(px * 0.58);
    const sizedSvg = svg.replace(/font-size="58"/, `font-size="${fontSize}"`);
    const outDir = path.join(ANDROID_RES, folder);
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'notification_icon.png');
    await sharp(Buffer.from(sizedSvg))
      .resize(px, px)
      .png()
      .toFile(outPath);
    console.log('Wrote', outPath);
  }
}

function lum(r, g, b) {
  return (r + g + b) / 3;
}

function isWhiteBackground(r, g, b, a) {
  const WHITE_THRESHOLD = 235;
  return a > 20 && lum(r, g, b) >= WHITE_THRESHOLD && r >= 230 && g >= 230 && b >= 230;
}

function isLogoContent(r, g, b, a) {
  if (a < 20) return false;
  return !isWhiteBackground(r, g, b, a);
}

function buildMask(width, height, data) {
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) * 4;
      if (isLogoContent(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        mask[width * y + x] = 255;
      }
    }
  }

  const dilated = new Uint8Array(mask);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (mask[width * y + x]) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (mask[width * (y + dy) + (x + dx)]) {
            dilated[width * y + x] = 255;
            break;
          }
        }
      }
    }
  }
  return dilated;
}

function downscale(mask, width, height, outSize) {
  const { PNG } = require('pngjs');
  const out = new PNG({ width: outSize, height: outSize });
  for (let oy = 0; oy < outSize; oy++) {
    for (let ox = 0; ox < outSize; ox++) {
      const sx0 = Math.floor((ox / outSize) * width);
      const sx1 = Math.floor(((ox + 1) / outSize) * width);
      const sy0 = Math.floor((oy / outSize) * height);
      const sy1 = Math.floor(((oy + 1) / outSize) * height);

      let maxAlpha = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          maxAlpha = Math.max(maxAlpha, mask[width * sy + sx]);
        }
      }

      const oi = (outSize * oy + ox) * 4;
      if (maxAlpha > 0) {
        out.data[oi] = 255;
        out.data[oi + 1] = 255;
        out.data[oi + 2] = 255;
        out.data[oi + 3] = maxAlpha;
      }
    }
  }
  return out;
}

function writeFromAppIcon() {
  const { PNG } = require('pngjs');
  const INPUT = path.join(__dirname, '../assets/icon.png');
  const src = PNG.sync.read(fs.readFileSync(INPUT));
  const mask = buildMask(src.width, src.height, src.data);
  const out = downscale(mask, src.width, src.height, OUT_SIZE);
  fs.writeFileSync(OUTPUT, PNG.sync.write(out));
  console.log('Wrote', OUTPUT, '(from app icon silhouette)');
}

async function main() {
  if (process.argv.includes('--from-app-icon')) {
    writeFromAppIcon();
    return;
  }
  await writeCharIcon();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
