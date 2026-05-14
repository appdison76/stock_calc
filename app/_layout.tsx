import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useRef } from 'react';
import { AppState, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import {
  FundamentalsHomeHeaderRight,
  HomeHeaderButton,
} from '../src/components/FundamentalsHomeHeaderRight';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import mobileAds from 'react-native-google-mobile-ads';
import { checkAppVersion } from '../src/services/versionCheck';
import ForceUpdateModal from '../src/components/ForceUpdateModal';
import * as Notifications from 'expo-notifications';
import { getNotificationToken, setupNotificationListeners, saveNotificationToLocal, markNotificationAsRead, getSavedNotifications, updateUnreadCount, fetchRecentNotificationsFromFirestore } from '../src/services/NotificationService';
import { initializeFirebase } from '../src/services/FirebaseService';
import { checkAllNotifications } from '../src/services/NotificationCheckService';
import { initDatabase } from '../src/services/DatabaseService';

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
        
        // Firestore에서 최근 알림 가져오기 (백그라운드에서 받은 알림 포함)
        await fetchRecentNotificationsFromFirestore();
        
        // 앱이 종료된 상태에서 받은 알림 처리 (앱 시작 시)
        const lastNotificationResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastNotificationResponse) {
          console.log('📱 앱 종료 중 받은 알림 발견:', lastNotificationResponse);
          const notification = lastNotificationResponse.notification;
          const content = notification.request.content;
          
          // 알림을 로컬에 저장
          await saveNotificationToLocal(notification);
          console.log('✅ 종료 중 받은 알림 저장 완료');
        }
        
        // 읽지 않은 알림 수를 기반으로 배지 업데이트 (정확한 숫자로)
        await updateUnreadCount();
        
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

    // 알림 체크 초기화
    const initializeNotificationChecks = async () => {
      try {
        await initDatabase();
        
        // 앱 시작 시 즉시 체크
        console.log('🔔 알림 체크 시작...');
        await checkAllNotifications();
      } catch (error) {
        console.error('❌ 알림 체크 초기화 오류:', error);
      }
    };

    // 주기적 알림 체크 (5분마다)
    let checkInterval: NodeJS.Timeout | null = null;
    const startPeriodicChecks = () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
      
      checkInterval = setInterval(async () => {
        if (AppState.currentState === 'active') {
          console.log('🔔 주기적 알림 체크...');
          try {
            await checkAllNotifications();
          } catch (error) {
            console.error('❌ 주기적 알림 체크 오류:', error);
          }
        }
      }, 5 * 60 * 1000); // 5분
    };

    // Firebase 초기화 후 약간의 지연을 두고 알림 체크 초기화
    setTimeout(() => {
      initializeNotificationChecks();
      startPeriodicChecks();
    }, 2000);

    // 알림 리스너 설정
    const notificationSubscription = setupNotificationListeners(
      async (notification) => {
        // 포그라운드에서 알림 수신 시 처리
        console.log('알림 수신:', notification);
        // 알림 데이터 상세 로그
        const content = notification.request.content;
        console.log('📦 알림 content.data 상세:', JSON.stringify(content.data, null, 2));
        console.log('📦 알림 content 전체 구조:', {
          title: content.title,
          body: content.body,
          'data.imageUrl': content.data?.imageUrl,
          'data.image': content.data?.image,
          'data.route': content.data?.route,
          'data 전체': content.data,
        });
        // 알림을 로컬에 저장
        await saveNotificationToLocal(notification);
      },
      async (response) => {
        // 알림 탭 시 처리
        console.log('알림 탭:', response);
        const notification = response.notification;
        const content = notification.request.content;
        const data = content.data;
        
        // 백그라운드/종료 상태에서 받은 알림이면 먼저 저장
        const savedNotifications = await getSavedNotifications();
        const existingNotification = savedNotifications.find(
          n => n.title === content.title && n.body === content.body
        );
        
        if (!existingNotification) {
          // 저장되지 않은 알림이면 저장
          console.log('📥 백그라운드에서 받은 알림 저장:', content.title);
          await saveNotificationToLocal(notification);
        }
        
        // 저장된 알림 목록에서 같은 알림 찾기
        // 먼저 identifier로 찾고, 없으면 제목과 본문으로 찾기
        let notificationId = notification.request.identifier;
        const updatedNotifications = await getSavedNotifications();
        
        if (!notificationId || !updatedNotifications.find(n => n.id === notificationId)) {
          // identifier가 없거나 저장된 알림과 매칭되지 않으면 제목과 본문으로 찾기
          const matchingNotification = updatedNotifications.find(
            n => n.title === content.title && n.body === content.body
          );
          if (matchingNotification) {
            notificationId = matchingNotification.id;
          }
        }
        
        // 알림을 읽음 처리
        if (notificationId) {
          await markNotificationAsRead(notificationId);
        }
        
        // link 정보가 있으면 외부 브라우저로 열기 (뉴스 알림)
        if (data && data.link) {
          console.log('알림 link로 이동:', data.link);
          try {
            await Linking.openURL(data.link);
          } catch (error) {
            console.error('링크 열기 실패:', error);
          }
        } else if (data && data.route) {
          // route 정보가 있으면 해당 화면으로 이동
          console.log('알림 route로 이동:', data.route);
          router.push(data.route as any);
        } else {
          // route가 없으면 메인 화면으로 이동
          console.log('알림 route 없음, 메인 화면으로 이동');
          router.push('/');
        }
      }
    );

    // AppState 리스너: 앱이 포그라운드로 돌아올 때 백그라운드에서 받은 알림 확인 및 알림 체크
    const handleAppStateChange = async (nextAppState: string) => {
      console.log('📱 AppState 변경:', nextAppState);
      if (nextAppState === 'active') {
        console.log('📱 앱이 포그라운드로 돌아옴, 백그라운드 알림 확인 중...');
        try {
          // Firestore에서 최근 알림 가져오기
          await fetchRecentNotificationsFromFirestore();
          
          // 알림 체크도 실행
          try {
            console.log('🔔 포그라운드 복귀 시 알림 체크...');
            await checkAllNotifications();
          } catch (error) {
            console.error('❌ 포그라운드 복귀 시 알림 체크 오류:', error);
          }
          
          // 약간의 지연을 두고 확인 (앱이 완전히 활성화된 후)
          setTimeout(async () => {
            try {
              const lastNotificationResponse = await Notifications.getLastNotificationResponseAsync();
              console.log('🔍 마지막 알림 응답:', lastNotificationResponse ? '있음' : '없음');
              
              if (lastNotificationResponse) {
                const notification = lastNotificationResponse.notification;
                const content = notification.request.content;
                console.log('📱 백그라운드 알림 발견:', {
                  title: content.title,
                  body: content.body,
                  identifier: notification.request.identifier,
                });
                
                // 이미 저장된 알림인지 확인
                const savedNotifications = await getSavedNotifications();
                const existingNotification = savedNotifications.find(
                  n => n.title === content.title && n.body === content.body
                );
                
                if (!existingNotification) {
                  // 저장되지 않은 알림이면 저장
                  console.log('📥 백그라운드에서 받은 알림 저장:', content.title);
                  await saveNotificationToLocal(notification);
                  await updateUnreadCount();
                  console.log('✅ 백그라운드 알림 저장 완료');
                } else {
                  console.log('ℹ️ 이미 저장된 알림:', content.title);
                }
              } else {
                console.log('ℹ️ 백그라운드에서 받은 알림 없음');
              }
            } catch (error) {
              console.error('❌ 백그라운드 알림 확인 오류:', error);
            }
          }, 500);
        } catch (error) {
          console.error('❌ 백그라운드 알림 확인 오류:', error);
        }
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // 정리 함수
    return () => {
      notificationSubscription.remove();
      appStateSubscription.remove();
      if (checkInterval) {
        clearInterval(checkInterval);
      }
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
          headerRight: () => <HomeHeaderButton />,
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
          name="price-scenario-profit"
          options={{
            title: '주가 시나리오 수익 계산기',
          }}
        />
        <Stack.Screen
          name="cap-per-por-calculator"
          options={{
            title: '시총·PER·POR 계산기',
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
            headerRight: () => <FundamentalsHomeHeaderRight />,
          }}
        />
        <Stack.Screen
          name="portfolio-detail"
          options={{
            title: '종목 목록',
            headerRight: () => <FundamentalsHomeHeaderRight />,
          }}
        />
        <Stack.Screen
          name="stock-detail"
          options={{
            title: '종목 상세',
            headerRight: () => <FundamentalsHomeHeaderRight />,
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
            headerRight: () => <FundamentalsHomeHeaderRight />,
          }}
        />
        <Stack.Screen
          name="notifications"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="shortcut-manager"
          options={{
            title: '바로가기 관리',
          }}
        />
        <Stack.Screen
          name="daily-settlement"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="fundamentals-compare"
          options={{
            title: '기업 실적 비교',
          }}
        />
      </Stack>
    </>
  );
}

