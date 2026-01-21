import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import mobileAds from 'react-native-google-mobile-ads';
import { checkAppVersion } from '../src/services/versionCheck';
import ForceUpdateModal from '../src/components/ForceUpdateModal';
import { getNotificationToken, setupNotificationListeners } from '../src/services/NotificationService';
import { initializeFirebase } from '../src/services/FirebaseService';

const headerButtonStyles = StyleSheet.create({
  homeButton: {
    marginRight: 16,
    padding: 4,
  },
  homeButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
});

// 홈 버튼 컴포넌트
function HomeButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push('/')}
      style={headerButtonStyles.homeButton}
      activeOpacity={0.7}
    >
      <Text style={headerButtonStyles.homeButtonText}>⌂</Text>
    </TouchableOpacity>
  );
}

export default function RootLayout() {
  const router = useRouter();
  const [forceUpdateVisible, setForceUpdateVisible] = useState(false);
  const [versionInfo, setVersionInfo] = useState<{
    currentVersion: string;
    requiredVersion: string;
  } | null>(null);

  useEffect(() => {
    // 버전 체크 (실제 릴리즈 빌드에서만 실행)
    // Application.nativeApplicationVersion이 존재하는 경우에만 체크
    // 개발 모드(Metro 서버 연결)에서는 보통 null이지만, 릴리즈 빌드(테스트 트랙 포함)에서는 항상 값이 있음
    const checkVersion = async () => {
      const nativeVersion = Application.nativeApplicationVersion;
      const executionEnvironment = Constants.executionEnvironment;
      
      console.log('[Version Check] executionEnvironment:', executionEnvironment);
      console.log('[Version Check] nativeApplicationVersion:', nativeVersion);
      
      // nativeApplicationVersion이 존재하는 경우 릴리즈 빌드로 간주
      const isReleaseBuild = nativeVersion !== null && nativeVersion !== undefined;
      console.log('[Version Check] isReleaseBuild:', isReleaseBuild);
      
      if (isReleaseBuild) {
        try {
          const version = await checkAppVersion();
          console.log('[Version Check] version info:', JSON.stringify(version, null, 2));
          if (version.needsUpdate) {
            console.log('[Version Check] Update required! Showing force update modal.');
            setVersionInfo({
              currentVersion: version.currentVersion,
              requiredVersion: version.minRequiredVersion,
            });
            setForceUpdateVisible(true);
          } else {
            console.log('[Version Check] No update required. Current:', version.currentVersion, 'Required:', version.minRequiredVersion);
          }
        } catch (error) {
          console.error('[Version Check] Error checking version:', error);
        }
      } else {
        console.log('[Version Check] Skipping version check (not a release build - nativeVersion is null/undefined)');
      }
    };
    
    checkVersion();

    // Firebase 초기화 (먼저 실행)
    console.log('🔵 Firebase 초기화 시작...');
    const firebaseApp = initializeFirebase();
    if (firebaseApp) {
      console.log('✅ Firebase 초기화 성공!');
    } else {
      console.error('❌ Firebase 초기화 실패!');
    }

    // Google Mobile Ads 초기화
    mobileAds()
      .initialize()
      .then(adapterStatuses => {
        console.log('Google Mobile Ads initialized:', adapterStatuses);
      })
      .catch(error => {
        console.error('Google Mobile Ads initialization error:', error);
      });

    // 알림 초기화 (Firebase 초기화 후 실행)
    const initializeNotifications = async () => {
      try {
        // Firebase 초기화 확인
        console.log('🔵 알림 초기화 시작...');
        
        // 알림 토큰 생성 (권한 요청 포함)
        const token = await getNotificationToken();
        if (token) {
          console.log('✅ 알림 토큰 생성 완료:', token);
        } else {
          console.log('⚠️ 알림 토큰 생성 실패 (권한 거부 또는 오류)');
        }
      } catch (error: any) {
        console.error('❌ 알림 초기화 오류:', error);
        console.error('오류 상세:', error.message);
        console.error('오류 스택:', error.stack);
      }
    };

    // Firebase 초기화 후 약간의 지연을 두고 알림 초기화
    setTimeout(() => {
      initializeNotifications();
    }, 1000);

    // 알림 리스너 설정
    const notificationSubscription = setupNotificationListeners(
      (notification) => {
        // 포그라운드에서 알림 수신 시 처리
        console.log('알림 수신:', notification);
      },
      (response) => {
        // 알림 탭 시 처리
        console.log('알림 탭:', response);
        const data = response.notification.request.content.data;
        
        // route 정보가 있으면 해당 화면으로 이동
        if (data && data.route) {
          console.log('알림 route로 이동:', data.route);
          router.push(data.route as any);
        } else {
          // route가 없으면 메인 화면으로 이동
          console.log('알림 route 없음, 메인 화면으로 이동');
          router.push('/');
        }
      }
    );

    // 정리 함수
    return () => {
      notificationSubscription.remove();
    };
  }, []);

  return (
    <>
      <StatusBar style="light" />
      {versionInfo && (
        <ForceUpdateModal
          visible={forceUpdateVisible}
          currentVersion={versionInfo.currentVersion}
          requiredVersion={versionInfo.requiredVersion}
        />
      )}
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#121212',
          } as any,
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: '#121212',
          },
          headerRight: () => <HomeButton />,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="profit"
          options={{
            title: '수익률 계산기',
          }}
        />
        <Stack.Screen
          name="averaging"
          options={{
            title: '물타기 계산기',
          }}
        />
        <Stack.Screen
          name="target-price"
          options={{
            title: '목표가 계산기',
          }}
        />
        <Stack.Screen
          name="stop-loss-take-profit"
          options={{
            title: '손절/익절 계산기',
          }}
        />
        <Stack.Screen
          name="regular-purchase-simulator"
          options={{
            title: '정기 매수 계산기',
          }}
        />
        <Stack.Screen
          name="dividend"
          options={{
            title: '배당금 계산기',
          }}
        />
        <Stack.Screen
          name="fee-comparison"
          options={{
            title: '수수료 비교 계산기',
          }}
        />
        <Stack.Screen
          name="capital-gains-tax"
          options={{
            title: '양도소득세 계산기',
          }}
        />
        <Stack.Screen
          name="news"
          options={{
            title: '주식 뉴스',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: '환경설정',
          }}
        />
        <Stack.Screen
          name="portfolios"
          options={{
            title: '포트폴리오',
          }}
        />
        <Stack.Screen
          name="portfolio-detail"
          options={{
            title: '종목 목록',
          }}
        />
        <Stack.Screen
          name="stock-detail"
          options={{
            title: '종목 상세',
          }}
        />
        <Stack.Screen
          name="visualization"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="market-indicators"
          options={{
            title: '주요 지표',
          }}
        />
        <Stack.Screen
          name="stock-chart"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="heatmap"
          options={{
            title: '히트맵',
          }}
        />
      </Stack>
    </>
  );
}

