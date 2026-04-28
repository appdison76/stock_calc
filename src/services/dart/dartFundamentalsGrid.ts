import type { FundamentalsMetricTab } from '../../data/fundamentalsCompareMock';
import { DART_REPRT, fetchFnlttSinglAcntAll } from './dartFinancialClient';
import {
  extractRevenueOperatingThousandWon,
  formatPairFromThousandWon,
  type DartFnlttRow,
} from './dartIncomeExtract';
import { dartFnlttNumericToWon, formatWonShortKr } from './dartFormatKr';
import { resolveDartCorpCode } from './dartCorpCodeCache';
import { dartTrace } from './dartLog';

export type DartCellBundle = {
  revenueKr: string;
  operatingIncomeKr: string;
  marketCapKr: string;
  per: string;
  /** 해당 기간 당기순이익(원) — PER 계산용 */
  netIncomeWon?: number | null;
  /** 해당 기간 영업이익(원) — POR 계산용 */
  operatingIncomeWon?: number | null;
};

/** periodKey → tickerKey(6자리) → 셀 묶음 */
export type DartFundamentalsGrid = Record<string, Record<string, DartCellBundle>>;

const fnlttCache = new Map<string, DartFnlttRow[]>();

/** 진단 로그 상한 (한 번 불러오기당, 서로 공유) */
let dartDiagLogBudget = 0;

function cacheKey(corp: string, year: number, reprt: string, fsDiv: string): string {
  return `${corp}|${year}|${reprt}|${fsDiv}`;
}

/** 연결(CFS) 우선, 비어 있으면 별도(OFS) 재시도 — 캐시는 조회 결과 기준 한 키 */
async function cachedFnltt(apiKey: string, corp: string, year: number, reprt: string): Promise<DartFnlttRow[]> {
  const kResolved = `${corp}|${year}|${reprt}|RES`;
  const hit = fnlttCache.get(kResolved);
  if (hit) return hit;

  let rows = await fetchFnlttSinglAcntAll({ apiKey, corpCode: corp, bsnsYear: year, reprtCode: reprt, fsDiv: 'CFS' });
  fnlttCache.set(cacheKey(corp, year, reprt, 'CFS'), rows);
  if (rows.length === 0) {
    rows = await fetchFnlttSinglAcntAll({ apiKey, corpCode: corp, bsnsYear: year, reprtCode: reprt, fsDiv: 'OFS' });
    fnlttCache.set(cacheKey(corp, year, reprt, 'OFS'), rows);
  }
  fnlttCache.set(kResolved, rows);
  if (rows.length === 0 && dartDiagLogBudget > 0) {
    dartDiagLogBudget -= 1;
    dartTrace('fnltt_zero_rows', { corp, year, reprt });
  }
  return rows;
}

const emptyBundle = (): DartCellBundle => ({
  revenueKr: '—',
  operatingIncomeKr: '—',
  marketCapKr: '—',
  per: '—',
  netIncomeWon: null,
  operatingIncomeWon: null,
});

function sjDivHistogram(rows: DartFnlttRow[]): Record<string, number> {
  const h: Record<string, number> = {};
  for (const r of rows) {
    const k = (r.sj_div || '(empty)').trim() || '(empty)';
    h[k] = (h[k] ?? 0) + 1;
  }
  return h;
}

