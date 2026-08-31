/**
 * 헤더용 로고: 흰 배경 → 투명 (다크 헤더와 일체감)
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const INPUT = path.join(__dirname, '../assets/icon-source.png');
const OUTPUT = path.join(__dirname, '../assets/icon-header.png');
const WHITE_THRESHOLD = 248;

function isWhite(r, g, b, a) {
  return a > 20 && r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD;
}

/** 다크 헤더용: 검정 → 흰색, 빨강 유지 */
function mapForDarkHeader(r, g, b, a) {
  if (a < 20) return { r: 0, g: 0, b: 0, a: 0 };
  if (isWhite(r, g, b, a)) return { r: 0, g: 0, b: 0, a: 0 };
  const isRed = r > 160 && g < 120 && b < 120;
  if (isRed) return { r, g, b, a: 255 };
  return { r: 255, g: 255, b: 255, a: 255 };
}

function main() {
  const src = PNG.sync.read(fs.readFileSync(INPUT));
  const { width, height, data } = src;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  const out = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) * 4;
      const mapped = mapForDarkHeader(
        data[i],
        data[i + 1],
        data[i + 2],
        data[i + 3]
      );
      out.data[i] = mapped.r;
      out.data[i + 1] = mapped.g;
      out.data[i + 2] = mapped.b;
      out.data[i + 3] = mapped.a;
      if (mapped.a > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // 콘텐츠 영역만 크롭 (+2% 패딩)
  const padX = Math.round((maxX - minX) * 0.02);
  const padY = Math.round((maxY - minY) * 0.02);
  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(width - 1, maxX + padX);
  maxY = Math.min(height - 1, maxY + padY);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;

  const cropped = new PNG({ width: cw, height: ch });
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = (width * (minY + y) + (minX + x)) * 4;
      const oi = (cw * y + x) * 4;
      cropped.data[oi] = out.data[si];
      cropped.data[oi + 1] = out.data[si + 1];
      cropped.data[oi + 2] = out.data[si + 2];
      cropped.data[oi + 3] = out.data[si + 3];
    }
  }

  fs.writeFileSync(OUTPUT, PNG.sync.write(cropped));
  console.log('Wrote', OUTPUT, `${cw}x${ch}`);
}

main();
