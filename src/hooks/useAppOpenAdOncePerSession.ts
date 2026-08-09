import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useAppOpenAd, TestIds } from 'react-native-google-mobile-ads';

/** Android 앱 오픈 광고 단위 (AdMob 콘솔) */
const APP_OPEN_AD_UNIT_ID_ANDROID = 'ca-app-pub-2041836899811349/6664543860';

function getAppOpenAdUnitId(): string | null {
  if (Platform.OS === 'android') {
    return __DEV__ ? TestIds.APP_OPEN : APP_OPEN_AD_UNIT_ID_ANDROID;
  }
  if (Platform.OS === 'ios') {
    return TestIds.APP_OPEN;
  }
  return null;
}

/**
 * Cold start 세션당 1회 앱 오픈 전면 광고.
 * 백그라운드 복귀 시에는 표시하지 않음 (프로세스 유지 동안 shownRef 유지).
 */
export function useAppOpenAdOncePerSession(enabled: boolean): void {
  const shownRef = useRef(false);
  const adUnitId = enabled ? getAppOpenAdUnitId() : null;
  const { isLoaded, load, show, error } = useAppOpenAd(adUnitId, {
    requestNonPersonalizedAdsOnly: false,
  });

  useEffect(() => {
    if (enabled && adUnitId) {
      load();
    }
  }, [enabled, adUnitId, load]);

  useEffect(() => {
    if (
      enabled &&
      isLoaded &&
      !shownRef.current &&
      AppState.currentState === 'active'
    ) {
      shownRef.current = true;
      show();
    }
  }, [enabled, isLoaded, show]);

  useEffect(() => {
    if (!error) return;
    const code = (error as Error & { code?: string }).code;
    if (code === 'googleMobileAds/error-code-no-fill') {
      console.log(`[${Platform.OS}] App Open 광고 인벤토리 없음 (정상 동작)`);
    } else {
      console.warn(`[${Platform.OS}] App Open 광고 로드 실패:`, code, error.message);
    }
  }, [error]);
}
