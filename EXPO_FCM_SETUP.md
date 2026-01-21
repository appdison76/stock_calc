# Expo FCM 서버 키 설정 가이드

## 문제

알림 발송 시 "Unable to retrieve the FCM server key" 오류가 발생합니다. Android 앱이 FCM을 사용하도록 설정되어 있어서 Expo에 FCM 서버 키를 등록해야 합니다.

## 해결 방법

### 방법 1: Firebase Console에서 FCM 서버 키 가져오기 (권장)

1. **Firebase Console 접속**
   - https://console.firebase.google.com/
   - 프로젝트 선택: `stock-calculator-e6190`

2. **프로젝트 설정으로 이동**
   - 왼쪽 메뉴에서 ⚙️ (설정) → "프로젝트 설정" 클릭

3. **Cloud Messaging 탭 선택**
   - 상단 탭에서 "Cloud Messaging" 클릭

4. **서버 키 복사**
   - "서버 키" 섹션에서 서버 키 복사
   - 또는 "클라우드 메시징 API (레거시)" 섹션에서 서버 키 확인

5. **Expo에 서버 키 업로드**

   ```powershell
   npx expo push:android:upload --api-key <서버 키>
   ```

   예시:
   ```powershell
   npx expo push:android:upload --api-key "AAAAxxxxx:APA91bH..."
   ```

### 방법 2: EAS Credentials 사용

1. **EAS CLI 설치** (이미 설치되어 있을 수 있음)
   ```powershell
   npm install -g eas-cli
   ```

2. **EAS 로그인**
   ```powershell
   eas login
   ```

3. **FCM 서버 키 업로드**
   ```powershell
   eas credentials
   ```
   - Android 선택
   - Push Notifications 선택
   - FCM Server Key 입력

## 확인

서버 키를 업로드한 후 다시 알림을 발송해보세요:

```powershell
node scripts/send-notification.js "테스트" "알림 테스트입니다"
```

## 참고

- FCM 서버 키는 Firebase Console → 프로젝트 설정 → Cloud Messaging에서 확인할 수 있습니다
- 서버 키를 업로드하면 Expo가 FCM을 통해 알림을 발송합니다
- 서버 키는 안전하게 보관하세요 (Git에 커밋하지 마세요)

## 문제 해결

만약 "서버 키"가 보이지 않는다면:
1. Firebase Console → 프로젝트 설정 → Cloud Messaging
2. "Cloud Messaging API (레거시)" 활성화 확인
3. Google Cloud Console에서 API 활성화 확인
