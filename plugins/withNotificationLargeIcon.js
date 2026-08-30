const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

/** expo-notifications: 알림 패널 large icon → 앱 런cher 아이콘 */
const META_DATA_LARGE_ICON = 'expo.modules.notifications.large_notification_icon';
const LARGE_ICON_RESOURCE = '@mipmap/ic_launcher';

const withNotificationLargeIcon = (config) => {
  return withAndroidManifest(config, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);

    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      mainApplication,
      META_DATA_LARGE_ICON,
      LARGE_ICON_RESOURCE,
      'resource'
    );

    return config;
  });
};

module.exports = withNotificationLargeIcon;
