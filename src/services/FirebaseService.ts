import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

// Firebase 설정 (google-services.json에서 가져온 정보)
const firebaseConfig = {
  apiKey: 'AIzaSyCPRQsNONDmisET1PU2p7GLg9uUv5D2vdU',
  projectId: 'stock-calculator-e6190',
  storageBucket: 'stock-calculator-e6190.firebasestorage.app',
  messagingSenderId: '914203061060',
  appId: '1:914203061060:android:b7321adecd3b072883c511',
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

/**
 * Firebase 초기화
 */
export function initializeFirebase(): FirebaseApp | null {
  try {
    // 이미 초기화된 앱이 있으면 재사용
    if (getApps().length > 0) {
      app = getApps()[0];
      console.log('✅ Firebase 이미 초기화됨');
    } else {
      console.log('🔵 Firebase 초기화 시작...');
      app = initializeApp(firebaseConfig);
      console.log('✅ Firebase 초기화 완료!', app.name);
    }
    return app;
  } catch (error: any) {
    console.error('❌ Firebase 초기화 오류:', error);
    console.error('오류 상세:', error.message);
    console.error('오류 스택:', error.stack);
    return null;
  }
}

/**
 * Firestore 인스턴스 가져오기
 */
export function getFirestoreInstance(): Firestore | null {
  try {
    if (!app) {
      console.log('🔵 Firebase 앱이 없어서 초기화 시도...');
      app = initializeFirebase();
    }
    if (!app) {
      console.error('❌ Firebase 앱 초기화 실패');
      return null;
    }
    if (!db) {
      console.log('🔵 Firestore 인스턴스 생성 중...');
      db = getFirestore(app);
      console.log('✅ Firestore 인스턴스 생성 완료');
    }
    return db;
  } catch (error: any) {
    console.error('❌ Firestore 인스턴스 가져오기 오류:', error);
    console.error('오류 상세:', error.message);
    console.error('오류 스택:', error.stack);
    return null;
  }
}

/**
 * Firebase Auth 인스턴스 가져오기
 */
export function getAuthInstance(): Auth | null {
  try {
    if (!app) {
      app = initializeFirebase();
    }
    if (!app) {
      return null;
    }
    if (!auth) {
      auth = getAuth(app);
    }
    return auth;
  } catch (error) {
    console.error('Firebase Auth 인스턴스 가져오기 오류:', error);
    return null;
  }
}
