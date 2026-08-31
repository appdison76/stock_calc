const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

/** expo-notifications prebuild 캐시 때문에 구 실루엣(4글자)이 남는 문제 → 「계」 PNG로 덮어쓰기 */
const withNotificationIconSync = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const scriptPath = path.join(projectRoot, 'scripts', 'create-notification-icon.js');
      if (!fs.existsSync(scriptPath)) {
        return config;
      }
      const { execFileSync } = require('child_process');
      execFileSync(process.execPath, [scriptPath], {
        cwd: projectRoot,
        stdio: 'inherit',
      });
      return config;
    },
  ]);
};

module.exports = withNotificationIconSync;
