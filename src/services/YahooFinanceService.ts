/**
 * Yahoo Finance API를 통한 주식 현재가 조회 서비스
 * 
 * 참고: Yahoo Finance는 공식 API가 없지만, yfinance 스타일의 엔드포인트를 사용할 수 있습니다.
 * 또는 무료 API 서비스를 활용할 수 있습니다.
 */

export interface StockQuote {
  symbol: string;
  price: number;
  currency: string;
  name?: string;
  change?: number;
  changePercent?: number;
}

/**
 * Yahoo Finance에서 주식 현재가 조회
 * @param ticker 종목 코드 (예: 'AAPL', '005930.KS' - 한국 주식은 .KS 접미사)
 * @returns 주식 현재가 정보
 */
export async function getStockQuote(ticker: string): Promise<StockQuote | null> {
  try {
    // 한국 주식인 경우 .KS 접미사 추가
    const normalizedTicker = ticker.includes('.') ? ticker : `${ticker}.KS`;
    
    // Yahoo Finance API 엔드포인트 (무료 버전)
    // 참고: 실제 프로덕션에서는 더 안정적인 API를 사용하는 것이 좋습니다.
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${normalizedTicker}?interval=1d&range=1d`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      return null;
    }
    
    const result = data.chart.result[0];
    const meta = result.meta;
    
    if (!meta || !meta.regularMarketPrice) {
      return null;
    }
    
    return {
      symbol: meta.symbol || ticker,
      price: meta.regularMarketPrice,
      currency: meta.currency || 'KRW',
      name: meta.shortName || meta.longName,
      change: meta.regularMarketPrice - (meta.previousClose || meta.regularMarketPrice),
      changePercent: meta.previousClose 
        ? ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100
        : undefined,
    };
  } catch (error) {
    console.error('Yahoo Finance API 오류:', error);
    return null;
  }
}

/**
 * 여러 종목의 현재가를 한 번에 조회
 */
export async function getMultipleStockQuotes(
  tickers: string[]
): Promise<Map<string, StockQuote | null>> {
  const results = new Map<string, StockQuote | null>();
  
  // 병렬로 요청 (너무 많으면 순차 처리로 변경 가능)
  const promises = tickers.map(async (ticker) => {
    const quote = await getStockQuote(ticker);
    results.set(ticker, quote);
  });
  
  await Promise.all(promises);
  
  return results;
}

/**
 * 한국 주식 티커를 Yahoo Finance 형식으로 변환
 * @param ticker 한국 주식 코드 (예: '005930')
 * @returns Yahoo Finance 형식 (예: '005930.KS')
 */
export function normalizeKoreanTicker(ticker: string): string {
  if (ticker.includes('.')) {
    return ticker;
  }
  // 6자리 숫자면 한국 주식으로 간주
  if (/^\d{6}$/.test(ticker)) {
    return `${ticker}.KS`;
  }
  return ticker;
}

/**
 * 미국 주식 티커를 Yahoo Finance 형식으로 변환
 * @param ticker 미국 주식 코드 (예: 'AAPL')
 * @returns Yahoo Finance 형식 (예: 'AAPL')
 */
export function normalizeUsTicker(ticker: string): string {
  return ticker.toUpperCase();
}




