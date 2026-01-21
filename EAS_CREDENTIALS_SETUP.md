# EAS Credentials 설정 가이드

## 현재 상태

- ✅ EAS CLI 설치 완료 (버전 16.28.0)
- ❌ EAS 로그인 필요
- ❌ Credentials 설정 필요

## 단계별 설정

### 1단계: EAS 로그인

터미널에서 다음 명령 실행:

```powershell
eas login
```

- 이메일 또는 사용자명 입력
- 브라우저가 열리면 Expo 계정으로 로그인
- 로그인 완료 후 터미널로 돌아옴

### 2단계: 서비스 계정 키 파일 확인

서비스 계정 키 파일 경로를 확인하세요:
- 파일명: `stock-calculator-e6190-firebase-adminsdk-fbsvc-8cc9479df9.json`
- 위치: `C:\projects\firebase비밀키\` (또는 다운로드한 위치)

### 3단계: Credentials 설정

```powershell
eas credentials
```

다음 순서로 선택:

1. **Platform 선택**
   - `Android` 선택

2. **Credentials type 선택**
   - `Push Notifications` 선택

3. **FCM Server Key 업로드**
   - 서비스 계정 키 파일의 **전체 경로** 입력
   - 예: `C:\projects\firebase비밀키\stock-calculator-e6190-firebase-adminsdk-fbsvc-8cc9479df9.json`
   - 또는 파일을 드래그 앤 드롭

### 4단계: 확인

설정 완료 후 다음 메시지가 표시됩니다:
```
✅ Successfully set up push notification credentials for Android
```

### 5단계: 알림 발송 테스트

```powershell
node scripts/send-notification.js "테스트" "알림 테스트입니다"
```

성공하면:
```
✅ 성공: 1개
❌ 실패: 0개
```

## 문제 해결

### "Not logged in" 오류
- `eas login` 명령으로 다시 로그인

### "File not found" 오류
- 서비스 계정 키 파일의 전체 경로를 정확히 입력
- 파일이 존재하는지 확인

### "Invalid credentials" 오류
- Firebase Console에서 새 서비스 계정 키 다운로드
- 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성

## 참고

- EAS Credentials는 프로젝트당 한 번만 설정하면 됩니다
- 설정된 인증 정보는 Expo 서버에 안전하게 저장됩니다
- 서비스 계정 키 파일은 Git에 커밋하지 마세요 (이미 `.gitignore`에 추가됨)
