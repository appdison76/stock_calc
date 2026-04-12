import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

/**
 * Google Mobile Ads 배너 광고 단위 ID 설정
 * 
 * 실제 배포용 ID 적용 완료
 * - Android: ca-app-pub-2041836899811349/7383353262
 * - iOS: 추후 iOS 출시 시 실제 ID로 교체 필요
 */
const getAdUnitId = (): string => {
  if (Platform.OS === 'android') {
    // 실제 Android 배너 광고 단위 ID
    return 'ca-app-pub-2041836899811349/7383353262';
  } else if (Platform.OS === 'ios') {
    // iOS 배너 광고 단위 ID (추후 iOS 출시 시 실제 ID로 교체 필요)
    return 'ca-app-pub-3940256099942544/2934735716'; // iOS 테스트 ID (임시)
  }
  
  // 기본값 (웹 등 기타 플랫폼)
  return TestIds.BANNER;
};

interface AdmobBannerProps {
  /** 뉴스 탭 등 좁은 간격용 — 세로 패딩만 줄임 */
  compact?: boolean;
}

export const AdmobBanner: React.FC<AdmobBannerProps> = ({ compact }) => {
  const adUnitId = getAdUnitId();

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
        onAdLoaded={() => {
          console.log(`[${Platform.OS}] AdMob 배너 광고 로드 완료: ${adUnitId}`);
        }}
        onAdFailedToLoad={(error) => {
          // no-fill 에러는 정상적인 동작 (광고 인벤토리 부족)이므로 경고만 출력
          if (error.code === 'googleMobileAds/error-code-no-fill') {
            console.log(`[${Platform.OS}] AdMob 배너 광고 인벤토리 없음 (정상 동작)`);
          } else {
            // 다른 에러는 콘솔에만 기록 (사용자에게는 표시하지 않음)
            console.warn(`[${Platform.OS}] AdMob 배너 광고 로드 실패:`, error.code, error.message);
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1E1E',
    paddingVertical: 8,
  },
  containerCompact: {
    paddingVertical: 4,
  },
});

