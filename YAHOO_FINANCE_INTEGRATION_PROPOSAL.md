# Yahoo Finance API 연동 제안서 (현재가 중심)

## 🎯 핵심 목표
**현재가를 가져와서 차트와 각 화면에 표시하기**
- 차트에 현재가 위치 표시 (수평선/마커)
- 종목 상세 화면에 현재가 표시
- 포트폴리오 목록에 현재가 표시
- 평단가와 현재가 비교로 손익 표시

## 현재 상황 분석

### 기존 구조
- ✅ `YahooFinanceService.ts`: 현재가 조회 기능 존재 (`getStockQuote`) - **이미 구현됨**
- ✅ `Stock` 모델: `ticker`(종목 코드), `name`(종목명), `currentPrice` 필드 존재
- ✅ 차트 화면: `currentPrice` 필드를 사용하려고 시도 (`stock.currentPrice || stock.averagePrice`)
- ✅ 종목 상세/포트폴리오: `currentPrice` 표시 코드 존재하지만 데이터가 없음
- ❌ 종목 추가 시: 티커 정보가 없어서 현재가를 가져올 수 없음
- ❌ 현재가 업데이트: 티커 정보가 없어서 현재가 조회 불가

### 문제점
**현재가를 가져오려면 티커 정보가 필수인데, 현재는 종목명만 입력하고 있어서 현재가를 가져올 수 없음**

### 필요한 기능
1. **종목 검색 기능**: 종목명 입력 시 Yahoo Finance API로 검색 → **티커 얻기**
2. **티커 저장**: 검색된 종목의 티커를 DB에 저장
3. **현재가 조회**: 저장된 티커로 현재가 가져오기 (이미 `getStockQuote` 함수 있음)
4. **현재가 업데이트**: 주기적으로 또는 수동으로 현재가 갱신
5. **차트 표시**: 현재가를 차트에 수평선/마커로 표시
6. **화면 표시**: 각 화면에 현재가와 평단가 비교 표시

---

## 구현 방법 제안

### ⭐ 추천: 방법 1 - Yahoo Finance 완전 활용 (검색 + 현재가)

**핵심 아이디어: 검색으로 티커를 얻고 → 티커로 현재가를 가져와서 → 차트와 화면에 표시**

#### 장점
- ✅ **무료** (공식 API 없지만 공개 엔드포인트 활용)
- ✅ **한국/미국 주식 모두 지원**
- ✅ **검색 + 현재가 모두 제공** (이미 현재가 조회 함수 있음)
- ✅ **별도 API 키 불필요**
- ✅ **이미 `getStockQuote` 함수 구현되어 있음**

#### 단점
- ⚠️ 공식 API가 아니므로 변경 가능성 (하지만 널리 사용되는 엔드포인트)
- ⚠️ Rate limit 제한 (적절한 디바운싱 필요)

#### 구현 단계

**1단계: Yahoo Finance 검색 API 함수 추가** (티커 얻기)
```typescript
// src/services/YahooFinanceService.ts

export interface StockSearchResult {
  symbol: string;      // 티커 (예: 'AAPL', '005930.KS')
  name: string;        // 종목명 (예: 'Apple Inc.', '삼성전자')
  exchange?: string;   // 거래소 (예: 'NASDAQ', 'KRX')
  type?: string;       // 종목 타입 (예: 'EQUITY')
}

export async function searchStocks(query: string): Promise<StockSearchResult[]> {
  // Yahoo Finance 검색 API 호출
  // 엔드포인트: https://query1.finance.yahoo.com/v1/finance/search?q={query}
  // 반환값: 티커 + 종목명 → 이 티커로 현재가를 가져올 수 있음
}
```

