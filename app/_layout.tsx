import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import mobileAds from 'react-native-google-mobile-ads';
import { checkAppVersion } from '../src/services/versionCheck';
import ForceUpdateModal from '../src/components/ForceUpdateModal';
import { getNotificationToken, setupNotificationListeners } from '../src/services/NotificationService';

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
  const [forceUpdateVisible, setForceUpdateVisible] = useState(false);
  const [versionInfo, setVersionInfo] = useState<{
    currentVersion: string;
    requiredVersion: string;
  } | null>(null);

  useEffect(() => {
    // 버전 체크 (개발 환경에서는 건너뛰기)
    if (!__DEV__) {
      const version = checkAppVersion();
      if (version.needsUpdate) {
        setVersionInfo({
          currentVersion: version.currentVersion,
          requiredVersion: version.minRequiredVersion,
        });
        setForceUpdateVisible(true);
      }
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

    // 알림 초기화 (Firebase 설정 전까지는 비활성화)
    const initializeNotifications = async () => {
      try {
        // 알림 토큰 생성 (권한 요청 포함)
        // Firebase 설정 전까지는 오류를 조용히 무시
        const token = await getNotificationToken();
        if (token) {
          console.log('알림 토큰 생성 완료:', token);
          // TODO: 나중에 서버/Firebase 연동 시 토큰을 서버에 등록
          // await registerTokenToServer(token);
        }
      } catch (error: any) {
        // Firebase 미설정 시 발생하는 오류는 무시
        if (error?.message?.includes('FirebaseApp') || error?.message?.includes('Firebase')) {
          console.log('알림 기능: Firebase 설정 필요 (현재 비활성화)');
        } else {
          console.error('알림 초기화 오류:', error);
        }
      }
    };

    initializeNotifications();

    // 알림 리스너 설정
    const notificationSubscription = setupNotificationListeners(
      (notification) => {
        // 포그라운드에서 알림 수신 시 처리
        console.log('알림 수신:', notification);
      },
      (response) => {
        // 알림 탭 시 처리
        console.log('알림 탭:', response);
        // TODO: 나중에 알림 데이터에 따라 특정 화면으로 이동
        // const data = response.notification.request.content.data;
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
            backgroundColor: '#0D1B2A',
          } as any,
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: '#0D1B2A',
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
      </Stack>
    </>
  );
}

