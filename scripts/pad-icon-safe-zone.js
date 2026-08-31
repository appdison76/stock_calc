/**
 * Android adaptive icon safe zone: 로고를 축소·중앙 배치 (테두리 괄호 잘림 방지)
 * Safe zone ≈ 전체의 66% — 70% 스케일 + 흰 배경
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const SCALE = 0.7;
const FILES = [
  path.join(__dirname, '../assets/icon.png'),
  path.join(__dirname, '../assets/adaptive-icon.png'),
  path.join(__dirname, '../assets/splash-icon.png'),
];

function padIcon(inputPath, outputPath) {
  const src = PNG.sync.read(fs.readFileSync(inputPath));
  const { width, height, data } = src;

  const sw = Math.round(width * SCALE);
  const sh = Math.round(height * SCALE);
  const ox = Math.floor((width - sw) / 2);
  const oy = Math.floor((height - sh) / 2);

  const out = new PNG({ width, height });
  // 흰 배경
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = 255;
    out.data[i + 1] = 255;
    out.data[i + 2] = 255;
    out.data[i + 3] = 255;
  }

  for (let dy = 0; dy < sh; dy++) {
    for (let dx = 0; dx < sw; dx++) {
      const sx = Math.min(width - 1, Math.floor((dx / sw) * width));
      const sy = Math.min(height - 1, Math.floor((dy / sh) * height));
      const si = (width * sy + sx) * 4;
      const oi = (width * (oy + dy) + (ox + dx)) * 4;
      out.data[oi] = data[si];
      out.data[oi + 1] = data[si + 1];
      out.data[oi + 2] = data[si + 2];
      out.data[oi + 3] = data[si + 3];
    }
  }

  fs.writeFileSync(outputPath, PNG.sync.write(out));
  console.log('Wrote', outputPath, `scale=${SCALE}`);
}

// 원본 백업 후 패딩 적용
const backup = path.join(__dirname, '../assets/icon-source.png');
if (!fs.existsSync(backup)) {
  fs.copyFileSync(FILES[0], backup);
  console.log('Backup:', backup);
}

const source = fs.existsSync(backup) ? backup : FILES[0];
for (const f of FILES) {
  padIcon(source, f);
}