function bundleFromRows(rows: DartFnlttRow[], ctx?: string): DartCellBundle {
  const ex = extractRevenueOperatingThousandWon(rows);
  const netIncomeWon =
    ex.netIncomeThousand == null ? null : dartFnlttNumericToWon(ex.netIncomeThousand);
  const operatingIncomeWon =
    ex.operatingThousand == null ? null : dartFnlttNumericToWon(ex.operatingThousand);
  if (rows.length > 0 && ex.revenueThousand == null && dartDiagLogBudget > 0) {
    dartDiagLogBudget -= 1;
    const names = rows
      .filter((r) => ['CIS', 'IS', 'MCIS'].includes((r.sj_div || '').toUpperCase()))
      .slice(0, 8)
      .map((r) => r.account_nm);
    dartTrace('extract_miss_revenue', {
      ctx: ctx ?? '(no ctx)',
      rowCount: rows.length,
      sjDiv: sjDivHistogram(rows),
      sampleCisIsAccounts: names,
    });
  }
  const f = formatPairFromThousandWon(ex.revenueThousand, ex.operatingThousand);
  return { ...f, marketCapKr: '—', per: '—', netIncomeWon, operatingIncomeWon };
}

/**
 * 분기별 손익: Open DART 가이드상 분·반기 (포괄)손익의 thstrm_amount는 3개월 금액.
 * → Q2=반기(11012) 직접, Q3=3분기(11014) 직접. Q4=사업보고서 당기(연간) − 3분기 당기누적(thstrm_add_amount).
 * @see https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS003&apiId=2019020
 */
async function calendarQuarterBundle(
  apiKey: string,
  corp: string,
  year: number,
  q: 1 | 2 | 3 | 4
): Promise<DartCellBundle> {
  if (q === 1) {
    const rows = await cachedFnltt(apiKey, corp, year, DART_REPRT.Q1);
    return bundleFromRows(rows, `Q1|corp=${corp}|${year}`);
  }
  if (q === 2) {
    const rows = await cachedFnltt(apiKey, corp, year, DART_REPRT.HALF);
    return bundleFromRows(rows, `Q2|corp=${corp}|${year}`);
  }
  if (q === 3) {
    const rows = await cachedFnltt(apiKey, corp, year, DART_REPRT.Q3);
    return bundleFromRows(rows, `Q3|corp=${corp}|${year}`);
  }
  const [q3Rows, annRows] = await Promise.all([
    cachedFnltt(apiKey, corp, year, DART_REPRT.Q3),
    cachedFnltt(apiKey, corp, year, DART_REPRT.ANNUAL),
  ]);
  const ann = extractRevenueOperatingThousandWon(annRows);
  const m9Cum = extractRevenueOperatingThousandWon(q3Rows, { amountKey: 'thstrm_add_amount' });
  let rTh =
    ann.revenueThousand != null && m9Cum.revenueThousand != null
      ? ann.revenueThousand - m9Cum.revenueThousand
      : null;
  let oTh =
    ann.operatingThousand != null && m9Cum.operatingThousand != null
      ? ann.operatingThousand - m9Cum.operatingThousand
      : null;
  let nTh =
    ann.netIncomeThousand != null && m9Cum.netIncomeThousand != null
      ? ann.netIncomeThousand - m9Cum.netIncomeThousand
      : null;
  /** 누적 컬럼이 비어 있으면 연간 − (분기별 3개월 합) */
  if (rTh == null || oTh == null || nTh == null) {
    const [q1Rows, h1Rows] = await Promise.all([
      cachedFnltt(apiKey, corp, year, DART_REPRT.Q1),
      cachedFnltt(apiKey, corp, year, DART_REPRT.HALF),
    ]);
    const q1p = extractRevenueOperatingThousandWon(q1Rows);
    const q2p = extractRevenueOperatingThousandWon(h1Rows);
    const q3p = extractRevenueOperatingThousandWon(q3Rows);
    if (
      rTh == null &&
      ann.revenueThousand != null &&
      q1p.revenueThousand != null &&
      q2p.revenueThousand != null &&
      q3p.revenueThousand != null
    ) {
      rTh = ann.revenueThousand - q1p.revenueThousand - q2p.revenueThousand - q3p.revenueThousand;
    }
    if (
      oTh == null &&
      ann.operatingThousand != null &&
      q1p.operatingThousand != null &&
      q2p.operatingThousand != null &&
      q3p.operatingThousand != null
    ) {
      oTh =
        ann.operatingThousand -
        q1p.operatingThousand -
        q2p.operatingThousand -
        q3p.operatingThousand;
    }
    if (
      nTh == null &&
      ann.netIncomeThousand != null &&
      q1p.netIncomeThousand != null &&
      q2p.netIncomeThousand != null &&
      q3p.netIncomeThousand != null
    ) {
      nTh =
        ann.netIncomeThousand -
        q1p.netIncomeThousand -
        q2p.netIncomeThousand -
        q3p.netIncomeThousand;
    }
  }
  const f = formatPairFromThousandWon(rTh, oTh);
  const netIncomeWon = nTh == null ? null : dartFnlttNumericToWon(nTh);
  const operatingIncomeWon = oTh == null ? null : dartFnlttNumericToWon(oTh);
  if (
    (rTh == null || f.revenueKr === '—') &&
    (annRows.length > 0 || q3Rows.length > 0) &&
    dartDiagLogBudget > 0
  ) {
    dartDiagLogBudget -= 1;
    dartTrace('q4_bundle_weak', {
      corp,
      year,
      annRows: annRows.length,
      q3Rows: q3Rows.length,
      annRev: ann.revenueThousand,
      m9CumRev: m9Cum.revenueThousand,
      rTh,
    });
  }
  return { ...f, marketCapKr: '—', per: '—', netIncomeWon, operatingIncomeWon };
}

