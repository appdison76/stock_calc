# AdMob 설정 가이드

## 현재 설정 상태

현재 앱은 **구글 공식 테스트 ID**를 사용하고 있습니다. 실제 배포 전에는 반드시 AdMob 콘솔에서 발급받은 실제 ID로 교체해야 합니다.

## 플랫폼별 AdMob App ID 설정 위치

### Android
- **파일**: `app.json`
- **경로**: `expo.android.config.googleMobileAdsAppId`
- **현재 값 (테스트)**: `ca-app-pub-3940256099942544~3347511713`
- **실제 ID 형식**: `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`

### iOS
- **파일**: `app.json`
- **경로**: `expo.ios.config.googleMobileAdsAppId`
- **현재 값 (테스트)**: `ca-app-pub-3940256099942544~1458002511`
- **실제 ID 형식**: `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`

## 광고 단위 ID 설정 위치

### Android 배너 광고
- **파일**: `src/components/AdmobBanner.tsx`
- **함수**: `getAdUnitId()` 내부의 `Platform.OS === 'android'` 케이스
- **현재 값 (테스트)**: `ca-app-pub-3940256099942544/6300978111`
- **실제 ID 형식**: `ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY`

### iOS 배너 광고
- **파일**: `src/components/AdmobBanner.tsx`
- **함수**: `getAdUnitId()` 내부의 `Platform.OS === 'ios'` 케이스
- **현재 값 (테스트)**: `ca-app-pub-3940256099942544/2934735716`
- **실제 ID 형식**: `ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY`

## 실제 ID로 교체 방법

1. [Google AdMob 콘솔](https://admob.google.com/)에 접속
2. 앱 등록 (Android/iOS 각각)
3. 각 플랫폼별로 배너 광고 단위 생성
4. 발급받은 ID를 위의 위치에 교체

## iOS SKAdNetworkIdentifier

`app.json`의 `expo.ios.infoPlist.SKAdNetworkItems`에 이미 주요 SKAdNetwork ID가 포함되어 있습니다. 
추가 네트워크가 필요한 경우 AdMob 콘솔에서 확인하여 추가할 수 있습니다.

## 주의사항

⚠️ **테스트 ID는 개발/테스트 시에만 사용해야 합니다.**
- 실제 앱 배포 시 테스트 ID 사용은 AdMob 정책 위반입니다.
- 프로덕션 빌드 전 반드시 실제 ID로 교체하세요.



