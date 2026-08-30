/**
 * 앱 아이콘과 동일한 구성(squircle 테두리 + 상승선 + =)의 Android 알림 아이콘 생성
 * Android 상태바는 단색 실루엣만 표시하므로 흰색/투명으로 만듦
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const INPUT = path.join(__dirname, '../assets/icon.png');
const OUTPUT = path.join(__dirname, '../assets/notification-icon.png');
const OUT_SIZE = 96;

const DARK_THRESHOLD = 200;
const LIGHT_THRESHOLD = 210;
const OUTER_BLACK_THRESHOLD = 45;

function lum(r, g, b) {
  return (r + g + b) / 3;
}

function isDark(r, g, b, a) {
  return a > 20 && lum(r, g, b) < DARK_THRESHOLD;
}

function isLight(r, g, b, a) {
  return a > 20 && lum(r, g, b) >= LIGHT_THRESHOLD;
}

function isOuterBlack(r, g, b, a) {
  return a > 20 && lum(r, g, b) < OUTER_BLACK_THRESHOLD;
}

function buildMask(width, height, data) {
  const mask = new Uint8Array(width * height);

  const at = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return null;
    const i = (width * y + x) * 4;
    return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) * 4;
      const p = { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };

      if (isDark(p.r, p.g, p.b, p.a)) {
        mask[width * y + x] = 255;
        continue;
      }

      if (isLight(p.r, p.g, p.b, p.a)) {
        const neighbors = [
          [-1, 0], [1, 0], [0, -1], [0, 1],
          [-1, -1], [1, -1], [-1, 1], [1, 1],
        ];
        for (const [dx, dy] of neighbors) {
          const n = at(x + dx, y + dy);
          if (!n || n.a < 20 || isOuterBlack(n.r, n.g, n.b, n.a)) {
            mask[width * y + x] = 255;
            break;
          }
        }
      }
    }
  }

  const dilated = new Uint8Array(mask);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (mask[width * y + x]) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (mask[width * (y + dy) + (x + dx)]) {
            near = true;
            break;
          }
        }
      }
      if (near) dilated[width * y + x] = 255;
    }
  }

  return dilated;
}

function downscale(mask, width, height, outSize) {
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

function main() {
  const src = PNG.sync.read(fs.readFileSync(INPUT));
  const mask = buildMask(src.width, src.height, src.data);
  const out = downscale(mask, src.width, src.height, OUT_SIZE);
  fs.writeFileSync(OUTPUT, PNG.sync.write(out));
  console.log('Wrote', OUTPUT);
}

main();
