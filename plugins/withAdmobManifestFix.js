const { withAndroidManifest } = require('expo/config-plugins');

/**
 * AndroidManifest.xml에서 DELAY_APP_MEASUREMENT_INIT 메타데이터 충돌을 해결하는 플러그인
 */
const withAdmobManifestFix = (config) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const { manifest } = androidManifest;

    if (!manifest.application || !manifest.application[0]) {
      return config;
    }

    const application = manifest.application[0];
    if (!application['meta-data']) {
      application['meta-data'] = [];
    }

    // manifest에 tools 네임스페이스 추가 (없는 경우)
    if (!manifest.$) {
      manifest.$ = {};
    }
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    // DELAY_APP_MEASUREMENT_INIT 메타데이터 찾기 또는 추가
    const metaDataArray = application['meta-data'];
    const existingIndex = metaDataArray.findIndex(
      (meta) =>
        meta.$ &&
        meta.$['android:name'] ===
          'com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT'
    );

    const metaData = {
      $: {
        'android:name': 'com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT',
        'android:value': 'false',
        'tools:replace': 'android:value',
      },
    };

    if (existingIndex >= 0) {
      // 기존 메타데이터 교체
      metaDataArray[existingIndex] = metaData;
    } else {
      // 새 메타데이터 추가
      metaDataArray.push(metaData);
    }

    return config;
  });
};

module.exports = withAdmobManifestFix;

