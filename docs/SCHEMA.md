# 데이터베이스 스키마 설계서

## 테이블 구조

### 1. accounts (포트폴리오)

계좌(포트폴리오) 정보를 저장하는 테이블입니다.

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | TEXT | PRIMARY KEY | 고유 식별자 (UUID) |
| name | TEXT | NOT NULL | 포트폴리오 이름 |
| currency | TEXT | NOT NULL | 통화 (KRW/USD) |
| created_at | INTEGER | NOT NULL | 생성일시 (타임스탬프) |
| updated_at | INTEGER | NOT NULL | 수정일시 (타임스탬프) |

**기본 키**: `id`

**인덱스**: 없음

**CASCADE DELETE**: stocks 테이블의 `account_id`가 이 테이블을 참조하며, 계좌 삭제 시 관련 종목들이 자동 삭제됩니다.

---

### 2. stocks (종목)

종목 정보를 저장하는 테이블입니다.

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | TEXT | PRIMARY KEY | 고유 식별자 (UUID) |
| account_id | TEXT | NOT NULL, FK → accounts.id | 포트폴리오 ID |
| ticker | TEXT | NOT NULL | 종목 코드 (티커) |
| name | TEXT | NULL | 종목명 |
| quantity | INTEGER | NOT NULL DEFAULT 0 | 보유 주식 수 |
| average_price | REAL | NOT NULL DEFAULT 0 | 현재 평균 단가 |
| current_price | REAL | NULL | 현재가 (Yahoo Finance에서 가져옴) |
| currency | TEXT | NOT NULL | 통화 (KRW/USD) |
| created_at | INTEGER | NOT NULL | 생성일시 (타임스탬프) |
| updated_at | INTEGER | NOT NULL | 수정일시 (타임스탬프) |

**기본 키**: `id`

**외래 키**: 
- `account_id` → `accounts.id` (ON DELETE CASCADE)

**복합 UNIQUE 제약조건**: `UNIQUE(account_id, ticker)`
- 같은 포트폴리오에서 동일한 티커는 중복 불가

**인덱스**:
- `idx_stocks_account_id`: account_id 컬럼 인덱스
- `idx_stocks_ticker`: ticker 컬럼 인덱스

**CASCADE DELETE**: 
- accounts 테이블 삭제 시 관련 종목들이 자동 삭제
- 종목 삭제 시 averaging_records 테이블의 관련 기록들이 자동 삭제

---

### 3. averaging_records (물타기 기록/실적)

물타기(평균단가 계산) 기록을 저장하는 테이블입니다.

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | TEXT | PRIMARY KEY | 고유 식별자 (UUID) |
| stock_id | TEXT | NOT NULL, FK → stocks.id | 종목 ID |
| buy_price | REAL | NOT NULL | 매수가 |
| quantity | INTEGER | NOT NULL | 매수 수량 |
| fee_rate | REAL | NOT NULL | 수수료율 (%) |
| currency | TEXT | NOT NULL | 통화 (KRW/USD) |
| exchange_rate | REAL | NULL | 환율 (USD인 경우) |
| average_price_before | REAL | NOT NULL | 매수 전 평균 단가 |
| average_price_after | REAL | NOT NULL | 매수 후 평균 단가 |
| total_quantity_before | INTEGER | NOT NULL | 매수 전 총 수량 |
| total_quantity_after | INTEGER | NOT NULL | 매수 후 총 수량 |
| created_at | INTEGER | NOT NULL | 생성일시 (타임스탬프) |

**기본 키**: `id`

**외래 키**:
- `stock_id` → `stocks.id` (ON DELETE CASCADE)

**인덱스**:
- `idx_averaging_records_stock_id`: stock_id 컬럼 인덱스
- `idx_averaging_records_created_at`: created_at 컬럼 인덱스 (시간순 정렬 최적화)

**CASCADE DELETE**: stocks 테이블 삭제 시 관련 물타기 기록들이 자동 삭제

---

## ERD (Entity Relationship Diagram)

