/**
 * 기업 실적 비교 화면 — 기간 유틸·라벨·티커 정규화 (실제 숫자는 DART/Yahoo/네이버 API).
 */

/** `false`로 두면 더보기·홈 헤더에서 기업 실적 비교 진입이 숨겨집니다. */
export const SHOW_FUNDAMENTALS_COMPARE_MENU = true;

/**
 * 해외 USD 환산 폴백(실적 비교 화면은 Yahoo USDKRW=X 조회를 우선함).
 * 환경변수 `EXPO_PUBLIC_USD_KRW_RATE`가 있으면 그 역할은 “실시간 조회 실패 시”에 가깝게 쓰임.
 */
export const FUNDAMENTALS_USD_KRW_RATE = (() => {
  const n = Number(process.env.EXPO_PUBLIC_USD_KRW_RATE);
  return Number.isFinite(n) && n > 0 ? n : 1380;
})();

export type FundamentalsMetricTab =
  | 'revenue'
  | 'operatingIncome'
  | 'netIncome'
  | 'marketCap'
  | 'por'
  | 'per';

/** 기간별 표 칩에만 쓰는 지표 (시총·POR·PER은 상단 요약 표에서 표시) */
export type FundamentalsPeriodMetricTab = 'revenue' | 'operatingIncome' | 'netIncome';

export const METRIC_TAB_LABELS: Record<FundamentalsMetricTab, string> = {
  revenue: '매출',
  operatingIncome: '영업이익',
  netIncome: '당기순이익',
  marketCap: '시가총액',
  por: 'POR',
  per: 'PER',
};

/** 지표 칩 표시 순서 (기간별 비교용만) */
export const METRIC_TAB_CHIP_ORDER: FundamentalsPeriodMetricTab[] = [
  'revenue',
  'operatingIncome',
  'netIncome',
];

/** 티커 정규화 (국내 숫자는 6자리, 미국 티커 대문자) */
export function fundamentalsMockKey(ticker: string): string {
  const t = ticker.trim().replace(/\.(KS|KQ)$/i, '');
  if (/^\d{1,6}$/.test(t)) return t.padStart(6, '0');
  return t.toUpperCase();
}

/** 기간 한 행 (레이블·키만 사용; 셀 값은 국내 DART / 해외 Yahoo 그리드에서 조회) */
export interface MockFundamentalsPeriodRow {
  periodKey: string;
  label: string;
  /** 레거시 호환용 빈 객체 — 표시는 전부 DART */
  values: Record<
    string,
    {
      revenueKr?: string;
      operatingIncomeKr?: string;
      netIncomeKr?: string;
      marketCapKr?: string;
      per?: number;
    }
  >;
}

/** 달력 연도 기준 최근 N년(올해 포함) — 연·분기 테이블·연도 칩 공통 */
export const FUNDAMENTALS_CALENDAR_YEAR_SPAN = 5;

/** 연도 모드: 최근 N년 행 (데이터 없음 — DART로 채움) */
export function buildYearPeriodRowsForChoices(years: number[]): MockFundamentalsPeriodRow[] {
  const sorted = [...years].sort((a, b) => b - a);
  return sorted.map((y) => {
    const key = String(y);
    return { periodKey: key, label: key, values: {} };
  });
}

/** 선택 연도의 Q1~Q4 행 (데이터 없음 — DART로 채움) */
export function buildQuarterPeriodRowsForYear(year: number): MockFundamentalsPeriodRow[] {
  return ([1, 2, 3, 4] as const).map((q) => {
    const periodKey = `${year}Q${q}`;
    return {
      periodKey,
      label: `${year} Q${q}`,
      values: {},
    };
  });
}

export function fundamentalsQuarterYearChoices(
  referenceDate: Date,
  yearCount = FUNDAMENTALS_CALENDAR_YEAR_SPAN
): number[] {
  const y = referenceDate.getFullYear();
  return Array.from({ length: yearCount }, (_, i) => y - i);
}

