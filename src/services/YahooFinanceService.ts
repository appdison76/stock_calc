/**
 * Yahoo Finance API를 통한 주식 현재가 조회 서비스
 * 
 * 참고: Yahoo Finance는 공식 API가 없지만, yfinance 스타일의 엔드포인트를 사용할 수 있습니다.
 * 또는 무료 API 서비스를 활용할 수 있습니다.
 */

export interface MarketStockInfo {
  ticker: string;
  name: string;
  market: 'KOSPI' | 'KOSDAQ' | 'SP500';
  marketCap?: number;
  changePercent?: number;
  volume?: number;
}

import {
  KOREAN_STOCK_MAP,
  KOREAN_TICKER_TO_NAME_MAP,
} from '../data/korean_stocks_maps';
import {
  US_STOCK_MAP,
  US_TICKER_TO_NAME_MAP,
} from '../data/us_stocks_maps';

export interface StockQuote {
  symbol: string;
  price: number;
  currency: string;
  name?: string;
  change?: number;
  changePercent?: number;
  marketCap?: number; // 시가총액
}

/** DB에 `5930`처럼 저장된 경우 Yahoo·Map 키와 맞추기 */
export function normalizeYahooTickerKey(ticker: string): string {
  const t = ticker.trim();
  if (!t.includes('.') && /^\d{1,6}$/.test(t)) {
    return t.padStart(6, '0');
  }
  return t;
}

const YAHOO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Yahoo web API는 Referer/Origin 없으면 quoteSummary가 401·빈 result로 떨어지는 경우가 있음(특히 RN/모바일). */
function yahooRequestHeaders(symbol: string): HeadersInit {
  return {
    'User-Agent': YAHOO_UA,
    Accept: 'application/json,text/plain,*/*',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    Referer: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/`,
    Origin: 'https://finance.yahoo.com',
  };
}

/** v10 응답이 `quoteSummary` 또는 `finance` 키로 올 수 있음(에러·레거시). */
export function extractYahooQuoteSummaryResult0(data: unknown): Record<string, unknown> | undefined {
  if (data == null || typeof data !== 'object') return undefined;
  const d = data as {
    quoteSummary?: { result?: unknown[] };
    finance?: { result?: unknown[] };
  };
  const r0 = d.quoteSummary?.result?.[0] ?? d.finance?.result?.[0];
  if (r0 != null && typeof r0 === 'object') return r0 as Record<string, unknown>;
  return undefined;
}

export const YAHOO_QUERY_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'] as const;

const YAHOO_CRUMB_TTL_MS = 3 * 60 * 1000;

type YahooCrumbCache = { crumb: string; cookie: string; expiresAt: number };
let yahooCrumbCache: YahooCrumbCache | null = null;

/** 병렬 getStockQuote 여러 개가 동시에 crumb을 요청할 때 fc.yahoo·getcrumb이 N배로 나가는 것 방지 */
let yahooCrumbSessionInFlight: Promise<{ crumb: string; cookie: string } | null> | null = null;

export function invalidateYahooCrumbSession(): void {
  yahooCrumbCache = null;
  yahooCrumbSessionInFlight = null;
}

/** fc.yahoo.com 응답에서 Set-Cookie → `Cookie` 헤더 문자열 */
function cookieHeaderFromPrimeResponse(res: Response): string {
  const rawHeaders = res.headers as unknown as { getSetCookie?: () => string[] };
  if (typeof rawHeaders.getSetCookie === 'function') {
    const parts = rawHeaders.getSetCookie().map((line) => line.split(';')[0]?.trim()).filter(Boolean);
    return parts.join('; ');
  }
  const sc = res.headers.get('set-cookie');
  if (!sc) return '';
  return sc
    .split(/,(?=\s*[A-Za-z0-9_.]+=)/)
    .map((chunk) => chunk.split(';')[0]?.trim())
    .filter(Boolean)
    .join('; ');
}

/**
 * quoteSummary 401 방지 — Yahoo 비공식 API가 crumb·세션 쿠키를 요구하는 경우가 많음(RN·모바일).
 * @see https://query1.finance.yahoo.com/v1/test/getcrumb
 */
export async function yahooGetCrumbSession(symbolForReferer: string): Promise<{
  crumb: string;
  cookie: string;
} | null> {
  if (yahooCrumbCache && Date.now() < yahooCrumbCache.expiresAt) {
    return { crumb: yahooCrumbCache.crumb, cookie: yahooCrumbCache.cookie };
  }
  if (yahooCrumbSessionInFlight) {
    return yahooCrumbSessionInFlight;
  }

  yahooCrumbSessionInFlight = (async (): Promise<{ crumb: string; cookie: string } | null> => {
    try {
      const prime = await fetch('https://fc.yahoo.com/', {
        method: 'GET',
        headers: {
          'User-Agent': YAHOO_UA,
          Accept: '*/*',
          Referer: 'https://finance.yahoo.com/',
        },
      });
      const cookie = cookieHeaderFromPrimeResponse(prime);

      const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
        headers: {
          'User-Agent': YAHOO_UA,
          Accept: 'text/plain,*/*',
          Referer: `https://finance.yahoo.com/quote/${encodeURIComponent(symbolForReferer)}/`,
          ...(cookie ? { Cookie: cookie } : {}),
        },
      });
      if (!crumbRes.ok) {
        return null;
      }
      const crumb = (await crumbRes.text()).trim();
      if (!crumb || crumb.includes('<') || crumb.toLowerCase().includes('invalid')) {
        return null;
      }

      yahooCrumbCache = {
        crumb,
        cookie,
        expiresAt: Date.now() + YAHOO_CRUMB_TTL_MS,
      };
      return { crumb, cookie };
    } catch {
      return null;
    } finally {
      yahooCrumbSessionInFlight = null;
    }
  })();

  return yahooCrumbSessionInFlight;
}

