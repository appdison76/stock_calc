# Firebase 네이티브 설정 가이드

## 문제

`expo-notifications`가 FCM(Firebase Cloud Messaging)을 사용하려면 네이티브 Firebase SDK가 초기화되어야 합니다. 현재 `google-services.json` 파일이 없어서 네이티브 Firebase가 초기화되지 않고 있습니다.

## 해결 방법

### 1. google-services.json 파일 다운로드

1. **Firebase Console 접속**
   - https://console.firebase.google.com/
   - 프로젝트 선택: `stock-calculator-e6190`

2. **프로젝트 설정으로 이동**
   - 왼쪽 메뉴에서 ⚙️ (설정) → "프로젝트 설정" 클릭

3. **google-services.json 다운로드**
   - "내 앱" 섹션에서 Android 앱 (`com.neovisioning.stockcalc`) 선택
   - "google-services.json" 파일 다운로드 버튼 클릭

4. **파일 저장**
   - 다운로드한 파일을 `android/app/google-services.json`에 저장

### 2. 네이티브 파일 재생성

```powershell
npx expo prebuild --clean
```

이 명령은 `google-services.json`을 인식하고 네이티브 Firebase 설정을 적용합니다.

### 3. 앱 재빌드

```powershell
npx expo run:android
```

### 4. 확인

앱 실행 후 로그에서 다음을 확인하세요:
- `✅ Firebase 초기화 성공!`
- `✅ Expo Push Token 생성 완료:`
- `✅ 알림 토큰 Firestore 저장 완료!`

## 참고

- `google-services.json`은 절대 Git에 커밋하지 마세요 (이미 `.gitignore`에 추가됨)
- 파일을 추가한 후에는 반드시 `npx expo prebuild --clean`을 실행해야 합니다
- `prebuild` 후에는 앱을 재빌드해야 합니다
