import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestoreInstance } from './FirebaseService';
import { collection, doc, setDoc, getDoc, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import * as Application from 'expo-application';

const DEVICE_ID_KEY = '@device_id';

const NOTIFICATION_TOKEN_KEY = '@notification_token';
const NOTIFICATIONS_LIST_KEY = '@notifications_list';
const UNREAD_COUNT_KEY = '@unread_notifications_count';
const DELETED_NOTIFICATION_IDS_KEY = '@deleted_notification_ids';
const DELETED_NOTIFICATION_SIGNATURES_KEY = '@deleted_notification_signatures';

export interface SavedNotification {
  id: string;
  title: string;
  body: string;
  imageUrl?: string;
  route?: string;
  receivedAt: string;
  read: boolean;
  data?: any;
}

// 알림 핸들러 설정
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // 백그라운드에서도 알림을 저장하기 위해 여기서 처리
    // 하지만 이 핸들러는 포그라운드에서만 호출됩니다
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
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
        // expo-application의 getInstallationIdAsync 사용 시도 (타입 체크 우회)
        const app = Application as any;
        if (app.getInstallationIdAsync && typeof app.getInstallationIdAsync === 'function') {
          deviceId = await app.getInstallationIdAsync();
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

/**
 * 알림을 로컬에 저장
 */
export async function saveNotificationToLocal(
  notification: Notifications.Notification
): Promise<void> {
  try {
    const content = notification.request.content;
    const savedNotification: SavedNotification = {
      // 서버에서 보낸 notificationId 우선 사용
      id: (content.data?.notificationId as string) || 
          notification.request.identifier || 
          `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: content.title || '',
      body: content.body || '',
      imageUrl: (content.data?.imageUrl as string | undefined) || (content.data?.image as string | undefined),
      route: content.data?.route as string | undefined,
      receivedAt: new Date().toISOString(),
      read: false,
      data: content.data || {},
    };

    console.log('📥 알림 저장 시작:', savedNotification.title);
    
    // 기존 알림 목록 가져오기
    const existingNotifications = await getSavedNotifications();
    console.log('📋 기존 알림 개수:', existingNotifications.length);
    
    // 새 알림을 맨 앞에 추가 (최신순)
    const updatedNotifications = [savedNotification, ...existingNotifications];
    
    // 최대 100개까지만 저장 (메모리 관리)
    const trimmedNotifications = updatedNotifications.slice(0, 100);
    console.log('💾 저장할 알림 개수:', trimmedNotifications.length);
    
    // AsyncStorage에 저장
    await AsyncStorage.setItem(NOTIFICATIONS_LIST_KEY, JSON.stringify(trimmedNotifications));
    console.log('✅ AsyncStorage 저장 완료');
    
    // 읽지 않은 알림 수 업데이트
    await updateUnreadCount();
    
    console.log('✅ 알림 로컬 저장 완료:', savedNotification.title);
  } catch (error) {
    console.error('❌ 알림 로컬 저장 오류:', error);
  }
}

/**
 * 저장된 알림 목록 가져오기
 */
export async function getSavedNotifications(): Promise<SavedNotification[]> {
  try {
    // 병렬로 AsyncStorage 읽기 (성능 개선)
    const [data, deletedIdsStr] = await Promise.all([
      AsyncStorage.getItem(NOTIFICATIONS_LIST_KEY),
      AsyncStorage.getItem(DELETED_NOTIFICATION_IDS_KEY),
    ]);
    
    if (!data) {
      return [];
    }
    
    const notifications: SavedNotification[] = JSON.parse(data);
    
    // 삭제된 알림이 없으면 바로 반환
    if (!deletedIdsStr) {
      return notifications;
    }
    
    // 삭제된 알림 ID를 Set으로 변환하여 필터링 속도 개선 (O(n) → O(1) 조회)
    const deletedIds: string[] = JSON.parse(deletedIdsStr);
    const deletedIdsSet = new Set(deletedIds);
    
    // 삭제된 알림 필터링
    const filteredNotifications = notifications.filter(n => !deletedIdsSet.has(n.id));
    
    // 필터링된 결과가 다르면 저장소 업데이트 (가비지 데이터 정리)
    // 단, 이 작업은 백그라운드에서 처리하여 초기 로딩을 막지 않음
    if (filteredNotifications.length !== notifications.length) {
      // 비동기로 저장 (await 제거하여 블로킹 방지)
      AsyncStorage.setItem(NOTIFICATIONS_LIST_KEY, JSON.stringify(filteredNotifications)).catch(
        (err) => console.error('알림 목록 정리 저장 오류:', err)
      );
    }
    
    return filteredNotifications;
  } catch (error) {
    console.error('저장된 알림 목록 가져오기 오류:', error);
    return [];
  }
}/**
 * 읽지 않은 알림 수 가져오기
 */
export async function getUnreadCount(): Promise<number> {
  try {
    const notifications = await getSavedNotifications();
    return notifications.filter(n => !n.read).length;
  } catch (error) {
    console.error('읽지 않은 알림 수 가져오기 오류:', error);
    return 0;
  }
}

/**
 * 읽지 않은 알림 수 업데이트 (캐시 및 배지)
 */
export async function updateUnreadCount(): Promise<void> {
  try {
    const count = await getUnreadCount();
    await AsyncStorage.setItem(UNREAD_COUNT_KEY, count.toString());
    
    // 앱 아이콘 배지 숫자 업데이트
    await Notifications.setBadgeCountAsync(count);
    console.log('📱 배지 숫자 업데이트:', count);
  } catch (error) {
    console.error('읽지 않은 알림 수 업데이트 오류:', error);
  }
}/**
 * 알림을 읽음 처리
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    const notifications = await getSavedNotifications();
    const updatedNotifications = notifications.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    );
    
    await AsyncStorage.setItem(NOTIFICATIONS_LIST_KEY, JSON.stringify(updatedNotifications));
    await updateUnreadCount();
    
    console.log('✅ 알림 읽음 처리 완료:', notificationId);
  } catch (error) {
    console.error('❌ 알림 읽음 처리 오류:', error);
  }
}

/**
 * 모든 알림을 읽음 처리
 */
export async function markAllNotificationsAsRead(): Promise<void> {
  try {
    const notifications = await getSavedNotifications();
    const updatedNotifications = notifications.map(n => ({ ...n, read: true }));
    
    await AsyncStorage.setItem(NOTIFICATIONS_LIST_KEY, JSON.stringify(updatedNotifications));
    await updateUnreadCount();
    
    console.log('✅ 모든 알림 읽음 처리 완료');
  } catch (error) {
    console.error('❌ 모든 알림 읽음 처리 오류:', error);
  }
}

/**
 * 알림 시그니처 생성 (제목+본문+시간 - 초 단위로 반올림)
 */
function createNotificationSignature(title: string, body: string, sentAt: Date): string {
  // 시간을 초 단위로 반올림 (밀리초 제거) - 로컬 시간과 서버 시간 차이 해결
  const roundedTime = new Date(Math.floor(sentAt.getTime() / 1000) * 1000);
  return `${title}|${body}|${roundedTime.toISOString()}`;
}

/**
 * 알림 삭제
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    const notifications = await getSavedNotifications();
    const notificationToDelete = notifications.find(n => n.id === notificationId);
    const updatedNotifications = notifications.filter(n => n.id !== notificationId);
    
    // 삭제된 알림 ID 목록에 추가
    const deletedIdsStr = await AsyncStorage.getItem(DELETED_NOTIFICATION_IDS_KEY);
    const deletedIds: string[] = deletedIdsStr ? JSON.parse(deletedIdsStr) : [];
    
    if (!deletedIds.includes(notificationId)) {
      deletedIds.push(notificationId);
      // 최대 1000개까지만 저장 (메모리 관리)
      const trimmedDeletedIds = deletedIds.slice(-1000);
      await AsyncStorage.setItem(DELETED_NOTIFICATION_IDS_KEY, JSON.stringify(trimmedDeletedIds));
      console.log('🗑️ 삭제된 알림 ID 추가:', notificationId);
    }
    
    // ID만 사용하므로 시그니처는 더 이상 필요 없음 (하위 호환성을 위해 유지)
    
    await AsyncStorage.setItem(NOTIFICATIONS_LIST_KEY, JSON.stringify(updatedNotifications));
    await updateUnreadCount();
    
    console.log('✅ 알림 삭제 완료:', notificationId);
  } catch (error) {
    console.error('❌ 알림 삭제 오류:', error);
  }
}

/**
 * 모든 알림 삭제
 */
export async function deleteAllNotifications(): Promise<void> {
  try {
    console.log('🗑️ 모든 알림 삭제 시작...');
    
    // 현재 저장된 알림들의 ID와 시그니처를 삭제된 목록에 추가
    const notifications = await getSavedNotifications();
    const notificationIds = notifications.map(n => n.id);
    
    const deletedIdsStr = await AsyncStorage.getItem(DELETED_NOTIFICATION_IDS_KEY);
    const deletedIds: string[] = deletedIdsStr ? JSON.parse(deletedIdsStr) : [];
    
    // 중복 제거하면서 ID 추가
    notificationIds.forEach(id => {
      if (!deletedIds.includes(id)) {
        deletedIds.push(id);
      }
    });
    
    // 최대 1000개까지만 저장
    const trimmedDeletedIds = deletedIds.slice(-1000);
    await AsyncStorage.setItem(DELETED_NOTIFICATION_IDS_KEY, JSON.stringify(trimmedDeletedIds));
    console.log('🗑️ 삭제된 알림 ID 목록 업데이트:', trimmedDeletedIds.length, '개');
    
    await AsyncStorage.removeItem(NOTIFICATIONS_LIST_KEY);
    await AsyncStorage.removeItem(UNREAD_COUNT_KEY);
    
    // 확인: 실제로 삭제되었는지 체크
    const checkDeleted = await AsyncStorage.getItem(NOTIFICATIONS_LIST_KEY);
    console.log('🔍 삭제 후 확인:', checkDeleted ? '여전히 존재함 ❌' : '삭제됨 ✅');
    
    // 앱 아이콘 배지 숫자 0으로 설정
    await Notifications.setBadgeCountAsync(0);
    
    console.log('✅ 모든 알림 삭제 완료');
  } catch (error) {
    console.error('❌ 모든 알림 삭제 오류:', error);
  }
}

/**
 * Firestore에서 최근 알림 가져오기
 */
export async function fetchRecentNotificationsFromFirestore(): Promise<void> {
  try {
    console.log('📡 Firestore에서 최근 알림 가져오기 시작...');
    
    const db = getFirestoreInstance();
    if (!db) {
      console.log('⚠️ Firestore 초기화되지 않음, 알림 가져오기 건너뜀');
      return; // 에러 없이 조용히 종료
    }

    // 삭제된 알림 ID 목록 가져오기
    const deletedIdsStr = await AsyncStorage.getItem(DELETED_NOTIFICATION_IDS_KEY);
    const deletedIds: string[] = deletedIdsStr ? JSON.parse(deletedIdsStr) : [];
    console.log('🗑️ 삭제된 알림 ID 개수:', deletedIds.length);
    
    // ID만 사용하므로 시그니처는 더 이상 필요 없음

    // 최근 24시간 이내의 알림 가져오기 (최대 50개)
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const notificationsRef = collection(db, 'notificationHistory');
    const q = query(
      notificationsRef,
      orderBy('sentAt', 'desc'),
      limit(50)
    );
    
    const snapshot = await getDocs(q);
    const savedNotifications = await getSavedNotifications();
    
    let newNotificationsCount = 0;
    
    snapshot.forEach((docSnapshot) => {
      try {
        const notificationId = docSnapshot.id;
        
        // 삭제된 알림이면 건너뛰기
        if (deletedIds.includes(notificationId)) {
          console.log('⏭️ 삭제된 알림 건너뛰기:', notificationId);
          return;
        }
        
        const notificationData = docSnapshot.data();
        
        // sentAt 필드 처리 (Timestamp 또는 Date)
        let sentAt: Date;
        if (notificationData.sentAt?.toDate) {
          sentAt = notificationData.sentAt.toDate();
        } else if (notificationData.sentAt instanceof Date) {
          sentAt = notificationData.sentAt;
        } else if (notificationData.sentAt) {
          sentAt = new Date(notificationData.sentAt);
        } else {
          // sentAt이 없으면 현재 시간 사용
          sentAt = new Date();
        }
        
        // 24시간 이내의 알림만 처리
        if (sentAt < yesterday) {
          return;
        }
        
        // 서버에서 보낸 고유 ID 확인
        const serverNotificationId = notificationData.id || notificationData.data?.notificationId || notificationId;
        
        // 삭제된 알림 ID인지 확인
        if (deletedIds.includes(serverNotificationId)) {
          console.log('⏭️ 삭제된 알림 ID 건너뛰기:', serverNotificationId);
          return;
        }
        
        // 이미 저장된 알림인지 확인 (ID로 비교)
        const existingNotification = savedNotifications.find(
          n => n.id === serverNotificationId
        );
        
        if (!existingNotification) {
          // 새 알림 저장
          const newNotification: SavedNotification = {
            // Firestore 문서의 id 필드 또는 notificationId 우선 사용
            id: notificationData.id || notificationData.data?.notificationId || notificationId,
            title: notificationData.title || '',
            body: notificationData.body || '',
            imageUrl: notificationData.imageUrl || undefined,
            route: notificationData.data?.route || undefined,
            receivedAt: sentAt.toISOString(),
            read: false,
            data: notificationData.data || {},
          };
          
          savedNotifications.unshift(newNotification); // 최신순으로 앞에 추가
          newNotificationsCount++;
        }
      } catch (docError) {
        console.error('❌ 알림 문서 처리 오류:', docError);
        // 개별 문서 오류는 무시하고 계속 진행
      }
    });
    
    if (newNotificationsCount > 0) {
      // 최대 100개까지만 저장
      const trimmedNotifications = savedNotifications.slice(0, 100);
      await AsyncStorage.setItem(NOTIFICATIONS_LIST_KEY, JSON.stringify(trimmedNotifications));
      await updateUnreadCount(); // 배지 업데이트
      console.log(`✅ Firestore에서 ${newNotificationsCount}개의 새 알림 저장 완료`);
    } else {
      console.log('ℹ️ Firestore에서 새 알림 없음');
    }
  } catch (error: any) {
    // 모든 오류를 조용히 처리 (앱은 정상 동작)
    console.error('❌ Firestore 알림 가져오기 오류:', error);
    console.error('오류 상세:', error.message);
    
    // 네트워크 오류인지 확인
    if (error?.code === 'unavailable' || error?.message?.includes('network')) {
      console.log('⚠️ 네트워크 연결 문제로 알림 가져오기 실패 (정상 동작 계속)');
    } else if (error?.code === 'permission-denied') {
      console.log('⚠️ Firestore 권한 문제로 알림 가져오기 실패 (정상 동작 계속)');
    } else {
      console.log('⚠️ 알림 가져오기 실패, 기존 로컬 알림 사용 (정상 동작 계속)');
    }
    
    // 에러를 throw하지 않음 - 앱은 계속 정상 동작
  }
}