/** `/path?a=1` → crumb 쿼리 추가 */
export function appendYahooCrumbQuery(pathWithLeadingSlashAndQuery: string, crumb: string | null): string {
  if (!crumb) return pathWithLeadingSlashAndQuery;
  if (pathWithLeadingSlashAndQuery.includes('crumb=')) return pathWithLeadingSlashAndQuery;
  const sep = pathWithLeadingSlashAndQuery.includes('?') ? '&' : '?';
  return `${pathWithLeadingSlashAndQuery}${sep}crumb=${encodeURIComponent(crumb)}`;
}

export function yahooRequestHeadersWithCookie(symbol: string, cookie: string | undefined): Record<string, string> {
  const h = { ...(yahooRequestHeaders(symbol) as Record<string, string>) };
  if (cookie) h.Cookie = cookie;
  return h;
}

/** Metro·adb: `[YAHOO_QUOTE]` — 시총·chart 실패 원인 (필터용) */
function yahooQuoteTrace(message: string, data?: Record<string, unknown>): void {
  if (data !== undefined) {
    console.warn('[YAHOO_QUOTE]', message, data);
  } else {
    console.warn('[YAHOO_QUOTE]', message);
  }
}

function mergeKoreanKsKqQuotes(
  ks: StockQuote | null,
  kq: StockQuote | null
): StockQuote | null {
  if (!ks && !kq) return null;
  if (!ks) return kq;
  if (!kq) return ks;
  const ksCap = ks.marketCap != null && Number.isFinite(ks.marketCap) && ks.marketCap > 0;
  const kqCap = kq.marketCap != null && Number.isFinite(kq.marketCap) && kq.marketCap > 0;
  if (ksCap && !kqCap) return ks;
  if (!ksCap && kqCap) return kq;
  return ks;
}

/** Yahoo nested `{ raw, fmt }` 또는 단일 숫자 필드 */
function readYahooNumericField(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  if (typeof v === 'object' && v !== null && 'raw' in v) {
    const r = (v as { raw?: unknown }).raw;
    if (typeof r === 'number' && Number.isFinite(r) && r > 0) return r;
  }
  return undefined;
}

/** quoteSummary에서 발행주식수 후보를 넓게 수집 (한국 .KS/.KQ에서 시총 필드만 비는 경우가 많음) */
function shareCountFromQuoteSummary(r0: Record<string, unknown> | undefined): number | undefined {
  if (r0 == null) return undefined;
  const dks = r0.defaultKeyStatistics as Record<string, unknown> | undefined;
  const sd = r0.summaryDetail as Record<string, unknown> | undefined;
  const candidates: unknown[] = [
    dks?.sharesOutstanding,
    dks?.floatShares,
    dks?.impliedSharesOutstanding,
    sd?.sharesOutstanding,
  ];
  for (const c of candidates) {
    const n = readYahooNumericField(c);
    if (n != null) return n;
  }
  return undefined;
}

