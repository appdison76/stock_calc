import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useRef } from 'react';
import mobileAds from 'react-native-google-mobile-ads';
import { checkAppVersion } from '../src/services/versionCheck';
import ForceUpdateModal from '../src/components/ForceUpdateModal';
import { getNotificationToken, setupNotificationListeners } from '../src/services/NotificationService';

export default function RootLayout() {
  const [forceUpdateVisible, setForceUpdateVisible] = useState(false);
  const [versionInfo, setVersionInfo] = useState<{
    currentVersion: string;
    requiredVersion: string;
  } | null>(null);

  useEffect(() => {
    // 버전 체크
    const version = checkAppVersion();
    if (version.needsUpdate) {
      setVersionInfo({
        currentVersion: version.currentVersion,
        requiredVersion: version.minRequiredVersion,
      });
      setForceUpdateVisible(true);
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

    // 알림 초기화
    const initializeNotifications = async () => {
      try {
        // 알림 토큰 생성 (권한 요청 포함)
        const token = await getNotificationToken();
        if (token) {
          console.log('알림 토큰 생성 완료:', token);
          // TODO: 나중에 서버/Firebase 연동 시 토큰을 서버에 등록
          // await registerTokenToServer(token);
        }
      } catch (error) {
        console.error('알림 초기화 오류:', error);
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
      </Stack>
    </>
  );
}

