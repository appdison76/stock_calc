# react-native-webview 모듈 오류 해결 가이드

## 문제
`RNCWebViewModule could not be found` 오류가 발생합니다.

## 원인
`react-native-webview`는 네이티브 모듈이므로, 개발 빌드를 다시 빌드해야 합니다.

## 해결 방법

### 방법 1: 개발 빌드 재생성 (권장)

Java와 Android SDK가 설치되어 있다면:

```powershell
# 1. 네이티브 프로젝트 생성 (처음이면)
npx expo prebuild

# 2. 개발 빌드 재생성 및 설치
npx expo run:android
```

### 방법 2: EAS Build 사용 (Java/Android SDK 없이)

```powershell
# 1. EAS CLI 설치 (처음이면)
npm install -g eas-cli

# 2. EAS 로그인
eas login

# 3. 개발 빌드 생성
eas build --profile development --platform android
```

빌드가 완료되면 QR 코드가 표시되며, 이를 스캔하여 앱을 설치할 수 있습니다.

### 방법 3: 로컬 빌드 (Java/Android SDK 필요)

```powershell
# 1. 네이티브 프로젝트 생성
npx expo prebuild

# 2. Android 폴더로 이동
cd android

# 3. 빌드
.\gradlew.bat assembleDebug

# 4. 설치 (기기 연결 시)
.\gradlew.bat installDebug
```

## 현재 상태 확인

Java와 Android SDK 설치 여부 확인:

```powershell
.\check-env-simple.ps1
```

Java가 설치되어 있지 않다면, 방법 2 (EAS Build)를 사용하는 것이 가장 간단합니다.

## 참고

- 개발 빌드는 네이티브 모듈을 포함하려면 반드시 재빌드해야 합니다
- JavaScript 코드만 변경하는 경우 재빌드 불필요 (Hot Reload 가능)
- 네이티브 모듈 추가/변경 시에는 반드시 재빌드 필요
