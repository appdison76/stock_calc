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

export const AdmobBanner: React.FC = () => {
  const adUnitId = getAdUnitId();

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdLoaded={() => {
          console.log(`[${Platform.OS}] AdMob 배너 광고 로드 완료: ${adUnitId}`);
        }}
        onAdFailedToLoad={(error) => {
          console.error(`[${Platform.OS}] AdMob 배너 광고 로드 실패:`, error);
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
});