/** 초기 연도 탭: 달력 기준 직전 연도(올해 − 1) */
export function fundamentalsDefaultPreviousCalendarYear(referenceDate: Date): number {
  return referenceDate.getFullYear() - 1;
}

/**
 * 초기 분기 탭: 달력 기준 "지금 속한 분기 − 1".
 * 1~3월(Q1) → 전년 Q4
 */
export function fundamentalsDefaultPreviousCalendarQuarter(referenceDate: Date): {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  periodKey: string;
} {
  const y = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1;
  const currentQ = (Math.floor((month - 1) / 3) + 1) as 1 | 2 | 3 | 4;
  if (currentQ === 1) {
    return { year: y - 1, quarter: 4, periodKey: `${y - 1}Q4` };
  }
  const q = (currentQ - 1) as 1 | 2 | 3 | 4;
  return { year: y, quarter: q, periodKey: `${y}Q${q}` };
}

/** `2024Q1` → `2023Q4` */
export function stepQuarterPeriodKeyBack(periodKey: string): string {
  const m = /^(\d{4})Q([1-4])$/.exec(periodKey);
  if (!m) return periodKey;
  const y = Number(m[1]);
  const q = Number(m[2]);
  if (q <= 1) return `${y - 1}Q4`;
  return `${y}Q${q - 1}`;
}

/**
 * DART "최신 실적" 후보 분기 (공시 누락 대비)
 */
export function buildDartLatestQuarterCandidates(referenceDate: Date, maxDepth = 12): string[] {
  const start = fundamentalsDefaultPreviousCalendarQuarter(referenceDate).periodKey;
  const out: string[] = [];
  let pk = start;
  for (let i = 0; i < maxDepth; i++) {
    out.push(pk);
    pk = stepQuarterPeriodKeyBack(pk);
  }
  return out;
}

/** 목 연도 행에 없을 때: target 이하 중 가장 큰 연도, 없으면 가장 이른 연도 */
export function fundamentalsPickYearPeriodKeyForTarget(
  targetYear: number,
  yearlyRows: MockFundamentalsPeriodRow[]
): string {
  const keys = yearlyRows
    .map((r) => Number(r.periodKey))
    .filter((n) => Number.isFinite(n));
  if (keys.length === 0) {
    return String(targetYear);
  }
  const atOrBelow = keys.filter((k) => k <= targetYear);
  if (atOrBelow.length > 0) {
    return String(Math.max(...atOrBelow));
  }
  return String(Math.min(...keys));
}

/**
 * 분기 연도 칩·초기 분기 키.
 * 직전 달력 분기가 **올해 Q1**이면 아직 공시가 비는 경우가 많아, 기본은 **전년도 + 전년 Q4**.
 * 그 외에는 직전 달력 분기 그대로(연도는 칩 목록에 맞게 클램프).
 */
export function fundamentalsDefaultQuarterWithinChoices(
  referenceDate: Date,
  choices: number[]
): { quarterYear: number; periodKey: string } {
  const raw = fundamentalsDefaultPreviousCalendarQuarter(referenceDate);
  if (choices.length === 0) {
    return { quarterYear: raw.year, periodKey: raw.periodKey };
  }
  const sorted = [...choices].sort((a, b) => a - b);
  const cy = referenceDate.getFullYear();

  if (raw.year === cy && raw.quarter === 1 && sorted.includes(cy - 1)) {
    const y = cy - 1;
    return { quarterYear: y, periodKey: `${y}Q4` };
  }

  if (choices.includes(raw.year)) {
    return { quarterYear: raw.year, periodKey: raw.periodKey };
  }
  const atOrBelow = sorted.filter((c) => c <= raw.year);
  let y: number;
  if (atOrBelow.length > 0) {
    y = Math.max(...atOrBelow);
  } else {
    y = Math.max(...sorted);
  }
  return { quarterYear: y, periodKey: `${y}Q${raw.quarter}` };
}
