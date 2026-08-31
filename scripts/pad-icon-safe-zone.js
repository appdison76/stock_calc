/**
 * Android adaptive icon safe zone: 로고 내용 크롭 → 축소 → 캔버스 정중앙 (테두리 괄호 잘림 방지)
 * Safe zone ≈ 전체의 66% — 크롭 후 약 52% 영역에 맞춤 (런처에서 과대 표시 방지)
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const SCALE = 0.52;
/** 스플래시: 런처(52%)보다 크게, 240dp·78%는 괄호 테두리 잘림 */
const SPLASH_SCALE = 0.62;
/** 화살표·괄호 비대칭 보정 (0 = 기하학적 중앙) */
const OPTICAL_OFFSET_X = 0;
const OPTICAL_OFFSET_Y = 0;
const WHITE_THRESHOLD = 248;
const LAUNCHER_FILES = [
  path.join(__dirname, '../assets/icon.png'),
  path.join(__dirname, '../assets/adaptive-icon.png'),
];
const SPLASH_FILE = path.join(__dirname, '../assets/splash-icon.png');

function isContentPixel(r, g, b, a) {
  if (a < 20) return false;
  return !(r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD);
}

function cropToContent(src) {
  const { width, height, data } = src;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) * 4;
      if (isContentPixel(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return src;
  }

  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.03);
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;

  const cropped = new PNG({ width: cw, height: ch });
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = (width * (minY + y) + (minX + x)) * 4;
      const oi = (cw * y + x) * 4;
      cropped.data[oi] = data[si];
      cropped.data[oi + 1] = data[si + 1];
      cropped.data[oi + 2] = data[si + 2];
      cropped.data[oi + 3] = data[si + 3];
    }
  }
  return cropped;
}

function samplePixel(src, sx, sy) {
  const { width, height, data } = src;
  const x = Math.max(0, Math.min(width - 1, sx));
  const y = Math.max(0, Math.min(height - 1, sy));
  const i = (width * y + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

function padIcon(inputPath, outputPath, scale = SCALE, transparentBackground = false) {
  const src = PNG.sync.read(fs.readFileSync(inputPath));
  const cropped = cropToContent(src);
  const { width, height } = src;

  const maxW = Math.round(width * scale);
  const maxH = Math.round(height * scale);
  const fitScale = Math.min(maxW / cropped.width, maxH / cropped.height);
  const tw = Math.max(1, Math.round(cropped.width * fitScale));
  const th = Math.max(1, Math.round(cropped.height * fitScale));
  const ox = Math.floor((width - tw) / 2 + width * OPTICAL_OFFSET_X);
  const oy = Math.floor((height - th) / 2 + height * OPTICAL_OFFSET_Y);

  const out = new PNG({ width, height });
  for (let i = 0; i < out.data.length; i += 4) {
    if (transparentBackground) {
      out.data[i] = 0;
      out.data[i + 1] = 0;
      out.data[i + 2] = 0;
      out.data[i + 3] = 0;
    } else {
      out.data[i] = 255;
      out.data[i + 1] = 255;
      out.data[i + 2] = 255;
      out.data[i + 3] = 255;
    }
  }

  for (let dy = 0; dy < th; dy++) {
    for (let dx = 0; dx < tw; dx++) {
      const sx = ((dx + 0.5) / tw) * cropped.width - 0.5;
      const sy = ((dy + 0.5) / th) * cropped.height - 0.5;
      const [r, g, b, a] = samplePixel(cropped, Math.round(sx), Math.round(sy));
      const oi = (width * (oy + dy) + (ox + dx)) * 4;
      if (a < 20) continue;
      out.data[oi] = r;
      out.data[oi + 1] = g;
      out.data[oi + 2] = b;
      out.data[oi + 3] = 255;
    }
  }

  fs.writeFileSync(outputPath, PNG.sync.write(out));
  console.log(
    'Wrote',
    outputPath,
    `crop=${cropped.width}x${cropped.height}`,
    `placed=${tw}x${th}`,
    `offset=(${ox},${oy})`,
  );
}

const backup = path.join(__dirname, '../assets/icon-source.png');
if (!fs.existsSync(backup)) {
  fs.copyFileSync(LAUNCHER_FILES[0], backup);
  console.log('Backup:', backup);
}

const source = fs.existsSync(backup) ? backup : LAUNCHER_FILES[0];
for (const f of LAUNCHER_FILES) {
  padIcon(source, f, SCALE, false);
}
padIcon(source, SPLASH_FILE, SPLASH_SCALE, true);
