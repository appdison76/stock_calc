import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getStockQuote, normalizeYahooTickerKey, type StockQuote } from '../src/services/YahooFinanceService';
import { fetchDomesticMarketCapWonFromNaver } from '../src/services/naverFinanceStock';
import { buildYahooFundamentalsGridColumn } from '../src/services/yahooFundamentalsGrid';
import { buildDartFundamentalsGrid, type DartCellBundle, type DartFundamentalsGrid } from '../src/services/dart/dartFundamentalsGrid';
import { getDartApiKey } from '../src/services/dart/dartConfig';
import {
  FORMAT_WON_SHORT_KR_MARKET_CAP_MAX_ABS,
  formatWonShortKr,
} from '../src/services/dart/dartFormatKr';
import {
  FUNDAMENTALS_USD_KRW_RATE,
  fundamentalsMockKey,
  buildDartLatestQuarterCandidates,
  fundamentalsQuarterYearChoices,
  buildYearPeriodRowsForChoices,
  buildQuarterPeriodRowsForYear,
  fundamentalsDefaultQuarterWithinChoices,
  FUNDAMENTALS_CALENDAR_YEAR_SPAN,
} from '../src/data/fundamentalsCompareMock';
import { AdmobNativeAd } from '../src/components/AdmobNativeAd';
import StockSearchModal from '../src/components/StockSearchModal';
import { togglePlainPercentSign } from '../src/utils/percentSignToggle';

/** 비율 표시 — 기업실적비교와 동일 규칙 */
function formatRatioLocale(n: number): string {
  const maxFrac = n >= 100 ? 0 : n >= 10 ? 1 : 2;
  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  }).format(n);
}

function annualizeIncomeForPerPor(baseWon: number | null, g: 'year' | 'quarter'): number | null {
  if (baseWon == null || !Number.isFinite(baseWon)) return null;
  if (g === 'year') return baseWon;
  return baseWon * 4;
}

function formatPerFromCapAndNet(marketCapWon: number | null, netIncomeWon: number | null): string {
  if (marketCapWon == null || !Number.isFinite(marketCapWon)) return '—';
  if (netIncomeWon == null || !Number.isFinite(netIncomeWon)) return '—';
  if (netIncomeWon <= 0) return '적자';
  const per = marketCapWon / netIncomeWon;
  if (!Number.isFinite(per) || per <= 0) return '—';
  return formatRatioLocale(per);
}

function formatPorFromCapAndOp(marketCapWon: number | null, operatingIncomeWon: number | null): string {
  if (marketCapWon == null || !Number.isFinite(marketCapWon)) return '—';
  if (operatingIncomeWon == null || !Number.isFinite(operatingIncomeWon)) return '—';
  if (operatingIncomeWon <= 0) return '적자';
  const por = marketCapWon / operatingIncomeWon;
  if (!Number.isFinite(por) || por <= 0) return '—';
  return formatRatioLocale(por);
}

type OpScenarioUnit = 'jo' | 'eok' | 'cheonman' | 'baekman';

const OP_SCENARIO_UNITS: { id: OpScenarioUnit; label: string }[] = [
  { id: 'jo', label: '조' },
  { id: 'eok', label: '억' },
  { id: 'cheonman', label: '천만' },
  { id: 'baekman', label: '백만' },
];

