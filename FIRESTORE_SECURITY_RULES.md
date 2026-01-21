# Firestore 보안 규칙 설정 가이드

## 현재 상황

Firestore 보안 규칙이 기본값으로 설정되어 있을 수 있습니다. 기본값은 **모든 읽기/쓰기를 거부**하므로, 앱에서 데이터를 저장하거나 읽을 수 없습니다.

## 보안 규칙 설정 방법

1. **Firebase Console 접속**
   - https://console.firebase.google.com/
   - 프로젝트 선택: `stock-calculator-e6190`

2. **Firestore Database로 이동**
   - 왼쪽 메뉴에서 "Firestore Database" 클릭
   - 상단 탭에서 "규칙" 클릭

3. **보안 규칙 작성**

### 개발/테스트용 (모든 접근 허용)
⚠️ **주의**: 이 규칙은 개발/테스트용입니다. 프로덕션에서는 더 엄격한 규칙을 사용해야 합니다.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 알림 토큰 컬렉션: 읽기/쓰기 모두 허용
    match /notificationTokens/{tokenId} {
      allow read, write: if true;
    }
    
    // 알림 발송 이력: 읽기/쓰기 모두 허용
    match /notificationHistory/{historyId} {
      allow read, write: if true;
    }
    
    // 기타 모든 문서: 거부
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### 프로덕션용 (인증 필요)
나중에 사용자 인증을 추가하면 다음과 같이 설정할 수 있습니다:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 알림 토큰: 인증된 사용자만 자신의 토큰 읽기/쓰기
    match /notificationTokens/{tokenId} {
      allow read, write: if request.auth != null;
    }
    
    // 알림 발송 이력: 관리자만 읽기
    match /notificationHistory/{historyId} {
      allow read: if request.auth != null && 
                     get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.isAdmin == true;
      allow write: if false; // 관리자 스크립트에서만 작성
    }
  }
}
```

4. **규칙 게시**
   - "게시" 버튼 클릭
   - 확인 메시지에서 "게시" 클릭

## 현재 권장 설정

개발 단계에서는 첫 번째 규칙(모든 접근 허용)을 사용하세요. 앱이 정상 작동하는지 확인한 후, 프로덕션 배포 전에 더 엄격한 규칙으로 변경하세요.

## 규칙 테스트

규칙을 설정한 후:
1. 앱을 실행하여 알림 권한 허용
2. Firestore Console에서 `notificationTokens` 컬렉션이 생성되는지 확인
3. 관리자 스크립트로 알림 발송 테스트
