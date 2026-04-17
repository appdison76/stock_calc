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

    // 실시간 이슈 키워드: 앱은 읽기만 (쓰기는 Firebase Admin / 관리자 서버만)
    match /issueKeywords/{docId} {
      allow read: if true;
      allow write: if false;
    }

    // 메인 기준금리 (컬렉션 interestRates — 문서 예: current, 필드 us·kr·jp)
    // - 앱(클라이언트 SDK): 읽기만 허용 → 메인 대시보드에 표시
    // - 저장/수정: 로컬 관리자(notification-server + Firebase Admin)만 (Admin은 보안 규칙 적용 대상 아님)
    match /interestRates/{docId} {
      allow read: if true; // 비로그인 사용자도 읽기 가능(공개 표시용)
      allow write: if false; // 앱·브라우저에서 Firestore 클라이언트로 직접 쓰기 불가
    }

    // 추천 바로가기 (예: recommendedShortcuts/current — items 배열)
    // - 앱 메인에서 읽기만, 관리자 서버(Admin)로만 쓰기
    match /recommendedShortcuts/{docId} {
      allow read: if true;
      allow write: if false;
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

    // 실시간 이슈 키워드 (예: issueKeywords/current)
    match /issueKeywords/{docId} {
      allow read: if true;
      allow write: if false;
    }

    // 메인 기준금리 (예: interestRates/current — 필드 us·kr·jp)
    match /interestRates/{docId} {
      allow read: if true;
      allow write: if false;
    }

    match /recommendedShortcuts/{docId} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

4. **규칙 게시**
   - "게시" 버튼 클릭
   - 확인 메시지에서 "게시" 클릭

## 실시간 이슈 키워드 (`issueKeywords/current`)

- 앱은 **Firestore에서 읽기만** 합니다 (`IssueKeywordsService`).
- 데이터 입력·수정은 **로컬 관리자** `node scripts/notification-server.js` → 웹에서 저장 시 Admin SDK로 기록합니다.
- 최초 시드: `node scripts/seed-issue-keywords-firestore.js` (서비스 계정 키 필요). 커스텀 JSON은 `node scripts/seed-issue-keywords-firestore.js ./my.json` 형식으로 경로 지정 가능.

## 현재 권장 설정

개발 단계에서는 첫 번째 규칙(모든 접근 허용)을 사용하세요. 앱이 정상 작동하는지 확인한 후, 프로덕션 배포 전에 더 엄격한 규칙으로 변경하세요.

프로덕션에서는 `issueKeywords`, `interestRates`, `recommendedShortcuts`에 위 **읽기만 / 쓰기 거부** 규칙을 반드시 포함하세요.

## 메인 기준금리 (`interestRates/current`)

- 앱은 **`InterestRatesRemoteService`** 로 Firestore에서 읽기만 합니다.
- 관리자: `http://localhost:3000/interest-rates.html` → `PUT /api/interest-rates` (Admin SDK).
- 최초 시드: `node scripts/seed-interest-rates-firestore.js`

## 추천 바로가기 (`recommendedShortcuts/current`)

- 앱 메인 「나만의 바로가기」 아래에서 **`RecommendedShortcutsRemoteService`** 로 읽기만 합니다.
- 관리자: `http://localhost:3000/recommended-shortcuts.html` → `PUT /api/recommended-shortcuts` (Admin SDK).
- 최초 빈 문서: `node scripts/seed-recommended-shortcuts-firestore.js`

## 규칙 테스트

규칙을 설정한 후:
1. 앱을 실행하여 알림 권한 허용
2. Firestore Console에서 `notificationTokens` 컬렉션이 생성되는지 확인
3. 관리자 스크립트로 알림 발송 테스트