```
accounts (포트폴리오)
  │
  │ 1:N (account_id)
  │
  └─→ stocks (종목)
       │
       │ 1:N (stock_id)
       │
       └─→ averaging_records (물타기 기록)
```

**관계 설명**:
- 1개 포트폴리오는 여러 종목을 가질 수 있음 (1:N)
- 1개 종목은 여러 물타기 기록을 가질 수 있음 (1:N)
- 포트폴리오 삭제 → 관련 종목 자동 삭제 → 관련 기록 자동 삭제 (CASCADE)

---

## SQL 생성 스크립트

```sql
-- 외래키 제약조건 활성화 (SQLite는 기본적으로 비활성화)
PRAGMA foreign_keys = ON;

-- accounts 테이블
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT NOT NULL CHECK(currency IN ('KRW', 'USD')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- stocks 테이블
CREATE TABLE IF NOT EXISTS stocks (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  name TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  average_price REAL NOT NULL DEFAULT 0,
  current_price REAL,
  currency TEXT NOT NULL CHECK(currency IN ('KRW', 'USD')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  UNIQUE(account_id, ticker)
);

-- averaging_records 테이블
CREATE TABLE IF NOT EXISTS averaging_records (
  id TEXT PRIMARY KEY,
  stock_id TEXT NOT NULL,
  buy_price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  fee_rate REAL NOT NULL,
  currency TEXT NOT NULL CHECK(currency IN ('KRW', 'USD')),
  exchange_rate REAL,
  average_price_before REAL NOT NULL,
  average_price_after REAL NOT NULL,
  total_quantity_before INTEGER NOT NULL,
  total_quantity_after INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_stocks_account_id ON stocks(account_id);
CREATE INDEX IF NOT EXISTS idx_stocks_ticker ON stocks(ticker);
CREATE INDEX IF NOT EXISTS idx_averaging_records_stock_id ON averaging_records(stock_id);
CREATE INDEX IF NOT EXISTS idx_averaging_records_created_at ON averaging_records(created_at);
```

---

## 키 관계 요약

### Primary Keys (기본 키)
- `accounts.id`: 포트폴리오 고유 식별자
- `stocks.id`: 종목 고유 식별자
- `averaging_records.id`: 물타기 기록 고유 식별자

### Foreign Keys (외래 키)
- `stocks.account_id` → `accounts.id` (CASCADE DELETE)
- `averaging_records.stock_id` → `stocks.id` (CASCADE DELETE)

### Unique Constraints (유일 제약조건)
- `stocks`: `UNIQUE(account_id, ticker)` - 같은 포트폴리오에서 동일 티커 중복 방지

---

## 테이블 구조 확인 방법

### 1. SQLite CLI 사용
```bash
# 데이터베이스 파일 열기
sqlite3 stock_calculator.db

# 외래키 설정 확인
PRAGMA foreign_keys;

# 테이블 목록 확인
.tables

# 테이블 구조 확인
.schema accounts
.schema stocks
.schema averaging_records

# 인덱스 확인
.indices stocks
.indices averaging_records
```

### 2. DB Browser for SQLite 사용
- https://sqlitebrowser.org/ 에서 다운로드
- 데이터베이스 파일 열기
- Database Structure 탭에서 테이블 구조 확인

### 3. 코드에서 확인
`src/services/DatabaseService.ts` 파일의 `createTables()` 함수에서 스키마 정의를 확인할 수 있습니다.

---

## 주의사항

1. **외래키 제약조건 활성화**: SQLite는 기본적으로 외래키 제약조건이 비활성화되어 있으므로, 데이터베이스 초기화 시 `PRAGMA foreign_keys = ON;`을 실행해야 합니다.

2. **CASCADE DELETE**: 포트폴리오 삭제 시 관련 종목과 기록이 자동으로 삭제되므로 주의하세요.

3. **UNIQUE 제약조건**: 같은 포트폴리오에서 동일한 티커로 종목을 중복 추가할 수 없습니다.
