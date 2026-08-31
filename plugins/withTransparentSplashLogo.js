const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');
const sharp = require('sharp');

const IMAGE_WIDTH_DP = 200;
const CANVAS_DP = 288;

const DENSITIES = [
  { folder: 'drawable-mdpi', multiplier: 1 },
  { folder: 'drawable-hdpi', multiplier: 1.5 },
  { folder: 'drawable-xhdpi', multiplier: 2 },
  { folder: 'drawable-xxhdpi', multiplier: 3 },
  { folder: 'drawable-xxxhdpi', multiplier: 4 },
];

/** expo prebuild가 splashscreen_logo에 흰 사각형을 합성 → Android에서 테두리 보임. 투명 PNG로 교체 */
const withTransparentSplashLogo = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const splashPath = path.join(projectRoot, 'assets', 'splash-icon.png');
      if (!fs.existsSync(splashPath)) {
        return config;
      }

      const resRoot = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');
      const logoBuffer = fs.readFileSync(splashPath);

      for (const { folder, multiplier } of DENSITIES) {
        const canvas = Math.round(CANVAS_DP * multiplier);
        const logoSize = Math.round(IMAGE_WIDTH_DP * multiplier);
        const resized = await sharp(logoBuffer)
          .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();
        const meta = await sharp(resized).metadata();
        const left = Math.round((canvas - meta.width) / 2);
        const top = Math.round((canvas - meta.height) / 2);
        const out = await sharp({
          create: {
            width: canvas,
            height: canvas,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          },
        })
          .composite([{ input: resized, left, top }])
          .png()
          .toBuffer();

        for (const dir of [folder, folder.replace('drawable-', 'drawable-night-')]) {
          const outDir = path.join(resRoot, dir);
          fs.mkdirSync(outDir, { recursive: true });
          fs.writeFileSync(path.join(outDir, 'splashscreen_logo.png'), out);
        }
      }

      return config;
    },
  ]);
};

module.exports = withTransparentSplashLogo;
