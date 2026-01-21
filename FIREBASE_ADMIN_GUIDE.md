# Firebase 알림 관리자 도구 사용 가이드

## 개요

Firebase를 사용하여 모든 사용자에게 푸시 알림을 발송할 수 있는 관리자 도구입니다.

## 사전 준비

1. **Firebase Admin SDK 비밀 키 파일**
   - Firebase Console → 프로젝트 설정 → 서비스 계정
   - "새 비공개 키 생성" 클릭하여 JSON 파일 다운로드
   - 파일을 `scripts/` 폴더에 저장하거나 원하는 위치에 저장

2. **비밀 키 파일 경로 설정**
   - 방법 1: 파일을 `scripts/` 폴더에 저장
   - 방법 2: 환경변수 `FIREBASE_ADMIN_KEY`에 파일 경로 설정
     ```powershell
     $env:FIREBASE_ADMIN_KEY = "C:\projects\firebase비밀키\stock-calculator-e6190-firebase-adminsdk-fbsvc-8cc9479df9.json"
     ```

## 사용 방법

### 방법 1: 대화형 모드

```powershell
node scripts/send-notification.js
```

실행하면 제목, 내용, 추가 데이터를 순서대로 입력할 수 있습니다.

### 방법 2: 명령줄 인자

```powershell
# 기본 사용
node scripts/send-notification.js "알림 제목" "알림 내용"

# 추가 데이터 포함
node scripts/send-notification.js "알림 제목" "알림 내용" '{"screen":"/news","data":"value"}'
```

## 작동 방식

1. **토큰 수집**: Firestore의 `notificationTokens` 컬렉션에서 모든 토큰을 가져옵니다.
2. **알림 발송**: Firebase Cloud Messaging (FCM)을 통해 모든 토큰에 알림을 발송합니다.
3. **이력 저장**: 발송 결과를 `notificationHistory` 컬렉션에 저장합니다.

## Firestore 데이터 구조

### notificationTokens 컬렉션

각 문서는 기기별로 저장됩니다:

```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxx]",
  "platform": "android",
  "deviceId": "device_xxxxx",
  "appVersion": "1.1.7",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### notificationHistory 컬렉션

발송 이력이 저장됩니다:

```json
{
  "title": "알림 제목",
  "body": "알림 내용",
  "data": {},
  "sentAt": "2024-01-01T00:00:00.000Z",
  "totalTokens": 100,
  "successCount": 95,
  "failureCount": 5
}
```

## 주의사항

1. **비밀 키 보안**: 비밀 키 파일은 절대 Git에 커밋하지 마세요. `.gitignore`에 추가되어 있는지 확인하세요.
2. **토큰 관리**: 사용자가 앱을 삭제하거나 재설치하면 토큰이 변경될 수 있습니다.
3. **발송 빈도**: 너무 자주 알림을 발송하면 사용자 경험이 나빠질 수 있습니다.

## 문제 해결

### "비밀 키 파일을 찾을 수 없습니다" 오류

- 파일 경로를 확인하세요.
- 환경변수 `FIREBASE_ADMIN_KEY`가 올바르게 설정되었는지 확인하세요.

### "등록된 알림 토큰이 없습니다" 메시지

- 앱에서 알림 권한을 허용했는지 확인하세요.
- 앱이 최소 한 번 실행되어 토큰이 생성되었는지 확인하세요.
- Firestore 콘솔에서 `notificationTokens` 컬렉션을 확인하세요.

### 알림이 발송되지 않음

- Firebase Console → Cloud Messaging에서 발송 이력을 확인하세요.
- Firestore 보안 규칙이 올바르게 설정되었는지 확인하세요.
- 앱의 Firebase 설정이 올바른지 확인하세요 (`google-services.json`).

## 향후 개선 사항

- [ ] 웹 인터페이스 구축 (Vercel/Netlify 배포)
- [ ] 특정 사용자 그룹에만 발송 기능
- [ ] 스케줄링 기능 (예약 발송)
- [ ] 알림 템플릿 관리
- [ ] 발송 통계 대시보드
