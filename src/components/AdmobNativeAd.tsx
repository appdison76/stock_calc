import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, Image } from 'react-native';
import { NativeAd, NativeAdView, TestIds, NativeAsset, NativeAssetType, NativeMediaView } from 'react-native-google-mobile-ads';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Google Mobile Ads 네이티브 광고 고급형 단위 ID 설정
 * 
 * 실제 배포용 ID 적용 완료
 * - Android: ca-app-pub-2041836899811349/2117851628
 * - iOS: 추후 iOS 출시 시 실제 ID로 교체 필요
 */
const getAdUnitId = (): string => {
  if (Platform.OS === 'android') {
    // 실제 Android 네이티브 광고 단위 ID
    return 'ca-app-pub-2041836899811349/2117851628';
  } else if (Platform.OS === 'ios') {
    // iOS 네이티브 광고 단위 ID (추후 iOS 출시 시 실제 ID로 교체 필요)
    return TestIds.NATIVE_ADVANCED; // iOS 테스트 ID (임시)
  }
  
  // 기본값 (웹 등 기타 플랫폼)
  return TestIds.NATIVE_ADVANCED;
};

interface AdmobNativeAdProps {
  style?: any;
}

export const AdmobNativeAd: React.FC<AdmobNativeAdProps> = ({ style }) => {
  const adUnitId = getAdUnitId();
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);

  useEffect(() => {
    // NativeAd 객체 생성
    NativeAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: false,
    })
      .then((ad) => {
        setNativeAd(ad);
        console.log(`[${Platform.OS}] AdMob 네이티브 광고 로드 완료: ${adUnitId}`);
      })
      .catch((error) => {
        // no-fill 에러는 정상적인 동작 (광고 인벤토리 부족)
        if (error.code === 'googleMobileAds/error-code-no-fill') {
          console.log(`[${Platform.OS}] AdMob 네이티브 광고 인벤토리 없음 (정상 동작)`);
        } else {
          console.warn(`[${Platform.OS}] AdMob 네이티브 광고 로드 실패:`, error.code, error.message);
        }
        setNativeAd(null);
      });

    // Cleanup: 컴포넌트 언마운트 시 NativeAd 객체 destroy
    return () => {
      if (nativeAd) {
        nativeAd.destroy();
      }
    };
  }, []);

  // NativeAd가 로드되지 않았으면 렌더링하지 않음
  if (!nativeAd) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <NativeAdView nativeAd={nativeAd} style={styles.nativeAdView}>
        <LinearGradient
          colors={['rgba(18, 18, 18, 0.8)', 'rgba(30, 30, 30, 0.6)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.adCard}
        >
          <View style={styles.adContent}>
            {/* 광고 라벨 */}
            <View style={styles.adLabelContainer}>
              <Text style={styles.adLabel}>광고</Text>
            </View>

            {/* 아이콘과 텍스트 영역 */}
            <View style={styles.adHeader}>
              {nativeAd.icon && (
                <NativeAsset assetType={NativeAssetType.ICON}>
                  <Image 
                    source={{ uri: nativeAd.icon.url }} 
                    style={styles.adIcon}
                  />
                </NativeAsset>
              )}
              <View style={styles.adTextContainer}>
                {nativeAd.headline && (
                  <NativeAsset assetType={NativeAssetType.HEADLINE}>
                    <Text style={styles.adHeadline}>{nativeAd.headline}</Text>
                  </NativeAsset>
                )}
                {nativeAd.body && (
                  <NativeAsset assetType={NativeAssetType.BODY}>
                    <Text style={styles.adTagline}>{nativeAd.body}</Text>
                  </NativeAsset>
                )}
              </View>
            </View>

            {/* 미디어 뷰 */}
            {nativeAd.mediaContent && (
              <NativeMediaView style={styles.mediaView} />
            )}

            {/* 광고주 정보 */}
            {nativeAd.advertiser && (
              <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                <Text style={styles.advertiser}>{nativeAd.advertiser}</Text>
              </NativeAsset>
            )}

            {/* CTA 버튼 */}
            {nativeAd.callToAction && (
              <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
                <View style={styles.ctaButton}>
                  <Text style={styles.ctaButtonText}>{nativeAd.callToAction}</Text>
                </View>
              </NativeAsset>
            )}
          </View>
        </LinearGradient>
      </NativeAdView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 8,
  },
  nativeAdView: {
    width: '100%',
    minHeight: 100,
  },
  adCard: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  adContent: {
    width: '100%',
  },
  adLabelContainer: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(66, 165, 245, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 12,
  },
  adLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#42A5F5',
    letterSpacing: 0.5,
  },
  adHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  adIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 12,
  },
  adTextContainer: {
    flex: 1,
  },
  adHeadline: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  adTagline: {
    fontSize: 13,
    color: '#B0BEC5',
    lineHeight: 18,
  },
  mediaView: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  advertiser: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 12,
  },
  ctaButton: {
    backgroundColor: '#42A5F5',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
