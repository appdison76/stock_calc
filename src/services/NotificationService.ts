import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_TOKEN_KEY = '@notification_token';

// 알림 핸들러 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * 알림 권한 요청
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    if (!Device.isDevice) {
      console.log('시뮬레이터에서는 푸시 알림을 테스트할 수 없습니다.');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('알림 권한이 거부되었습니다.');
      return false;
    }

    // Android에서 알림 채널 설정
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: '기본 알림',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return true;
  } catch (error) {
    console.error('알림 권한 요청 오류:', error);
    return false;
  }
}

/**
 * 알림 토큰 가져오기 (생성 및 저장)
 */
export async function getNotificationToken(): Promise<string | null> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return null;
    }

    // 기존 토큰 확인
    const savedToken = await AsyncStorage.getItem(NOTIFICATION_TOKEN_KEY);
    if (savedToken) {
      // 기존 토큰이 있으면 반환
      return savedToken;
    }

    // 새 토큰 생성
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '36134970-204f-47ae-854f-4b91bde8c562', // EAS project ID
    });

    const token = tokenData.data;
    
    // 토큰 저장
    await AsyncStorage.setItem(NOTIFICATION_TOKEN_KEY, token);
    
    console.log('알림 토큰 생성:', token);
    
    // TODO: 나중에 서버/Firebase 연동 시 여기서 토큰을 서버에 등록
    // await registerTokenToServer(token);
    
    return token;
  } catch (error) {
    console.error('알림 토큰 가져오기 오류:', error);
    return null;
  }
}

/**
 * 저장된 알림 토큰 가져오기 (저장소에서만)
 */
export async function getSavedNotificationToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(NOTIFICATION_TOKEN_KEY);
  } catch (error) {
    console.error('저장된 알림 토큰 가져오기 오류:', error);
    return null;
  }
}

/**
 * 알림 토큰 삭제
 */
export async function deleteNotificationToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(NOTIFICATION_TOKEN_KEY);
    // TODO: 나중에 서버/Firebase 연동 시 여기서 토큰을 서버에서 삭제
    // await unregisterTokenFromServer(token);
  } catch (error) {
    console.error('알림 토큰 삭제 오류:', error);
  }
}

/**
 * 알림 리스너 설정
 */
export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationTapped?: (response: Notifications.NotificationResponse) => void
) {
  // 포그라운드에서 알림 수신 시
  const receivedListener = Notifications.addNotificationReceivedListener((notification) => {
    console.log('알림 수신:', notification);
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  });

  // 알림 탭 시 (앱이 백그라운드/종료 상태에서)
  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('알림 탭:', response);
    if (onNotificationTapped) {
      onNotificationTapped(response);
    }
    
    // TODO: 나중에 알림 데이터에 따라 특정 화면으로 이동하도록 구현
    // const data = response.notification.request.content.data;
    // if (data?.screen) {
    //   router.push(data.screen);
    // }
  });

  return {
    remove: () => {
      Notifications.removeNotificationSubscription(receivedListener);
      Notifications.removeNotificationSubscription(responseListener);
    },
  };
}

/**
 * 로컬 알림 발송 (테스트용)
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: any
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
      },
      trigger: null, // 즉시 발송
    });
  } catch (error) {
    console.error('로컬 알림 발송 오류:', error);
  }
}