**2단계: 현재가 업데이트 함수 추가** (이미 getStockQuote 있음, DB 업데이트 기능 추가)
```typescript
// src/services/DatabaseService.ts

/**
 * 종목의 현재가를 Yahoo Finance에서 가져와서 DB에 업데이트
 */
export async function updateStockCurrentPrice(stockId: string): Promise<void> {
  const stock = await getStockById(stockId);
  if (!stock || !stock.ticker) return;
  
  const quote = await getStockQuote(stock.ticker);
  if (quote) {
    await updateStock(stockId, { currentPrice: quote.price });
  }
}

/**
 * 여러 종목의 현재가를 한 번에 업데이트 (포트폴리오 전체)
 */
export async function updatePortfolioCurrentPrices(accountId: string): Promise<void> {
  const stocks = await getStocksByAccountId(accountId);
  // 병렬로 현재가 조회 (Rate limit 고려해서 배치 처리)
  for (const stock of stocks) {
    if (stock.ticker) {
      await updateStockCurrentPrice(stock.id);
    }
  }
}
```

**3단계: 종목 검색 UI 컴포넌트 생성**
- 검색 입력창에 입력하면 자동으로 검색 결과 표시
- 검색 결과 리스트 (종목명, 티커, 거래소)
- 선택하면 티커와 종목명이 자동 입력됨

**4단계: 종목 추가 화면 수정 (`portfolio-detail.tsx`)**
```
[현재]
종목명 입력 → 바로 저장

[변경 후]
종목명 입력 → 검색 결과 표시 → 선택 → 티커/종목명 저장
                또는
            "직접 입력" 버튼 → 기존 방식대로 저장
```

**5단계: 물타기 저장 화면 수정 (`averaging.tsx`)**
```
[현재]
종목명 입력 → 바로 저장

[변경 후]
종목명 입력 → 검색 결과 표시 → 선택 → 티커/종목명 저장
                또는
            "직접 입력" 버튼 → 기존 방식대로 저장
```

**6단계: 현재가 조회 및 업데이트 기능**

**6-1. 종목 추가 시 현재가 자동 조회**
```typescript
// 종목 추가 후
await createStock(...);
// 티커가 있으면 현재가 조회
if (ticker) {
  const quote = await getStockQuote(ticker);
  if (quote) {
    await updateStock(stockId, { currentPrice: quote.price });
  }
}
```

**6-2. 화면 진입 시 현재가 갱신**
- 포트폴리오 상세 화면 진입 시: 모든 종목 현재가 갱신
- 종목 상세 화면 진입 시: 해당 종목 현재가 갱신
- 차트 화면 진입 시: 모든 종목 현재가 갱신

**6-3. 수동 새로고침 버튼**
- "현재가 갱신" 버튼으로 수동으로도 갱신 가능

**7단계: 차트에 현재가 표시 (`visualization.tsx`)**
```typescript
// 현재 코드: currentPrice: stock.currentPrice || stock.averagePrice
// → stock.currentPrice가 있으면 차트에 수평선/마커로 표시

// 차트에 현재가 라인 추가
<View style={styles.currentPriceLine}>
  <Text>현재가: {formatPrice(currentPrice)}</Text>
  {/* 차트 위에 수평선으로 표시 */}
</View>
```

**8단계: 각 화면에 현재가 표시**

**8-1. 종목 상세 화면 (`stock-detail.tsx`)**
```typescript
// 이미 코드 있음: {stock.currentPrice && ...}
// → currentPrice 데이터가 있으면 자동으로 표시됨

// 추가: 평단가 vs 현재가 비교
평단가: 50,000원
현재가: 55,000원 (+10.0% 📈)
```

**8-2. 포트폴리오 상세 화면 (`portfolio-detail.tsx`)**
```typescript
// 이미 코드 있음: {stock.currentPrice && ...}
// → 각 종목 카드에 현재가 표시

삼성전자
평단가: 50,000원 | 현재가: 55,000원 (+10%)
```

**9단계: 종목명 편집 기능 유지**
- 종목 편집 시에도 검색 기능 사용 가능
- 또는 수동으로 종목명만 수정 (티커는 유지되어 현재가 조회 계속 가능)

---

### 방법 2: Alpha Vantage API 사용 (비추천 ❌)

#### 장점
- 공식 API (안정적)
- 검색 기능 제공
- 무료 티어 존재

#### 단점
- ❌ API 키 필요 (회원가입 필요)
- ❌ 무료 티어는 API 호출 제한 (5 calls/min, 500 calls/day) → **현재가 갱신이 제한적**
- ❌ 한국 주식 지원 제한적
- ❌ 이미 Yahoo Finance 함수 구현되어 있어서 변경 작업 불필요

