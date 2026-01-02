"""
생성된 korean_stocks_data.json을 TypeScript 코드로 변환하는 스크립트
"""

import json

def convert_to_typescript():
    """JSON 데이터를 TypeScript 맵으로 변환"""
    
    # JSON 파일 읽기
    with open('scripts/korean_stocks_data.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    stock_map = data['stock_map']
    ticker_to_name = data['ticker_to_name']
    
    print(f"📊 변환 시작...")
    print(f"   - Stock map: {len(stock_map)}개")
    print(f"   - Ticker to name: {len(ticker_to_name)}개")
    
    # KOREAN_STOCK_MAP 생성
    ts_code = "// 한국 전체 종목의 한글명-티커 매핑 (자동 생성됨)\n"
    ts_code += "// 생성일: " + __import__('datetime').datetime.now().strftime("%Y-%m-%d %H:%M:%S") + "\n"
    ts_code += "// 총 " + str(len(stock_map)) + "개 매핑\n"
    ts_code += "const KOREAN_STOCK_MAP: Record<string, string> = {\n"
    
    # 정렬된 키로 출력 (가독성 향상)
    sorted_keys = sorted(stock_map.keys(), key=lambda x: (len(x), x))
    
    for name in sorted_keys:
        ticker = stock_map[name]
        # TypeScript 문자열 이스케이프
        escaped_name = name.replace("'", "\\'").replace("\\", "\\\\")
        ts_code += f"  '{escaped_name}': '{ticker}',\n"
    
    ts_code += "};\n\n"
    
    # KOREAN_TICKER_TO_NAME_MAP 생성
    ts_code += "// 티커를 한글명으로 변환하는 역매핑 (한국 주식용)\n"
    ts_code += "// 총 " + str(len(ticker_to_name)) + "개 매핑\n"
    ts_code += "const KOREAN_TICKER_TO_NAME_MAP: Record<string, string> = {\n"
    
    # 티커로 정렬
    sorted_tickers = sorted(ticker_to_name.keys())
    
    for ticker in sorted_tickers:
        name = ticker_to_name[ticker]
        # TypeScript 문자열 이스케이프
        escaped_name = name.replace("'", "\\'").replace("\\", "\\\\")
        ts_code += f"  '{ticker}': '{escaped_name}',\n"
    
    ts_code += "};\n"
    
    # 파일로 저장
    output_file = 'scripts/korean_stocks_maps.ts'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(ts_code)
    
    print(f"✅ TypeScript 파일 생성 완료: {output_file}")
    print(f"   파일 크기: {len(ts_code):,} bytes")
    
    return output_file

if __name__ == "__main__":
    convert_to_typescript()


