/**
 * 라이트 헤더용 로고: 흰 배경 제거 + 원본 색(검정·빨강) 유지 + 타이트 크롭
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const INPUT = path.join(__dirname, '../assets/icon-source.png');
const OUTPUT = path.join(__dirname, '../assets/icon-header-light.png');
const WHITE_THRESHOLD = 248;

function isWhite(r, g, b, a) {
  return a > 20 && r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD;
}

function cropContent(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) * 4;
      if (data[i + 3] > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
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

function main() {
  const src = PNG.sync.read(fs.readFileSync(INPUT));
  const { width, height, data } = src;
  const out = new PNG({ width, height });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (isWhite(r, g, b, a)) {
      out.data[i + 3] = 0;
    } else {
      out.data[i] = r;
      out.data[i + 1] = g;
      out.data[i + 2] = b;
      out.data[i + 3] = a;
    }
  }

  const cropped = cropContent(out.data, width, height);
  fs.writeFileSync(OUTPUT, PNG.sync.write(cropped));
  console.log('Wrote', OUTPUT, `${cropped.width}x${cropped.height}`);
}

main();
