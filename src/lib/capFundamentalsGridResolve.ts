import { formatWonShortKr } from '../services/dart/dartFormatKr';
import type { DartCellBundle, DartFundamentalsGrid } from '../services/dart/dartFundamentalsGrid';
import { getStockQuote, normalizeYahooTickerKey, type StockQuote } from '../services/YahooFinanceService';
import { FUNDAMENTALS_USD_KRW_RATE } from '../data/fundamentalsCompareMock';

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

export function formatPorFromQuarterlyOpEok(capWon: number | null, quarterlyOpEok: number | null): string {
  if (capWon == null || !Number.isFinite(capWon)) return '—';
  if (quarterlyOpEok == null || !Number.isFinite(quarterlyOpEok)) return '—';
  if (quarterlyOpEok <= 0) return '적자';
  const annualOpWon = quarterlyOpEok * 1e8 * 4;
  const por = capWon / annualOpWon;
  if (!Number.isFinite(por) || por <= 0) return '—';
  return formatRatioLocale(por);
}

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

function gridHasAnyFundamentals(grid: DartFundamentalsGrid, mockKey: string): boolean {
  for (const pk of Object.keys(grid)) {
    const b = grid[pk]?.[mockKey];
    if (
      b &&
      (b.revenueKr !== '—' ||
        b.operatingIncomeKr !== '—' ||
        (b.netIncomeWon != null && Number.isFinite(b.netIncomeWon)))
    ) {
      return true;
    }
  }
  return false;
}

export function pickSnapshotPeriodKey(
  grid: DartFundamentalsGrid,
  mockKey: string,
  granularity: 'year' | 'quarter',
  latestQuarterCandidates: string[],
  yearPeriodRows: Array<{ periodKey: string }>
): string | null {
  const hasRevenue = (pk: string) => {
    const r = cellAt(grid, pk, mockKey)?.revenueKr;
    return r != null && r !== '—';
  };
  const hasNet = (pk: string) => {
    const n = cellAt(grid, pk, mockKey)?.netIncomeWon;
    return n != null && Number.isFinite(n);
  };
  const hasAnyFs = (pk: string) => {
    const b = cellAt(grid, pk, mockKey);
    return !!(
      b &&
      (b.revenueKr !== '—' ||
        (b.netIncomeWon != null && Number.isFinite(b.netIncomeWon)) ||
        b.operatingIncomeKr !== '—')
    );
  };

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

export function buildPerNetIncomeSearchPeriodKeys(
  granularity: 'year' | 'quarter',
  snapshotPeriodKey: string,
  latestQuarterCandidates: string[],
  yearPeriodRows: Array<{ periodKey: string }>
): string[] {
  if (granularity === 'year') {
    const ys = yearPeriodRows.map((r) => r.periodKey);
    return [...new Set([snapshotPeriodKey, ...ys])];
  }
  return [...new Set([snapshotPeriodKey, ...latestQuarterCandidates])];
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
  yearPeriodRows: Array<{ periodKey: string }>
): {
  snapshotPk: string;
  netIncomeWon: number | null;
  operatingIncomeWon: number | null;
  revenueWon: number | null;
  revenueKr: string;
  operatingIncomeKr: string;
  netIncomeKr: string;
  fsPeriodLabel: string | null;
  revenuePeriodSuffix: string | null;
  operatingPeriodSuffix: string | null;
  netIncomePeriodSuffix: string | null;
} | null {
  if (!gridHasAnyFundamentals(grid, mockKey)) return null;

  const snapshotPk = pickSnapshotPeriodKey(grid, mockKey, granularity, latestQuarterCandidates, yearPeriodRows);
  if (snapshotPk == null) return null;

  const searchKeys = buildPerNetIncomeSearchPeriodKeys(
    granularity,
    snapshotPk,
    latestQuarterCandidates,
    yearPeriodRows
  );
  const net = resolveNetIncomeWon(grid, mockKey, searchKeys);
  const rev = resolveRevenue(grid, mockKey, searchKeys);
  const op = resolveOperatingIncome(grid, mockKey, searchKeys);

  const hasResolved =
    (net.value != null && Number.isFinite(net.value)) ||
    (rev.kr != null && rev.kr !== '—') ||
    (op.won != null && Number.isFinite(op.won));
  if (!hasResolved) return null;

  const netKr = net.value != null && Number.isFinite(net.value) ? formatWonShortKr(net.value) : '—';

  return {
    snapshotPk,
    netIncomeWon: net.value,
    operatingIncomeWon: op.won,
    revenueWon: rev.won,
    revenueKr: rev.kr ?? '—',
    operatingIncomeKr: op.kr ?? '—',
    netIncomeKr: netKr,
    fsPeriodLabel: cellAt(grid, snapshotPk, mockKey)?.fsPeriodLabel ?? null,
    revenuePeriodSuffix: metricPeriodSuffixFromGrid(grid, mockKey, rev.periodKey, snapshotPk, granularity),
    operatingPeriodSuffix: metricPeriodSuffixFromGrid(grid, mockKey, op.periodKey, snapshotPk, granularity),
    netIncomePeriodSuffix: metricPeriodSuffixFromGrid(grid, mockKey, net.periodKey, snapshotPk, granularity),
  };
}

export function marketCapWonFromQuote(q: StockQuote | null, usdKrw: number): number | null {
  if (!q?.marketCap || !Number.isFinite(q.marketCap)) return null;
  const cur = (q.currency || '').toUpperCase();
  if (cur === 'KRW') return q.marketCap;
  return q.marketCap * usdKrw;
}
