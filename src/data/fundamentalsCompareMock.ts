/**
 * 실적 비교 화면용 샘플 데이터 (API 연동 전).
 * 프로덕션 연동 시 이 파일의 상수·테이블을 서비스 응답으로 대체하면 됩니다.
 */

/** `false`로 두면 릴리즈 빌드에서 더보기 메뉴가 숨겨집니다. */
export const SHOW_FUNDAMENTALS_COMPARE_MENU = __DEV__;

/** 화면 상단에 표시하는 샘플 환율 안내 문구 */
export const MOCK_FX_DISCLOSURE =
  '표시: 원화(KRW) 환산 · 샘플 환율 1USD = 1,380원 (고정, 데모)';

export type FundamentalsMetricTab = 'revenue' | 'operatingIncome' | 'marketCap' | 'per';

export const METRIC_TAB_LABELS: Record<FundamentalsMetricTab, string> = {
  revenue: '매출',
  operatingIncome: '영업이익',
  marketCap: '시가총액',
  per: 'PER (TTM)',
};

/** 티커 정규화: mock 테이블 키와 맞춤 (6자리 숫자 → 앞자리만, 미국 티커 대문자) */
export function fundamentalsMockKey(ticker: string): string {
  const t = ticker.trim().replace(/\.(KS|KQ)$/i, '');
  if (/^\d{6}$/.test(t)) return t;
  return t.toUpperCase();
}

/** 기간 한 행: 종목별 표시 문자열 (이미 원화 환산된 가정의 문자열 또는 PER 숫자) */
export interface MockFundamentalsPeriodRow {
  periodKey: string;
  label: string;
  /** 키: fundamentalsMockKey(티커) */
  values: Record<
    string,
    {
      revenueKr?: string;
      operatingIncomeKr?: string;
      marketCapKr?: string;
      per?: number;
    }
  >;
}

/** 연도별 샘플 (데모) */
export const MOCK_YEARLY_ROWS: MockFundamentalsPeriodRow[] = [
  {
    periodKey: '2022',
    label: '2022',
    values: {
      '005930': {
        revenueKr: '302조',
        operatingIncomeKr: '43조',
        marketCapKr: '약 420조',
        per: 12.4,
      },
      NVDA: {
        revenueKr: '27조',
        operatingIncomeKr: '4.4조',
        marketCapKr: '약 95조',
        per: 48.2,
      },
      '000660': {
        revenueKr: '44조',
        operatingIncomeKr: '6.6조',
        marketCapKr: '약 88조',
        per: 9.8,
      },
    },
  },
  {
    periodKey: '2023',
    label: '2023',
    values: {
      '005930': {
        revenueKr: '259조',
        operatingIncomeKr: '6.6조',
        marketCapKr: '약 380조',
        per: 18.1,
      },
      NVDA: {
        revenueKr: '61조',
        operatingIncomeKr: '33조',
        marketCapKr: '약 140조',
        per: 32.5,
      },
      '000660': {
        revenueKr: '37조',
        operatingIncomeKr: '15조',
        marketCapKr: '약 72조',
        per: 11.2,
      },
    },
  },
  {
    periodKey: '2024',
    label: '2024',
    values: {
      '005930': {
        revenueKr: '301조',
        operatingIncomeKr: '33조',
        marketCapKr: '약 450조',
        per: 15.6,
      },
      NVDA: {
        revenueKr: '113조',
        operatingIncomeKr: '74조',
        marketCapKr: '약 220조',
        per: 28.4,
      },
      '000660': {
        revenueKr: '66조',
        operatingIncomeKr: '23조',
        marketCapKr: '약 165조',
        per: 10.5,
      },
    },
  },
];

/**
 * 연도 모드: 분기와 동일한 달력 연도 목록(최근 N년)으로 행을 만들고, `MOCK_YEARLY_ROWS`에 없는 연도는 빈 `values`.
 * `years`는 보통 [올해, 전년, 전전년] — 표·칩 순서를 맞추기 위해 **내림차순(최신 먼저)** 으로 정렬한다.
 */
