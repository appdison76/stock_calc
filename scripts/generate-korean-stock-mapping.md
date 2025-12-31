# 한국 주식 종목 매핑 데이터 생성 가이드

## 개요
코스피/코스닥 전체 종목(약 2,400개)의 티커와 한글명을 매핑하는 데이터를 생성하는 방법입니다.

## 방법 1: Python pykrx 라이브러리 사용 (권장)

```python
# install: pip install pykrx
from pykrx import stock

# 코스피 전체 종목
kospi_stocks = stock.get_market_ticker_list("20240101", market="KOSPI")
kospi_data = []
for ticker in kospi_stocks:
    name = stock.get_market_ticker_name(ticker)
    kospi_data.append({
        "ticker": f"{ticker}.KS",
        "name": name
    })

# 코스닥 전체 종목
kosdaq_stocks = stock.get_market_ticker_list("20240101", market="KOSDAQ")
kosdaq_data = []
for ticker in kosdaq_stocks:
    name = stock.get_market_ticker_name(ticker)
    kosdaq_data.append({
        "ticker": f"{ticker}.KS",
        "name": name
    })

# JSON으로 저장
import json
all_stocks = kospi_data + kosdaq_data
with open('korean-stocks.json', 'w', encoding='utf-8') as f:
    json.dump(all_stocks, f, ensure_ascii=False, indent=2)
```

## 방법 2: 한국투자증권 API (KIS API)

- 공식 API 사용
- API 키 필요 (한국투자증권 계좌 필요)

## 방법 3: 네이버 증권 크롤링 (비권장)

- 법적/윤리적 문제 가능
- 페이지 구조 변경 시 코드 수정 필요
- 불안정할 수 있음

## 데이터 형식

생성된 JSON 파일 형식:
```json
[
  {
    "ticker": "005930.KS",
    "name": "삼성전자"
  },
  {
    "ticker": "000660.KS",
    "name": "SK하이닉스"
  }
]
```

## 코드에 추가하기

생성된 데이터를 `src/services/YahooFinanceService.ts`의 `KOREAN_STOCK_MAP`과 `KOREAN_TICKER_TO_NAME_MAP`에 추가합니다.


