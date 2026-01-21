# Firebase 알림 시스템 구축 가이드

## 사용자가 직접 해야 할 작업

### 1단계: Firebase 프로젝트 생성
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. "프로젝트 추가" 클릭
3. 프로젝트 이름 입력 (예: `stock-calculator`)
4. Google Analytics 설정 (선택사항, 추천: 사용 안 함)
5. 프로젝트 생성 완료

### 2단계: Android 앱 등록
1. Firebase 프로젝트 대시보드에서 "Android 앱 추가" 클릭
2. **Android 패키지 이름**: `com.neovisioning.stockcalc` (app.json의 package와 동일)
3. 앱 닉네임: `물타기 계산기` (선택사항)
4. 디버그 서명 인증서 SHA-1 (선택사항, 나중에 추가 가능)
5. "앱 등록" 클릭
6. **`google-services.json` 파일 다운로드** ⭐ **중요**
7. 다운로드한 파일을 프로젝트 루트의 `android/app/` 폴더에 저장

### 3단계: Firestore 데이터베이스 생성
1. Firebase Console 왼쪽 메뉴에서 "Firestore Database" 클릭
2. "데이터베이스 만들기" 클릭
3. **프로덕션 모드**로 시작 (보안 규칙은 나중에 설정)
4. 위치 선택: `asia-northeast3` (서울) 또는 `asia-northeast1` (도쿄) 추천
5. "사용 설정" 클릭

### 4단계: FCM (Firebase Cloud Messaging) 설정 확인
- Android 앱 등록 시 자동으로 FCM이 설정됩니다
- 추가 설정 불필요

### 5단계: Firestore 보안 규칙 (임시)
Firestore Console → 규칙 탭에서 다음으로 설정 (임시, 개발 중):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 임시: 개발 중 모든 읽기/쓰기 허용
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

⚠️ **주의**: 프로덕션 배포 전에는 보안 규칙을 엄격하게 설정해야 합니다!

### 6단계: Firebase Admin SDK 비밀 키 (관리자 도구용)
1. Firebase Console → 프로젝트 설정 → 서비스 계정
2. "새 비공개 키 생성" 클릭
3. `firebase-adminsdk-xxx.json` 파일 다운로드
4. **이 파일은 절대 Git에 커밋하지 마세요!** (비밀 키입니다)

---

## 제가 할 작업 (코드 작성)

### 앱 코드 통합
- Firebase SDK 패키지 설치
- `google-services.json` 연동 설정
- `NotificationService.ts` 수정: 토큰을 Firestore에 저장
- Firebase 초기화 코드 추가

### 관리자 도구
- 알림 발송 웹 인터페이스 또는 로컬 스크립트 작성

---

## 다음 단계

위의 1~6단계를 완료한 후, `google-services.json` 파일을 프로젝트에 추가해주시면 제가 나머지 코드 작업을 진행하겠습니다!