export function buildYearPeriodRowsForChoices(years: number[]): MockFundamentalsPeriodRow[] {
  const sorted = [...years].sort((a, b) => b - a);
  return sorted.map((y) => {
    const key = String(y);
    const fromMock = MOCK_YEARLY_ROWS.find((r) => r.periodKey === key);
    if (fromMock) {
      return { ...fromMock, label: key, periodKey: key };
    }
    return { periodKey: key, label: key, values: {} };
  });
}

/**
 * 분기별 샘플 셀 (데모). 키: `YYYYQn` (예: 2024Q2). 없는 분기는 빈 객체 → 표에서는 `—`.
 * API 연동 시 동일 키로 서버 응답을 매핑하면 됩니다.
 */
export const MOCK_QUARTERLY_VALUES_BY_PERIOD: Record<string, MockFundamentalsPeriodRow['values']> = {
  '2023Q1': {
    '005930': {
      revenueKr: '63조',
      operatingIncomeKr: '0.6조',
      marketCapKr: '—',
      per: 17.2,
    },
    NVDA: {
      revenueKr: '12조',
      operatingIncomeKr: '5.7조',
      marketCapKr: '—',
      per: 34.0,
    },
    '000660': {
      revenueKr: '8.5조',
      operatingIncomeKr: '2.6조',
      marketCapKr: '—',
      per: 11.5,
    },
  },
  '2023Q2': {
    '005930': {
      revenueKr: '60조',
      operatingIncomeKr: '0.7조',
      marketCapKr: '—',
      per: 17.8,
    },
    NVDA: {
      revenueKr: '13조',
      operatingIncomeKr: '6.8조',
      marketCapKr: '—',
      per: 33.2,
    },
    '000660': {
      revenueKr: '8.2조',
      operatingIncomeKr: '2.4조',
      marketCapKr: '—',
      per: 11.0,
    },
  },
  '2023Q3': {
    '005930': {
      revenueKr: '67조',
      operatingIncomeKr: '2.4조',
      marketCapKr: '—',
      per: 16.5,
    },
    NVDA: {
      revenueKr: '16조',
      operatingIncomeKr: '9.0조',
      marketCapKr: '—',
      per: 32.0,
    },
    '000660': {
      revenueKr: '9.1조',
      operatingIncomeKr: '3.1조',
      marketCapKr: '—',
      per: 10.8,
    },
  },
  '2023Q4': {
    '005930': {
      revenueKr: '67조',
      operatingIncomeKr: '2.8조',
      marketCapKr: '—',
      per: 18.1,
    },
    NVDA: {
      revenueKr: '19조',
      operatingIncomeKr: '11조',
      marketCapKr: '—',
      per: 32.5,
    },
    '000660': {
      revenueKr: '9.2조',
      operatingIncomeKr: '3.4조',
      marketCapKr: '—',
      per: 11.2,
    },
  },
  '2024Q1': {
    '005930': {
      revenueKr: '71조',
      operatingIncomeKr: '6.6조',
      marketCapKr: '—',
      per: 15.1,
    },
    NVDA: {
      revenueKr: '26조',
      operatingIncomeKr: '14조',
      marketCapKr: '—',
      per: 31.4,
    },
    '000660': {
      revenueKr: '16조',
      operatingIncomeKr: '5.9조',
      marketCapKr: '—',
      per: 10.8,
    },
  },
  '2024Q2': {
    '005930': {
      revenueKr: '74조',
      operatingIncomeKr: '10.4조',
      marketCapKr: '—',
      per: 14.2,
    },
    NVDA: {
      revenueKr: '30조',
      operatingIncomeKr: '16조',
      marketCapKr: '—',
      per: 30.1,
    },
    '000660': {
      revenueKr: '17조',
      operatingIncomeKr: '6.8조',
      marketCapKr: '—',
      per: 10.9,
    },
  },
  '2024Q3': {
    '005930': {
      revenueKr: '79조',
      operatingIncomeKr: '12.8조',
      marketCapKr: '—',
      per: 13.8,
    },
    NVDA: {
      revenueKr: '35조',
      operatingIncomeKr: '19조',
      marketCapKr: '—',
      per: 29.2,
    },
    '000660': {
      revenueKr: '19조',
      operatingIncomeKr: '7.0조',
      marketCapKr: '—',
      per: 10.6,
    },
  },
  '2024Q4': {
    '005930': {
      revenueKr: '67조',
      operatingIncomeKr: '6.5조',
      marketCapKr: '—',
      per: 16.4,
    },
    NVDA: {
      revenueKr: '39조',
      operatingIncomeKr: '22조',
      marketCapKr: '—',
      per: 27.8,
    },
    '000660': {
      revenueKr: '15조',
      operatingIncomeKr: '4.1조',
      marketCapKr: '—',
      per: 11.8,
    },
  },
  '2025Q1': {
    '005930': {
      revenueKr: '73조',
      operatingIncomeKr: '6.8조',
      marketCapKr: '—',
      per: 14.8,
    },
    NVDA: {
      revenueKr: '44조',
      operatingIncomeKr: '22조',
      marketCapKr: '—',
      per: 28.2,
    },
    '000660': {
      revenueKr: '17조',
      operatingIncomeKr: '6.2조',
      marketCapKr: '—',
      per: 10.4,
    },
  },
  '2025Q2': {
    '005930': {
      revenueKr: '74조',
      operatingIncomeKr: '4.9조',
      marketCapKr: '—',
      per: 15.6,
    },
    NVDA: {
      revenueKr: '47조',
      operatingIncomeKr: '26조',
      marketCapKr: '—',
      per: 27.5,
    },
    '000660': {
      revenueKr: '19조',
      operatingIncomeKr: '7.4조',
      marketCapKr: '—',
      per: 10.2,
    },
  },
};

