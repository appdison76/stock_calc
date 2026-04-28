/**
 * 네이버 페이 증권 모바일 API — 국내 종목 시총 등 (Yahoo 시총 실패 시 폴백).
 * 공식 문서 없음 · 앱과 동일 엔드포인트 사용. 과도한 호출 자제.
 */

function naverCapTrace(message: string, data?: Record<string, unknown>): void {
  if (data !== undefined) {
    console.warn('[NAVER_CAP]', message, data);
  } else {
    console.warn('[NAVER_CAP]', message);
  }
}

/**
 * 네이버 증권 통합 패널의 시총 문자열 → 원화 정수 (예: "1,297조 8,739억").
 */
export function parseNaverMarketCapDisplayToWon(value: string): number | null {
  const v = value.trim();
  if (!v || v === '—' || v === '-' || v === 'N/A' || v.toLowerCase() === 'n/a') {
    return null;
  }

  let won = 0;
  const joRe = /([\d,]+)\s*조/g;
  let m: RegExpExecArray | null;
  while ((m = joRe.exec(v)) !== null) {
    const n = parseFloat(m[1].replace(/,/g, ''));
    if (Number.isFinite(n)) won += n * 1e12;
  }
  const eokRe = /([\d,]+)\s*억/g;
  while ((m = eokRe.exec(v)) !== null) {
    const n = parseFloat(m[1].replace(/,/g, ''));
    if (Number.isFinite(n)) won += n * 1e8;
  }
  const manRe = /([\d,]+)\s*만/g;
  while ((m = manRe.exec(v)) !== null) {
    const n = parseFloat(m[1].replace(/,/g, ''));
    if (Number.isFinite(n)) won += n * 1e4;
  }
  const baekRe = /([\d,]+)\s*백만/;
  m = baekRe.exec(v);
  if (m != null && won === 0) {
    const n = parseFloat(m[1].replace(/,/g, ''));
    if (Number.isFinite(n)) won += n * 1e6;
  }

  if (!Number.isFinite(won) || won <= 0) return null;
  return Math.round(won);
}

interface NaverIntegrationTotalInfo {
  code?: string;
  key?: string;
  value?: string;
}

interface NaverIntegrationJson {
  totalInfos?: NaverIntegrationTotalInfo[];
}

/**
 * 6자리 국내 종목코드 — 시가총액(원)만 조회. 실패 시 `null`.
 */
export async function fetchDomesticMarketCapWonFromNaver(itemCode: string): Promise<number | null> {
  const code = itemCode.replace(/\D/g, '').padStart(6, '0');
  if (!/^\d{6}$/.test(code)) return null;

  const url = `https://m.stock.naver.com/api/stock/${code}/integration`;
  const headers: HeadersInit = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    Referer: `https://m.stock.naver.com/domestic/stock/${code}`,
  };

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      naverCapTrace('integration_http_error', { code, status: res.status });
      return null;
    }
    const data = (await res.json()) as NaverIntegrationJson;
    const infos = data.totalInfos;
    if (!Array.isArray(infos)) {
      naverCapTrace('integration_no_totalInfos', { code });
      return null;
    }
    const capEntry = infos.find((x) => x.code === 'marketValue' || x.key === '시총');
    const raw = capEntry?.value;
    if (raw == null || typeof raw !== 'string') {
      naverCapTrace('integration_no_marketValue', { code });
      return null;
    }
    const won = parseNaverMarketCapDisplayToWon(raw);
    if (won == null) {
      naverCapTrace('integration_parse_failed', { code, raw });
      return null;
    }
    naverCapTrace('integration_ok', { code, won, display: raw });
    return won;
  } catch (e: unknown) {
    naverCapTrace('integration_exception', {
      code,
      message: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}
