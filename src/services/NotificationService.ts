import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestoreInstance } from './FirebaseService';
import { collection, doc, setDoc, getDoc } from 'firebase/firestore';
import * as Application from 'expo-application';

const DEVICE_ID_KEY = '@device_id';

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
    console.log('🔵 알림 권한 요청 시작...');
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.error('❌ 알림 권한이 거부되었습니다!');
      return null;
    }
    console.log('✅ 알림 권한 허용됨');

    // 기존 토큰 확인
    console.log('🔵 기존 토큰 확인 중...');
    const savedToken = await AsyncStorage.getItem(NOTIFICATION_TOKEN_KEY);
    if (savedToken) {
      console.log('✅ 기존 토큰 발견:', savedToken.substring(0, 20) + '...');
      // 기존 토큰이 있으면 Firestore에도 저장 (없을 수 있음)
      await registerTokenToFirestore(savedToken);
      return savedToken;
    }
    console.log('📝 기존 토큰 없음, 새 토큰 생성 시도...');

    // 새 토큰 생성 시도
    try {
      console.log('🔵 Expo Push Token 생성 중...');
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '36134970-204f-47ae-854f-4b91bde8c562', // EAS project ID
      });

      const token = tokenData.data;
      console.log('✅ Expo Push Token 생성 완료:', token.substring(0, 30) + '...');
      
      // 토큰 저장
      await AsyncStorage.setItem(NOTIFICATION_TOKEN_KEY, token);
      console.log('✅ 토큰 AsyncStorage에 저장 완료');
      
      // Firestore에 토큰 저장
      await registerTokenToFirestore(token);
      
      return token;
    } catch (tokenError: any) {
      console.error('❌ 토큰 생성 오류 발생:', tokenError);
      console.error('오류 메시지:', tokenError.message);
      console.error('오류 스택:', tokenError.stack);
      
      // Firebase 미설정 등으로 인한 오류는 조용히 처리
      if (tokenError?.message?.includes('FirebaseApp') || 
          tokenError?.message?.includes('Firebase') ||
          tokenError?.message?.includes('Make sure to')) {
        console.log('⚠️ 알림 토큰: Firebase 설정 필요 (현재 비활성화)');
        return null;
      }
      throw tokenError;
    }
  } catch (error: any) {
    console.error('❌ getNotificationToken 전체 오류:', error);
    console.error('오류 메시지:', error.message);
    console.error('오류 스택:', error.stack);
    
    // Firebase 관련 오류는 조용히 무시
    if (error?.message?.includes('FirebaseApp') || 
        error?.message?.includes('Firebase') ||
        error?.message?.includes('Make sure to')) {
      console.log('⚠️ 알림 토큰: Firebase 설정 필요 (현재 비활성화)');
      return null;
    }
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
 * 알림 토큰을 Firestore에 등록
 */
async function registerTokenToFirestore(token: string): Promise<void> {
  try {
    console.log('🔵 Firestore 토큰 저장 시작...');
    const db = getFirestoreInstance();
    if (!db) {
      console.error('❌ Firestore 초기화되지 않음, 토큰 저장 건너뜀');
      return;
    }
    console.log('✅ Firestore 인스턴스 가져오기 성공');

    // 기기 고유 ID 생성 (또는 기존 ID 사용)
    let deviceId: string;
    
    // 먼저 저장된 deviceId 확인
    const savedDeviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (savedDeviceId) {
      deviceId = savedDeviceId;
      console.log('📱 저장된 기기 ID 사용:', deviceId);
    } else {
      // 새 deviceId 생성
      try {
        // expo-application의 getInstallationIdAsync 사용 시도
        if (Application.getInstallationIdAsync && typeof Application.getInstallationIdAsync === 'function') {
          deviceId = await Application.getInstallationIdAsync();
          console.log('📱 Installation ID 사용:', deviceId);
        } else {
          // 함수가 없으면 Device 정보 사용
          const deviceInfo = `${Device.brand || 'unknown'}_${Device.modelId || Device.modelName || 'unknown'}_${Date.now()}`;
          deviceId = `device_${deviceInfo.replace(/\s+/g, '_')}_${Math.random().toString(36).substr(2, 9)}`;
          console.log('📱 새 기기 ID 생성:', deviceId);
        }
      } catch (error) {
        // 모든 방법이 실패하면 랜덤 ID 생성
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log('📱 랜덤 기기 ID 생성:', deviceId);
      }
      
      // 생성한 deviceId 저장
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    }

    const tokenDoc = {
      token,
      platform: Platform.OS,
      deviceId,
      appVersion: Application.nativeApplicationVersion || 'unknown',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log('📝 토큰 문서 데이터:', JSON.stringify(tokenDoc, null, 2));

    // Firestore에 저장 (deviceId를 문서 ID로 사용)
    const docRef = doc(collection(db, 'notificationTokens'), deviceId);
    console.log('💾 Firestore에 저장 시도...', docRef.path);
    
    await setDoc(docRef, tokenDoc, {
      merge: true, // 기존 문서가 있으면 업데이트
    });

    console.log('✅ 알림 토큰 Firestore 저장 완료! deviceId:', deviceId);
  } catch (error: any) {
    console.error('❌ 알림 토큰 Firestore 저장 오류:', error);
    console.error('오류 상세:', error.message);
    console.error('오류 스택:', error.stack);
    // Firestore 저장 실패해도 앱은 계속 동작하도록 함
  }
}

/**
 * 알림 토큰 삭제
 */
export async function deleteNotificationToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(NOTIFICATION_TOKEN_KEY);
    
    // Firestore에서도 토큰 삭제 (선택사항)
    try {
      const db = getFirestoreInstance();
      if (db) {
        const deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (deviceId) {
          // Firestore에서 토큰 문서 삭제 또는 비활성화 표시
          // 실제 삭제 대신 비활성화 플래그를 설정하는 것이 좋을 수 있음
          console.log('Firestore 토큰 삭제 (선택사항)');
        }
      }
    } catch (firestoreError) {
      console.error('Firestore 토큰 삭제 오류:', firestoreError);
    }
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
      // subscription 객체의 remove() 메서드 직접 호출
      if (receivedListener && typeof receivedListener.remove === 'function') {
        receivedListener.remove();
      }
      if (responseListener && typeof responseListener.remove === 'function') {
        responseListener.remove();
      }
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