**결론: Yahoo Finance가 더 적합 (무료, 제한 없음, 한국/미국 모두 지원)**

---

### 방법 3: 하이브리드 방식 (검색 + 수동 입력)

#### 장점
- 사용자가 원하는 방식 선택 가능
- 검색이 실패해도 수동 입력 가능
- 유연성 높음

#### 구현 방식
```
종목명 입력창
  ↓
입력 시 자동 검색 (디바운싱 적용)
  ↓
[검색 결과 표시 영역]
  - 결과 1: Apple Inc. (AAPL)
  - 결과 2: Apple Hospitality REIT (APLE)
  - ...
  - "직접 입력" 버튼
  ↓
선택 또는 직접 입력
  ↓
저장 (ticker + name)
```

---

## 데이터베이스 스키마 (변경 불필요 ✅)

현재 스키마가 이미 적합합니다:
- `ticker`: 종목 코드 저장 (예: 'AAPL', '005930.KS')
- `name`: 종목명 저장 (예: 'Apple Inc.', '삼성전자')
- 사용자가 종목명을 수정해도 `ticker`는 유지됨

---

## 권장 구현 방식

### ⭐ 추천: 방법 1 (Yahoo Finance Search API) + 방법 3 (하이브리드)

**이유:**
1. ✅ **무료이고 API 키가 필요 없음**
2. ✅ **한국/미국 주식 모두 지원**
3. ✅ **이미 현재가 조회 함수(`getStockQuote`) 구현되어 있음**
4. ✅ **사용자가 검색 실패 시 수동 입력 가능**
5. ✅ **구현이 비교적 간단**
6. ✅ **현재가 조회에 필요한 티커 정보를 검색으로 얻을 수 있음**

**UI/UX 흐름:**

1. **종목 추가 화면** (티커 얻기)
   ```
   [종목명 입력창]
   사용자 입력: "Apple"
   
   [검색 결과 (자동 표시)]
   🔍 검색 결과 (3개)
   ┌─────────────────────────────────┐
   │ Apple Inc.                      │
   │ AAPL · NASDAQ                   │ ← 선택
   └─────────────────────────────────┘
   ┌─────────────────────────────────┐
   │ Apple Hospitality REIT, Inc.    │
   │ APLE · NYSE                     │
   └─────────────────────────────────┘
   ┌─────────────────────────────────┐
   │ 직접 입력 (검색 결과 없음)       │
   └─────────────────────────────────┘
   
   [저장 후]
   - ticker: 'AAPL' 저장
   - name: 'Apple Inc.' 저장
   - 현재가 자동 조회: getStockQuote('AAPL') → currentPrice 저장
   ```

2. **종목 상세 화면** (현재가 표시)
   ```
   삼성전자 (005930.KS)
   
   평단가: 50,000원
   현재가: 55,000원 (+10.0% 📈)  ← Yahoo Finance에서 가져온 현재가
   보유 수량: 100주
   ```

3. **차트 화면** (현재가 라인 표시)
   ```
   [차트 영역]
   ┌─────────────────────────────┐
   │                            │ ← 현재가 수평선
   │    ●    ●                  │
   │  ●       ●                 │
   │───────────────  (55,000원) │ ← 현재가 라인
   │        ●                   │
   └─────────────────────────────┘
   
   평단가: 50,000원
   현재가: 55,000원 (+10%)
   ```

4. **포트폴리오 상세 화면** (각 종목 현재가 표시)
   ```
   삼성전자
   평단가: 50,000원 | 현재가: 55,000원 (+10%)
   
   Apple Inc.
   평단가: $150 | 현재가: $165 (+10%)
   ```

5. **종목 편집 시**
   - 현재 저장된 종목명 표시
   - 수정 시에도 검색 기능 사용 가능
   - 종목명만 수정해도 티커는 유지 → 현재가 조회 계속 가능

---

## 구현 순서 (현재가 중심)