/** 달력 연도 기준 최근 N년(올해 포함) — 분기 모드 연도 칩용 */
export function fundamentalsQuarterYearChoices(referenceDate: Date, yearCount = 3): number[] {
  const y = referenceDate.getFullYear();
  return Array.from({ length: yearCount }, (_, i) => y - i);
}

/** 초기 연도 탭: 달력 기준 직전 연도(올해 − 1) */
export function fundamentalsDefaultPreviousCalendarYear(referenceDate: Date): number {
  return referenceDate.getFullYear() - 1;
}

/**
 * 초기 분기 탭: 달력 기준 "지금 속한 분기 − 1".
 * 1~3월(Q1) → 전년 Q4 (같은 해에서 Q0으로 가지 않음)
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

/**
 * 목 연도 행에 없을 때: target 이하 중 가장 큰 연도, 없으면 가장 이른 연도.
 */
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

/** 분기 연도 칩에 맞게 "직전 달력 분기"의 연도만 클램프 */
export function fundamentalsDefaultQuarterWithinChoices(
  referenceDate: Date,
  choices: number[]
): { quarterYear: number; periodKey: string } {
  const raw = fundamentalsDefaultPreviousCalendarQuarter(referenceDate);
  if (choices.length === 0) {
    return { quarterYear: raw.year, periodKey: raw.periodKey };
  }
  const sorted = [...choices].sort((a, b) => a - b);
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

/** 선택 연도의 Q1~Q4 행 (목 데이터는 `MOCK_QUARTERLY_VALUES_BY_PERIOD`에서 병합) */
export function buildQuarterPeriodRowsForYear(year: number): MockFundamentalsPeriodRow[] {
  return ([1, 2, 3, 4] as const).map((q) => {
    const periodKey = `${year}Q${q}`;
    return {
      periodKey,
      label: `${year} Q${q}`,
      values: { ...(MOCK_QUARTERLY_VALUES_BY_PERIOD[periodKey] ?? {}) },
    };
  });
}

export function getMockCell(
  tab: FundamentalsMetricTab,
  row: MockFundamentalsPeriodRow,
  tickerKey: string
): string {
  const cell = row.values[tickerKey];
  if (!cell) return '—';
  switch (tab) {
    case 'revenue':
      return cell.revenueKr ?? '—';
    case 'operatingIncome':
      return cell.operatingIncomeKr ?? '—';
    case 'marketCap':
      return cell.marketCapKr ?? '—';
    case 'per':
      return cell.per != null && Number.isFinite(cell.per) ? String(cell.per.toFixed(1)) : '—';
    default:
      return '—';
  }
}