/** Yahoo가 marketCap 필드를 안 줄 때: 보통주 총수 × 현재가 (원화 종목에서 자주 필요) */
function marketCapFromSharesAndPrice(
  r0: Record<string, unknown> | undefined,
  price: number
): number | undefined {
  if (r0 == null || !Number.isFinite(price) || price <= 0) return undefined;
  const rawShares = shareCountFromQuoteSummary(r0);
  if (rawShares == null || !Number.isFinite(rawShares) || rawShares <= 0) return undefined;
  const cap = rawShares * price;
  return Number.isFinite(cap) && cap > 0 ? cap : undefined;
}

/** chart meta에 주식수가 있으면 시총 추정 (summary보다 먼저 시도) */
function marketCapFromChartMetaShares(meta: Record<string, unknown>, price: number): number | undefined {
  if (!Number.isFinite(price) || price <= 0) return undefined;
  for (const k of ['sharesOutstanding', 'regularMarketSharesOutstanding', 'impliedSharesOutstanding'] as const) {
    const v = meta[k];
    const n = typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : readYahooNumericField(v);
    if (n != null) {
      const cap = n * price;
      if (Number.isFinite(cap) && cap > 0) return cap;
    }
  }
  return undefined;
}

/**
 * 이미 `.KS` / `.KQ` / 미국 티커 등 Yahoo 심볼로 정규화된 한 종목 조회
 */