### Phase 1: 티커 얻기 (검색 기능)
1. ✅ Yahoo Finance 검색 API 함수 추가
2. ✅ 종목 검색 UI 컴포넌트 생성 (재사용 가능)
3. ✅ 종목 추가 화면에 검색 기능 통합 → **티커 저장**
4. ✅ 물타기 저장 화면에 검색 기능 통합 → **티커 저장**
5. ✅ 에러 처리 (검색 실패, 네트워크 오류 등)
6. ✅ 디바운싱 처리 (검색 요청 최적화)

### Phase 2: 현재가 조회 및 업데이트
7. ✅ 현재가 업데이트 함수 추가 (`updateStockCurrentPrice`)
8. ✅ 종목 추가 시 현재가 자동 조회
9. ✅ 화면 진입 시 현재가 갱신 로직 추가
10. ✅ 수동 새로고침 버튼 추가 ("현재가 갱신")

### Phase 3: 현재가 표시
11. ✅ 차트에 현재가 라인/마커 표시 (`visualization.tsx`)
12. ✅ 종목 상세 화면에 현재가 + 평단가 비교 표시
13. ✅ 포트폴리오 상세 화면에 각 종목 현재가 표시
14. ✅ 손익률 계산 및 표시 (현재가 - 평단가)

---

## 추가 고려사항

1. **현재가 갱신 전략**
   - **자동 갱신**: 화면 진입 시 1회 조회 (너무 자주 조회하지 않음)
   - **수동 갱신**: "새로고침" 버튼으로 사용자가 직접 갱신
   - **Rate Limit**: Yahoo Finance는 제한이 있으므로 배치 처리 (여러 종목 조회 시 순차 처리 또는 딜레이)

2. **캐싱**: 
   - 현재가 조회 결과를 일정 시간 캐싱 (예: 1분)
   - 같은 티커를 짧은 시간에 여러 번 조회하는 것 방지

3. **오프라인 모드**: 
   - 검색 실패 시 수동 입력으로 fallback
   - 현재가 조회 실패 시 기존 currentPrice 유지 또는 표시 안 함

4. **한국 주식 처리**: 
   - 한국 주식 검색 시 '.KS' 접미사 자동 처리
   - 예: '삼성전자' 검색 → '005930.KS' 저장
   - 미국 주식은 그대로 (예: 'AAPL')

5. **통화 자동 감지**: 
   - 티커 형식으로 통화 자동 판단
   - 예: '005930.KS' → KRW, 'AAPL' → USD
   - 포트폴리오의 currency와 일치하는지 확인

6. **에러 처리**:
   - 현재가 조회 실패 시 사용자에게 알림
   - "현재가 조회 실패" 메시지 표시
   - 재시도 버튼 제공

7. **성능 최적화**:
   - 포트폴리오에 종목이 많을 경우 현재가 갱신 시간이 오래 걸릴 수 있음
   - 로딩 인디케이터 표시
   - 병렬 처리 또는 순차 처리 선택

---

## 기술 스택

- **API**: 
  - Yahoo Finance Search API (검색)
  - Yahoo Finance Quote API (현재가 조회) - **이미 구현됨**
- **라이브러리**: 기존 `fetch` API 사용 (추가 패키지 불필요)
- **상태 관리**: React Native `useState`, `useEffect`
- **디바운싱**: `useDebounce` 커스텀 훅 또는 라이브러리
- **차트 라이브러리**: 기존 차트 컴포넌트 활용

## 요약

### 핵심 흐름
```
1. 종목 검색 → 티커 얻기
   ↓
2. 티커 저장 (DB)
   ↓
3. 티커로 현재가 조회 (getStockQuote)
   ↓
4. 현재가 저장 (DB)
   ↓
5. 차트/화면에 현재가 표시
```

### 구현 우선순위
1. **검색 기능** (티커 얻기) - 필수
2. **현재가 조회 및 저장** - 필수
3. **현재가 표시** - 필수 (차트 + 화면)
4. **자동 갱신** - 권장
5. **수동 갱신 버튼** - 선택

### 현재가 표시 위치
- ✅ 차트 화면 (수평선/마커)
- ✅ 종목 상세 화면
- ✅ 포트폴리오 상세 화면
- ✅ 평단가 vs 현재가 비교 (손익률)

