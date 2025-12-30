# SQLite 데이터베이스 확인 방법

## 데이터베이스 파일 위치

### Android
- **경로**: `/data/data/com.neovisioning.stockcalc/databases/stock_calculator.db`
- **파일명**: `stock_calculator.db`

### iOS (시뮬레이터)
- **경로**: `~/Library/Developer/CoreSimulator/Devices/{DEVICE_UUID}/data/Containers/Data/Application/{APP_UUID}/Documents/`
- **파일명**: `stock_calculator.db`

## 데이터베이스 확인 방법

### 방법 1: adb를 통한 확인 (Android)

1. **데이터베이스 파일을 PC로 복사**:
   ```bash
   adb pull /data/data/com.neovisioning.stockcalc/databases/stock_calculator.db ./
   ```

2. **SQLite 뷰어로 열기**:
   - [DB Browser for SQLite](https://sqlitebrowser.org/) 설치
   - 복사한 `stock_calculator.db` 파일 열기

### 방법 2: 앱 내에서 확인 (디버그 모드)

앱 실행 시 콘솔에서 데이터베이스 경로가 출력됩니다.

### 방법 3: adb shell로 직접 확인

```bash
# adb shell 접속
adb shell

# 앱 데이터 디렉토리로 이동
cd /data/data/com.neovisioning.stockcalc/databases/

# 파일 목록 확인
ls -la

# SQLite CLI로 데이터베이스 열기 (선택사항)
sqlite3 stock_calculator.db

# SQLite CLI 명령어 예시:
# .tables           # 테이블 목록
# SELECT * FROM accounts;  # accounts 테이블 조회
# .quit            # 종료
```

## 테이블 구조

### accounts (포트폴리오)
- `id`: TEXT PRIMARY KEY
- `name`: TEXT NOT NULL
- `currency`: TEXT NOT NULL (KRW/USD)
- `created_at`: INTEGER NOT NULL
- `updated_at`: INTEGER NOT NULL

### stocks (종목)
- `id`: TEXT PRIMARY KEY
- `account_id`: TEXT NOT NULL (accounts.id 참조)
- `ticker`: TEXT NOT NULL (종목 코드, 나중에 Yahoo Finance 연동 시 사용)
- `name`: TEXT (종목명, 사용자가 입력하는 이름)
- `quantity`: INTEGER NOT NULL DEFAULT 0 (보유 주식 수)
- `average_price`: REAL NOT NULL DEFAULT 0 (평균 단가)
- `current_price`: REAL (현재가, Yahoo Finance에서 가져옴)
- `currency`: TEXT NOT NULL
- `created_at`: INTEGER NOT NULL
- `updated_at`: INTEGER NOT NULL
- FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE

### averaging_records (거래 기록, 매수/매도 통합)
- `id`: TEXT PRIMARY KEY
- `stock_id`: TEXT NOT NULL (stocks.id 참조)
- `type`: TEXT NOT NULL ('BUY' 또는 'SELL')
- `price`: REAL NOT NULL (매수가 또는 매도가)
- `quantity`: INTEGER NOT NULL (매수 또는 매도 수량)
- `fee_rate`: REAL NOT NULL
- `currency`: TEXT NOT NULL
- `exchange_rate`: REAL
- `average_price_before`: REAL (매수 전 평균 단가)
- `average_price_after`: REAL (매수 후 평균 단가)
- `average_price_at_sell`: REAL (매도 시점의 평단가)
- `profit`: REAL (손익, 매도일 때만)
- `total_quantity_before`: INTEGER NOT NULL
- `total_quantity_after`: INTEGER NOT NULL
- `created_at`: INTEGER NOT NULL

## 참고사항

- 데이터베이스는 앱 최초 실행 시 자동으로 생성됩니다 (`initDatabase()` 함수 호출 시)
- 계좌/종목 삭제 시 CASCADE DELETE로 하위 데이터도 자동 삭제됩니다
- 루팅되지 않은 Android 기기에서는 `/data/data/` 경로 접근이 제한될 수 있습니다
  - 이 경우 에뮬레이터 사용 또는 앱 내에서 데이터베이스 파일을 외부 저장소로 복사하는 기능 추가 필요


