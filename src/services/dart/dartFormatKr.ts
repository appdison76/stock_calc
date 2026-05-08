/**
 * DART fnltt 필드는 문서상 “천원”이나, 대형주·일부 보고서는 **원** 자릿수(10^12~10^15)로 온다.
 * 연결 손익의 천원 표기는 대개 10^12(1조 천원) 미만이므로, 그 이상이면 원 단위로 보고 ×1000을 하지 않는다.
 * (천원으로 잘못 ×1000 하면 4676조 같은 수백~수천 조로 부풀어 오른다.)
 */
const THOUSAND_WON_MAX_PLAUSIBLE = 1e12;

export function dartFnlttNumericToWon(raw: number): number {
  if (!Number.isFinite(raw)) return NaN;
  if (Math.abs(raw) >= THOUSAND_WON_MAX_PLAUSIBLE) return raw;
  return raw * 1000;
}

export function dartThousandWonToWon(thousandWon: number): number {
  return dartFnlttNumericToWon(thousandWon);
}

/** 단일 계정·분기 기준으로 비현실적으로 크면 파싱 오류로 간주 (조 단위 왜곡 방지) */
const MAX_DISPLAY_WON = 5e15;

/**
 * 해외 시가총액을 원화로 환산하면 NVDA 등 메가캡이 DART 실적용 상한(5e15)을 넘을 수 있음.
 * (USD 시총 3~4조 × 환율 ≈ 4~6×10^15 원)
 */
export const FORMAT_WON_SHORT_KR_MARKET_CAP_MAX_ABS = 2e16;

export type FormatWonShortKrOptions = {
  /** 기본은 DART용 MAX_DISPLAY_WON. 시총 등은 `FORMAT_WON_SHORT_KR_MARKET_CAP_MAX_ABS` 등으로 넓힘. */
  maxAbsWon?: number;
};

/** 조·억·만 앞 계수에 천단위 쉼표 (소수 자릿수는 기존 규칙 유지) */
function formatShortKrScaled(absScaled: number): string {
  const maxFrac = absScaled >= 100 ? 0 : absScaled >= 10 ? 1 : 2;
  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  }).format(absScaled);
}

export function formatWonShortKr(won: number, opts?: FormatWonShortKrOptions): string {
  if (!Number.isFinite(won) || won === 0) return '0';
  const maxAbs = opts?.maxAbsWon ?? MAX_DISPLAY_WON;
  if (Math.abs(won) > maxAbs) return '—';
  const sign = won < 0 ? '-' : '';
  const v = Math.abs(won);
  const jo = 1e12;
  const eok = 1e8;
  if (v >= jo) {
    const x = v / jo;
    return `${sign}${formatShortKrScaled(x)}조`;
  }
  if (v >= eok) {
    const x = v / eok;
    return `${sign}${formatShortKrScaled(x)}억`;
  }
  const man = v / 10000;
  if (man >= 1) {
    return `${sign}${formatShortKrScaled(man)}만`;
  }
  return `${sign}${Math.round(v).toLocaleString('ko-KR')}원`;
}