function parseQuarterPeriodKey(periodKey: string): { year: number; q: 1 | 2 | 3 | 4 } | null {
  const m = /^(\d{4})Q([1-4])$/.exec(periodKey);
  if (!m) return null;
  return { year: Number(m[1]), q: Number(m[2]) as 1 | 2 | 3 | 4 };
}

/**
 * 연 모드: 당해 달력 연도는 사업보고서(전기) 미제출로 API 0건인 경우가 많음.
 * 분기 모드: 당해·미래 분기(현재 분기 포함)는 아직 공시 전인 경우가 많음.
 */
function isDartPeriodLikelyUnpublished(periodKey: string, granularity: 'year' | 'quarter'): boolean {
  const ref = new Date();
  const cy = ref.getFullYear();
  if (granularity === 'year') {
    const y = Number(periodKey);
    return Number.isFinite(y) && y >= cy;
  }
  const m = /^(\d{4})Q([1-4])$/.exec(periodKey);
  if (!m) return false;
  const y = Number(m[1]);
  const q = Number(m[2]);
  const currentQ = Math.floor(ref.getMonth() / 3) + 1;
  if (y > cy) return true;
  if (y < cy) return false;
  return q >= currentQ;
}

/** 동시에 너무 많은 DART 호출을 하면 JS·네트워크가 멈추므로 풀 제한 */
async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  if (items.length === 0) return;
  const queue = items.slice();
  const runWorker = async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item === undefined) break;
      await worker(item);
    }
  };
  const n = Math.min(Math.max(1, limit), items.length);
  await Promise.all(Array.from({ length: n }, () => runWorker()));
}

/**
 * 선택 종목(6자리)·기간 행마다 DART에서 매출·영업이익 채움. 시총·PER은 항상 '—'.
 * API 키 없음·해외 티커는 호출하지 않음.
 */
/** 한 번에 너무 많은 기간을 치면 느려지므로 최근 N개만 DART 조회 */
const MAX_DART_PERIOD_KEYS = 10;