async function fetchYahooQuoteForNormalizedSymbol(normalizedTicker: string): Promise<StockQuote | null> {
  try {
    type ChartResultRow = { meta?: Record<string, unknown> };
    let result: ChartResultRow | undefined;
    let chartJson: { chart?: { result?: unknown[]; error?: unknown } } = {};
    for (const host of YAHOO_QUERY_HOSTS) {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(
        normalizedTicker
      )}?interval=1d&range=1d`;
      const response = await fetch(url, { headers: yahooRequestHeaders(normalizedTicker) });
      if (!response.ok) {
        yahooQuoteTrace('chart_http_error', {
          symbol: normalizedTicker,
          host,
          status: response.status,
          statusText: response.statusText,
        });
        continue;
      }
      chartJson = await response.json();
      if (chartJson.chart?.result && chartJson.chart.result.length > 0) {
        result = chartJson.chart.result[0] as ChartResultRow;
        break;
      }
      const chErr = chartJson.chart?.error as { description?: string } | undefined;
      yahooQuoteTrace('chart_empty_result', {
        symbol: normalizedTicker,
        host,
        chartError: chErr?.description ?? chartJson.chart?.error,
      });
    }

    if (!result) {
      yahooQuoteTrace('chart_empty_all_hosts', { symbol: normalizedTicker });
      return null;
    }
    if (result.meta == null || typeof result.meta !== 'object') {
      yahooQuoteTrace('chart_no_price_meta', { symbol: normalizedTicker, hasMeta: false });
      return null;
    }
    const meta = result.meta as Record<string, unknown> & {
      regularMarketPrice?: number;
      shortName?: string;
      longName?: string;
      symbol?: string;
      currency?: string;
    };

    const currentPrice =
      typeof meta.regularMarketPrice === 'number' && Number.isFinite(meta.regularMarketPrice)
        ? meta.regularMarketPrice
        : null;
    if (currentPrice == null) {
      yahooQuoteTrace('chart_no_price_meta', { symbol: normalizedTicker, hasMeta: true });
      return null;
    }

    const previousClose = meta.previousClose || meta.regularMarketPreviousClose || meta.chartPreviousClose;
    const prevN =
      typeof previousClose === 'number' && Number.isFinite(previousClose) ? previousClose : undefined;
    const change = prevN != null ? currentPrice - prevN : undefined;
    const changePercent = prevN != null ? ((currentPrice - prevN) / prevN) * 100 : undefined;

    let finalMarketCap =
      readYahooNumericField(meta.marketCap) ??
      readYahooNumericField(meta.regularMarketMarketCap) ??
      readYahooNumericField(meta.marketCapRaw);

    let chartMetaSharesUsed = false;
    if (finalMarketCap == null) {
      const fromChart = marketCapFromChartMetaShares(meta, currentPrice);
      if (fromChart != null) {
        finalMarketCap = fromChart;
        chartMetaSharesUsed = true;
      }
    }

    let summaryHttpStatus: number | null = null;
    let summaryGotCap = false;
    let sharesEstimateUsed = chartMetaSharesUsed;

    const needSummary =
      finalMarketCap == null || !Number.isFinite(finalMarketCap) || finalMarketCap <= 0;

    if (needSummary) {
      const summaryPathBase = `/v10/finance/quoteSummary/${encodeURIComponent(
        normalizedTicker
      )}?modules=summaryDetail,defaultKeyStatistics,price`;

      const runSummaryOnHost = async (host: string, session: { crumb: string; cookie: string } | null) => {
        const pathQ = appendYahooCrumbQuery(summaryPathBase, session?.crumb ?? null);
        const summaryUrl = `https://${host}${pathQ}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const summaryResponse = await fetch(summaryUrl, {
          headers: yahooRequestHeadersWithCookie(normalizedTicker, session?.cookie),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return summaryResponse;
      };

      for (const host of YAHOO_QUERY_HOSTS) {
        if (finalMarketCap != null && Number.isFinite(finalMarketCap) && finalMarketCap > 0) break;
        let session = await yahooGetCrumbSession(normalizedTicker);
        try {
          let summaryResponse = await runSummaryOnHost(host, session);
          summaryHttpStatus = summaryResponse.status;

          if (summaryResponse.status === 401) {
            invalidateYahooCrumbSession();
            session = await yahooGetCrumbSession(normalizedTicker);
            yahooQuoteTrace('summary_401_retry_crumb', { symbol: normalizedTicker, host, retried: true });
            summaryResponse = await runSummaryOnHost(host, session);
            summaryHttpStatus = summaryResponse.status;
          }

          if (summaryResponse.ok) {
            const summaryData = await summaryResponse.json();
            const r0 = extractYahooQuoteSummaryResult0(summaryData);
            if (!r0) {
              yahooQuoteTrace('summary_empty_result', { symbol: normalizedTicker, host });
              continue;
            }
            const fromSummary =
              readYahooNumericField((r0.summaryDetail as { marketCap?: unknown } | undefined)?.marketCap) ??
              readYahooNumericField(
                (r0.defaultKeyStatistics as { marketCap?: unknown } | undefined)?.marketCap
              );
            if (fromSummary != null) {
              finalMarketCap = fromSummary;
              summaryGotCap = true;
              break;
            }
            const est = marketCapFromSharesAndPrice(r0, currentPrice);
            if (est != null) {
              finalMarketCap = est;
              sharesEstimateUsed = true;
              break;
            }
          } else {
            yahooQuoteTrace('summary_http_error', {
              symbol: normalizedTicker,
              host,
              status: summaryResponse.status,
              statusText: summaryResponse.statusText,
            });
          }
        } catch (e: unknown) {
          const aborted = e instanceof Error && e.name === 'AbortError';
          yahooQuoteTrace('summary_fetch_failed', {
            symbol: normalizedTicker,
            aborted,
            host,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    const resolvedCap =
      finalMarketCap != null && Number.isFinite(finalMarketCap) && finalMarketCap > 0
        ? finalMarketCap
        : undefined;

    if (resolvedCap == null) {
      yahooQuoteTrace('no_market_cap_after_chart_summary', {
        symbol: normalizedTicker,
        price: currentPrice,
        currency: meta.currency,
        chartMetaHadCap: !!(
          readYahooNumericField(meta.marketCap) ??
          readYahooNumericField(meta.regularMarketMarketCap) ??
          readYahooNumericField(meta.marketCapRaw)
        ),
        summaryHttpStatus,
        summaryGotCap,
        sharesEstimateUsed,
      });
    }

    return {
      symbol: (meta.symbol as string | undefined) || normalizedTicker,
      price: currentPrice,
      currency: (meta.currency as string | undefined) || 'KRW',
      name: meta.shortName || meta.longName,
      change: change,
      changePercent: changePercent,
      marketCap: resolvedCap,
    };
  } catch (e: unknown) {
    yahooQuoteTrace('chart_fetch_exception', {
      symbol: normalizedTicker,
      message: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

/**
 * Yahoo Finance에서 주식 현재가 조회
 * @param ticker 종목 코드 (예: 'AAPL', '005930.KS' - 한국 주식은 .KS/.KQ 접미사)
 * @returns 주식 현재가 정보
 */
export async function getStockQuote(ticker: string): Promise<StockQuote | null> {
  const raw = normalizeYahooTickerKey(ticker);
  try {
    // 6자리·접미사 없음 → 코스피(.KS)·코스닥(.KQ) 병렬 조회 후 유효한 쪽 사용 (시총 우선)
    if (!raw.includes('.') && /^\d{6}$/.test(raw)) {
      const [ks, kq] = await Promise.all([
        fetchYahooQuoteForNormalizedSymbol(`${raw}.KS`),
        fetchYahooQuoteForNormalizedSymbol(`${raw}.KQ`),
      ]);
      const merged = mergeKoreanKsKqQuotes(ks, kq);
      if (merged && (merged.marketCap == null || !Number.isFinite(merged.marketCap))) {
        yahooQuoteTrace('kr6_merge_no_mcap', {
          pad6: raw,
          ksQuote: ks != null,
          kqQuote: kq != null,
          ksMcap: ks?.marketCap,
          kqMcap: kq?.marketCap,
          mergedPrice: merged.price,
          currency: merged.currency,
        });
      }
      return merged;
    }

    const single = await fetchYahooQuoteForNormalizedSymbol(raw);
    if (single && (single.marketCap == null || !Number.isFinite(single.marketCap))) {
      yahooQuoteTrace('single_quote_no_mcap', { raw, symbol: single.symbol, price: single.price });
    }
    return single;
  } catch (e: unknown) {
    yahooQuoteTrace('getStockQuote_exception', {
      ticker,
      message: e instanceof Error ? e.message : String(e),
    });
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
    results.set(normalizeYahooTickerKey(ticker), quote);
  });
  
  await Promise.all(promises);
  
  return results;
}

/**
 * 여러 종목의 현재가를 배치 처리로 조회 (API 제한 방지)
 * @param tickers 종목 티커 배열
 * @param batchSize 배치 크기 (기본값: 10)
 * @param delay 배치 간 지연 시간(ms) (기본값: 200)
 * @returns 종목별 현재가 맵
 */
export async function getMultipleStockQuotesBatch(
  tickers: string[],
  batchSize: number = 10,
  delay: number = 200
): Promise<Map<string, StockQuote | null>> {
  const results = new Map<string, StockQuote | null>();
  
  // 배치로 나눠서 처리
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    
    // 배치 내에서는 병렬 처리
    const batchPromises = batch.map(async (ticker) => {
      try {
        const quote = await getStockQuote(ticker);
        results.set(normalizeYahooTickerKey(ticker), quote);
      } catch (error) {
        console.warn(`종목 ${ticker} 조회 실패:`, error);
        results.set(normalizeYahooTickerKey(ticker), null);
      }
    });
    
    await Promise.all(batchPromises);
    
    // 마지막 배치가 아니면 지연 시간 대기 (API 제한 방지)
    if (i + batchSize < tickers.length) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
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
 * @param marketFilter 시장 필터 ('all' | 'kr' | 'us')
 * @returns 검색 결과 배열
 */
export async function searchStocks(query: string, marketFilter: 'all' | 'kr' | 'us' = 'all'): Promise<StockSearchResult[]> {
  try {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const trimmedQuery = query.trim();
    
    // 한국 주식 한글명으로 검색한 경우, 티커로 변환하여 추가 검색
    const koreanStockTicker = marketFilter !== 'us' ? KOREAN_STOCK_MAP[trimmedQuery] : undefined;
    
    // 미국 주식 한글명으로 검색한 경우, 티커로 변환하여 추가 검색
    const usStockTicker = marketFilter !== 'kr' ? US_STOCK_MAP[trimmedQuery] : undefined;
    
    // 검색어가 짧을 때(2-4글자) KOREAN_STOCK_MAP에서 매칭되는 종목들의 티커로도 검색
    let additionalQueries: string[] = [];
    const upperQuery = trimmedQuery.toUpperCase();
    
    // 한국 주식 필터가 아닐 때만 한국 주식 매칭 로직 실행
    if (marketFilter !== 'kr') {
      // 검색어가 2-4글자이고 한국어인 경우, KOREAN_STOCK_MAP에서 검색어를 포함하는 항목 찾기
      // 단, 영문 티커 패턴이면 스킵 (예: "NVDA", "MSFT")
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
    }
    
    // 영문 검색어가 짧을 때(2-4글자) 주요 패턴 매칭
    // 단, 영문 티커 패턴이면 한국 주식 매칭 스킵 (예: "NVDA", "MSFT")
    if (marketFilter !== 'kr' && trimmedQuery.length >= 2 && trimmedQuery.length <= 4 && /^[A-Za-z]+$/.test(trimmedQuery)) {
      // 영문 티커 패턴인지 확인 (2-5자, 대문자)
      const isTickerPattern = /^[A-Z]{2,5}$/.test(trimmedQuery.toUpperCase());
      
      // 티커 패턴이 아니거나, 티커 패턴이지만 US_STOCK_MAP에 없는 경우에만 한국 주식 매칭
      if (!isTickerPattern || (isTickerPattern && !US_STOCK_MAP[trimmedQuery.toUpperCase()])) {
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
    }
    
    // 여러 검색어로 시도 (원래 검색어 + 한국 티커 + 미국 티커 + 추가 검색어)
    // 필터에 따라 검색어 선택
    const searchQueries: string[] = [trimmedQuery];
    
    if (marketFilter !== 'us' && koreanStockTicker) {
      searchQueries.push(koreanStockTicker.replace('.KS', ''));
    }
    
    if (marketFilter !== 'kr' && usStockTicker) {
      searchQueries.push(usStockTicker);
    }
    
    if (marketFilter !== 'kr') {
      searchQueries.push(...additionalQueries);
    }
    
    let allResults: StockSearchResult[] = [];
    
    // 여러 검색어로 검색 실행 (병렬 처리로 속도 개선)
    // rate limit을 고려하여 최대 5개씩 병렬 처리
    const BATCH_SIZE = 5;
    for (let i = 0; i < searchQueries.length; i += BATCH_SIZE) {
      const batch = searchQueries.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (searchQuery) => {
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
            return [];
          }

          const data = await response.json();
          
          // API 응답 구조: { quotes: [{ symbol, shortname, longname, exchange, quoteType, ... }] }
          if (!data.quotes || !Array.isArray(data.quotes)) {
            return [];
          }
          
          // 한국 주식 판별 헬퍼 함수
          const isKoreanStock = (symbol: string | undefined): boolean => {
            if (!symbol) return false;
            return symbol.endsWith('.KS') || symbol.endsWith('.KQ');
          };

          // 디버깅: 원본 검색 결과 수 확인
          const totalQuotes = data.quotes.length;
          const koreanQuotes = data.quotes.filter((q: any) => isKoreanStock(q.symbol)).length;
          console.log(`Search query "${searchQuery}": ${totalQuotes} total quotes (${koreanQuotes} Korean)`);

          // 검색 결과를 StockSearchResult 형식으로 변환
          const results: StockSearchResult[] = data.quotes
            .filter((quote: any) => {
              // symbol이 있고 이름이 있는 항목만 필터링
              if (!quote.symbol || (!quote.shortname && !quote.longname)) {
                return false;
              }
              // 한국 주식(.KS 또는 .KQ)인 경우 모든 타입 허용 (더 많은 결과를 위해)
              if (isKoreanStock(quote.symbol)) {
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
              // 한국 주식 판별 헬퍼 함수
              const isKR = isKoreanStock(quote.symbol);
              
              // 한국 주식(.KS 또는 .KQ)인 경우 한글명으로 우선 표시
              const originalName = quote.longname || quote.shortname || quote.symbol;
              let displayName = originalName;
              let savedOriginalName: string | undefined = undefined;
              
              if (isKR) {
                const koreanName = KOREAN_TICKER_TO_NAME_MAP[quote.symbol];
                if (koreanName) {
                  displayName = koreanName;
                  // 한글명이 있는 경우 원래 영문명 저장
                  savedOriginalName = originalName;
                }
              }
              // 미국 주식인 경우 (티커에 점이 없거나 주요 거래소인 경우)
              else if (quote.symbol && !quote.symbol.includes('.') && quote.exchange && ['NASDAQ', 'NYSE', 'NMS', 'NYQ'].includes(quote.exchange)) {
                const usKoreanName = US_TICKER_TO_NAME_MAP[quote.symbol];
                if (usKoreanName) {
                  displayName = usKoreanName;
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

          return results;
        } catch (error) {
          console.error(`Yahoo Finance search error for "${searchQuery}":`, error);
          return [];
        }
      });
      
      // 배치 단위로 병렬 처리
      const batchResults = await Promise.all(batchPromises);
      allResults = allResults.concat(batchResults.flat());
    }

    // 중복 제거 (같은 symbol)
    const uniqueResults = allResults.filter((result: StockSearchResult, index: number, self: StockSearchResult[]) => 
      index === self.findIndex((r) => r.symbol === result.symbol)
    );

    // 한국 주식 판별 헬퍼 함수
    const isKoreanStock = (symbol: string | undefined): boolean => {
      if (!symbol) return false;
      return symbol.endsWith('.KS') || symbol.endsWith('.KQ');
    };

    // 필터에 따른 정렬
    const sortedResults = uniqueResults.sort((a: StockSearchResult, b: StockSearchResult) => {
      // 필터가 'all'이 아닌 경우 필터에 맞는 결과를 우선 정렬
      if (marketFilter === 'kr') {
        const aIsKorean = isKoreanStock(a.symbol);
        const bIsKorean = isKoreanStock(b.symbol);
        if (aIsKorean && !bIsKorean) return -1;
        if (!aIsKorean && bIsKorean) return 1;
      } else if (marketFilter === 'us') {
        // 검색어·한국 매핑·미국 별칭 티커와 정확히 일치하는 항목 우선(전체 탭과 동일)
        const aIsExactMatch =
          a.symbol === trimmedQuery ||
          a.symbol === koreanStockTicker ||
          a.symbol === usStockTicker;
        const bIsExactMatch =
          b.symbol === trimmedQuery ||
          b.symbol === koreanStockTicker ||
          b.symbol === usStockTicker;
        if (aIsExactMatch && !bIsExactMatch) return -1;
        if (!aIsExactMatch && bIsExactMatch) return 1;
        const aIsKorean = isKoreanStock(a.symbol);
        const bIsKorean = isKoreanStock(b.symbol);
        if (!aIsKorean && bIsKorean) return -1;
        if (aIsKorean && !bIsKorean) return 1;
      } else {
        // 'all'인 경우: 검색어와 정확히 일치하는 티커 우선, 그 다음 한국 주식 우선
        const aIsExactMatch = a.symbol === trimmedQuery || a.symbol === koreanStockTicker || a.symbol === usStockTicker;
        const bIsExactMatch = b.symbol === trimmedQuery || b.symbol === koreanStockTicker || b.symbol === usStockTicker;
        if (aIsExactMatch && !bIsExactMatch) return -1;
        if (!aIsExactMatch && bIsExactMatch) return 1;
        
        // 정확히 일치하지 않는 경우 한국 주식 우선 (기존 동작 유지)
        const aIsKorean = isKoreanStock(a.symbol);
        const bIsKorean = isKoreanStock(b.symbol);
        if (aIsKorean && !bIsKorean) return -1;
        if (!aIsKorean && bIsKorean) return 1;
      }
      return 0;
    });

    // 최대 50개까지 반환 (더 많은 결과 제공)
    const finalResults = sortedResults.slice(0, 50);

    // 검색어가 짧을 때(2-4글자) KOREAN_STOCK_MAP에서 매칭되는 종목들 추가
    // 단, 미국 주식 필터일 때는 스킵
    if (marketFilter !== 'us' && trimmedQuery.length >= 2 && trimmedQuery.length <= 4) {
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
      
      // 필터에 따른 정렬 (이 블록은 marketFilter가 us가 아닐 때만 실행됨)
      finalResults.sort((a: StockSearchResult, b: StockSearchResult) => {
        const aIsKorean = isKoreanStock(a.symbol);
        const bIsKorean = isKoreanStock(b.symbol);

        if (marketFilter === 'kr') {
          if (aIsKorean && !bIsKorean) return -1;
          if (!aIsKorean && bIsKorean) return 1;
        } else {
          // 'all'인 경우 한국 주식 우선
          if (aIsKorean && !bIsKorean) return -1;
          if (!aIsKorean && bIsKorean) return 1;
        }
        return 0;
      });
      // 최대 50개 유지
      if (finalResults.length > 50) {
        finalResults.splice(50);
      }
    }
    
    // 한국 주식 티커 매핑이 있는 경우, 해당 티커가 결과에 없으면 추가
    // 단, 미국 주식 필터일 때는 스킵
    if (marketFilter !== 'us' && koreanStockTicker && !finalResults.some(r => r.symbol === koreanStockTicker)) {
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
    const koreanStocksCount = finalResults.filter(r => isKoreanStock(r.symbol)).length;
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

/**
 * 인덱스 구성 종목을 가져오기 (Yahoo Finance API 사용)
 * 여러 엔드포인트를 시도하여 마스터 리스트를 동적으로 가져옵니다.
 * @param market 시장 ('KOSPI' | 'KOSDAQ' | 'SP500')
 * @param limit 상위 N개 (기본값: 50)
 * @returns 종목 정보 배열 (ticker, name만 포함)
 */
export async function getIndexStocksMaster(
  market: 'KOSPI' | 'KOSDAQ' | 'SP500',
  limit: number = 50
): Promise<{ ticker: string; name: string }[]> {
  try {
    // 인덱스 티커 매핑
    const indexTickerMap: Record<string, string> = {
      'KOSPI': '^KS11',
      'KOSDAQ': '^KQ11',
      'SP500': '^GSPC',
    };

    const indexTicker = indexTickerMap[market];
    if (!indexTicker) {
      console.warn(`Unknown market: ${market}`);
      return [];
    }

    // 방법 1: Yahoo Finance Holdings API 시도 (인덱스 구성 종목)
    try {
      const holdingsUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${indexTicker}?modules=topHoldings`;
      const holdingsResponse = await fetch(holdingsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (holdingsResponse.ok) {
        const holdingsData = await holdingsResponse.json();
        const holdings = holdingsData.quoteSummary?.result?.[0]?.topHoldings?.holdings || [];
        
        if (holdings.length > 0) {
          const stocks = holdings
            .slice(0, limit)
            .map((holding: any) => ({
              ticker: holding.symbol || '',
              name: holding.name || holding.longName || '',
            }))
            .filter((stock: { ticker: string; name: string }) => stock.ticker && stock.name);
          
          if (stocks.length > 0) {
            console.log(`[getIndexStocksMaster] ${market}: Holdings API로 ${stocks.length}개 종목 조회 성공`);
            return stocks;
          }
        }
      }
    } catch (error) {
      console.warn(`[getIndexStocksMaster] ${market}: Holdings API 실패, 다른 방법 시도:`, error);
    }

    // 방법 2: Yahoo Finance Screener API 시도
    try {
      const screenerUrl = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=true&lang=en-US&region=US&scrIds=${indexTicker}&count=${limit * 2}&start=0`;
      const screenerResponse = await fetch(screenerUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (screenerResponse.ok) {
        const screenerData = await screenerResponse.json();
        const quotes = screenerData.finance?.result?.[0]?.quotes || [];
        
        if (quotes.length > 0) {
          const stocks = quotes
            .slice(0, limit)
            .map((quote: any) => ({
              ticker: quote.symbol || '',
              name: quote.shortName || quote.longName || '',
            }))
            .filter((stock: { ticker: string; name: string }) => stock.ticker && stock.name);
          
          if (stocks.length > 0) {
            console.log(`[getIndexStocksMaster] ${market}: Screener API로 ${stocks.length}개 종목 조회 성공`);
            return stocks;
          }
        }
      }
    } catch (error) {
      console.warn(`[getIndexStocksMaster] ${market}: Screener API 실패:`, error);
    }

    // 방법 3: Yahoo Finance Components API 시도 (S&P500의 경우)
    if (market === 'SP500') {
      try {
        const componentsUrl = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=true&lang=en-US&region=US&scrIds=sp500&count=${limit * 2}&start=0`;
        const componentsResponse = await fetch(componentsUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (componentsResponse.ok) {
          const componentsData = await componentsResponse.json();
          const quotes = componentsData.finance?.result?.[0]?.quotes || [];
          
          if (quotes.length > 0) {
            const stocks = quotes
              .slice(0, limit)
              .map((quote: any) => ({
                ticker: quote.symbol || '',
                name: quote.shortName || quote.longName || '',
              }))
              .filter((stock: { ticker: string; name: string }) => stock.ticker && stock.name);
            
            if (stocks.length > 0) {
              console.log(`[getIndexStocksMaster] ${market}: Components API로 ${stocks.length}개 종목 조회 성공`);
              return stocks;
            }
          }
        }
      } catch (error) {
        console.warn(`[getIndexStocksMaster] ${market}: Components API 실패:`, error);
      }
    }

    console.warn(`[getIndexStocksMaster] ${market}: 모든 API 시도 실패, 빈 배열 반환`);
    return [];
  } catch (error) {
    console.error(`[getIndexStocksMaster] ${market}: 오류 발생:`, error);
    return [];
  }
}




