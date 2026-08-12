import { formatWonShortKr } from '../services/dart/dartFormatKr';
import type { DartCellBundle, DartFundamentalsGrid } from '../services/dart/dartFundamentalsGrid';
import { getStockQuote, normalizeYahooTickerKey, type StockQuote } from '../services/YahooFinanceService';
import {
  FUNDAMENTALS_USD_KRW_RATE,
  buildFundamentalsSnapshotSelectionQuarterPeriodKeys,
} from '../data/fundamentalsCompareMock';

export type FundamentalsSnapshotPickContext = {
  referenceDate?: Date;
  /** 분기 스냅샷 후보 연도(계산기 초기값·기업실적비교 연도 칩) */
  quarterYear?: number;
};

export function formatRatioLocale(n: number): string {
  const maxFrac = n >= 100 ? 0 : n >= 10 ? 1 : 2;
  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  }).format(n);
}

export function annualizeIncomeForPerPor(baseWon: number | null, g: 'year' | 'quarter'): number | null {
  if (baseWon == null || !Number.isFinite(baseWon)) return null;
  if (g === 'year') return baseWon;
  return baseWon * 4;
}

export function formatPerFromCapAndNet(marketCapWon: number | null, netIncomeWon: number | null): string {
  if (marketCapWon == null || !Number.isFinite(marketCapWon)) return '—';
  if (netIncomeWon == null || !Number.isFinite(netIncomeWon)) return '—';
  if (netIncomeWon <= 0) return '적자';
  const per = marketCapWon / netIncomeWon;
  if (!Number.isFinite(per) || per <= 0) return '—';
  return formatRatioLocale(per);
}

export function formatPorFromCapAndOp(marketCapWon: number | null, operatingIncomeWon: number | null): string {
  if (marketCapWon == null || !Number.isFinite(marketCapWon)) return '—';
  if (operatingIncomeWon == null || !Number.isFinite(operatingIncomeWon)) return '—';
  if (operatingIncomeWon <= 0) return '적자';
  const por = marketCapWon / operatingIncomeWon;
  if (!Number.isFinite(por) || por <= 0) return '—';
  return formatRatioLocale(por);
}

/** PBR = 시가총액 ÷ 순자산(자본). 연율화 없음. */
export function formatPbrFromCapAndEquity(marketCapWon: number | null, equityWon: number | null): string {
  if (marketCapWon == null || !Number.isFinite(marketCapWon)) return '—';
  if (equityWon == null || !Number.isFinite(equityWon)) return '—';
  if (equityWon <= 0) return '—';
  const pbr = marketCapWon / equityWon;
  if (!Number.isFinite(pbr) || pbr <= 0) return '—';
  return formatRatioLocale(pbr);
}

export type OpScenarioUnit = 'jo' | 'eok' | 'cheonman' | 'baekman';

export const OP_SCENARIO_UNITS: { id: OpScenarioUnit; label: string }[] = [
  { id: 'jo', label: '조' },
  { id: 'eok', label: '억' },
  { id: 'cheonman', label: '천만' },
  { id: 'baekman', label: '백만' },
];

