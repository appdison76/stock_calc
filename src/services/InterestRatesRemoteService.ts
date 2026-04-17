// GitHub Pages 원격 설정 베이스. 앱 재배포 없이 갱신 가능.
const INTEREST_RATES_URL =
  'https://appdison76.github.io/stock_calc/interest-rates.json';

/** 원격 JSON 파싱 성공 시 (메인 화면 표시용) */
export interface InterestRatesRemoteResult {
  /** 미국: 범위 문자열 등 (예: "3.50~3.75") */
  us: string;
  kr: number;
  jp: number;
}

function parseRemotePayload(data: unknown): InterestRatesRemoteResult | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;

  const usRaw = o.us;
  let us: string;
  if (typeof usRaw === 'string') {
    us = usRaw.trim();
  } else if (typeof usRaw === 'number' && Number.isFinite(usRaw)) {
    us = String(usRaw);
  } else {
    return null;
  }
  if (!us) return null;

  const krRaw = o.kr;
  const kr =
    typeof krRaw === 'number'
      ? krRaw
      : typeof krRaw === 'string'
        ? parseFloat(krRaw)
        : NaN;
  if (!Number.isFinite(kr)) return null;

  const jpRaw = o.jp;
  const jp =
    typeof jpRaw === 'number'
      ? jpRaw
      : typeof jpRaw === 'string'
        ? parseFloat(jpRaw)
        : NaN;
  if (!Number.isFinite(jp)) return null;

  return { us, kr, jp };
}

/**
 * Pages에 배포된 interest-rates.json 을 가져온다.
 * 실패·형식 오류 시 null (호출측에서 기존 InterestRateService 로직으로 폴백).
 */
export async function fetchInterestRatesFromRemote(): Promise<InterestRatesRemoteResult | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(INTEREST_RATES_URL, {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('[InterestRatesRemote] HTTP', response.status);
      return null;
    }

    const data: unknown = await response.json();
    const parsed = parseRemotePayload(data);
    if (!parsed) {
      console.warn('[InterestRatesRemote] JSON 형식 불일치');
      return null;
    }
    return parsed;
  } catch (e) {
    console.warn('[InterestRatesRemote] fetch 실패:', e);
    return null;
  }
}
