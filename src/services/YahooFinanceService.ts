/**
 * Yahoo Finance API를 통한 주식 현재가 조회 서비스
 * 
 * 참고: Yahoo Finance는 공식 API가 없지만, yfinance 스타일의 엔드포인트를 사용할 수 있습니다.
 * 또는 무료 API 서비스를 활용할 수 있습니다.
 */

import {
  KOREAN_STOCK_MAP,
  KOREAN_TICKER_TO_NAME_MAP,
} from '../data/korean_stocks_maps';

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
    // 티커 정규화: 이미 접미사가 있으면 그대로 사용, 6자리 숫자면 .KS 추가, 그 외는 그대로 사용
    let normalizedTicker = ticker;
    if (!ticker.includes('.')) {
      // 6자리 숫자인 경우 한국 주식으로 간주하여 .KS 추가
      if (/^\d{6}$/.test(ticker)) {
        normalizedTicker = `${ticker}.KS`;
      }
      // 그 외 (영문 티커 등)는 그대로 사용 (미국 주식 등)
    }
    
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
    
    const previousClose = meta.previousClose || meta.regularMarketPreviousClose || meta.chartPreviousClose;
    const currentPrice = meta.regularMarketPrice;
    const change = previousClose ? currentPrice - previousClose : undefined;
    const changePercent = previousClose ? ((currentPrice - previousClose) / previousClose) * 100 : undefined;

    return {
      symbol: meta.symbol || ticker,
      price: currentPrice,
      currency: meta.currency || 'KRW',
      name: meta.shortName || meta.longName,
      change: change,
      changePercent: changePercent,
    };
  } catch (error) {
    // 백그라운드 작업이므로 조용히 처리 (사용자에게 오류 표시하지 않음)
    // console.warn('Yahoo Finance API 오류:', error);
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

/**
 * Yahoo Finance 검색 결과 인터페이스
 */
export interface StockSearchResult {
  symbol: string;      // 티커 (예: 'AAPL', '005930.KS')
  name: string;        // 종목명 (예: 'Apple Inc.', '삼성전자')
  originalName?: string; // 원래 종목명 (한국 주식의 경우 영문명, 예: 'Samsung Electronics Co., Ltd.')
  exchange?: string;   // 거래소 (예: 'NASDAQ', 'KRX')
  type?: string;       // 종목 타입 (예: 'EQUITY')
  quoteType?: string;  // 인용 타입
}

// 한국 종목 매핑은 src/data/korean_stocks_maps.ts에서 import됨

/**
 * Yahoo Finance에서 종목 검색
 * @param query 검색어 (예: 'Apple', '삼성전자', 'Samsung', '005930')
 * @returns 검색 결과 배열
 */
export async function searchStocks(query: string): Promise<StockSearchResult[]> {
  try {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const trimmedQuery = query.trim();
    
    // 한국 주식 한글명으로 검색한 경우, 티커로 변환하여 추가 검색
    const koreanStockTicker = KOREAN_STOCK_MAP[trimmedQuery];
    
    // 검색어가 짧을 때(2-4글자) KOREAN_STOCK_MAP에서 매칭되는 종목들의 티커로도 검색
    let additionalQueries: string[] = [];
    const upperQuery = trimmedQuery.toUpperCase();
    
    // 검색어가 2-4글자이고 한국어인 경우, KOREAN_STOCK_MAP에서 검색어를 포함하는 항목 찾기
    if (trimmedQuery.length >= 2 && trimmedQuery.length <= 4 && /[가-힣]/.test(trimmedQuery)) {
      // KOREAN_STOCK_MAP에서 검색어를 포함하는 항목 찾기
      const matchingStocks = Object.entries(KOREAN_STOCK_MAP).filter(([name, ticker]) => 
        name.includes(trimmedQuery) || trimmedQuery.includes(name.substring(0, Math.min(trimmedQuery.length, name.length)))
      );
      
      // 매칭되는 종목들의 티커로 추가 검색 (티커에서 .KS 제거)
      matchingStocks.forEach(([name, ticker]) => {
        const tickerWithoutKS = ticker.replace('.KS', '');
        if (!additionalQueries.includes(tickerWithoutKS)) {
          additionalQueries.push(tickerWithoutKS);
        }
      });
    }
    
    // 영문 검색어가 짧을 때(2-4글자) 주요 패턴 매칭
    if (trimmedQuery.length >= 2 && trimmedQuery.length <= 4 && /^[A-Za-z]+$/.test(trimmedQuery)) {
      // KOREAN_STOCK_MAP에서 대소문자 무시하고 매칭되는 항목 찾기
      const matchingStocks = Object.entries(KOREAN_STOCK_MAP).filter(([name, ticker]) => 
        name.toUpperCase().includes(upperQuery) || upperQuery.includes(name.toUpperCase().substring(0, Math.min(upperQuery.length, name.length)))
      );
      
      matchingStocks.forEach(([name, ticker]) => {
        const tickerWithoutKS = ticker.replace('.KS', '');
        if (!additionalQueries.includes(tickerWithoutKS)) {
          additionalQueries.push(tickerWithoutKS);
        }
      });
    }
    
    // 여러 검색어로 시도 (원래 검색어 + 티커 + 추가 검색어)
    const searchQueries = [
      trimmedQuery,
      ...(koreanStockTicker ? [koreanStockTicker.replace('.KS', '')] : []), // 티커에서 .KS 제거하여 검색
      ...additionalQueries,
    ];
    
    let allResults: StockSearchResult[] = [];
    
    // 여러 검색어로 검색 실행
    for (const searchQuery of searchQueries) {
      try {
        // Yahoo Finance 검색 API 엔드포인트
        const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(searchQuery)}`;
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
        });

        if (!response.ok) {
          console.warn(`Yahoo Finance search API error for "${searchQuery}": ${response.status}`);
          continue;
        }

        const data = await response.json();
        
        // API 응답 구조: { quotes: [{ symbol, shortname, longname, exchange, quoteType, ... }] }
        if (!data.quotes || !Array.isArray(data.quotes)) {
          continue;
        }
        
        // 디버깅: 원본 검색 결과 수 확인
        const totalQuotes = data.quotes.length;
        const koreanQuotes = data.quotes.filter((q: any) => q.symbol?.endsWith('.KS')).length;
        console.log(`Search query "${searchQuery}": ${totalQuotes} total quotes (${koreanQuotes} Korean)`);

        // 검색 결과를 StockSearchResult 형식으로 변환
        const results: StockSearchResult[] = data.quotes
          .filter((quote: any) => {
            // symbol이 있고 이름이 있는 항목만 필터링
            if (!quote.symbol || (!quote.shortname && !quote.longname)) {
              return false;
            }
            // 한국 주식(.KS)인 경우 모든 타입 허용 (더 많은 결과를 위해)
            if (quote.symbol && quote.symbol.endsWith('.KS')) {
              // 한국 주식은 타입 필터링 완화
              if (quote.quoteType && quote.quoteType === 'CURRENCY') {
                return false; // 통화만 제외
              }
              return true;
            }
            // 기타 종목은 EQUITY, ETF, INDEX 타입만 필터링 (옵션, 선물, CURRENCY 등 제외)
            if (quote.quoteType && quote.quoteType !== 'EQUITY' && quote.quoteType !== 'ETF' && quote.quoteType !== 'INDEX') {
              return false;
            }
            return true;
          })
          .map((quote: any) => {
            // 한국 주식(.KS)인 경우 한글명으로 우선 표시
            const originalName = quote.longname || quote.shortname || quote.symbol;
            let displayName = originalName;
            let savedOriginalName: string | undefined = undefined;
            
            if (quote.symbol && quote.symbol.endsWith('.KS')) {
              const koreanName = KOREAN_TICKER_TO_NAME_MAP[quote.symbol];
              if (koreanName) {
                displayName = koreanName;
                // 한글명이 있는 경우 원래 영문명 저장
                savedOriginalName = originalName;
              }
            }
            
            return {
              symbol: quote.symbol,
              name: displayName,
              originalName: savedOriginalName,
              exchange: quote.exchange,
              type: quote.type,
              quoteType: quote.quoteType,
            };
          });

        allResults = allResults.concat(results);
      } catch (error) {
        console.error(`Yahoo Finance search error for "${searchQuery}":`, error);
      }
    }

    // 중복 제거 (같은 symbol)
    const uniqueResults = allResults.filter((result: StockSearchResult, index: number, self: StockSearchResult[]) => 
      index === self.findIndex((r) => r.symbol === result.symbol)
    );

    // 한국 주식(.KS)을 우선 정렬
    const sortedResults = uniqueResults.sort((a: StockSearchResult, b: StockSearchResult) => {
      const aIsKorean = a.symbol?.endsWith('.KS') || false;
      const bIsKorean = b.symbol?.endsWith('.KS') || false;
      if (aIsKorean && !bIsKorean) return -1;
      if (!aIsKorean && bIsKorean) return 1;
      return 0;
    });

    // 최대 50개까지 반환 (더 많은 결과 제공)
    const finalResults = sortedResults.slice(0, 50);

    // 검색어가 짧을 때(2-4글자) KOREAN_STOCK_MAP에서 매칭되는 종목들 추가
    if (trimmedQuery.length >= 2 && trimmedQuery.length <= 4) {
      const matchingStocks = Object.entries(KOREAN_STOCK_MAP).filter(([name, ticker]) => 
        name.includes(trimmedQuery) || trimmedQuery.includes(name.substring(0, Math.min(trimmedQuery.length, name.length)))
      );
      
      for (const [name, ticker] of matchingStocks) {
        if (!finalResults.some(r => r.symbol === ticker)) {
          try {
            const quote = await getStockQuote(ticker);
            if (quote && quote.name) {
              const koreanName = KOREAN_TICKER_TO_NAME_MAP[ticker];
              finalResults.push({
                symbol: ticker,
                name: koreanName || quote.name,
                originalName: koreanName ? quote.name : undefined, // 한글명이 있으면 영문명 저장
                exchange: 'KRX',
                type: 'EQUITY',
                quoteType: 'EQUITY',
              });
            }
          } catch (error) {
            console.warn(`Failed to fetch stock info for ${ticker}:`, error);
          }
        }
      }
      
      // 다시 한국 주식 우선 정렬
      finalResults.sort((a: StockSearchResult, b: StockSearchResult) => {
        const aIsKorean = a.symbol?.endsWith('.KS') || false;
        const bIsKorean = b.symbol?.endsWith('.KS') || false;
        if (aIsKorean && !bIsKorean) return -1;
        if (!aIsKorean && bIsKorean) return 1;
        return 0;
      });
      // 최대 50개 유지
      if (finalResults.length > 50) {
        finalResults.splice(50);
      }
    }
    
    // 한국 주식 티커 매핑이 있는 경우, 해당 티커가 결과에 없으면 추가
    if (koreanStockTicker && !finalResults.some(r => r.symbol === koreanStockTicker)) {
      // 티커로 직접 현재가 조회하여 종목명 가져오기
      try {
        const quote = await getStockQuote(koreanStockTicker);
        if (quote && quote.name) {
          // 한글명 우선 사용
          const koreanName = KOREAN_TICKER_TO_NAME_MAP[koreanStockTicker];
          finalResults.unshift({
            symbol: koreanStockTicker,
            name: koreanName || quote.name,
            originalName: koreanName ? quote.name : undefined, // 한글명이 있으면 영문명 저장
            exchange: 'KRX',
            type: 'EQUITY',
            quoteType: 'EQUITY',
          });
          // 최대 50개 유지
          if (finalResults.length > 50) {
            finalResults.pop();
          }
        }
      } catch (error) {
        console.warn('Failed to fetch Korean stock info:', error);
      }
    }

    // 디버깅: 한국 종목 수 확인
    const koreanStocksCount = finalResults.filter(r => r.symbol?.endsWith('.KS')).length;
    console.log(`Yahoo Finance search for "${trimmedQuery}": ${finalResults.length} results (${koreanStocksCount} Korean stocks)`);

    return finalResults;
  } catch (error) {
    console.error('Yahoo Finance search API 오류:', error);
    return [];
  }
}

/**
 * 과거 주가 데이터 인터페이스
 */
export interface HistoricalPriceData {
  date: number; // Unix timestamp (초)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Yahoo Finance에서 과거 주가 데이터 조회
 * @param ticker 종목 코드 (예: 'AAPL', '005930.KS')
 * @param range 기간 ('1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max')
 * @param interval 간격 ('1d', '1wk', '1mo')
 * @returns 과거 주가 데이터 배열
 */
export async function getHistoricalData(
  ticker: string,
  range: string = '1mo',
  interval: string = '1d'
): Promise<HistoricalPriceData[]> {
  try {
    // 티커 정규화
    let normalizedTicker = ticker;
    if (!ticker.includes('.')) {
      if (/^\d{6}$/.test(ticker)) {
        normalizedTicker = `${ticker}.KS`;
      }
    }
    
    // Yahoo Finance API 엔드포인트
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${normalizedTicker}?interval=${interval}&range=${range}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      return [];
    }
    
    const result = data.chart.result[0];
    const timestamps = result.timestamp || [];
    const indicators = result.indicators || {};
    const quote = indicators.quote?.[0] || {};
    
    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const closes = quote.close || [];
    const volumes = quote.volume || [];
    
    // 데이터 배열 생성
    const historicalData: HistoricalPriceData[] = [];
    
    for (let i = 0; i < timestamps.length; i++) {
      // null 값 제외
      if (opens[i] == null || highs[i] == null || lows[i] == null || closes[i] == null) {
        continue;
      }
      
      historicalData.push({
        date: timestamps[i],
        open: opens[i],
        high: highs[i],
        low: lows[i],
        close: closes[i],
        volume: volumes[i] || 0,
      });
    }
    
    return historicalData;
  } catch (error) {
    console.error('Yahoo Finance historical data API 오류:', error);
    return [];
  }
}

/**
 * 이동평균선 계산
 * @param prices 가격 배열
 * @param period 기간 (예: 5, 20, 60)
 * @returns 이동평균 배열
 */
export function calculateMovingAverage(prices: number[], period: number): number[] {
  const movingAverages: number[] = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      movingAverages.push(NaN);
    } else {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      movingAverages.push(sum / period);
    }
  }
  
  return movingAverages;
}




