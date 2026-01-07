"""
한국 주식 전체 종목 데이터 생성 스크립트
pykrx 라이브러리를 사용하여 코스피/코스닥 전체 종목의 티커와 한글명을 추출합니다.

사용법:
  pip install pykrx
  python scripts/generate_korean_stocks.py
"""

import json
import sys
from datetime import datetime

try:
    from pykrx import stock
except ImportError:
    print("❌ pykrx 라이브러리가 설치되지 않았습니다.")
    print("다음 명령어로 설치하세요: pip install pykrx")
    sys.exit(1)

def generate_stock_mapping():
    """코스피/코스닥 전체 종목 데이터 생성"""
    print("📊 한국 주식 전체 종목 데이터 생성 시작...")
    
    # 최근 날짜 사용 (상장된 종목만 가져오기 위해)
    today = datetime.now().strftime("%Y%m%d")
    
    all_stocks = []
    stock_map = {}  # 이름 -> 티커 매핑 (여러 이름 지원)
    ticker_to_name = {}  # 티커 -> 한글명 매핑
    
    # 코스피 종목
    print("📈 코스피 종목 수집 중...")
    try:
        kospi_tickers = stock.get_market_ticker_list(today, market="KOSPI")
        print(f"  코스피 종목 수: {len(kospi_tickers)}개")
        
        for ticker in kospi_tickers:
            try:
                name = stock.get_market_ticker_name(ticker)
                ticker_ks = f"{ticker}.KS"
                
                # 기본 매핑 추가
                stock_map[name] = ticker_ks
                ticker_to_name[ticker_ks] = name
                
                # 별칭 추가 (예: "하이닉스" -> "SK하이닉스")
                if "하이닉스" in name:
                    stock_map["하이닉스"] = ticker_ks
                if "현대" in name and "자동차" in name:
                    stock_map["현대차"] = ticker_ks
                if name.startswith("LG"):
                    # LG 관련 별칭 추가
                    if "에너지" in name:
                        stock_map["LG에너솔"] = ticker_ks
                        stock_map["LGES"] = ticker_ks
                    # LG만 검색했을 때는 LG전자가 기본값 (나중에 처리)
                if name.startswith("SK"):
                    # SK 관련 별칭
                    if "증권" in name or "지주" in name:
                        stock_map["SK지주"] = ticker_ks
                        stock_map["SK지주사"] = ticker_ks
                
                all_stocks.append({
                    "ticker": ticker_ks,
                    "name": name
                })
            except Exception as e:
                print(f"  경고: 티커 {ticker} 처리 중 오류: {e}")
                continue
    except Exception as e:
        print(f"❌ 코스피 종목 수집 오류: {e}")
        return None
    
    # 코스닥 종목
    print("📉 코스닥 종목 수집 중...")
    try:
        kosdaq_tickers = stock.get_market_ticker_list(today, market="KOSDAQ")
        print(f"  코스닥 종목 수: {len(kosdaq_tickers)}개")
        
        for ticker in kosdaq_tickers:
            try:
                name = stock.get_market_ticker_name(ticker)
                ticker_ks = f"{ticker}.KS"
                
                # 기본 매핑 추가
                stock_map[name] = ticker_ks
                ticker_to_name[ticker_ks] = name
                
                all_stocks.append({
                    "ticker": ticker_ks,
                    "name": name
                })
            except Exception as e:
                print(f"  경고: 티커 {ticker} 처리 중 오류: {e}")
                continue
    except Exception as e:
        print(f"❌ 코스닥 종목 수집 오류: {e}")
        return None
    
    print(f"\n✅ 총 {len(all_stocks)}개 종목 수집 완료")
    print(f"   - 매핑 엔트리: {len(stock_map)}개")
    print(f"   - 티커->이름: {len(ticker_to_name)}개")
    
    return {
        "stocks": all_stocks,
        "stock_map": stock_map,
        "ticker_to_name": ticker_to_name
    }

def save_json(data, filename):
    """JSON 파일로 저장"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"💾 {filename} 파일로 저장 완료")

def main():
    """메인 함수"""
    data = generate_stock_mapping()
    
    if data is None:
        print("❌ 데이터 생성 실패")
        sys.exit(1)
    
    # JSON 파일로 저장
    save_json(data, "scripts/korean_stocks_data.json")
    
    print("\n✅ 작업 완료!")
    print("다음 단계: 생성된 JSON 파일을 사용하여 YahooFinanceService.ts를 업데이트하세요.")

if __name__ == "__main__":
    main()