export function parsePositiveAmountString(raw: string): number | null {
  const s = raw.replace(/,/g, '').trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function scenarioAmountToQuarterlyOpEok(amount: number, unit: OpScenarioUnit): number {
  switch (unit) {
    case 'jo':
      return amount * 10000;
    case 'eok':
      return amount;
    case 'cheonman':
      return amount * 0.1;
    case 'baekman':
      return amount * 0.01;
    default:
      return amount;
  }
}

export function parseScenarioToQuarterlyOpEok(raw: string, unit: OpScenarioUnit): number | null {
  const n = parsePositiveAmountString(raw);
  if (n == null) return null;
  return scenarioAmountToQuarterlyOpEok(n, unit);
}

export function annualWonFromQuarterlyEok(quarterlyEok: number | null): number | null {
  if (quarterlyEok == null || !Number.isFinite(quarterlyEok) || quarterlyEok <= 0) return null;
  const won = quarterlyEok * 1e8 * 4;
  return Number.isFinite(won) ? won : null;
}

/** 분기 실적(억 환산) ×4 연율 금액 — 잠정·가이던스 표시용 */
export function formatAnnualKrFromQuarterlyEok(quarterlyEok: number | null): string {
  const won = annualWonFromQuarterlyEok(quarterlyEok);
  if (won == null) return '—';
  return formatWonShortKr(won);
}

export function formatPorFromQuarterlyOpEok(capWon: number | null, quarterlyOpEok: number | null): string {
  if (capWon == null || !Number.isFinite(capWon)) return '—';
  if (quarterlyOpEok == null || !Number.isFinite(quarterlyOpEok)) return '—';
  if (quarterlyOpEok <= 0) return '적자';
  const annualOpWon = annualWonFromQuarterlyEok(quarterlyOpEok);
  if (annualOpWon == null) return '—';
  const por = capWon / annualOpWon;
  if (!Number.isFinite(por) || por <= 0) return '—';
  return formatRatioLocale(por);
}

/** PSR = 시총 ÷ (분기 매출 ×4 연율) */
export function formatPsrFromQuarterlyRevEok(capWon: number | null, quarterlyRevEok: number | null): string {
  if (capWon == null || !Number.isFinite(capWon)) return '—';
  if (quarterlyRevEok == null || !Number.isFinite(quarterlyRevEok)) return '—';
  if (quarterlyRevEok <= 0) return '—';
  const annualRevWon = annualWonFromQuarterlyEok(quarterlyRevEok);
  if (annualRevWon == null) return '—';
  const psr = capWon / annualRevWon;
  if (!Number.isFinite(psr) || psr <= 0) return '—';
  return formatRatioLocale(psr);
}

/** 영업이익률 = 분기 영업이익 ÷ 분기 매출 (×4 해도 동일) */
export function formatOpMarginFromQuarterlyEok(
  quarterlyOpEok: number | null,
  quarterlyRevEok: number | null
): string {
  if (quarterlyOpEok == null || !Number.isFinite(quarterlyOpEok)) return '—';
  if (quarterlyRevEok == null || !Number.isFinite(quarterlyRevEok) || quarterlyRevEok <= 0) return '—';
  const pct = (quarterlyOpEok / quarterlyRevEok) * 100;
  if (!Number.isFinite(pct)) return '—';
  return `${new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(pct)}%`;
}

/** PER·POR·PBR·PSR 정의 — 실적 조회(연/분기) 한 줄 */
export function fundamentalsValuationFormulasLine(g: 'year' | 'quarter'): string {
  if (g === 'year') {
    return 'PER=시총÷당기순이익 · POR=시총÷영업이익 · PBR=시총÷순자산(자본) · PSR=시총÷매출';
  }
  return 'PER=시총÷(분기 순이익×4) · POR=시총÷(분기 영업이익×4) · PBR=시총÷순자산(자본) · PSR=시총÷(분기 매출×4)';
}

/** 요약·실적 PER/POR/PBR/PSR 분모 안내 */
export function fundamentalsValuationBasisFootnote(g: 'year' | 'quarter'): string {
  return `※ ${fundamentalsValuationFormulasLine(g)}`;
}

/** 잠정·가이던스 시나리오 — POR·PSR·영업이익률 */
export const SCENARIO_POR_PSR_METRICS_HINT =
  'POR=시총÷(분기 영업이익×4) · PSR=시총÷(분기 매출×4) · 영업이익률=분기 영업이익÷분기 매출';

export function formatCapBadge(periodKey: string, g: 'year' | 'quarter'): string {
  const quarterRe = /^(\d{4})Q([1-4])$/;
  const yearOnlyRe = /^(\d{4})$/;

  if (g === 'year') {
    const qm = quarterRe.exec(periodKey);
    if (qm) return `${qm[1]}년 연`;
    const ym = yearOnlyRe.exec(periodKey);
    if (ym) return `${ym[1]}년 연`;
    return `${periodKey}년 연`;
  }

  const qm = quarterRe.exec(periodKey);
  if (qm) return `${qm[1]}년 ${qm[2]}분기`;
  const ym = yearOnlyRe.exec(periodKey);
  if (ym) return `${ym[1]}년 연간`;
  return periodKey;
}

export function yahooLookupFromMockKey(mockKey: string): string {
  const mk = mockKey.trim();
  if (/^\d{6}$/.test(mk)) return mk;
  const withoutSuffix = mk.replace(/\.(US|O|NYSE|NASDAQ)$/i, '');
  return normalizeYahooTickerKey(withoutSuffix);
}

export async function resolveUsdKrwRate(): Promise<number> {
  try {
    const q = await getStockQuote('USDKRW=X');
    if (q != null && Number.isFinite(q.price) && q.price > 400 && q.price < 100_000) return q.price;
  } catch {
    /* ignore */
  }
  return FUNDAMENTALS_USD_KRW_RATE;
}

function cellAt(grid: DartFundamentalsGrid, periodKey: string, mockKey: string): DartCellBundle | undefined {
  return grid[periodKey]?.[mockKey];
}

function cellHasFundamentalsData(b: DartCellBundle | undefined): boolean {
  return !!(
    b &&
    (b.revenueKr !== '—' ||
      (b.netIncomeWon != null && Number.isFinite(b.netIncomeWon)) ||
      b.operatingIncomeKr !== '—')
  );
}

function cellHasRevenue(b: DartCellBundle | undefined): boolean {
  return b?.revenueKr != null && b.revenueKr !== '—';
}

function cellHasNetIncome(b: DartCellBundle | undefined): boolean {
  return b?.netIncomeWon != null && Number.isFinite(b.netIncomeWon);
}

function calendarQuarterEndUtcMs(year: number, quarter: 1 | 2 | 3 | 4): number {
  return Date.UTC(year, quarter * 3, 0);
}

function periodKeyEndUtcMs(periodKey: string): number | null {
  const qm = /^(\d{4})Q([1-4])$/.exec(periodKey);
  if (qm) {
    const y = Number(qm[1]);
    const q = Number(qm[2]) as 1 | 2 | 3 | 4;
    if (!Number.isFinite(y)) return null;
    return calendarQuarterEndUtcMs(y, q);
  }
  const ym = /^(\d{4})$/.exec(periodKey);
  if (ym) {
    const y = Number(ym[1]);
    if (!Number.isFinite(y)) return null;
    return Date.UTC(y, 12, 0);
  }
  return null;
}

function fsPeriodLabelEndUtcMs(label: string): number | null {
  const trimmed = label.trim();
  if (!trimmed) return null;
  const endPart = (trimmed.includes('~') ? trimmed.split('~').pop() : trimmed)?.trim() ?? '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(endPart);
  if (iso) {
    return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(endPart);
  if (us) {
    return Date.UTC(Number(us[3]), Number(us[1]) - 1, Number(us[2]));
  }
  return null;
}

/** 그리드 칸·periodKey에서 실적 **마감일**(UTC ms). 해외는 Yahoo `fsPeriodLabel` 종료일 우선. */
export function fundamentalsPeriodEndUtcMs(
  _mockKey: string,
  periodKey: string,
  bundle: DartCellBundle | undefined,
  _granularity: 'year' | 'quarter'
): number | null {
  const fromLabel = bundle?.fsPeriodLabel?.trim()
    ? fsPeriodLabelEndUtcMs(bundle.fsPeriodLabel)
    : null;
  if (fromLabel != null) return fromLabel;
  return periodKeyEndUtcMs(periodKey);
}

function periodKeyMatchesGranularity(periodKey: string, granularity: 'year' | 'quarter'): boolean {
  if (granularity === 'year') return /^\d{4}$/.test(periodKey);
  return /^\d{4}Q[1-4]$/.test(periodKey);
}

type RankedFundamentalsPeriod = {
  pk: string;
  end: number;
  hasRev: boolean;
  hasNet: boolean;
};

function compareRankedFundamentalsPeriods(a: RankedFundamentalsPeriod, b: RankedFundamentalsPeriod): number {
  if (b.end !== a.end) return b.end - a.end;
  if (a.hasRev !== b.hasRev) return (b.hasRev ? 1 : 0) - (a.hasRev ? 1 : 0);
  if (a.hasNet !== b.hasNet) return (b.hasNet ? 1 : 0) - (a.hasNet ? 1 : 0);
  return b.pk.localeCompare(a.pk);
}

function snapshotSelectionQuarterKeySet(
  referenceDate: Date,
  quarterYear: number,
  candidateDepth: number
): Set<string> {
  return new Set(
    buildFundamentalsSnapshotSelectionQuarterPeriodKeys(referenceDate, quarterYear, candidateDepth)
  );
}

function listFundamentalPeriodKeysByEndDateDesc(
  grid: DartFundamentalsGrid,
  mockKey: string,
  granularity: 'year' | 'quarter',
  eligibleQuarterKeys?: Set<string>
): string[] {
  const rows: RankedFundamentalsPeriod[] = [];
  for (const pk of Object.keys(grid)) {
    if (!periodKeyMatchesGranularity(pk, granularity)) continue;
    if (granularity === 'quarter' && eligibleQuarterKeys != null && !eligibleQuarterKeys.has(pk)) {
      continue;
    }
    const b = cellAt(grid, pk, mockKey);
    if (!cellHasFundamentalsData(b)) continue;
    const end = fundamentalsPeriodEndUtcMs(mockKey, pk, b, granularity);
    if (end == null) continue;
    rows.push({
      pk,
      end,
      hasRev: cellHasRevenue(b),
      hasNet: cellHasNetIncome(b),
    });
  }
  rows.sort(compareRankedFundamentalsPeriods);
  return rows.map((r) => r.pk);
}

function gridHasAnyFundamentals(grid: DartFundamentalsGrid, mockKey: string): boolean {
  for (const pk of Object.keys(grid)) {
    if (cellHasFundamentalsData(grid[pk]?.[mockKey])) return true;
  }
  return false;
}

function pickSnapshotPeriodKeyLegacy(
  grid: DartFundamentalsGrid,
  mockKey: string,
  granularity: 'year' | 'quarter',
  latestQuarterCandidates: string[],
  yearPeriodRows: Array<{ periodKey: string }>
): string | null {
  const hasRevenue = (pk: string) => cellHasRevenue(cellAt(grid, pk, mockKey));
  const hasNet = (pk: string) => cellHasNetIncome(cellAt(grid, pk, mockKey));
  const hasAnyFs = (pk: string) => cellHasFundamentalsData(cellAt(grid, pk, mockKey));

  if (granularity === 'year') {
    for (const r of yearPeriodRows) {
      if (hasRevenue(r.periodKey)) return r.periodKey;
    }
    for (const r of yearPeriodRows) {
      if (hasNet(r.periodKey)) return r.periodKey;
    }
    for (const r of yearPeriodRows) {
      if (hasAnyFs(r.periodKey)) return r.periodKey;
    }
    return yearPeriodRows[0]?.periodKey ?? null;
  }
  for (const pk of latestQuarterCandidates) {
    if (hasRevenue(pk)) return pk;
  }
  for (const pk of latestQuarterCandidates) {
    if (hasNet(pk)) return pk;
  }
  for (const pk of latestQuarterCandidates) {
    if (hasAnyFs(pk)) return pk;
  }
  return latestQuarterCandidates[0] ?? null;
}

function pickSnapshotPeriodKeyDomesticQuarter(
  grid: DartFundamentalsGrid,
  mockKey: string,
  latestQuarterCandidates: string[],
  eligibleQuarterKeys: Set<string>
): string | null {
  const cell = (pk: string) => cellAt(grid, pk, mockKey);

  for (const pk of latestQuarterCandidates) {
    if (!eligibleQuarterKeys.has(pk)) continue;
    if (cellHasRevenue(cell(pk))) return pk;
  }
  for (const pk of latestQuarterCandidates) {
    if (!eligibleQuarterKeys.has(pk)) continue;
    if (cellHasNetIncome(cell(pk))) return pk;
  }
  for (const pk of latestQuarterCandidates) {
    if (!eligibleQuarterKeys.has(pk)) continue;
    if (cellHasFundamentalsData(cell(pk))) return pk;
  }
  return null;
}

/** 그리드에 있는 실적 중 **마감일이 가장 늦은** periodKey (한·미 공통). */
export function pickSnapshotPeriodKey(
  grid: DartFundamentalsGrid,
  mockKey: string,
  granularity: 'year' | 'quarter',
  latestQuarterCandidates: string[],
  yearPeriodRows: Array<{ periodKey: string }>,
  pickContext?: FundamentalsSnapshotPickContext
): string | null {
  const domestic = /^\d{6}$/.test(mockKey.trim());
  const ref = pickContext?.referenceDate ?? new Date();
  const qy = pickContext?.quarterYear ?? ref.getFullYear();
  const candidateDepth = Math.max(12, latestQuarterCandidates.length);
  const eligibleQuarterKeys =
    granularity === 'quarter'
      ? snapshotSelectionQuarterKeySet(ref, qy, candidateDepth)
      : undefined;

  if (domestic && granularity === 'year') {
    return pickSnapshotPeriodKeyLegacy(grid, mockKey, granularity, latestQuarterCandidates, yearPeriodRows);
  }
  if (domestic && granularity === 'quarter' && eligibleQuarterKeys != null) {
    const domesticPk = pickSnapshotPeriodKeyDomesticQuarter(
      grid,
      mockKey,
      latestQuarterCandidates,
      eligibleQuarterKeys
    );
    if (domesticPk != null) return domesticPk;
    return pickSnapshotPeriodKeyLegacy(grid, mockKey, granularity, latestQuarterCandidates, yearPeriodRows);
  }

  const ranked = listFundamentalPeriodKeysByEndDateDesc(
    grid,
    mockKey,
    granularity,
    eligibleQuarterKeys
  );
  if (ranked.length > 0) return ranked[0];
  return pickSnapshotPeriodKeyLegacy(grid, mockKey, granularity, latestQuarterCandidates, yearPeriodRows);
}

/** 포트폴리오 요약용 — 선택 종목 그리드 전체에서 마감일 최신 periodKey */
export function pickPortfolioSnapshotPeriodKey(
  getGridForStock: (mockKey: string) => DartFundamentalsGrid | null | undefined,
  mockKeys: string[],
  granularity: 'year' | 'quarter',
  latestQuarterCandidates: string[],
  yearPeriodRows: Array<{ periodKey: string }>,
  pickContext?: FundamentalsSnapshotPickContext
): string | null {
  const ref = pickContext?.referenceDate ?? new Date();
  const qy = pickContext?.quarterYear ?? ref.getFullYear();
  const candidateDepth = Math.max(12, latestQuarterCandidates.length);
  const eligibleQuarterKeys =
    granularity === 'quarter'
      ? snapshotSelectionQuarterKeySet(ref, qy, candidateDepth)
      : undefined;
  const merged = new Map<string, RankedFundamentalsPeriod>();

  for (const mk of mockKeys) {
    const grid = getGridForStock(mk);
    if (!grid) continue;
    for (const pk of Object.keys(grid)) {
      if (!periodKeyMatchesGranularity(pk, granularity)) continue;
      if (granularity === 'quarter' && eligibleQuarterKeys != null && !eligibleQuarterKeys.has(pk)) {
        continue;
      }
      const b = grid[pk]?.[mk];
      if (!cellHasFundamentalsData(b)) continue;
      const end = fundamentalsPeriodEndUtcMs(mk, pk, b, granularity);
      if (end == null) continue;
      const prev = merged.get(pk);
      if (!prev) {
        merged.set(pk, {
          pk,
          end,
          hasRev: cellHasRevenue(b),
          hasNet: cellHasNetIncome(b),
        });
      } else {
        prev.end = Math.max(prev.end, end);
        prev.hasRev = prev.hasRev || cellHasRevenue(b);
        prev.hasNet = prev.hasNet || cellHasNetIncome(b);
      }
    }
  }

  const ranked = [...merged.values()].sort(compareRankedFundamentalsPeriods);
  if (ranked.length > 0) return ranked[0].pk;
  return pickSnapshotPeriodKeyLegacy(
    getGridForStock(mockKeys[0] ?? '') ?? {},
    mockKeys[0] ?? '',
    granularity,
    latestQuarterCandidates,
    yearPeriodRows
  );
}

export function buildPerNetIncomeSearchPeriodKeys(
  grid: DartFundamentalsGrid,
  mockKey: string,
  granularity: 'year' | 'quarter',
  snapshotPeriodKey: string,
  latestQuarterCandidates: string[],
  yearPeriodRows: Array<{ periodKey: string }>,
  pickContext?: FundamentalsSnapshotPickContext
): string[] {
  const ref = pickContext?.referenceDate ?? new Date();
  const qy = pickContext?.quarterYear ?? ref.getFullYear();
  const candidateDepth = Math.max(12, latestQuarterCandidates.length);
  const eligibleQuarterKeys =
    granularity === 'quarter'
      ? snapshotSelectionQuarterKeySet(ref, qy, candidateDepth)
      : undefined;
  const sorted = listFundamentalPeriodKeysByEndDateDesc(
    grid,
    mockKey,
    granularity,
    eligibleQuarterKeys
  );
  if (granularity === 'year') {
    const ys = yearPeriodRows.map((r) => r.periodKey);
    return [...new Set([snapshotPeriodKey, ...sorted, ...ys])];
  }
  return [...new Set([snapshotPeriodKey, ...sorted, ...latestQuarterCandidates])];
}

function resolveNetIncomeWon(
  grid: DartFundamentalsGrid,
  mockKey: string,
  searchKeys: string[]
): { value: number | null; periodKey: string | null } {
  for (const pk of searchKeys) {
    const n = cellAt(grid, pk, mockKey)?.netIncomeWon;
    if (n != null && Number.isFinite(n)) return { value: n, periodKey: pk };
  }
  return { value: null, periodKey: null };
}

function resolveRevenue(
  grid: DartFundamentalsGrid,
  mockKey: string,
  searchKeys: string[]
): { kr: string | null; won: number | null; periodKey: string | null } {
  for (const pk of searchKeys) {
    const b = cellAt(grid, pk, mockKey);
    if (!b) continue;
    if (b.revenueKr != null && b.revenueKr !== '—') {
      const won = b.revenueWon;
      return {
        kr: b.revenueKr,
        won: won != null && Number.isFinite(won) ? won : null,
        periodKey: pk,
      };
    }
  }
  return { kr: null, won: null, periodKey: null };
}

function resolveOperatingIncome(
  grid: DartFundamentalsGrid,
  mockKey: string,
  searchKeys: string[]
): { kr: string | null; won: number | null; periodKey: string | null } {
  for (const pk of searchKeys) {
    const b = cellAt(grid, pk, mockKey);
    if (!b) continue;
    if (b.operatingIncomeKr !== '—' && b.operatingIncomeWon != null && Number.isFinite(b.operatingIncomeWon)) {
      return { kr: b.operatingIncomeKr, won: b.operatingIncomeWon, periodKey: pk };
    }
  }
  return { kr: null, won: null, periodKey: null };
}

function resolveEquityWon(
  grid: DartFundamentalsGrid,
  mockKey: string,
  searchKeys: string[]
): { value: number | null; periodKey: string | null } {
  for (const pk of searchKeys) {
    const eq = cellAt(grid, pk, mockKey)?.equityWon;
    if (eq != null && Number.isFinite(eq)) return { value: eq, periodKey: pk };
  }
  return { value: null, periodKey: null };
}

function metricPeriodSuffixFromGrid(
  grid: DartFundamentalsGrid,
  mockKey: string,
  sourcePk: string | null,
  snapshotPk: string | null,
  granularity: 'year' | 'quarter'
): string | null {
  if (!sourcePk || !snapshotPk || sourcePk === snapshotPk) return null;
  const domestic = /^\d{6}$/.test(mockKey.trim());
  const b = cellAt(grid, sourcePk, mockKey);
  if (!domestic && b?.fsPeriodLabel?.trim()) return b.fsPeriodLabel.trim();
  return formatCapBadge(sourcePk, granularity);
}

export function applyFundamentalsSnapshotFromGrid(
  grid: DartFundamentalsGrid,
  mockKey: string,
  granularity: 'year' | 'quarter',
  latestQuarterCandidates: string[],
  yearPeriodRows: Array<{ periodKey: string }>,
  pickContext?: FundamentalsSnapshotPickContext
): {
  snapshotPk: string;
  netIncomeWon: number | null;
  operatingIncomeWon: number | null;
  equityWon: number | null;
  revenueWon: number | null;
  revenueKr: string;
  operatingIncomeKr: string;
  netIncomeKr: string;
  equityKr: string;
  fsPeriodLabel: string | null;
  revenuePeriodSuffix: string | null;
  operatingPeriodSuffix: string | null;
  netIncomePeriodSuffix: string | null;
  equityPeriodSuffix: string | null;
} | null {
  if (!gridHasAnyFundamentals(grid, mockKey)) return null;

  const snapshotPk = pickSnapshotPeriodKey(
    grid,
    mockKey,
    granularity,
    latestQuarterCandidates,
    yearPeriodRows,
    pickContext
  );
  if (snapshotPk == null) return null;

  const searchKeys = buildPerNetIncomeSearchPeriodKeys(
    grid,
    mockKey,
    granularity,
    snapshotPk,
    latestQuarterCandidates,
    yearPeriodRows,
    pickContext
  );
  const net = resolveNetIncomeWon(grid, mockKey, searchKeys);
  const rev = resolveRevenue(grid, mockKey, searchKeys);
  const op = resolveOperatingIncome(grid, mockKey, searchKeys);
  const eq = resolveEquityWon(grid, mockKey, searchKeys);

  const hasResolved =
    (net.value != null && Number.isFinite(net.value)) ||
    (rev.kr != null && rev.kr !== '—') ||
    (op.won != null && Number.isFinite(op.won)) ||
    (eq.value != null && Number.isFinite(eq.value));
  if (!hasResolved) return null;

  const netKr = net.value != null && Number.isFinite(net.value) ? formatWonShortKr(net.value) : '—';
  const equityKr =
    eq.value != null && Number.isFinite(eq.value) ? formatWonShortKr(eq.value) : '—';

  return {
    snapshotPk,
    netIncomeWon: net.value,
    operatingIncomeWon: op.won,
    equityWon: eq.value,
    revenueWon: rev.won,
    revenueKr: rev.kr ?? '—',
    operatingIncomeKr: op.kr ?? '—',
    netIncomeKr: netKr,
    equityKr,
    fsPeriodLabel: cellAt(grid, snapshotPk, mockKey)?.fsPeriodLabel ?? null,
    revenuePeriodSuffix: metricPeriodSuffixFromGrid(grid, mockKey, rev.periodKey, snapshotPk, granularity),
    operatingPeriodSuffix: metricPeriodSuffixFromGrid(grid, mockKey, op.periodKey, snapshotPk, granularity),
    netIncomePeriodSuffix: metricPeriodSuffixFromGrid(grid, mockKey, net.periodKey, snapshotPk, granularity),
    equityPeriodSuffix: metricPeriodSuffixFromGrid(grid, mockKey, eq.periodKey, snapshotPk, granularity),
  };
}

export function marketCapWonFromQuote(q: StockQuote | null, usdKrw: number): number | null {
  if (!q?.marketCap || !Number.isFinite(q.marketCap)) return null;
  const cur = (q.currency || '').toUpperCase();
  if (cur === 'KRW') return q.marketCap;
  return q.marketCap * usdKrw;
}
