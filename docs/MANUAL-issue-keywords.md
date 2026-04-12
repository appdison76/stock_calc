# 실시간 이슈 키워드 운영 메뉴얼

메인 화면「실시간 이슈」칩 등에서 쓰는 키워드 목록을 **앱 스토어 재배포 없이** 바꾸는 방법과, 앱 안 폴백이 언제 쓰이는지 정리합니다.

---

## 1. 데이터가 오는 곳

| 구분 | 설명 |
|------|------|
| **런타임(실기기)** | `IssueKeywordsService.ts`에 적힌 **URL**로 `fetch` 합니다. 로컬의 `docs/issue-keywords.json` 파일을 앱이 직접 읽지는 **않습니다**. |
| **원격 URL** | `https://appdison76.github.io/stock_calc/issue-keywords.json` |
| **저장소 소스** | `docs/issue-keywords.json` — 편집·버전 관리용. GitHub Pages 등에 **배포**되면 위 URL과 내용을 맞출 수 있습니다. |
| **폴백** | 원격 요청이 실패하거나 유효한 목록이 없을 때, 앱 바이너리에 포함된 `FALLBACK_ISSUE_KEYWORDS` 배열을 사용합니다. (`src/services/IssueKeywordsService.ts`) |

`min-version.json`과 동일하게 **GitHub Pages** 베이스를 쓰는 전제입니다.

---

## 2. 앱 업데이트 없이 키워드만 바꾸려면

1. **`docs/issue-keywords.json`** 형식을 유지한 채 `keywords` 배열만 수정합니다.
2. **`IssueKeywordsService.ts`는 건드리지 않습니다.** (URL·파싱 규칙이 그대로일 때)
3. 변경분을 **Git에 커밋**한 뒤, 실제로 **GitHub Pages에 `issue-keywords.json`이 위 URL로 서빙되도록** 배포합니다.

> **주의:** 깃에만 커밋하고 Pages에 반영이 안 되면, 사용자 앱은 예전 원격 파일·또는 네트워크 오류 시 폴백만 보게 됩니다.

---

## 3. JSON 형식

최상위 객체에 **`keywords`** 배열이 있어야 합니다. 각 요소는 객체이며, 앱 파서 기준으로는 다음을 사용합니다.

| 필드 | 필수 | 설명 |
|------|------|------|
| `keyword` | 예 | 표시·검색에 쓰는 문자열 (비어 있으면 제외) |
| `rank` | 아니오 | 숫자면 정렬에 사용. 없으면 순서대로 부여 |
| `count` | 아니오 | 숫자면 부가 정보로만 사용 가능 |

정렬 후 **최대 10개**만 사용합니다.

### 예시 (`docs/issue-keywords.json`과 동일 구조)

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

아래 중 하나면 원격 JSON 대신 **앱에 빌드된 폴백 목록**이 나갑니다.

- 네트워크 오류, 타임아웃(서비스 쪽 약 8초), 기타 `fetch` 예외
- HTTP 응답이 `ok`가 아님 (예: 404)
- JSON 파싱 후 `keywords`가 비어 있거나 형식이 맞지 않아 파싱 결과가 빈 배열

**폴백 문구를 바꾸려면** `IssueKeywordsService.ts`의 `FALLBACK_ISSUE_KEYWORDS`를 수정하고 **스토어에 새 앱 버전**을 올려야 합니다.

---

## 5. 앱 스토어 업데이트가 필요한 경우

| 작업 | 앱 업데이트 |
|------|-------------|
| `docs/issue-keywords.json`만 수정 후 Pages 배포 | **불필요** (형식 동일·URL 동일) |
| 원격 URL 변경, 파싱 규칙 변경 | **필요** (`IssueKeywordsService.ts` 등 코드 변경) |
| 폴백 기본 목록 변경 | **필요** |

---

## 6. 관련 소스 위치

- 서비스 로직: `src/services/IssueKeywordsService.ts`
- 편집용 JSON: `docs/issue-keywords.json`
- 메인 UI: `app/index.tsx` (실시간 이슈 섹션, 설정으로 표시 on/off 가능)

---

## 7. 빠른 체크리스트

- [ ] `docs/issue-keywords.json` 문법 오류 없음 (`keywords` 배열)
- [ ] 브라우저에서 `https://appdison76.github.io/stock_calc/issue-keywords.json` 열어 최신 내용 확인
- [ ] 앱에서 메인「실시간 이슈」또는 설정 켠 뒤 새로고침·재진입으로 반영 확인
