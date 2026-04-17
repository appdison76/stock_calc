# 실시간 이슈 키워드 운영 메뉴얼

메인 화면「실시간 이슈」칩 등에서 쓰는 키워드 목록을 **앱 스토어 재배포 없이** 바꾸는 방법과, 앱 안 폴백이 언제 쓰이는지 정리합니다.

---

## 1. 데이터가 오는 곳

| 구분 | 설명 |
|------|------|
| **런타임(실기기)** | Firestore **`issueKeywords`** 컬렉션의 **`current`** 문서를 읽습니다. (`IssueKeywordsService.ts`, `getDoc`) |
| **보안 규칙** | 비로그인 앱은 **읽기만** 허용, **쓰기 거부** 권장. (`FIRESTORE_SECURITY_RULES.md` 참고) |
| **관리자에서 쓰기** | 로컬 `node scripts/notification-server.js` 후 웹 `issue-keywords.html`에서 저장 → Admin SDK로 동일 문서 갱신 |
| **초기 시드** | `node scripts/seed-issue-keywords-firestore.js` (내장 기본 목록). 다른 JSON을 쓰려면 인자로 파일 경로 전달 |
| **폴백** | Firestore 미초기화·문서 없음·읽기 실패 시 `FALLBACK_ISSUE_KEYWORDS` (`IssueKeywordsService.ts`) |

---

## 2. 앱 업데이트 없이 키워드만 바꾸려면

1. **Firestore 규칙**에 `issueKeywords` 읽기 허용이 반영되어 있는지 확인합니다.
2. **`node scripts/notification-server.js`** 실행 후 브라우저에서 **`http://localhost:3000/issue-keywords.html`** 로 편집·저장합니다.
3. 메인 화면으로 **다시 들어오면** 앱이 Firestore를 다시 읽어 반영합니다 (포커스 시 갱신).

---

## 3. Firestore / JSON 공통 형식

문서 필드 **`keywords`** 배열이 있어야 합니다. 각 요소는 객체이며, 앱 파서 기준으로는 다음을 사용합니다.

| 필드 | 필수 | 설명 |
|------|------|------|
| `keyword` | 예 | 표시·검색에 쓰는 문자열 (비어 있으면 제외) |
| `rank` | 아니오 | 숫자면 정렬에 사용. 없으면 순서대로 부여 |
| `count` | 아니오 | 숫자면 부가 정보로만 사용 가능 |

정렬 후 **최대 20개**까지 사용합니다.

### 예시

```json
{
  "keywords": [
    { "rank": 1, "keyword": "이란", "count": 1038 },
    { "rank": 2, "keyword": "트럼프", "count": 218 }
  ]
}
```

---

## 4. 폴백이 쓰이는 경우

아래 중 하나면 **앱에 빌드된 폴백 목록**이 나갑니다.

- Firebase 미초기화, Firestore 인스턴스 없음
- `issueKeywords/current` 문서가 없음
- 읽기 오류·네트워크 예외

**폴백 문구를 바꾸려면** `FALLBACK_ISSUE_KEYWORDS`를 수정하고 **스토어에 새 앱 버전**을 올려야 합니다.

---

## 5. 앱 스토어 업데이트가 필요한 경우

| 작업 | 앱 업데이트 |
|------|-------------|
| Firestore `current` 문서만 수정 (관리자·콘솔) | **불필요** |
| 컬렉션/문서 ID·파싱 규칙 변경 | **필요** (`IssueKeywordsService.ts`) |
| 폴백 기본 목록·상한 변경 | **필요** |

---

## 6. 관련 소스 위치

- 서비스 로직: `src/services/IssueKeywordsService.ts`
- 관리자 API: `scripts/notification-server.js` (`/api/issue-keywords`)
- 시드 스크립트: `scripts/seed-issue-keywords-firestore.js`
- 메인 UI: `app/index.tsx` (실시간 이슈 섹션, 포커스 시 키워드 갱신)

---

## 7. 빠른 체크리스트

- [ ] Firestore 규칙에 `issueKeywords` 읽기 허용·쓰기 거부(클라이언트) 반영
- [ ] `issueKeywords/current` 문서 존재 (없으면 시드 스크립트 실행)
- [ ] 콘솔 또는 관리자 웹으로 저장 후 앱 메인 재진입으로 반영 확인
