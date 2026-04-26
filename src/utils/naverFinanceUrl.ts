/**
 * 네이버 금융(국내) / 네이버증권 모바일(해외) 웹 URL 생성.
 * 해외: https://m.stock.naver.com/worldstock/stock/{BASE}.{N|O}/total
 * (.N = NYSE, .O = 나스닥 — 거래소 메타가 없을 때 휴리스틱)
 */

const NYSE_BASE_SYMBOLS = new Set(
  [
    'JPM',
    'BAC',
    'WFC',
    'C',
    'GS',
    'MS',
    'XOM',
    'CVX',
    'COP',
    'DIS',
    'KO',
    'WMT',
    'MCD',
    'V',
    'MA',
    'UNH',
    'PFE',
    'JNJ',
    'MRK',
    'ABBV',
    'CAT',
    'BA',
    'LMT',
    'GE',
    'T',
    'VZ',
    'HD',
    'LOW',
    'AXP',
    'BLK',
    'SPGI',
    'IBM',
    'DOW',
    'CVS',
    'PM',
    'BRK.A',
    'BRK.B',
    'BABA',
    'SO',
    'DUK',
    'NEE',
    'MET',
    'CL',
    'MMM',
    'NKE',
    'TGT',
    'USB',
    'PNC',
    'SCHW',
    'TFC',
    'BK',
    'STT',
  ].map((s) => s.toUpperCase())
);

/** 국내 6자리 종목코드(코스피/코스닥)면 true */
export function isDomesticNaverItemCode(ticker: string): boolean {
  const code = ticker.trim().replace(/\.(KS|KQ)$/i, '');
  return /^\d{6}$/.test(code);
}

/** 네이버 해외종목 경로용 심볼 (예: NVDA.O, JPM.N) */
export function naverWorldStockSymbol(ticker: string): string {
  let t = ticker.trim().replace(/\.(KS|KQ)$/i, '');
  t = t.toUpperCase();
  if (/\.(N|O)$/.test(t)) {
    return t;
  }
  const base = t.replace(/\.(US|NASDAQ|NYSE)$/i, '');
  const suffix = NYSE_BASE_SYMBOLS.has(base) ? 'N' : 'O';
  return `${base}.${suffix}`;
}

/** 국내: finance.naver.com 6자리 code. 해외: m.stock.naver.com worldstock */
export function buildNaverFinanceWebUrl(ticker: string): string {
  const code = ticker.trim().replace(/\.(KS|KQ)$/i, '');
  if (/^\d{6}$/.test(code)) {
    return `https://finance.naver.com/item/main.naver?code=${code}`;
  }
  const sym = naverWorldStockSymbol(ticker);
  return `https://m.stock.naver.com/worldstock/stock/${encodeURIComponent(sym)}/total`;
}

/** 메인 추천 바로가기 등 — URL이 네이버 금융·증권 웹인지 (아이콘 배지용) */
export function isNaverFinanceShortcutUrl(url: string): boolean {
  const raw = url.trim();
  if (!raw) return false;
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    if (host === 'finance.naver.com' || host === 'm.stock.naver.com' || host === 'stock.naver.com') {
      return true;
    }
    if (host.endsWith('.stock.naver.com')) {
      return true;
    }
    return false;
  } catch {
    const t = raw.toLowerCase();
    return (
      t.includes('finance.naver.com') ||
      t.includes('m.stock.naver.com') ||
      t.includes('stock.naver.com')
    );
  }
}