function parsePositiveAmountString(raw: string): number | null {
  const s = raw.replace(/,/g, '').trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function scenarioAmountToQuarterlyOpEok(amount: number, unit: OpScenarioUnit): number {
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

function parseScenarioToQuarterlyOpEok(raw: string, unit: OpScenarioUnit): number | null {
  const n = parsePositiveAmountString(raw);
  if (n == null) return null;
  return scenarioAmountToQuarterlyOpEok(n, unit);
}

/** 분기 영업이익(억)×4 = 연율 영업이익(원) 기준 POR */
function formatPorFromQuarterlyOpEok(capWon: number | null, quarterlyOpEok: number | null): string {
  if (capWon == null || !Number.isFinite(capWon)) return '—';
  if (quarterlyOpEok == null || !Number.isFinite(quarterlyOpEok)) return '—';
  if (quarterlyOpEok <= 0) return '적자';
  const annualOpWon = quarterlyOpEok * 1e8 * 4;
  const por = capWon / annualOpWon;
  if (!Number.isFinite(por) || por <= 0) return '—';
  return formatRatioLocale(por);
}

function formatCapBadge(periodKey: string, g: 'year' | 'quarter'): string {
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

function yahooLookupFromMockKey(mockKey: string): string {
  const mk = mockKey.trim();
  if (/^\d{6}$/.test(mk)) return mk;
  const withoutSuffix = mk.replace(/\.(US|O|NYSE|NASDAQ)$/i, '');
  return normalizeYahooTickerKey(withoutSuffix);
}

async function resolveUsdKrwRate(): Promise<number> {
  try {
    const q = await getStockQuote('USDKRW=X');
    if (q != null && Number.isFinite(q.price) && q.price > 400 && q.price < 100_000) return q.price;
  } catch {
    /* ignore */
  }
  return FUNDAMENTALS_USD_KRW_RATE;
}

function cellAt(
  grid: DartFundamentalsGrid,
  periodKey: string,
  mockKey: string
): DartCellBundle | undefined {
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

/**
 * 기업실적비교 `capSummaryPeriodKeyByStock`(종목 1개)·`dartCapTableSnapshotPeriodKey` 와 동일:
 * 연도 → 순이익 있는 연 우선, 없으면 매출·영업·순이익 중 하나라도 있는 연.
 * 분기 → 최근 분기 후보 순으로 순이익 우선, 없으면 실적 있는 분기.
 */
function pickSnapshotPeriodKey(
  grid: DartFundamentalsGrid,
  mockKey: string,
  granularity: 'year' | 'quarter',
  latestQuarterCandidates: string[],
  yearPeriodRows: Array<{ periodKey: string }>
): string | null {
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
      if (hasNet(r.periodKey)) return r.periodKey;
    }
    for (const r of yearPeriodRows) {
      if (hasAnyFs(r.periodKey)) return r.periodKey;
    }
    return yearPeriodRows[0]?.periodKey ?? null;
  }
  for (const pk of latestQuarterCandidates) {
    if (hasNet(pk)) return pk;
  }
  for (const pk of latestQuarterCandidates) {
    if (hasAnyFs(pk)) return pk;
  }
  return latestQuarterCandidates[0] ?? null;
}

/** 기업실적비교 `perNetIncomeSearchPeriodKeys` 와 동일 */
function buildPerNetIncomeSearchPeriodKeys(
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

/** 요약 표 `netIncomeWonForPer`와 동일: 스냅샷 분기가 리스트 선두 → 순서대로 탐색 */
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

/** `revenueKrForSummary` 와 동일 */
function resolveRevenueKr(
  grid: DartFundamentalsGrid,
  mockKey: string,
  searchKeys: string[]
): { value: string | null; periodKey: string | null } {
  for (const pk of searchKeys) {
    const r = cellAt(grid, pk, mockKey)?.revenueKr;
    if (r != null && r !== '—') return { value: r, periodKey: pk };
  }
  return { value: null, periodKey: null };
}

/** `operatingIncomeWonForPor` / `operatingIncomeKrForSummary` 와 동일 */
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

/** 스냅샷과 출처 분기가 다를 때 숫자 옆 표시. 해외(Yahoo)는 해당 칸 fsPeriodLabel(from–to) 우선 */
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

function applyFundamentalsSnapshotFromGrid(
  grid: DartFundamentalsGrid,
  mockKey: string,
  granularity: 'year' | 'quarter',
  latestQuarterCandidates: string[],
  yearPeriodRows: Array<{ periodKey: string }>
): {
  snapshotPk: string;
  netIncomeWon: number | null;
  operatingIncomeWon: number | null;
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
  const rev = resolveRevenueKr(grid, mockKey, searchKeys);
  const op = resolveOperatingIncome(grid, mockKey, searchKeys);

  const hasResolved =
    (net.value != null && Number.isFinite(net.value)) ||
    (rev.value != null && rev.value !== '—') ||
    (op.won != null && Number.isFinite(op.won));
  if (!hasResolved) return null;

  const netKr =
    net.value != null && Number.isFinite(net.value) ? formatWonShortKr(net.value) : '—';

  return {
    snapshotPk,
    netIncomeWon: net.value,
    operatingIncomeWon: op.won,
    revenueKr: rev.value ?? '—',
    operatingIncomeKr: op.kr ?? '—',
    netIncomeKr: netKr,
    fsPeriodLabel: cellAt(grid, snapshotPk, mockKey)?.fsPeriodLabel ?? null,
    revenuePeriodSuffix: metricPeriodSuffixFromGrid(grid, mockKey, rev.periodKey, snapshotPk, granularity),
    operatingPeriodSuffix: metricPeriodSuffixFromGrid(grid, mockKey, op.periodKey, snapshotPk, granularity),
    netIncomePeriodSuffix: metricPeriodSuffixFromGrid(grid, mockKey, net.periodKey, snapshotPk, granularity),
  };
}

function marketCapWonFromQuote(q: StockQuote | null, usdKrw: number): number | null {
  if (!q?.marketCap || !Number.isFinite(q.marketCap)) return null;
  const cur = (q.currency || '').toUpperCase();
  if (cur === 'KRW') return q.marketCap;
  return q.marketCap * usdKrw;
}

export default function CapPerPorCalculatorScreen() {
  const [tickerInput, setTickerInput] = useState('');
  const [showStockModal, setShowStockModal] = useState(false);
  const [granularity, setGranularity] = useState<'year' | 'quarter'>('quarter');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mockKeyResolved, setMockKeyResolved] = useState<string | null>(null);
  /** 불러오기 성공 후 표시 — 시세 종목명 우선, 없으면 검색 팝업에서 고른 이름 */
  const [stockDisplayName, setStockDisplayName] = useState<string | null>(null);
  /** 종목 검색 모달에서만 설정; 입력칸 직접 수정 시 초기화 */
  const [pickedOfficialName, setPickedOfficialName] = useState<string | null>(null);
  const [capWon, setCapWon] = useState<number | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [quoteCurrency, setQuoteCurrency] = useState<string>('KRW');
  const [periodKeyUsed, setPeriodKeyUsed] = useState<string | null>(null);
  const [fsPeriodLabel, setFsPeriodLabel] = useState<string | null>(null);
  const [netIncomeWon, setNetIncomeWon] = useState<number | null>(null);
  const [operatingIncomeWon, setOperatingIncomeWon] = useState<number | null>(null);
  /** 요약 카드 — 선택 실적 기간의 매출·영업이익(포맷 문자열), 당기순이익 표시용 */
  const [displayRevenueKr, setDisplayRevenueKr] = useState<string | null>(null);
  const [displayOperatingIncomeKr, setDisplayOperatingIncomeKr] = useState<string | null>(null);
  const [displayNetIncomeKr, setDisplayNetIncomeKr] = useState<string | null>(null);
  /** 스냅샷과 다른 칸에서 채운 경우 숫자 옆 표시(해외는 Yahoo fsPeriodLabel 우선) */
  const [revenuePeriodSuffix, setRevenuePeriodSuffix] = useState<string | null>(null);
  const [operatingPeriodSuffix, setOperatingPeriodSuffix] = useState<string | null>(null);
  const [netIncomePeriodSuffix, setNetIncomePeriodSuffix] = useState<string | null>(null);

  const [scenarioPct, setScenarioPct] = useState('5');

  const [provisionalOpEok, setProvisionalOpEok] = useState('');
  const [provisionalUnit, setProvisionalUnit] = useState<OpScenarioUnit>('jo');
  const [guidanceOpEok, setGuidanceOpEok] = useState('');
  const [guidanceUnit, setGuidanceUnit] = useState<OpScenarioUnit>('jo');

  /** 해외 원화 환산에 쓰는 USD/KRW — 기업실적비교와 동일 출처( USDKRW=X → 실패 시 기본값 ) */
  const [usdKrwApplied, setUsdKrwApplied] = useState(FUNDAMENTALS_USD_KRW_RATE);

  const quarterYearChoices = useMemo(
    () => fundamentalsQuarterYearChoices(new Date(), FUNDAMENTALS_CALENDAR_YEAR_SPAN),
    []
  );
  const yearPeriodRows = useMemo(
    () => buildYearPeriodRowsForChoices(quarterYearChoices),
    [quarterYearChoices]
  );
  const initQuarter = useMemo(
    () => fundamentalsDefaultQuarterWithinChoices(new Date(), quarterYearChoices),
    [quarterYearChoices]
  );
  const [quarterYear] = useState(initQuarter.quarterYear);

  const latestQuarterCandidates = useMemo(() => buildDartLatestQuarterCandidates(new Date(), 12), []);

  const perDenominator = useMemo(
    () => annualizeIncomeForPerPor(netIncomeWon, granularity),
    [netIncomeWon, granularity]
  );
  const porDenominator = useMemo(
    () => annualizeIncomeForPerPor(operatingIncomeWon, granularity),
    [operatingIncomeWon, granularity]
  );

  /** 요약·주가 시나리오 PER/POR가 분기 실적을 어떻게 쓰는지 안내 */
  const perPorBasisFootnote = useMemo(
    () =>
      granularity === 'quarter'
        ? '※ PER·POR는 분기 당기순이익·영업이익을 각각 ×4(연율화)한 금액을 분모로 씁니다.'
        : '※ PER·POR는 연간 당기순이익·영업이익을 분모로 씁니다.',
    [granularity]
  );

  const fsAmountPeriodLabel = granularity === 'quarter' ? '분기' : '연간';

  const scenarioPctNum = useMemo(() => {
    const n = parseFloat(scenarioPct.replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }, [scenarioPct]);

  const scenarioMultiplier = useMemo(() => 1 + scenarioPctNum / 100, [scenarioPctNum]);

  const scenarioCapWon = useMemo(() => {
    if (capWon == null || !Number.isFinite(capWon)) return null;
    return capWon * scenarioMultiplier;
  }, [capWon, scenarioMultiplier]);

  const scenarioPrice = useMemo(() => {
    if (price == null || !Number.isFinite(price)) return null;
    return price * scenarioMultiplier;
  }, [price, scenarioMultiplier]);

  const provisionalQOp = useMemo(
    () => parseScenarioToQuarterlyOpEok(provisionalOpEok, provisionalUnit),
    [provisionalOpEok, provisionalUnit]
  );
  const guidanceQOp = useMemo(
    () => parseScenarioToQuarterlyOpEok(guidanceOpEok, guidanceUnit),
    [guidanceOpEok, guidanceUnit]
  );

  const handleScenarioPctInputChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9.-]/g, '');
    const parts = cleaned.split('.');
    const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
    if (formatted === '' || formatted === '.' || formatted === '-') {
      setScenarioPct(formatted);
      return;
    }
    setScenarioPct(formatted);
  }, []);

  type FetchFundamentalsOpts = {
    /** 모달 선택 직후 state 반영 전에 조회 — 티커 문자열 */
    ticker?: string;
    /** 모달 검색 결과 종목명 — 즉시 표시용 */
    officialNameFromModal?: string | null;
    /** 분기/연도 전환 등 동일 종목만 다시 맞출 때 — 카드가 사라지지 않도록 일부 state 유지 */
    sameTickerGranularityChange?: boolean;
  };

  const fetchFundamentals = useCallback(
    async (opts?: FetchFundamentalsOpts) => {
      const raw = (opts?.ticker ?? tickerInput).trim();
      if (!raw) {
        setError('종목코드 또는 티커를 입력하세요.');
        return;
      }
      const mk = fundamentalsMockKey(raw);
      const domestic = /^\d{6}$/.test(mk);
      const labelFromPicker =
        opts?.officialNameFromModal !== undefined
          ? opts.officialNameFromModal?.trim() || null
          : pickedOfficialName;

      const softRefresh = opts?.sameTickerGranularityChange === true;

      setLoading(true);
      setError(null);
      if (!softRefresh) {
        setMockKeyResolved(null);
        setStockDisplayName(null);
        setCapWon(null);
        setPrice(null);
        setPeriodKeyUsed(null);
        setFsPeriodLabel(null);
        setNetIncomeWon(null);
        setOperatingIncomeWon(null);
        setDisplayRevenueKr(null);
        setDisplayOperatingIncomeKr(null);
        setDisplayNetIncomeKr(null);
        setRevenuePeriodSuffix(null);
        setOperatingPeriodSuffix(null);
        setNetIncomePeriodSuffix(null);
      }

      try {
        const usdKrw = await resolveUsdKrwRate();
        setUsdKrwApplied(usdKrw);
        const yahooSym = yahooLookupFromMockKey(mk);
        const quote = await getStockQuote(yahooSym);
        if (quote != null && Number.isFinite(quote.price) && quote.price > 0) {
          setPrice(quote.price);
          setQuoteCurrency((quote.currency || 'KRW').toUpperCase());
        }

        let cap: number | null = null;
        if (domestic) {
          cap = await fetchDomesticMarketCapWonFromNaver(mk);
          if (cap == null || !Number.isFinite(cap)) {
            cap = marketCapWonFromQuote(quote, usdKrw);
          }
        }

        if (domestic) {
          const apiKey = getDartApiKey();
          if (!apiKey) {
            setError('DART API 키가 없습니다. 국내 종목 실적 조회에 필요합니다.');
            setLoading(false);
            return;
          }
          const periodKeysYear = yearPeriodRows.map((r) => r.periodKey);
          const periodKeysQ = [
            ...new Set([
              ...buildQuarterPeriodRowsForYear(quarterYear).map((r) => r.periodKey),
              ...latestQuarterCandidates,
            ]),
          ];
          const periodKeys = granularity === 'year' ? periodKeysYear : periodKeysQ;

          const grid = await buildDartFundamentalsGrid({
            apiKey,
            domesticTickerKeys: [mk],
            periodKeys,
            granularity,
          });

          const resolved = applyFundamentalsSnapshotFromGrid(
            grid,
            mk,
            granularity,
            latestQuarterCandidates,
            yearPeriodRows
          );
          if (!resolved) {
            setError('해당 종목의 실적 데이터를 찾지 못했습니다.');
            setMockKeyResolved(mk);
            if (cap != null) setCapWon(cap);
            setLoading(false);
            return;
          }

          setNetIncomeWon(resolved.netIncomeWon);
          setOperatingIncomeWon(resolved.operatingIncomeWon);
          setDisplayRevenueKr(resolved.revenueKr);
          setDisplayOperatingIncomeKr(resolved.operatingIncomeKr);
          setDisplayNetIncomeKr(resolved.netIncomeKr);
          setPeriodKeyUsed(resolved.snapshotPk);
          setFsPeriodLabel(resolved.fsPeriodLabel);
          setRevenuePeriodSuffix(resolved.revenuePeriodSuffix);
          setOperatingPeriodSuffix(resolved.operatingPeriodSuffix);
          setNetIncomePeriodSuffix(resolved.netIncomePeriodSuffix);
          setMockKeyResolved(mk);
          if (cap != null) setCapWon(cap);
          const resolvedLabel =
            labelFromPicker || (quote?.name && quote.name.trim()) || null;
          setStockDisplayName(resolvedLabel);
        } else {
          const widenedYearKeys = buildYearPeriodRowsForChoices(
            fundamentalsQuarterYearChoices(new Date(), FUNDAMENTALS_CALENDAR_YEAR_SPAN + 6)
          ).map((r) => r.periodKey);
          const periodKeysForYahoo =
            granularity === 'quarter'
              ? [...new Set([...buildQuarterPeriodRowsForYear(quarterYear).map((r) => r.periodKey), ...buildDartLatestQuarterCandidates(new Date(), 24)])]
              : [...new Set([...widenedYearKeys])];

          const col = await buildYahooFundamentalsGridColumn({
            yahooSymbol: yahooSym,
            mockKey: mk,
            periodKeys: periodKeysForYahoo,
            granularity,
            usdKrwRate: usdKrw,
          });

          const grid = col.grid;

          const resolved = applyFundamentalsSnapshotFromGrid(
            grid,
            mk,
            granularity,
            latestQuarterCandidates,
            yearPeriodRows
          );
          if (!resolved) {
            setError('해당 종목의 실적 데이터를 찾지 못했습니다.');
            setMockKeyResolved(mk);
            setLoading(false);
            return;
          }

          setNetIncomeWon(resolved.netIncomeWon);
          setOperatingIncomeWon(resolved.operatingIncomeWon);
          setDisplayRevenueKr(resolved.revenueKr);
          setDisplayOperatingIncomeKr(resolved.operatingIncomeKr);
          setDisplayNetIncomeKr(resolved.netIncomeKr);
          setPeriodKeyUsed(resolved.snapshotPk);
          setFsPeriodLabel(resolved.fsPeriodLabel);
          setRevenuePeriodSuffix(resolved.revenuePeriodSuffix);
          setOperatingPeriodSuffix(resolved.operatingPeriodSuffix);
          setNetIncomePeriodSuffix(resolved.netIncomePeriodSuffix);
          setMockKeyResolved(mk);

          const resolvedLabel =
            labelFromPicker || (quote?.name && quote.name.trim()) || null;
          setStockDisplayName(resolvedLabel);

          if (col.marketCap != null && Number.isFinite(col.marketCap) && col.marketCap > 0) {
            const cur = (col.currency || 'USD').toUpperCase();
            cap = cur === 'KRW' ? col.marketCap : col.marketCap * usdKrw;
          }
          if (cap == null || !Number.isFinite(cap)) {
            cap = marketCapWonFromQuote(quote, usdKrw);
          }
          setCapWon(cap);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [tickerInput, granularity, quarterYear, latestQuarterCandidates, yearPeriodRows, pickedOfficialName]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await resolveUsdKrwRate();
      if (!cancelled) setUsdKrwApplied(r);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** 기간 단위(분기/연도) 전환 시 이미 불러온 종목이면 실적 그리드·라벨을 다시 맞춤 */
  useEffect(() => {
    if (mockKeyResolved == null) return;
    void fetchFundamentals({
      ticker: mockKeyResolved,
      sameTickerGranularityChange: true,
    });
    // intentional: granularity 외 변경으로는 재조회하지 않음 (mockKeyResolved·fetchFundamentals는 의도적 제외)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granularity]);

  const onPickStockFromModal = useCallback(
    (ticker: string, officialName: string) => {
      const mk = fundamentalsMockKey(ticker);
      const trimmed = officialName.trim() || null;
      setTickerInput(mk);
      setPickedOfficialName(trimmed);
      setShowStockModal(false);
      void fetchFundamentals({ ticker: mk, officialNameFromModal: trimmed });
    },
    [fetchFundamentals]
  );

  const onTickerInputChange = useCallback((text: string) => {
    setTickerInput(text);
    setPickedOfficialName(null);
  }, []);

  const perCurrent = formatPerFromCapAndNet(capWon, perDenominator);
  const porCurrent = formatPorFromCapAndOp(capWon, porDenominator);
  const perScenario = formatPerFromCapAndNet(scenarioCapWon, perDenominator);
  const porScenario = formatPorFromCapAndOp(scenarioCapWon, porDenominator);

  const showResults = mockKeyResolved != null && periodKeyUsed != null;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={['#1e3a5f', '#121212']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroTitle}>시총·PER·POR 계산기</Text>
          <Text style={styles.heroSub}>
            시총과 최신 실적(분기·연) 기준 PER/POR, 주가 시나리오·잠정·가이던스를 함께 봅니다.
          </Text>
        </LinearGradient>

        <Text style={styles.sectionTitle}>기간 단위</Text>
        <View style={styles.periodAndFxRow}>
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, granularity === 'quarter' && styles.chipOn]}
              onPress={() => setGranularity('quarter')}
              activeOpacity={0.85}
            >
              <Text style={[styles.chipText, granularity === 'quarter' && styles.chipTextOn]}>분기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, granularity === 'year' && styles.chipOn]}
              onPress={() => setGranularity('year')}
              activeOpacity={0.85}
            >
              <Text style={[styles.chipText, granularity === 'year' && styles.chipTextOn]}>연도</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.fxPill} accessibilityLabel="적용 달러 환율">
            <Text style={styles.fxPillText} numberOfLines={1}>
              1 USD = {usdKrwApplied.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원
            </Text>
          </View>
        </View>
        <Text style={styles.hint}>
          분기: 최근 분기 실적을 연율화(×4)해 PER/POR. 연도: 최신 연간 실적 그대로. 종목을 이미 불러온 뒤에는 단위만 바꿔도 자동으로 다시 맞춥니다.
        </Text>

        <Text style={styles.sectionTitle}>종목</Text>
        <TouchableOpacity
          style={styles.stockSearchBtn}
          onPress={() => setShowStockModal(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.stockSearchBtnText}>종목 검색 (팝업)</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>
          팝업에서 종목을 고르면 바로 시세·실적을 불러옵니다. 티커만 직접 입력한 경우에는 불러오기를 눌러 주세요.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="예: 005930, AAPL"
          placeholderTextColor="#888"
          value={tickerInput}
          onChangeText={onTickerInputChange}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.primaryBtn} onPress={fetchFundamentals} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>불러오기</Text>}
        </TouchableOpacity>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {showResults ? (
          <>
            <Text style={styles.sectionTitle}>요약</Text>
            <View style={styles.card}>
              <Text style={styles.mono}>{mockKeyResolved}</Text>
              {stockDisplayName ? <Text style={styles.stockNameLine}>{stockDisplayName}</Text> : null}
              <Text style={styles.line}>실적 기준: {periodKeyUsed ? formatCapBadge(periodKeyUsed, granularity) : '—'}</Text>
              {fsPeriodLabel ? <Text style={styles.fsLabel}>{fsPeriodLabel}</Text> : null}
              <Text style={styles.line}>
                현재가:{' '}
                {price != null
                  ? `${quoteCurrency === 'USD' ? '$' : ''}${price.toLocaleString('ko-KR', { maximumFractionDigits: quoteCurrency === 'USD' ? 2 : 0 })}${quoteCurrency === 'USD' ? '' : ' 원'}`
                  : '—'}
              </Text>
              <Text style={styles.line}>
                시가총액:{' '}
                {capWon != null
                  ? formatWonShortKr(capWon, { maxAbsWon: FORMAT_WON_SHORT_KR_MARKET_CAP_MAX_ABS })
                  : '—'}
              </Text>
              <Text style={styles.line}>
                매출 ({fsAmountPeriodLabel}): {displayRevenueKr ?? '—'}
                {revenuePeriodSuffix ? (
                  <Text style={styles.metricPeriodInline}>{` · ${revenuePeriodSuffix}`}</Text>
                ) : null}
              </Text>
              <Text style={styles.line}>
                영업이익 ({fsAmountPeriodLabel}): {displayOperatingIncomeKr ?? '—'}
                {operatingPeriodSuffix ? (
                  <Text style={styles.metricPeriodInline}>{` · ${operatingPeriodSuffix}`}</Text>
                ) : null}
              </Text>
              <Text style={styles.line}>
                당기순이익 ({fsAmountPeriodLabel}): {displayNetIncomeKr ?? '—'}
                {netIncomePeriodSuffix ? (
                  <Text style={styles.metricPeriodInline}>{` · ${netIncomePeriodSuffix}`}</Text>
                ) : null}
              </Text>
              <Text style={styles.perPorNote}>{perPorBasisFootnote}</Text>
              <Text style={styles.emRow}>PER {perCurrent} · POR {porCurrent}</Text>
            </View>

            <Text style={styles.sectionTitle}>주가 시나리오 (%)</Text>
            <Text style={styles.hint}>현재가·시총에 동일 비율 적용(발행주식수 불변 가정). 양수는 상승, 음수는 하락입니다.</Text>
            <View style={styles.percentRow}>
              <TextInput
                style={[styles.input, styles.percentInput]}
                placeholder="예: 5 또는 -5"
                placeholderTextColor="#888"
                keyboardType="numeric"
                value={scenarioPct}
                onChangeText={handleScenarioPctInputChange}
              />
              <TouchableOpacity
                style={styles.signToggleBtn}
                onPress={() => togglePlainPercentSign(scenarioPct, handleScenarioPctInputChange)}
                activeOpacity={0.75}
                accessibilityLabel="부호 바꾸기"
              >
                <Text style={styles.signToggleText}>±</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.card}>
              <Text style={styles.line}>
                목표 주가:{' '}
                {scenarioPrice != null
                  ? `${quoteCurrency === 'USD' ? '$' : ''}${scenarioPrice.toLocaleString('ko-KR', { maximumFractionDigits: quoteCurrency === 'USD' ? 2 : 0 })}`
                  : '—'}
              </Text>
              <Text style={styles.line}>
                시나리오 시총:{' '}
                {scenarioCapWon != null
                  ? formatWonShortKr(scenarioCapWon, { maxAbsWon: FORMAT_WON_SHORT_KR_MARKET_CAP_MAX_ABS })
                  : '—'}
              </Text>
              <Text style={styles.perPorNote}>{perPorBasisFootnote}</Text>
              <Text style={styles.emRow}>
                PER {perScenario} · POR {porScenario}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>잠정 분기 영업이익 ×4 (선택)</Text>
            <Text style={styles.hint}>기업실적비교와 동일: 분기 영업이익 숫자·단위 → 연율화 후 POR만 표시.</Text>
            <View style={styles.unitRow}>
              {OP_SCENARIO_UNITS.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={[styles.unitChip, provisionalUnit === u.id && styles.unitChipOn]}
                  onPress={() => setProvisionalUnit(u.id)}
                >
                  <Text style={[styles.unitChipText, provisionalUnit === u.id && styles.unitChipTextOn]}>{u.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="분기 영업이익"
              placeholderTextColor="#888"
              keyboardType="decimal-pad"
              value={provisionalOpEok}
              onChangeText={setProvisionalOpEok}
            />
            <View style={styles.card}>
              <Text style={styles.line}>현재 시총 기준 POR: {formatPorFromQuarterlyOpEok(capWon, provisionalQOp)}</Text>
              <Text style={styles.line}>시나리오 시총 기준 POR: {formatPorFromQuarterlyOpEok(scenarioCapWon, provisionalQOp)}</Text>
            </View>

            <Text style={styles.sectionTitle}>가이던스 분기 영업이익 ×4 (선택)</Text>
            <View style={styles.unitRow}>
              {OP_SCENARIO_UNITS.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={[styles.unitChip, guidanceUnit === u.id && styles.unitChipOn]}
                  onPress={() => setGuidanceUnit(u.id)}
                >
                  <Text style={[styles.unitChipText, guidanceUnit === u.id && styles.unitChipTextOn]}>{u.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="분기 영업이익"
              placeholderTextColor="#888"
              keyboardType="decimal-pad"
              value={guidanceOpEok}
              onChangeText={setGuidanceOpEok}
            />
            <View style={styles.card}>
              <Text style={styles.line}>현재 시총 기준 POR: {formatPorFromQuarterlyOpEok(capWon, guidanceQOp)}</Text>
              <Text style={styles.line}>시나리오 시총 기준 POR: {formatPorFromQuarterlyOpEok(scenarioCapWon, guidanceQOp)}</Text>
            </View>
          </>
        ) : null}

        <AdmobNativeAd />
      </ScrollView>

      <StockSearchModal
        visible={showStockModal}
        onClose={() => setShowStockModal(false)}
        onSelect={(ticker, officialName) => onPickStockFromModal(ticker, officialName)}
        title="종목 검색"
        placeholder="예: 삼성전자, Apple Inc"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#121212' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  hero: { padding: 20, marginBottom: 8 },
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  heroSub: { marginTop: 8, fontSize: 14, color: '#b0bec5', lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#eceff1', marginHorizontal: 16, marginTop: 16, marginBottom: 8 },
  hint: { fontSize: 12, color: '#78909c', marginHorizontal: 16, marginBottom: 8, lineHeight: 18 },
  periodAndFxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', gap: 10, flexShrink: 0 },
  fxPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#263238',
    borderWidth: 1,
    borderColor: '#455a64',
    maxWidth: '100%',
  },
  fxPillText: { color: '#90caf9', fontSize: 13, fontWeight: '600' },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#263238',
    borderWidth: 1,
    borderColor: '#37474f',
  },
  chipOn: { backgroundColor: '#1565c0', borderColor: '#42a5f5' },
  chipText: { color: '#90a4ae', fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  input: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  percentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  percentInput: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 0,
    marginBottom: 0,
  },
  signToggleBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#263238',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#546e7a',
  },
  signToggleText: {
    color: '#90caf9',
    fontSize: 18,
    fontWeight: '700',
  },
  primaryBtn: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#1976d2',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  stockSearchBtn: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#C62828',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FF8A80',
    minHeight: 48,
  },
  stockSearchBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 16 },
  errorText: { color: '#ef9a9a', marginHorizontal: 16, marginBottom: 8 },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: '#333',
  },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#81d4fa', marginBottom: 6 },
  stockNameLine: { color: '#eceff1', fontSize: 18, marginBottom: 8, fontWeight: '600', letterSpacing: -0.2 },
  line: { color: '#eceff1', marginBottom: 6, fontSize: 15 },
  fsLabel: { color: '#90caf9', fontSize: 13, marginBottom: 8 },
  /** PER/POR 분모(연율화 등) 설명 — emRow 바로 위 */
  perPorNote: {
    color: '#90a4ae',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6,
    marginTop: 2,
  },
  metricPeriodInline: {
    color: '#78909c',
    fontSize: 12,
    fontWeight: '500',
  },
  emRow: { color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 0 },
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 16, marginBottom: 8 },
  unitChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#263238',
    borderWidth: 1,
    borderColor: '#455a64',
  },
  unitChipOn: { backgroundColor: '#37474f', borderColor: '#90caf9' },
  unitChipText: { color: '#b0bec5', fontSize: 13 },
  unitChipTextOn: { color: '#fff', fontWeight: '600' },
});