export async function buildDartFundamentalsGrid(params: {
  apiKey: string;
  /** fundamentalsMockKey 형태 (국내 6자리만 사용) */
  domesticTickerKeys: string[];
  periodKeys: string[];
  granularity: 'year' | 'quarter';
}): Promise<DartFundamentalsGrid> {
  const { apiKey, domesticTickerKeys, granularity } = params;
  fnlttCache.clear();
  dartDiagLogBudget = 28;
  dartTrace('grid_build_start', {
    tickers: domesticTickerKeys,
    granularity,
    periodCount: params.periodKeys.length,
    periodsSample: params.periodKeys.slice(0, 6),
  });
  const periodKeys =
    params.periodKeys.length > MAX_DART_PERIOD_KEYS
      ? params.periodKeys.slice(-MAX_DART_PERIOD_KEYS)
      : params.periodKeys;
  const grid: DartFundamentalsGrid = {};

  const corpByTicker = new Map<string, string>();
  for (const tk of domesticTickerKeys) {
    try {
      const cc = await resolveDartCorpCode(apiKey, tk);
      if (cc) {
        corpByTicker.set(tk, cc);
        if (dartDiagLogBudget > 0) {
          dartDiagLogBudget -= 1;
          dartTrace('corp_resolved', { ticker: tk, corp: cc });
        }
      } else if (dartDiagLogBudget > 0) {
        dartDiagLogBudget -= 1;
        dartTrace('corp_unlisted_or_miss', { ticker: tk });
      }
    } catch (e) {
      dartTrace('corp_resolve_throw', { ticker: tk, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const tickersWithCorp = domesticTickerKeys.filter((tk) => corpByTicker.has(tk));
  if (tickersWithCorp.length === 0) {
    dartTrace('grid_no_corp', { tried: domesticTickerKeys });
  }

  for (const periodKey of periodKeys) {
    grid[periodKey] = {};
    for (const tk of domesticTickerKeys) {
      grid[periodKey][tk] = emptyBundle();
    }

    if (isDartPeriodLikelyUnpublished(periodKey, granularity)) {
      dartTrace('grid_skip_unpublished_period', { periodKey, granularity });
      await new Promise((r) => setTimeout(r, 0));
      continue;
    }

    await runPool(tickersWithCorp, 1, async (tk) => {
      const corp = corpByTicker.get(tk);
      if (!corp) return;
      try {
        if (granularity === 'year') {
          const y = Number(periodKey);
          if (!Number.isFinite(y)) return;
          const rows = await cachedFnltt(apiKey, corp, y, DART_REPRT.ANNUAL);
          grid[periodKey][tk] = bundleFromRows(rows, `Y|tk=${tk}|corp=${corp}|${y}`);
          return;
        }
        const pq = parseQuarterPeriodKey(periodKey);
        if (!pq) return;
        grid[periodKey][tk] = await calendarQuarterBundle(apiKey, corp, pq.year, pq.q);
      } catch (e) {
        dartTrace('cell_fetch_error', {
          ticker: tk,
          periodKey,
          error: e instanceof Error ? e.message : String(e),
        });
        grid[periodKey][tk] = emptyBundle();
      }
    });

    await new Promise((r) => setTimeout(r, 0));
  }

  let filledRev = 0;
  let totalCells = 0;
  for (const pk of Object.keys(grid)) {
    for (const tk of Object.keys(grid[pk])) {
      totalCells += 1;
      if (grid[pk][tk].revenueKr !== '—') filledRev += 1;
    }
  }
  dartTrace('grid_build_done', {
    filledRevenueCells: filledRev,
    totalCells,
    tickersWithCorp: tickersWithCorp.length,
  });

  return grid;
}

export function pickDartCellDisplay(
  tab: FundamentalsMetricTab,
  bundle: DartCellBundle | undefined
): string {
  if (!bundle) return '—';
  switch (tab) {
    case 'revenue':
      return bundle.revenueKr;
    case 'operatingIncome':
      return bundle.operatingIncomeKr;
    case 'netIncome':
      if (bundle.netIncomeWon != null && Number.isFinite(bundle.netIncomeWon)) {
        return formatWonShortKr(bundle.netIncomeWon);
      }
      return '—';
    case 'marketCap':
      return bundle.marketCapKr;
    case 'per':
      return bundle.per;
    case 'por':
      return '—';
    default:
      return '—';
  }
}
