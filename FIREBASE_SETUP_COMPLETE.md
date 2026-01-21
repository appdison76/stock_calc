# Firebase 네이티브 설정 완료 가이드

## 현재 상황

`google-services.json` 파일이 `android/app/` 폴더에 없습니다. 이 파일이 없으면 네이티브 Firebase SDK가 초기화되지 않아 푸시 알림 토큰을 생성할 수 없습니다.

## 해결 방법

### 1단계: google-services.json 파일 다운로드

1. **Firebase Console 접속**
   - https://console.firebase.google.com/
   - 프로젝트 선택: `stock-calculator-e6190`

2. **프로젝트 설정으로 이동**
   - 왼쪽 메뉴에서 ⚙️ (설정) → "프로젝트 설정" 클릭

3. **google-services.json 다운로드**
   - "내 앱" 섹션에서 Android 앱 (`com.neovisioning.stockcalc`) 선택
   - "google-services.json" 파일 다운로드 버튼 클릭

### 2단계: 파일을 프로젝트에 추가

**중요**: `prebuild --clean`을 실행하면 `android` 폴더가 재생성되므로, 파일을 추가한 **후**에 `prebuild`를 실행해야 합니다.

다운로드한 파일을 다음 위치에 저장:
```
android/app/google-services.json
```

### 3단계: 앱 재빌드

파일을 추가한 후:

```powershell
npx expo run:android
```

**주의**: `npx expo prebuild --clean`을 다시 실행하면 파일이 삭제되므로, 파일을 추가한 후에는 바로 `npx expo run:android`를 실행하세요.

## 확인

앱 실행 후 로그에서 다음을 확인하세요:
- `✅ Firebase 초기화 성공!`
- `✅ Expo Push Token 생성 완료:`
- `✅ 알림 토큰 Firestore 저장 완료!`

## 참고

- `google-services.json` 파일은 `.gitignore`에 추가되어 Git에 커밋되지 않습니다
- 파일을 추가한 후에는 `prebuild --clean`을 실행하지 마세요 (파일이 삭제됩니다)
- 파일이 있으면 `npx expo run:android`만 실행하면 됩니다
