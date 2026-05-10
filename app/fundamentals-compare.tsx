import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect, usePathname, useGlobalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAllAccounts, getStocksByAccountId, initDatabase } from '../src/services/DatabaseService';
import { openDefaultPortfolioAddStock } from '../src/navigation/openDefaultPortfolioAddStock';
import type { Stock } from '../src/models/Stock';
import {
  FUNDAMENTALS_USD_KRW_RATE,
  METRIC_TAB_LABELS,
  METRIC_TAB_CHIP_ORDER,
  buildQuarterPeriodRowsForYear,
  buildYearPeriodRowsForChoices,
  fundamentalsDefaultPreviousCalendarQuarter,
  fundamentalsDefaultPreviousCalendarYear,
  fundamentalsDefaultQuarterWithinChoices,
  fundamentalsMockKey,
  fundamentalsPickYearPeriodKeyForTarget,
  fundamentalsQuarterYearChoices,
  FUNDAMENTALS_CALENDAR_YEAR_SPAN,
  buildDartLatestQuarterCandidates,
  type FundamentalsPeriodMetricTab,
  type MockFundamentalsPeriodRow,
} from '../src/data/fundamentalsCompareMock';
import { getDartApiKey, DART_FUNDAMENTALS_DISCLOSURE } from '../src/services/dart/dartConfig';
import { dartTrace } from '../src/services/dart/dartLog';
import {
  buildDartFundamentalsGrid,
  pickDartCellDisplay,
  DART_FUNDAMENTALS_GRID_MAX_PERIOD_KEYS,
  type DartCellBundle,
  type DartFundamentalsGrid,
} from '../src/services/dart/dartFundamentalsGrid';
import {
  FORMAT_WON_SHORT_KR_MARKET_CAP_MAX_ABS,
  formatWonShortKr,
} from '../src/services/dart/dartFormatKr';
import { fetchDomesticMarketCapWonFromNaver } from '../src/services/naverFinanceStock';
import {
  getMultipleStockQuotesBatch,
  getStockQuote,
  normalizeYahooTickerKey,
  type StockQuote,
} from '../src/services/YahooFinanceService';
import { buildYahooFundamentalsGridColumn } from '../src/services/yahooFundamentalsGrid';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SettingsService } from '../src/services/SettingsService';

/** 해외 실적 컬럼 동시 조회 상한 — 무제한 병렬은 Yahoo 차단·메모리 스파이크 위험 */
const YAHOO_FUNDAMENTALS_FOREIGN_CONCURRENCY = 4;

/** Metro·adb logcat에서 `[CAP_PER]`로 필터링 (시총·PER 진단) */
function capPerTrace(message: string, data?: Record<string, unknown>): void {
  if (data !== undefined) {
    console.warn('[CAP_PER]', message, data);
  } else {
    console.warn('[CAP_PER]', message);
  }
}

/** 시총·Yahoo 실적이 같은 초에 각각 환율을 부르면 중복 요청이 되므로 짧게 재사용 */
const FUNDAMENTALS_USD_KRW_CACHE_MS = 90_000;
let fundamentalsUsdKrwRateCache: { value: number; readAtMs: number } | null = null;

/**
 * 네이버 등 원화 시총과 비교 시 차이를 줄이기 위해 Yahoo USD/KRW 스팟(USDKRW=X)을 우선 사용.
 * 실패 시 `EXPO_PUBLIC_USD_KRW_RATE` 또는 기본 1380.
 */
async function resolveFundamentalsUsdKrwRate(): Promise<number> {
  const now = Date.now();
  if (
    fundamentalsUsdKrwRateCache != null &&
    now - fundamentalsUsdKrwRateCache.readAtMs < FUNDAMENTALS_USD_KRW_CACHE_MS
  ) {
    return fundamentalsUsdKrwRateCache.value;
  }
  try {
    const q = await getStockQuote('USDKRW=X');
    if (q != null && Number.isFinite(q.price) && q.price > 400 && q.price < 100_000) {
      fundamentalsUsdKrwRateCache = { value: q.price, readAtMs: now };
      return q.price;
    }
  } catch {
    /* ignore */
  }
  const fallback = FUNDAMENTALS_USD_KRW_RATE;
  fundamentalsUsdKrwRateCache = { value: fallback, readAtMs: now };
  return fallback;
}

/** 매출·영업·순이익 중 하나라도 있으면 ‘채워짐’ */
function dartCellHasFundamentals(b: DartCellBundle | undefined): boolean {
  if (!b) return false;
  return (
    b.revenueKr !== '—' ||
    b.operatingIncomeKr !== '—' ||
    (b.netIncomeWon != null && Number.isFinite(b.netIncomeWon))
  );
}

/**
 * 연도 격자 + 최신분기 오버레이·해외 컬럼 병합.
 * 같은 periodKey·티커가 양쪽에 있으면 **이미 실적이 있는 쪽을 유지** — 오버레이가 빈 DART 응답이면 메인 표 매출·영업이익을 지우지 않음.
 * (티커가 다른 해외 종목 열만 합칠 때는 한쪽에만 있어 그대로 합쳐짐.)
 */
function mergeDartFundamentalsGrids(
  a: DartFundamentalsGrid,
  b: DartFundamentalsGrid
): DartFundamentalsGrid {
  const out: DartFundamentalsGrid = { ...a };
  for (const pk of Object.keys(b)) {
    const ar = out[pk] ?? {};
    const br = b[pk] ?? {};
    const merged: Record<string, DartCellBundle> = { ...ar };
    for (const tk of Object.keys(br)) {
      const left = merged[tk];
      const right = br[tk];
      if (right == null) continue;
      if (left == null) {
        merged[tk] = right;
        continue;
      }
      merged[tk] = dartCellHasFundamentals(left) ? left : right;
    }
    out[pk] = merged;
  }
  return out;
}

/** 분기 연도 칩과 동일 규칙: 스냅샷 연도(보통 올해)면 직전 달력 분기 키, 아니면 해당 연도 Q4 */
function quarterPeriodKeyForChipYear(
  y: number,
  snapshot: ReturnType<typeof fundamentalsDefaultPreviousCalendarQuarter>
): string {
  return y === snapshot.year ? snapshot.periodKey : `${y}Q4`;
}

function initFundamentalsPeriodState(): { periodKey: string; quarterYear: number } {
  const d = new Date();
  const yChoices = fundamentalsQuarterYearChoices(d, FUNDAMENTALS_CALENDAR_YEAR_SPAN);
  const yearRows = buildYearPeriodRowsForChoices(yChoices);
  const yearKey = fundamentalsPickYearPeriodKeyForTarget(
    fundamentalsDefaultPreviousCalendarYear(d),
    yearRows
  );
  const qInit = fundamentalsDefaultQuarterWithinChoices(d, yChoices);
  return { periodKey: yearKey, quarterYear: qInit.quarterYear };
}

function formatFundamentalsMarketCapKr(q: StockQuote | null, usdKrw: number): string {
  if (!q?.marketCap || !Number.isFinite(q.marketCap)) return '—';
  const cur = (q.currency || '').toUpperCase();
  if (cur === 'KRW') return formatWonShortKr(q.marketCap);
  return formatWonShortKr(q.marketCap * usdKrw, {
    maxAbsWon: FORMAT_WON_SHORT_KR_MARKET_CAP_MAX_ABS,
  });
}

function marketCapWonFromQuote(q: StockQuote | null, usdKrw: number): number | null {
  if (!q?.marketCap || !Number.isFinite(q.marketCap)) return null;
  const cur = (q.currency || '').toUpperCase();
  if (cur === 'KRW') return q.marketCap;
  return q.marketCap * usdKrw;
}

/** 네이버 시총 API를 한꺼번에 때리면 느리거나 막힐 수 있어 동시에 최대 n개만 */
async function mapWithConcurrency<T, R>(items: readonly T[], concurrency: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let next = 0;
  const limit = Math.min(Math.max(1, concurrency), items.length);
  const worker = async () => {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      results[idx] = await mapper(items[idx]);
    }
  };
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

/** PER·POR 등 비율 — 정수부 천단위 쉼표 */
function formatRatioLocale(n: number): string {
  const maxFrac = n >= 100 ? 0 : n >= 10 ? 1 : 2;
  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  }).format(n);
}

/** 시가총액(원) ÷ DART 당기순이익(원) — 기간 단위(연/분)에 맞는 기간의 순이익 */
function formatPerFromCapAndNet(marketCapWon: number | null, netIncomeWon: number | null): string {
  if (marketCapWon == null || !Number.isFinite(marketCapWon)) return '—';
  if (netIncomeWon == null || !Number.isFinite(netIncomeWon)) return '—';
  if (netIncomeWon <= 0) return '적자';
  const per = marketCapWon / netIncomeWon;
  if (!Number.isFinite(per) || per <= 0) return '—';
  return formatRatioLocale(per);
}

/** POR(Price to Operating income) = 시가총액(원) ÷ 영업이익(원) */
function formatPorFromCapAndOp(marketCapWon: number | null, operatingIncomeWon: number | null): string {
  if (marketCapWon == null || !Number.isFinite(marketCapWon)) return '—';
  if (operatingIncomeWon == null || !Number.isFinite(operatingIncomeWon)) return '—';
  if (operatingIncomeWon <= 0) return '적자';
  const por = marketCapWon / operatingIncomeWon;
  if (!Number.isFinite(por) || por <= 0) return '—';
  return formatRatioLocale(por);
}

/**
 * 분기 모드: DART 분기 순이익·영업이익을 연율화(×4)한 값으로 PER/POR 분모에 사용.
 * 연도 모드: 연간 실적 그대로.
 */
function annualizeIncomeForPerPor(baseWon: number | null, g: 'year' | 'quarter'): number | null {
  if (baseWon == null || !Number.isFinite(baseWon)) return null;
  if (g === 'year') return baseWon;
  return baseWon * 4;
}

/** 시총·PER 요약 열 — 종목별로 잡힌 실적 기간 표시 */
function formatCapSummaryPeriodBadge(periodKey: string, g: 'year' | 'quarter'): string {
  if (g === 'year') return `${periodKey}년 연`;
  const m = /^(\d{4})Q([1-4])$/.exec(periodKey);
  if (m) return `${m[1]}년 ${m[2]}분기`;
  return periodKey;
}

/** 양수 금액 문자열 (쉼표 허용) */
function parsePositiveAmountString(raw: string): number | null {
  const s = raw.replace(/,/g, '').trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

type OpScenarioUnit = 'jo' | 'eok' | 'cheonman' | 'baekman';

const OP_SCENARIO_UNITS: { id: OpScenarioUnit; label: string }[] = [
  { id: 'jo', label: '조' },
  { id: 'eok', label: '억' },
  { id: 'cheonman', label: '천만' },
  { id: 'baekman', label: '백만' },
];

/** 선택 단위 → 분기 영업이익(억 원). 조=×10000억, 억=그대로, 천만=×0.1억, 백만=×0.01억 */
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

/** 분기 영업이익(억)×4 = 연율 영업이익(원), POR = 시총÷연율영업이익 */
function formatPorFromQuarterlyOpEok(capWon: number | null, quarterlyOpEok: number | null): string {
  if (capWon == null || !Number.isFinite(capWon)) return '—';
  if (quarterlyOpEok == null || !Number.isFinite(quarterlyOpEok)) return '—';
  if (quarterlyOpEok <= 0) return '적자';
  const annualOpWon = quarterlyOpEok * 1e8 * 4;
  const por = capWon / annualOpWon;
  if (!Number.isFinite(por) || por <= 0) return '—';
  return formatRatioLocale(por);
}

const CAP_PER_TABLE_ROWS: { id: 'cap' | 'por' | 'per' | 'net' | 'op' | 'rev'; label: string }[] = [
  { id: 'cap', label: '시가총액' },
  { id: 'por', label: 'POR' },
  { id: 'per', label: 'PER' },
  { id: 'rev', label: '매출' },
  { id: 'op', label: '영업이익' },
  { id: 'net', label: '당기순이익' },
];

interface DedupedStockRow {
  mockKey: string;
  displayTicker: string;
  label: string;
}

/** 저장된 열 순서가 있으면 그 순으로, 나머지·신규 종목은 뒤에 유지 */
function applySavedFundamentalsColumnOrder(rows: DedupedStockRow[], saved: string[] | null): DedupedStockRow[] {
  if (saved == null || saved.length === 0) return rows;
  const byKey = new Map(rows.map((r) => [r.mockKey, r]));
  const out: DedupedStockRow[] = [];
  const used = new Set<string>();
  for (const k of saved) {
    const row = byKey.get(k);
    if (row) {
      out.push(row);
      used.add(k);
    }
  }
  for (const r of rows) {
    if (!used.has(r.mockKey)) out.push(r);
  }
  return out;
}

export default function FundamentalsCompareScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const globalParams = useGlobalSearchParams<{ id?: string | string[] }>();
  const routePortfolioId = Array.isArray(globalParams.id) ? globalParams.id[0] : globalParams.id;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [deduped, setDeduped] = useState<DedupedStockRow[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [granularity, setGranularity] = useState<'year' | 'quarter'>('year');
  const initPeriod = useMemo(() => initFundamentalsPeriodState(), []);
  const [periodKey, setPeriodKey] = useState<string>(() => initPeriod.periodKey);
  const [quarterYear, setQuarterYear] = useState<number>(() => initPeriod.quarterYear);
  const [metricTab, setMetricTab] = useState<FundamentalsPeriodMetricTab>('revenue');

  /** 분기 연도 칩·강조 행 동기화용 (달력 직전 분기) — 시총/PER 실적 분기와 별개 */
  const snapshotQuarterInfo = useMemo(() => fundamentalsDefaultPreviousCalendarQuarter(new Date()), []);
  const latestQuarterCandidates = useMemo(() => buildDartLatestQuarterCandidates(new Date(), 12), []);

  const [dartGrid, setDartGrid] = useState<DartFundamentalsGrid | null>(null);
  const [dartLoading, setDartLoading] = useState(false);
  const [dartError, setDartError] = useState<string | null>(null);
  const [dartLoadTicket, setDartLoadTicket] = useState(0);
  /** 해외 티커 — Yahoo 손익(USD→원 환산) */
  const [yahooGrid, setYahooGrid] = useState<DartFundamentalsGrid | null>(null);
  const [yahooLoading, setYahooLoading] = useState(false);
  const [yahooError, setYahooError] = useState<string | null>(null);
  const [yahooLoadTicket, setYahooLoadTicket] = useState(0);
  /** 시총(국내: 네이버→Yahoo, 해외: Yahoo) 수동 재조회 — 조회 버튼 */
  const [quoteRefreshKey, setQuoteRefreshKey] = useState(0);
  /** 화면에 표시·해외 USD 환산에 쓰는 1USD원화 (Yahoo USDKRW=X → 실패 시 env/기본) */
  const [fundamentalsUsdKrwLive, setFundamentalsUsdKrwLive] = useState(FUNDAMENTALS_USD_KRW_RATE);
  const [marketCapKrByKey, setMarketCapKrByKey] = useState<Record<string, string>>({});
  const [marketCapWonByKey, setMarketCapWonByKey] = useState<Record<string, number | null>>({});
  const [marketCapLoading, setMarketCapLoading] = useState(false);
  /** 잠정·가이던스: 종목별 금액 문자열 + 단위(조·억·천만·백만) */
  const [provisionalOpEokByKey, setProvisionalOpEokByKey] = useState<Record<string, string>>({});
  const [guidanceOpEokByKey, setGuidanceOpEokByKey] = useState<Record<string, string>>({});
  const [provisionalOpUnitByKey, setProvisionalOpUnitByKey] = useState<Record<string, OpScenarioUnit>>({});
  const [guidanceOpUnitByKey, setGuidanceOpUnitByKey] = useState<Record<string, OpScenarioUnit>>({});

  const quarterYearChoices = useMemo(
    () => fundamentalsQuarterYearChoices(new Date(), FUNDAMENTALS_CALENDAR_YEAR_SPAN),
    []
  );

  const yearPeriodRows = useMemo(
    () => buildYearPeriodRowsForChoices(quarterYearChoices),
    [quarterYearChoices]
  );

  const periodRows: MockFundamentalsPeriodRow[] = useMemo(
    () => (granularity === 'year' ? yearPeriodRows : buildQuarterPeriodRowsForYear(quarterYear)),
    [granularity, quarterYear, yearPeriodRows]
  );

  const loadPortfolioStocks = useCallback(async () => {
    setLoading(true);
    try {
      await initDatabase();
      const accounts = await getAllAccounts();
      const byKey = new Map<string, DedupedStockRow>();
      for (const acc of accounts) {
        const stocks: Stock[] = await getStocksByAccountId(acc.id);
        for (const s of stocks) {
          const mockKey = fundamentalsMockKey(s.ticker);
          if (!byKey.has(mockKey)) {
            const label = (s.name || s.officialName || s.ticker).trim() || s.ticker;
            byKey.set(mockKey, {
              mockKey,
              displayTicker: s.ticker,
              label,
            });
          }
        }
      }
      const list = Array.from(byKey.values());
      const savedOrder = await SettingsService.getFundamentalsCompareColumnOrder();
      const ordered = applySavedFundamentalsColumnOrder(list, savedOrder);
      setDeduped(ordered);
      setSelectedKeys(new Set(ordered.map((x) => x.mockKey)));
    } catch (e) {
      console.error('[FundamentalsCompare] 포트폴리오 종목 로드 실패:', e);
      setDeduped([]);
      setSelectedKeys(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPortfolioStocks();
    }, [loadPortfolioStocks])
  );

  const handleAddStock = useCallback(() => {
    openDefaultPortfolioAddStock(router, {
      pathname,
      currentPortfolioId: routePortfolioId != null ? String(routePortfolioId) : null,
    });
  }, [router, pathname, routePortfolioId]);

  useEffect(() => {
    if (granularity === 'year') {
      const rows = buildYearPeriodRowsForChoices(quarterYearChoices);
      const last = rows[rows.length - 1];
      const fromQuarter = /^(\d{4})Q[1-4]$/.exec(periodKey);
      if (fromQuarter) {
        const y = fromQuarter[1];
        if (rows.some((r) => r.periodKey === y)) {
          setPeriodKey(y);
          return;
        }
      }
      if (last && !rows.some((r) => r.periodKey === periodKey)) {
        setPeriodKey(
          fundamentalsPickYearPeriodKeyForTarget(
            fundamentalsDefaultPreviousCalendarYear(new Date()),
            rows
          )
        );
      }
      return;
    }

    if (/^\d{4}$/.test(periodKey)) {
      const y = Number(periodKey);
      if (Number.isFinite(y) && quarterYearChoices.includes(y)) {
        setQuarterYear(y);
        setPeriodKey(quarterPeriodKeyForChipYear(y, snapshotQuarterInfo));
        return;
      }
      const d = new Date();
      const { quarterYear: qy, periodKey: pk } = fundamentalsDefaultQuarterWithinChoices(
        d,
        quarterYearChoices
      );
      setQuarterYear(qy);
      setPeriodKey(pk);
      return;
    }

    const qm = /^(\d{4})Q([1-4])$/.exec(periodKey);
    if (qm) {
      const py = Number(qm[1]);
      if (py !== quarterYear) {
        if (quarterYearChoices.includes(py)) {
          setQuarterYear(py);
        } else {
          const y0 = quarterYearChoices[0] ?? py;
          setQuarterYear(y0);
          setPeriodKey(`${y0}Q${qm[2]}`);
        }
      }
      return;
    }

    const rows = buildQuarterPeriodRowsForYear(quarterYear);
    const last = rows[rows.length - 1];
    if (last && !rows.some((r) => r.periodKey === periodKey)) {
      setPeriodKey(last.periodKey);
    }
  }, [granularity, periodKey, quarterYear, quarterYearChoices, snapshotQuarterInfo]);

  /** 분기 연도 칩만 사용(Q1~Q4 칩 없음) — 같은 해면 직전 달력 분기, 아니면 해당 연도 Q4 */
  const setQuarterYearFromChip = useCallback(
    (y: number) => {
      setQuarterYear(y);
      setPeriodKey(quarterPeriodKeyForChipYear(y, snapshotQuarterInfo));
    },
    [snapshotQuarterInfo]
  );

  const selectedRows = useMemo(
    () => deduped.filter((r) => selectedKeys.has(r.mockKey)),
    [deduped, selectedKeys]
  );

  useEffect(() => {
    const keyList = selectedRows.map((r) => r.mockKey);
    setProvisionalOpEokByKey((prev) => {
      const next: Record<string, string> = {};
      for (const k of keyList) {
        next[k] = prev[k] ?? '';
      }
      return next;
    });
    setGuidanceOpEokByKey((prev) => {
      const next: Record<string, string> = {};
      for (const k of keyList) {
        next[k] = prev[k] ?? '';
      }
      return next;
    });
    setProvisionalOpUnitByKey((prev) => {
      const next: Record<string, OpScenarioUnit> = {};
      for (const k of keyList) {
        next[k] = prev[k] ?? 'jo';
      }
      return next;
    });
    setGuidanceOpUnitByKey((prev) => {
      const next: Record<string, OpScenarioUnit> = {};
      for (const k of keyList) {
        next[k] = prev[k] ?? 'jo';
      }
      return next;
    });
  }, [selectedRows]);

  /**
   * 상단 시총·PER·실적 요약에 쓰는 실적 기준 기간(국내 DART / 해외 Yahoo 손익).
   * 연도 모드 → 표 연도 칩 순서상 가장 최근 연도부터 순이익·실적 매칭.
   * 분기 모드 → 최근 분기 후보 순으로 매칭.
   */
  const dartCapTableSnapshotPeriodKey = useMemo(() => {
    const yearFallback =
      yearPeriodRows[0]?.periodKey ?? String(fundamentalsDefaultPreviousCalendarYear(new Date()));
    const quarterFallback = latestQuarterCandidates[0] ?? '2025Q4';
    if (!dartGrid && !yahooGrid) {
      return granularity === 'year' ? yearFallback : quarterFallback;
    }

    const cellAt = (pk: string, mockKey: string): DartCellBundle | undefined => {
      const dom = /^\d{6}$/.test(mockKey);
      if (dom) return dartGrid?.[pk]?.[mockKey];
      return yahooGrid?.[pk]?.[mockKey];
    };

    const hasNetIncome = (pk: string): boolean => {
      for (const row of selectedRows) {
        const c = cellAt(pk, row.mockKey);
        if (c?.netIncomeWon != null && Number.isFinite(c.netIncomeWon)) return true;
      }
      return false;
    };

    const hasAnyFs = (pk: string): boolean => {
      for (const row of selectedRows) {
        const c = cellAt(pk, row.mockKey);
        if (
          c &&
          (c.revenueKr !== '—' ||
            (c.netIncomeWon != null && Number.isFinite(c.netIncomeWon)) ||
            c.operatingIncomeKr !== '—')
        ) {
          return true;
        }
      }
      return false;
    };

    if (granularity === 'year') {
      for (const r of yearPeriodRows) {
        if (hasNetIncome(r.periodKey)) return r.periodKey;
      }
      for (const r of yearPeriodRows) {
        if (hasAnyFs(r.periodKey)) return r.periodKey;
      }
      return yearFallback;
    }

    for (const pk of latestQuarterCandidates) {
      if (hasNetIncome(pk)) return pk;
    }
    for (const pk of latestQuarterCandidates) {
      if (hasAnyFs(pk)) return pk;
    }
    return quarterFallback;
  }, [dartGrid, yahooGrid, granularity, latestQuarterCandidates, selectedRows, yearPeriodRows]);

  /** 종목별 실적 스냅샷 키 — `dartCapTableSnapshotPeriodKey`와 동일 규칙을 종목 하나에만 적용 */
  const capSummaryPeriodKeyByStock = useMemo(() => {
    const yearFallback =
      yearPeriodRows[0]?.periodKey ?? String(fundamentalsDefaultPreviousCalendarYear(new Date()));
    const quarterFallback = latestQuarterCandidates[0] ?? '2025Q4';

    const cellAt = (pk: string, mockKey: string): DartCellBundle | undefined => {
      const dom = /^\d{6}$/.test(mockKey);
      if (dom) return dartGrid?.[pk]?.[mockKey];
      return yahooGrid?.[pk]?.[mockKey];
    };

    const hasNetIncomeOne = (pk: string, mockKey: string): boolean => {
      const c = cellAt(pk, mockKey);
      return c?.netIncomeWon != null && Number.isFinite(c.netIncomeWon);
    };

    const hasAnyFsOne = (pk: string, mockKey: string): boolean => {
      const c = cellAt(pk, mockKey);
      return !!(
        c &&
        (c.revenueKr !== '—' ||
          (c.netIncomeWon != null && Number.isFinite(c.netIncomeWon)) ||
          c.operatingIncomeKr !== '—')
      );
    };

    const out: Record<string, string> = {};
    for (const row of selectedRows) {
      const mk = row.mockKey;
      if (!dartGrid && !yahooGrid) {
        out[mk] = granularity === 'year' ? yearFallback : quarterFallback;
        continue;
      }
      if (granularity === 'year') {
        let pk: string | null = null;
        for (const r of yearPeriodRows) {
          if (hasNetIncomeOne(r.periodKey, mk)) {
            pk = r.periodKey;
            break;
          }
        }
        if (!pk) {
          for (const r of yearPeriodRows) {
            if (hasAnyFsOne(r.periodKey, mk)) {
              pk = r.periodKey;
              break;
            }
          }
        }
        out[mk] = pk ?? yearFallback;
      } else {
        let pk: string | null = null;
        for (const cand of latestQuarterCandidates) {
          if (hasNetIncomeOne(cand, mk)) {
            pk = cand;
            break;
          }
        }
        if (!pk) {
          for (const cand of latestQuarterCandidates) {
            if (hasAnyFsOne(cand, mk)) {
              pk = cand;
              break;
            }
          }
        }
        out[mk] = pk ?? quarterFallback;
      }
    }
    return out;
  }, [dartGrid, yahooGrid, granularity, latestQuarterCandidates, selectedRows, yearPeriodRows]);

  /** PER 순이익 탐색 순서(연도 모드=최근 연도 우선, 분기=최근 분기 우선) */
  const perNetIncomeSearchPeriodKeys = useMemo(() => {
    if (granularity === 'year') {
      const ys = yearPeriodRows.map((r) => r.periodKey);
      return [...new Set([dartCapTableSnapshotPeriodKey, ...ys])];
    }
    return [...new Set([dartCapTableSnapshotPeriodKey, ...latestQuarterCandidates])];
  }, [
    granularity,
    yearPeriodRows,
    dartCapTableSnapshotPeriodKey,
    latestQuarterCandidates,
  ]);

  const selectedStocksForCapSig = useMemo(
    () =>
      selectedRows
        .map((r) => `${r.mockKey}:${r.displayTicker}`)
        .sort()
        .join('|'),
    [selectedRows]
  );

  /**
   * Yahoo 조회용 심볼. 국내 6자리는 그대로(.KS/.KQ는 getStockQuote에서 처리).
   * 해외는 **mockKey(`fundamentalsMockKey`)**만 사용 — `displayTicker`가 종목명·별칭이면 손익·시총이 전부 실패함.
   */
  const yahooQuoteLookupKey = useCallback((row: DedupedStockRow) => {
    const mk = row.mockKey.trim();
    if (/^\d{6}$/.test(mk)) return mk;
    const withoutSuffix = mk.replace(/\.(US|O|NYSE|NASDAQ)$/i, '');
    return normalizeYahooTickerKey(withoutSuffix);
  }, []);

  useEffect(() => {
    if (selectedRows.length === 0) {
      setMarketCapKrByKey({});
      setMarketCapWonByKey({});
      setMarketCapLoading(false);
      return;
    }
    let cancelled = false;
    setMarketCapLoading(true);
    const domesticYahooKeys = [
      ...new Set(
        selectedRows.filter((r) => /^\d{6}$/.test(r.mockKey)).map((r) => yahooQuoteLookupKey(r))
      ),
    ];
    const domesticKeys = [...new Set(selectedRows.filter((r) => /^\d{6}$/.test(r.mockKey)).map((r) => r.mockKey))];
    capPerTrace('cap_fetch_start', {
      requestKeysDomesticYahoo: domesticYahooKeys,
      domesticKeys,
      note: '국내: 네이버 우선 → 없으면 Yahoo 시세 배치. 해외 시총은 손익 quoteSummary(통합)에서 별도 반영 — 여기서 해외 티커는 배치 제외.',
      rows: selectedRows.map((r) => ({
        mockKey: r.mockKey,
        displayTicker: r.displayTicker,
        yahooLookupKey: yahooQuoteLookupKey(r),
      })),
    });
    void (async () => {
      try {
        const usdKrw = await resolveFundamentalsUsdKrwRate();
        if (cancelled) return;
        setFundamentalsUsdKrwLive(usdKrw);

        const next: Record<string, string> = {};
        const nextWon: Record<string, number | null> = {};

        /** 국내: 네이버 시총이 KRX 기준으로 Yahoo보다 맞는 경우가 많음 → 우선 채움. Yahoo 배치와 동시 실행으로 지연 완화 */
        const naverPhase = async (): Promise<void> => {
          if (domesticKeys.length === 0) return;
          capPerTrace('naver_cap_primary_start', { mockKeys: domesticKeys, concurrency: 3 });
          const pairs = await mapWithConcurrency(domesticKeys, 3, async (mockKey) => {
            const won = await fetchDomesticMarketCapWonFromNaver(mockKey);
            return { mockKey, won } as const;
          });
          for (const { mockKey, won } of pairs) {
            if (won != null && Number.isFinite(won) && won > 0) {
              next[mockKey] = formatWonShortKr(won);
              nextWon[mockKey] = won;
            }
          }
          capPerTrace('naver_cap_primary_done', {
            filled: domesticKeys.filter((k) => nextWon[k] != null && Number.isFinite(nextWon[k] as number)),
          });
        };

        const [batch] = await Promise.all([
          domesticYahooKeys.length > 0
            ? getMultipleStockQuotesBatch(domesticYahooKeys, 6, 80)
            : Promise.resolve(new Map<string, StockQuote | null>()),
          naverPhase(),
        ]);
        if (cancelled) return;

        const byRow: Record<string, unknown>[] = [];
        for (const row of selectedRows) {
          const lookupKey = yahooQuoteLookupKey(row);
          const isDomestic = /^\d{6}$/.test(row.mockKey);
          const q = isDomestic ? batch.get(lookupKey) ?? null : null;
          const hasNaverCap =
            isDomestic &&
            nextWon[row.mockKey] != null &&
            Number.isFinite(nextWon[row.mockKey] as number);

          if (hasNaverCap) {
            byRow.push({
              mockKey: row.mockKey,
              displayTicker: row.displayTicker,
              yahooLookupKey: lookupKey,
              batchHasKey: batch.has(lookupKey),
              quoteOk: q != null,
              price: q?.price,
              currency: q?.currency,
              marketCapRawYahoo: q?.marketCap,
              capDisplayKr: next[row.mockKey],
              capWon: nextWon[row.mockKey],
              capSource: 'naver_primary',
              capMissingReason: null,
            });
            continue;
          }

          if (!isDomestic) {
            /** 해외 시총은 Yahoo 손익 통합 요청에서 `setMarketCap*` 병합 — 여기서 next에 넣으면 레이스로 패치를 지움 */
            byRow.push({
              mockKey: row.mockKey,
              displayTicker: row.displayTicker,
              yahooLookupKey: lookupKey,
              batchHasKey: false,
              quoteOk: null,
              price: null,
              currency: null,
              capDisplayKr: '(yahoo_fs_merge)',
              capWon: null,
              capSource: 'yahoo_fs_pending',
              capMissingReason: 'foreign_cap_filled_with_income_quoteSummary',
            });
            continue;
          }

          next[row.mockKey] = formatFundamentalsMarketCapKr(q, usdKrw);
          nextWon[row.mockKey] = marketCapWonFromQuote(q, usdKrw);
          const capMissingReason =
            q == null
              ? 'quote_null_yahoo_returned_null'
              : q.marketCap == null || !Number.isFinite(q.marketCap)
                ? 'quote_ok_but_no_market_cap_yahoo_fields_empty'
                : null;
          byRow.push({
            mockKey: row.mockKey,
            displayTicker: row.displayTicker,
            yahooLookupKey: lookupKey,
            batchHasKey: batch.has(lookupKey),
            quoteOk: q != null,
            price: q?.price,
            currency: q?.currency,
            marketCapRaw: q?.marketCap,
            capDisplayKr: next[row.mockKey],
            capWon: nextWon[row.mockKey],
            capSource: 'yahoo_after_naver_miss',
            capMissingReason,
            hint:
              capMissingReason != null
                ? 'PER/POR도 시총(원) 없으면 계산 불가. logcat에서 [YAHOO_QUOTE] 동시 확인.'
                : undefined,
          });
        }
        capPerTrace('yahoo_batch_done', {
          mapSize: batch.size,
          note: '국내 시총만 차트·배치. 해외 시총은 Yahoo 손익 통합 요청 후 병합.',
          byRow,
        });

        setMarketCapKrByKey((prev) => {
          const out: Record<string, string> = {};
          for (const row of selectedRows) {
            const k = row.mockKey;
            if (/^\d{6}$/.test(k)) {
              out[k] = next[k] ?? '—';
            } else {
              out[k] = prev[k] ?? '—';
            }
          }
          return out;
        });
        setMarketCapWonByKey((prev) => {
          const out: Record<string, number | null> = {};
          for (const row of selectedRows) {
            const k = row.mockKey;
            if (/^\d{6}$/.test(k)) {
              out[k] = nextWon[k] ?? null;
            } else {
              out[k] = prev[k] ?? null;
            }
          }
          return out;
        });
      } catch (e: unknown) {
        capPerTrace('yahoo_batch_error', {
          message: e instanceof Error ? e.message : String(e),
          requestKeysDomesticYahoo: domesticYahooKeys,
        });
      } finally {
        if (!cancelled) setMarketCapLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedStocksForCapSig, yahooQuoteLookupKey, quoteRefreshKey]);

  /** 시총·PER 표시에 쓰는 값 요약 (adb: `[CAP_PER]` 필터) */
  useEffect(() => {
    if (selectedRows.length === 0) return;

    const rows = selectedRows.map((s) => {
      const k = s.mockKey;
      const isDomestic = /^\d{6}$/.test(k);
      let netIncomeWon: number | null = null;
      let netIncomePeriodKey: string | null = null;
      if (isDomestic && dartGrid) {
        for (const pk of perNetIncomeSearchPeriodKeys) {
          const n = dartGrid[pk]?.[k]?.netIncomeWon;
          if (n != null && Number.isFinite(n)) {
            netIncomeWon = n;
            netIncomePeriodKey = pk;
            break;
          }
        }
      } else if (!isDomestic && yahooGrid) {
        for (const pk of perNetIncomeSearchPeriodKeys) {
          const n = yahooGrid[pk]?.[k]?.netIncomeWon;
          if (n != null && Number.isFinite(n)) {
            netIncomeWon = n;
            netIncomePeriodKey = pk;
            break;
          }
        }
      }
      const capWon = marketCapWonByKey[k] ?? null;
      const capKr = marketCapKrByKey[k] ?? '—';
      let operatingIncomeWon: number | null = null;
      let operatingPeriodKey: string | null = null;
      if (isDomestic && dartGrid) {
        for (const pk of perNetIncomeSearchPeriodKeys) {
          const o = dartGrid[pk]?.[k]?.operatingIncomeWon;
          if (o != null && Number.isFinite(o)) {
            operatingIncomeWon = o;
            operatingPeriodKey = pk;
            break;
          }
        }
      } else if (!isDomestic && yahooGrid) {
        for (const pk of perNetIncomeSearchPeriodKeys) {
          const o = yahooGrid[pk]?.[k]?.operatingIncomeWon;
          if (o != null && Number.isFinite(o)) {
            operatingIncomeWon = o;
            operatingPeriodKey = pk;
            break;
          }
        }
      }
      const netForPer = annualizeIncomeForPerPor(netIncomeWon, granularity);
      const opForPor = annualizeIncomeForPerPor(operatingIncomeWon, granularity);
      const perUi = netForPer != null ? formatPerFromCapAndNet(capWon, netForPer) : '—';
      const porUi = opForPor != null ? formatPorFromCapAndOp(capWon, opForPor) : '—';
      return {
        mockKey: k,
        label: s.label,
        isDomestic,
        capKr,
        capWon,
        dartSnapshotPeriod: dartCapTableSnapshotPeriodKey,
        netIncomeWon,
        netIncomePeriodKey,
        operatingIncomeWon,
        operatingPeriodKey,
        perUi,
        porUi,
      };
    });

    capPerTrace('per_cap_snapshot', {
      granularity,
      marketCapLoading,
      dartGridLoaded: dartGrid != null,
      yahooGridLoaded: yahooGrid != null,
      rows,
    });
  }, [
    selectedStocksForCapSig,
    marketCapLoading,
    marketCapWonByKey,
    marketCapKrByKey,
    dartGrid,
    yahooGrid,
    dartCapTableSnapshotPeriodKey,
    perNetIncomeSearchPeriodKeys,
    granularity,
    selectedRows,
  ]);

  /** 기간(연·분기) 칩·표 범위만 — PER·요약용 DART 스냅샷 기간은 `dartCapTableSnapshotPeriodKey`에서 별도 산정 */
  const dartDataScopeSignature = useMemo(
    () =>
      `${granularity}|${periodRows.map((r) => r.periodKey).join(',')}|${[...selectedKeys].sort().join(',')}`,
    [granularity, periodRows, selectedKeys]
  );

  /** 기간·종목 선택이 바뀌면 그리드 초기화 후 DART·Yahoo 자동 재조회 */
  useEffect(() => {
    setDartGrid(null);
    setDartError(null);
    setYahooGrid(null);
    setYahooError(null);
    setDartLoadTicket((t) => t + 1);
    setYahooLoadTicket((t) => t + 1);
  }, [dartDataScopeSignature]);

  const handleFetchAll = useCallback(() => {
    setQuoteRefreshKey((k) => k + 1);
    setDartLoadTicket((t) => t + 1);
    setYahooLoadTicket((t) => t + 1);
  }, []);

  const dartApiKeyPresent = getDartApiKey().length > 0;
  const hasDomesticSelected = useMemo(
    () => selectedRows.some((r) => /^\d{6}$/.test(r.mockKey)),
    [selectedRows]
  );
  const hasForeignSelected = useMemo(
    () => selectedRows.some((r) => !/^\d{6}$/.test(r.mockKey)),
    [selectedRows]
  );
  const isFundamentalsFetching =
    (dartLoading && dartApiKeyPresent && hasDomesticSelected) ||
    (yahooLoading && hasForeignSelected) ||
    (marketCapLoading && selectedRows.length > 0);

  const dartFetchRef = useRef({
    selectedRows,
    granularity: 'year' as 'year' | 'quarter',
    tablePeriodKeys: [] as string[],
  });
  dartFetchRef.current = {
    selectedRows,
    granularity,
    tablePeriodKeys: periodRows.map((r) => r.periodKey),
  };

  const yahooFetchRef = useRef({
    selectedRows: [] as DedupedStockRow[],
    granularity: 'year' as 'year' | 'quarter',
    tablePeriodKeys: [] as string[],
  });
  yahooFetchRef.current = {
    selectedRows,
    granularity,
    tablePeriodKeys: periodRows.map((r) => r.periodKey),
  };

  useEffect(() => {
    if (dartLoadTicket === 0) return;
    const apiKey = getDartApiKey();
    if (!apiKey) {
      setDartLoading(false);
      return;
    }
    const { selectedRows: sr, granularity: gridGranularity, tablePeriodKeys } = dartFetchRef.current;
    const domesticKeys = sr.map((r) => r.mockKey).filter((k) => /^\d{6}$/.test(k));
    if (domesticKeys.length === 0) {
      setDartLoading(false);
      setDartError(null);
      return;
    }
    let cancelled = false;
    setDartLoading(true);
    setDartError(null);
    const tickerKeys = [...new Set(domesticKeys)];

    const traceDone = (g: DartFundamentalsGrid, label: string) => {
      let filled = 0;
      let cells = 0;
      for (const pk of Object.keys(g)) {
        for (const tk of Object.keys(g[pk])) {
          cells += 1;
          if (g[pk][tk].revenueKr !== '—') filled += 1;
        }
      }
      dartTrace('ui_dart_fetch_ok', { filledRevenueCells: filled, totalCells: cells, label });
    };

    void (async () => {
      try {
        const overlayCandidates = buildDartLatestQuarterCandidates(new Date(), 12);

        /** 실패한 분기 그리드를 누적하지 않음 — 누적 시 빈 칸이 메인 표 동일 기간을 덮어씀 */
        const fetchLatestQuarterOverlay = async (): Promise<DartFundamentalsGrid> => {
          const batchSize = DART_FUNDAMENTALS_GRID_MAX_PERIOD_KEYS;
          for (let start = 0; start < overlayCandidates.length; start += batchSize) {
            if (cancelled) return {};
            const batch = overlayCandidates.slice(start, start + batchSize);
            if (batch.length === 0) break;
            dartTrace('dart_latest_quarter_batch', { periodKeys: batch, start });
            const gridMaybe = await buildDartFundamentalsGrid({
              apiKey,
              domesticTickerKeys: tickerKeys,
              periodKeys: batch,
              granularity: 'quarter',
            });
            for (const pk of batch) {
              const ok = tickerKeys.some((tk) => {
                const b = gridMaybe[pk]?.[tk];
                return (
                  b &&
                  (b.revenueKr !== '—' ||
                    (b.netIncomeWon != null && Number.isFinite(b.netIncomeWon)) ||
                    b.operatingIncomeKr !== '—')
                );
              });
              if (ok) {
                dartTrace('dart_latest_quarter_resolved', { periodKey: pk });
                return { [pk]: gridMaybe[pk] ?? {} };
              }
            }
          }
          return {};
        };

        if (gridGranularity === 'year') {
          dartTrace('ui_dart_fetch_start', {
            tickers: tickerKeys,
            granularity: 'year',
            periodTotal: tablePeriodKeys.length,
            periodsHead: tablePeriodKeys.slice(0, 8),
            note: '연도 표만 + 최신 분기 오버레이(연도와 무관)',
          });
          const gridYear = await buildDartFundamentalsGrid({
            apiKey,
            domesticTickerKeys: tickerKeys,
            periodKeys: tablePeriodKeys,
            granularity: 'year',
          });
          if (cancelled) return;

          const gridLatest = await fetchLatestQuarterOverlay();
          if (cancelled) return;

          const merged = mergeDartFundamentalsGrids(gridYear, gridLatest);
          traceDone(merged, 'year+latestQuarterOverlay');
          setDartGrid(merged);
        } else {
          dartTrace('ui_dart_fetch_start', {
            tickers: tickerKeys,
            granularity: 'quarter',
            periodTotal: tablePeriodKeys.length,
            periodsHead: tablePeriodKeys.slice(0, 8),
            note: '분기 표만 + 최신 분기 오버레이(보조)',
          });
          const gridTable = await buildDartFundamentalsGrid({
            apiKey,
            domesticTickerKeys: tickerKeys,
            periodKeys: tablePeriodKeys,
            granularity: 'quarter',
          });
          if (cancelled) return;

          const gridLatest = await fetchLatestQuarterOverlay();
          if (cancelled) return;

          const merged = mergeDartFundamentalsGrids(gridTable, gridLatest);
          traceDone(merged, 'quarter+latestQuarterOverlay');
          setDartGrid(merged);
        }
        if (!cancelled) setDartLoading(false);
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          dartTrace('ui_dart_fetch_catch', { message: msg });
          setDartError(msg);
          setDartGrid(null);
          setDartLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      setDartLoading(false);
    };
  }, [dartLoadTicket]);

  useEffect(() => {
    if (yahooLoadTicket === 0) return;
    const { selectedRows: sr, granularity: g, tablePeriodKeys: pks } = yahooFetchRef.current;
    const foreign = sr.filter((r) => !/^\d{6}$/.test(r.mockKey));
    if (foreign.length === 0) {
      setYahooGrid(null);
      setYahooLoading(false);
      setYahooError(null);
      return;
    }
    let cancelled = false;
    setYahooLoading(true);
    setYahooError(null);
    void (async () => {
      try {
        const usdKrw = await resolveFundamentalsUsdKrwRate();
        if (cancelled) return;
        setFundamentalsUsdKrwLive(usdKrw);

        /** 분기: 표 기간 + 최근 분기 후보. 연: 표 연도 + 더 과거 연도(회계연도·상장주 매칭 여유) */
        const widenedYearKeys = buildYearPeriodRowsForChoices(
          fundamentalsQuarterYearChoices(new Date(), FUNDAMENTALS_CALENDAR_YEAR_SPAN + 6)
        ).map((r) => r.periodKey);
        const periodKeysForYahoo =
          g === 'quarter'
            ? [...new Set([...pks, ...buildDartLatestQuarterCandidates(new Date(), 24)])]
            : [...new Set([...pks, ...widenedYearKeys])];
        /** 한 종목 실패 시 전체 Yahoo 그리드가 비지 않도록 개별 처리(순서 유지·동시성 제한) */
        const settled = await mapWithConcurrency(foreign, YAHOO_FUNDAMENTALS_FOREIGN_CONCURRENCY, async (row) => {
          try {
            const value = await buildYahooFundamentalsGridColumn({
              yahooSymbol: yahooQuoteLookupKey(row),
              mockKey: row.mockKey,
              periodKeys: periodKeysForYahoo,
              granularity: g,
              usdKrwRate: usdKrw,
            });
            return { status: 'fulfilled' as const, value };
          } catch (reason) {
            return { status: 'rejected' as const, reason };
          }
        });
        if (cancelled) return;
        let merged: DartFundamentalsGrid = {};
        const capKrPatch: Record<string, string> = {};
        const capWonPatch: Record<string, number | null> = {};
        settled.forEach((result, i) => {
          const row = foreign[i];
          if (result.status === 'rejected') {
            capPerTrace('yahoo_fundamentals_column_failed', {
              mockKey: row.mockKey,
              symbol: yahooQuoteLookupKey(row),
              message: result.reason instanceof Error ? result.reason.message : String(result.reason),
            });
            return;
          }
          const col = result.value;
          merged = mergeDartFundamentalsGrids(merged, col.grid);
          if (col.marketCap != null && Number.isFinite(col.marketCap) && col.marketCap > 0) {
            const cur = (col.currency || 'USD').toUpperCase();
            const won = cur === 'KRW' ? col.marketCap : col.marketCap * usdKrw;
            capKrPatch[col.mockKey] = formatWonShortKr(won, {
              maxAbsWon: FORMAT_WON_SHORT_KR_MARKET_CAP_MAX_ABS,
            });
            capWonPatch[col.mockKey] = won;
          }
        });
        if (!cancelled) {
          setYahooGrid(merged);
          if (Object.keys(capKrPatch).length > 0) {
            setMarketCapKrByKey((prev) => ({ ...prev, ...capKrPatch }));
            setMarketCapWonByKey((prev) => ({ ...prev, ...capWonPatch }));
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setYahooError(e instanceof Error ? e.message : String(e));
          setYahooGrid(null);
        }
      } finally {
        if (!cancelled) setYahooLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      setYahooLoading(false);
    };
  }, [yahooLoadTicket, yahooQuoteLookupKey]);

  const displayCell = useCallback(
    (tab: FundamentalsPeriodMetricTab, row: MockFundamentalsPeriodRow, mockKey: string): string => {
      const isDomestic = /^\d{6}$/.test(mockKey);
      const grid = isDomestic ? dartGrid : yahooGrid;
      if (!grid) return '—';

      const tryPick = (bundle: DartCellBundle | undefined) => pickDartCellDisplay(tab, bundle);
      /** 아래 시총·PER·POR 요약 표와 동일: 해당 행 기간 우선, 비면 `perNetIncomeSearchPeriodKeys`로 폴백 */
      const periodKeysForMetric =
        tab === 'revenue' || tab === 'operatingIncome' || tab === 'netIncome'
          ? [row.periodKey, ...perNetIncomeSearchPeriodKeys.filter((pk) => pk !== row.periodKey)]
          : [row.periodKey];

      for (const pk of periodKeysForMetric) {
        const s = tryPick(grid[pk]?.[mockKey]);
        if (s !== '—') return s;
      }
      return '—';
    },
    [dartGrid, yahooGrid, perNetIncomeSearchPeriodKeys]
  );

  const capPerTableCell = useCallback(
    (rowId: 'cap' | 'por' | 'per' | 'net' | 'op' | 'rev', s: DedupedStockRow): string => {
      const k = s.mockKey;
      const isDomestic = /^\d{6}$/.test(k);
      const dCell = isDomestic
        ? dartGrid?.[dartCapTableSnapshotPeriodKey]?.[k]
        : yahooGrid?.[dartCapTableSnapshotPeriodKey]?.[k];
      const capWon = marketCapWonByKey[k] ?? null;

      /** 상단 요약 표 제목의 기준 분기·연도와 같은 칸(`dartCapTableSnapshotPeriodKey`)을 우선 — 예전엔 순이익만 다른 분기를 집어와 매출·영업과 불일치했음 */
      const netIncomeWonForPer = (): number | null => {
        const snap = dCell?.netIncomeWon;
        if (snap != null && Number.isFinite(snap)) return snap;
        if (isDomestic) {
          if (!dartGrid) return null;
          for (const pk of perNetIncomeSearchPeriodKeys) {
            const n = dartGrid[pk]?.[k]?.netIncomeWon;
            if (n != null && Number.isFinite(n)) return n;
          }
          return null;
        }
        if (!yahooGrid) return null;
        for (const pk of perNetIncomeSearchPeriodKeys) {
          const n = yahooGrid[pk]?.[k]?.netIncomeWon;
          if (n != null && Number.isFinite(n)) return n;
        }
        return null;
      };

      const operatingIncomeWonForPor = (): number | null => {
        const snap = dCell?.operatingIncomeWon;
        if (snap != null && Number.isFinite(snap)) return snap;
        if (isDomestic) {
          if (!dartGrid) return null;
          for (const pk of perNetIncomeSearchPeriodKeys) {
            const o = dartGrid[pk]?.[k]?.operatingIncomeWon;
            if (o != null && Number.isFinite(o)) return o;
          }
          return null;
        }
        if (!yahooGrid) return null;
        for (const pk of perNetIncomeSearchPeriodKeys) {
          const o = yahooGrid[pk]?.[k]?.operatingIncomeWon;
          if (o != null && Number.isFinite(o)) return o;
        }
        return null;
      };

      /** 스냅샷 한 칸만 보면 해외·국내 중 한쪽만 채워진 분기로 잡혀 반대쪽 매출·영업 문자열이 비는 경우가 있음 → 순이익과 같은 기간 탐색 순서로 폴백 */
      const revenueKrForSummary = (): string => {
        const snap = dCell?.revenueKr;
        if (snap != null && snap !== '—') return snap;
        if (isDomestic) {
          if (!dartGrid) return '—';
          for (const pk of perNetIncomeSearchPeriodKeys) {
            const r = dartGrid[pk]?.[k]?.revenueKr;
            if (r != null && r !== '—') return r;
          }
          return '—';
        }
        if (!yahooGrid) return '—';
        for (const pk of perNetIncomeSearchPeriodKeys) {
          const r = yahooGrid[pk]?.[k]?.revenueKr;
          if (r != null && r !== '—') return r;
        }
        return '—';
      };

      const operatingIncomeKrForSummary = (): string => {
        const snap = dCell?.operatingIncomeKr;
        if (snap != null && snap !== '—') return snap;
        if (isDomestic) {
          if (!dartGrid) return '—';
          for (const pk of perNetIncomeSearchPeriodKeys) {
            const o = dartGrid[pk]?.[k]?.operatingIncomeKr;
            if (o != null && o !== '—') return o;
          }
          return '—';
        }
        if (!yahooGrid) return '—';
        for (const pk of perNetIncomeSearchPeriodKeys) {
          const o = yahooGrid[pk]?.[k]?.operatingIncomeKr;
          if (o != null && o !== '—') return o;
        }
        return '—';
      };

      switch (rowId) {
        case 'cap':
          return marketCapLoading && selectedRows.length > 0 ? '불러오는 중…' : (marketCapKrByKey[k] ?? '—');
        case 'por': {
          const opWon = annualizeIncomeForPerPor(operatingIncomeWonForPor(), granularity);
          return opWon != null ? formatPorFromCapAndOp(capWon, opWon) : '—';
        }
        case 'per': {
          const net = annualizeIncomeForPerPor(netIncomeWonForPer(), granularity);
          return net != null ? formatPerFromCapAndNet(capWon, net) : '—';
        }
        case 'net': {
          const net = netIncomeWonForPer();
          if (net == null || !Number.isFinite(net)) return '—';
          return formatWonShortKr(net);
        }
        case 'op':
          return operatingIncomeKrForSummary();
        case 'rev':
          return revenueKrForSummary();
        default:
          return '—';
      }
    },
    [
      dartGrid,
      yahooGrid,
      marketCapKrByKey,
      marketCapLoading,
      marketCapWonByKey,
      selectedRows.length,
      dartCapTableSnapshotPeriodKey,
      perNetIncomeSearchPeriodKeys,
      granularity,
    ]
  );

  /** 기간별 비교 표 제목 (구체 연·분기는 표 안 행·분기 연도 칩에서 보임) */
  const periodTableTitle =
    granularity === 'quarter'
      ? `${quarterYear}년 분기별`
      : `연도별(최근 ${FUNDAMENTALS_CALENDAR_YEAR_SPAN}년)`;

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size <= 1) return next;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleResetFundamentalsColumnOrder = useCallback(async () => {
    await SettingsService.clearFundamentalsCompareColumnOrder();
    await loadPortfolioStocks();
  }, [loadPortfolioStocks]);

  const moveDedupedRow = useCallback((fromIndex: number, toIndex: number) => {
    setDeduped((prev) => {
      if (toIndex < 0 || toIndex >= prev.length || fromIndex === toIndex) return prev;
      const next = [...prev];
      const [row] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, row);
      void SettingsService.setFundamentalsCompareColumnOrder(next.map((r) => r.mockKey));
      return next;
    });
  }, []);

  return (
    <GestureHandlerRootView style={styles.flexOne}>
      <View style={styles.root}>
      <LinearGradient colors={['#000000', '#121212', '#1A1A1A']} style={StyleSheet.absoluteFill} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.banner, { marginTop: insets.top + 8 }]}>
          <Text style={styles.bannerTitle}>실적·시총 조회</Text>
          <View style={styles.bannerFxChip}>
            <Text style={styles.bannerFxChipLabel}>적용 환율</Text>
            <Text style={styles.bannerFxChipValue}>
              1 USD ={' '}
              {fundamentalsUsdKrwLive.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원
            </Text>
            <Text style={styles.bannerFxChipSource}>Yahoo USDKRW=X · 조회 시 갱신</Text>
          </View>
          <Text style={styles.bannerSub}>
            {dartApiKeyPresent
              ? '국내(6자리) 실적은 DART, 미국 등 해외는 Yahoo Finance 손익(USD→원)입니다. 시총은 국내 6자리는 네이버 우선·없으면 Yahoo, 해외는 Yahoo. PER·POR은 연·분기 모드 규칙은 아래 힌트와 같습니다. 기간·종목을 바꾸면 자동으로 다시 불러옵니다.'
              : '국내 실적(DART)은 DART_API_KEY가 필요합니다. 해외 실적·시총은 Yahoo를 사용합니다.'}
          </Text>
          <TouchableOpacity
            style={[styles.primaryFetchBtn, isFundamentalsFetching && styles.dartLoadBtnDisabled]}
            onPress={handleFetchAll}
            disabled={isFundamentalsFetching || selectedRows.length === 0}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryFetchBtnText}>
              {isFundamentalsFetching ? '조회 중…' : '조회'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>
            비교 종목 (전 포트폴리오 합집합 · 중복 제거)
          </Text>
          <View style={styles.sectionHeaderActions}>
            <TouchableOpacity
              style={styles.resetOrderBtn}
              onPress={() => void handleResetFundamentalsColumnOrder()}
              activeOpacity={0.85}
            >
              <Text style={styles.resetOrderBtnText}>순서 초기화</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addStockBtn} onPress={handleAddStock} activeOpacity={0.85}>
              <Text style={styles.addStockBtnText}>+ 종목 추가</Text>
            </TouchableOpacity>
          </View>
        </View>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#42A5F5" />
            <Text style={styles.loadingText}>종목 불러오는 중…</Text>
          </View>
        ) : deduped.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>등록된 종목이 없습니다</Text>
            <Text style={styles.emptySub}>포트폴리오에 종목을 추가하면 여기에 표시됩니다.</Text>
            <TouchableOpacity style={styles.addStockBtnLarge} onPress={handleAddStock} activeOpacity={0.85}>
              <Text style={styles.addStockBtnLargeText}>종목 추가하러 가기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.compareOrderHint}>
              왼쪽 체크로 표에 포함할 종목을 고르고, 오른쪽 ↑↓ 옆에서 맨 위·맨 아래로 순서를 바꿉니다. 순서는 저장됩니다.
            </Text>
            <View style={styles.checkList}>
              {deduped.map((item, index) => {
                const on = selectedKeys.has(item.mockKey);
                return (
                  <View key={item.mockKey} style={styles.checkRow}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.checkRowMain,
                        pressed && { opacity: 0.88 },
                      ]}
                      onPress={() => toggleKey(item.mockKey)}
                    >
                      <View style={[styles.checkbox, on && styles.checkboxOn]}>
                        {on ? <Text style={styles.checkMark}>✓</Text> : null}
                      </View>
                      <View style={styles.checkTextCol}>
                        <Text style={styles.checkLabel} numberOfLines={1}>
                          {item.label}
                        </Text>
                        <Text style={styles.checkTicker} numberOfLines={1}>
                          {item.displayTicker}
                        </Text>
                      </View>
                    </Pressable>
                    <View style={styles.reorderStepper}>
                      <View style={styles.reorderArrowsCol}>
                        <TouchableOpacity
                          style={[styles.reorderStepBtn, index === 0 && styles.reorderStepBtnDisabled]}
                          onPress={() => moveDedupedRow(index, index - 1)}
                          disabled={index === 0}
                          accessibilityLabel="한 칸 위로"
                          activeOpacity={0.75}
                        >
                          <Text style={styles.reorderStepBtnText}>↑</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.reorderStepBtn,
                            index >= deduped.length - 1 && styles.reorderStepBtnDisabled,
                          ]}
                          onPress={() => moveDedupedRow(index, index + 1)}
                          disabled={index >= deduped.length - 1}
                          accessibilityLabel="한 칸 아래로"
                          activeOpacity={0.75}
                        >
                          <Text style={styles.reorderStepBtnText}>↓</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.reorderJumpCol}>
                        <TouchableOpacity
                          style={[styles.reorderJumpBtn, index === 0 && styles.reorderStepBtnDisabled]}
                          onPress={() => moveDedupedRow(index, 0)}
                          disabled={index === 0}
                          accessibilityLabel="맨 위로"
                          activeOpacity={0.75}
                        >
                          <Text style={styles.reorderJumpBtnText}>맨 위</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.reorderJumpBtn,
                            index >= deduped.length - 1 && styles.reorderStepBtnDisabled,
                          ]}
                          onPress={() => moveDedupedRow(index, deduped.length - 1)}
                          disabled={index >= deduped.length - 1}
                          accessibilityLabel="맨 아래로"
                          activeOpacity={0.75}
                        >
                          <Text style={styles.reorderJumpBtnText}>맨 아래</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {!dartApiKeyPresent ? (
          <Text style={styles.dartHintMuted}>
            `.env`에 DART_API_KEY를 넣으면 국내 매출·이익 등이 표시됩니다.
          </Text>
        ) : !hasDomesticSelected ? (
          <Text style={styles.dartHintMuted}>
            국내(6자리)는 DART·미국 등 티커는 Yahoo 손익이 표에 반영됩니다.
          </Text>
        ) : null}

        <Text style={styles.fxLine}>
          해외 시총·손익 원화는 상단 적용 환율 기준입니다. Yahoo 조회 실패 시 EXPO_PUBLIC_USD_KRW_RATE·기본 1380.
        </Text>
        {dartApiKeyPresent ? <Text style={styles.fxLine}>{DART_FUNDAMENTALS_DISCLOSURE}</Text> : null}
        {dartError ? <Text style={styles.dartErrorLine}>DART: {dartError}</Text> : null}
        {yahooError ? <Text style={styles.dartErrorLine}>Yahoo 실적: {yahooError}</Text> : null}

        <Text style={styles.sectionTitle}>기간 단위</Text>
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, granularity === 'year' && styles.chipOn]}
            onPress={() => {
              if (granularity === 'year') return;
              setGranularity('year');
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.chipText, granularity === 'year' && styles.chipTextOn]}>연도</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, granularity === 'quarter' && styles.chipOn]}
            onPress={() => {
              if (granularity === 'quarter') return;
              const choices = fundamentalsQuarterYearChoices(new Date(), FUNDAMENTALS_CALENDAR_YEAR_SPAN);
              setGranularity('quarter');
              const yFromYearMode = /^(\d{4})$/.exec(periodKey);
              if (yFromYearMode) {
                const y = Number(yFromYearMode[1]);
                if (Number.isFinite(y) && choices.includes(y)) {
                  setQuarterYear(y);
                  setPeriodKey(quarterPeriodKeyForChipYear(y, snapshotQuarterInfo));
                  return;
                }
              }
              const next = fundamentalsDefaultQuarterWithinChoices(new Date(), choices);
              setQuarterYear(next.quarterYear);
              setPeriodKey(next.periodKey);
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.chipText, granularity === 'quarter' && styles.chipTextOn]}>분기</Text>
          </TouchableOpacity>
        </View>

        {granularity === 'quarter' ? (
          <>
            <Text style={styles.sectionTitle}>분기 연도</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.periodScroll}
            >
              {quarterYearChoices.map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.periodChip, quarterYear === y && styles.periodChipOn]}
                  onPress={() => setQuarterYearFromChip(y)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.periodChipText, quarterYear === y && styles.periodChipTextOn]}>
                    {y}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        ) : null}

        {!loading && deduped.length > 0 && selectedRows.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>지표</Text>
            <Text style={styles.metricSectionSub}>
              기간별 표에 적용 · 아래 시총 요약과 별개. 해외(Yahoo)는 달력 분기·연도 칸 + 숫자 아래 공시 기간(FROM ~ TO).
            </Text>
            <View style={styles.metricTabs}>
              {METRIC_TAB_CHIP_ORDER.map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.metricTab, metricTab === tab && styles.metricTabOn]}
                  onPress={() => setMetricTab(tab)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.metricTabText, metricTab === tab && styles.metricTabTextOn]}>
                    {METRIC_TAB_LABELS[tab]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <>
              <Text style={styles.sectionTitle}>{periodTableTitle}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator
                style={[styles.tableScroll, granularity === 'year' ? styles.periodTableScrollYearRows : null]}
              >
                <View style={styles.tableInner}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.th, styles.thPeriod]}>기간</Text>
                    {selectedRows.map((s) => (
                      <Text key={s.mockKey} style={[styles.th, styles.thStock]} numberOfLines={2}>
                        {s.label}
                      </Text>
                    ))}
                  </View>
                  {periodRows.map((r) => (
                    <View
                      key={r.periodKey}
                      style={[styles.tableBodyRow, r.periodKey === periodKey && styles.tableBodyRowHighlight]}
                    >
                      <Text style={[styles.td, styles.thPeriod]}>{r.label}</Text>
                      {selectedRows.map((s) => {
                        const dom = /^\d{6}$/.test(s.mockKey);
                        const bundle = dom
                          ? dartGrid?.[r.periodKey]?.[s.mockKey]
                          : yahooGrid?.[r.periodKey]?.[s.mockKey];
                        const fsHint =
                          !dom && bundle?.fsPeriodLabel && bundle.fsPeriodLabel.length > 0
                            ? bundle.fsPeriodLabel
                            : null;
                        return (
                          <View key={`${r.periodKey}-${s.mockKey}`} style={[styles.thStock, styles.fsPeriodCellWrap]}>
                            <Text style={[styles.td, styles.fsPeriodCellValue]}>{displayCell(metricTab, r, s.mockKey)}</Text>
                            {fsHint != null ? (
                              <Text style={styles.fsPeriodCellHint} numberOfLines={3}>
                                {fsHint}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>
              <Text style={styles.tableHint}>
                가로로 스크롤하여 열을 확인할 수 있습니다. 이 표만 연·분기 단위가 적용됩니다. 해외 종목은 행 라벨이 달력 분기·연도이며, 숫자 아래는 Yahoo 공시 구간입니다. 기간·종목 변경 또는 「조회」 시 최신 데이터가 반영됩니다.
              </Text>
            </>

            <Text style={styles.sectionTitle}>시총·PER·실적 요약</Text>
            <Text style={styles.capSummaryCalcMode}>
              {granularity === 'year'
                ? '연도 단위: 매출·영업이익·당기순이익은 연 실적(종목별 최근 연도). PER·POR 분모도 같은 연간 영업이익·당기순이익.'
                : '분기 단위: 매출·영업·순이익 행은 해당 분기 금액. PER·POR 분모는 분기 이익×4(연율).'}
            </Text>
            <Text style={styles.metricSectionSub}>
              열마다 실적 기준을 표시합니다. 해외는 Yahoo가 주는 시작·종료일이 있으면 FROM ~ TO, 없으면 ~ 종료일 또는 연·분기 키입니다.
              {hasForeignSelected ? ' 해외 Yahoo' : ''}
              {hasDomesticSelected ? ' · 국내 DART' : ''}
            </Text>
            <Text style={styles.capSummaryGlossary}>
              · PER(주가수익비율): 시가총액을 당기순이익으로 나눈 값. 이 표는 시총÷당기순이익(원화)이며, 분모 이익은 위 연·분기 규칙과 같습니다.{'\n'}
              · POR: 시가총액을 영업이익으로 나눈 값(이 화면에서 시총÷영업이익, 원화). PER은 순이익, POR은 영업이익 기준으로 ‘몇 배 밸류’인지 볼 때 쓰는 지표입니다.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
              <View style={styles.tableInner}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.th, styles.thLabel]}>항목</Text>
                  {selectedRows.map((s) => (
                    <View key={s.mockKey} style={[styles.th, styles.thStock, styles.capSummaryStockHead]}>
                      <Text style={styles.capSummaryStockName} numberOfLines={2}>
                        {s.label}
                      </Text>
                      <Text style={styles.capSummaryStockPeriod} numberOfLines={4}>
                        {(() => {
                          const pk = capSummaryPeriodKeyByStock[s.mockKey];
                          if (pk == null) return '—';
                          const dom = /^\d{6}$/.test(s.mockKey);
                          const yahooLabel = !dom ? yahooGrid?.[pk]?.[s.mockKey]?.fsPeriodLabel : undefined;
                          if (typeof yahooLabel === 'string' && yahooLabel.length > 0) {
                            return yahooLabel;
                          }
                          return formatCapSummaryPeriodBadge(pk, granularity);
                        })()}
                      </Text>
                    </View>
                  ))}
                </View>
                {CAP_PER_TABLE_ROWS.map((rowDef) => (
                  <View key={rowDef.id} style={styles.tableBodyRow}>
                    <Text style={[styles.td, styles.thLabel]}>{rowDef.label}</Text>
                    {selectedRows.map((s) => (
                      <Text key={`${rowDef.id}-${s.mockKey}`} style={[styles.td, styles.thStock]}>
                        {capPerTableCell(rowDef.id, s)}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
            <Text style={styles.tableHint}>
              {granularity === 'year'
                ? '시총은 Yahoo(조회 시점). 이익 분모는 국내=DART·해외=Yahoo 손익을 원화 환산한 값입니다. POR=시총÷연간 영업이익, PER=시총÷연간 당기순이익.'
                : '시총은 Yahoo(조회 시점). PER·POR은 분기 이익×4(연율). 이익은 국내 DART·해외 Yahoo 손익(원화).「영업이익」「당기순이익」행은 해당 분기 금액.'}
            </Text>

            <Text style={styles.sectionTitle}>잠정 분기 실적 ×4 환산 실적</Text>
            <Text style={styles.scenarioSub}>
              잠정(다음 분기) 분기 영업이익 숫자를 입력하고 조·억·천만·백만 단위를 고르세요. (×4 연율)÷현재 시총으로 POR을 봅니다. 매출·당기순이익은 사용하지 않습니다.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
              <View style={styles.tableInner}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.th, styles.thScenarioLabel]}>항목</Text>
                  {selectedRows.map((s) => (
                    <Text
                      key={`prov-h-${s.mockKey}`}
                      style={[styles.th, styles.thStock, styles.scenarioStockCol]}
                      numberOfLines={2}
                    >
                      {s.label}
                    </Text>
                  ))}
                </View>
                <View style={styles.tableBodyRow}>
                  <Text style={[styles.td, styles.thScenarioLabel]}>분기 영업이익</Text>
                  {selectedRows.map((s) => (
                    <View key={`prov-op-${s.mockKey}`} style={[styles.thStock, styles.scenarioStockCol]}>
                      <View style={styles.unitGrid}>
                        {OP_SCENARIO_UNITS.map((u) => {
                          const on = (provisionalOpUnitByKey[s.mockKey] ?? 'jo') === u.id;
                          return (
                            <TouchableOpacity
                              key={u.id}
                              style={[styles.unitChip, on && styles.unitChipOn]}
                              onPress={() =>
                                setProvisionalOpUnitByKey((p) => ({ ...p, [s.mockKey]: u.id }))
                              }
                              activeOpacity={0.85}
                            >
                              <Text style={[styles.unitChipText, on && styles.unitChipTextOn]}>
                                {u.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <TextInput
                        style={styles.scenarioInput}
                        value={provisionalOpEokByKey[s.mockKey] ?? ''}
                        onChangeText={(t) =>
                          setProvisionalOpEokByKey((p) => ({ ...p, [s.mockKey]: t }))
                        }
                        placeholder="—"
                        placeholderTextColor="#546E7A"
                        keyboardType="decimal-pad"
                      />
                    </View>
                  ))}
                </View>
                <View style={styles.tableBodyRow}>
                  <Text style={[styles.td, styles.thScenarioLabel]}>POR (×4)</Text>
                  {selectedRows.map((s) => (
                    <Text
                      key={`prov-por-${s.mockKey}`}
                      style={[styles.td, styles.thStock, styles.scenarioStockCol]}
                    >
                      {formatPorFromQuarterlyOpEok(
                        marketCapWonByKey[s.mockKey] ?? null,
                        parseScenarioToQuarterlyOpEok(
                          provisionalOpEokByKey[s.mockKey] ?? '',
                          provisionalOpUnitByKey[s.mockKey] ?? 'jo'
                        )
                      )}
                    </Text>
                  ))}
                </View>
              </View>
            </ScrollView>
            <Text style={styles.tableHint}>
              시총은 위 요약과 동일(조회 시점). 해외 종목도 숫자·단위만 맞추면 동일하게 환산됩니다.
            </Text>

            <Text style={styles.sectionTitle}>가이던스 분기 실적 ×4 환산 실적</Text>
            <Text style={styles.scenarioSub}>
              가이던스가 나온 분기(예: 차기 분기) 영업이익 숫자와 단위(조·억·천만·백만)를 입력하세요. PER은 계산하지 않고 POR만 표시합니다.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
              <View style={styles.tableInner}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.th, styles.thScenarioLabel]}>항목</Text>
                  {selectedRows.map((s) => (
                    <Text
                      key={`guide-h-${s.mockKey}`}
                      style={[styles.th, styles.thStock, styles.scenarioStockCol]}
                      numberOfLines={2}
                    >
                      {s.label}
                    </Text>
                  ))}
                </View>
                <View style={styles.tableBodyRow}>
                  <Text style={[styles.td, styles.thScenarioLabel]}>분기 영업이익</Text>
                  {selectedRows.map((s) => (
                    <View key={`guide-op-${s.mockKey}`} style={[styles.thStock, styles.scenarioStockCol]}>
                      <View style={styles.unitGrid}>
                        {OP_SCENARIO_UNITS.map((u) => {
                          const on = (guidanceOpUnitByKey[s.mockKey] ?? 'jo') === u.id;
                          return (
                            <TouchableOpacity
                              key={u.id}
                              style={[styles.unitChip, on && styles.unitChipOn]}
                              onPress={() =>
                                setGuidanceOpUnitByKey((p) => ({ ...p, [s.mockKey]: u.id }))
                              }
                              activeOpacity={0.85}
                            >
                              <Text style={[styles.unitChipText, on && styles.unitChipTextOn]}>
                                {u.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <TextInput
                        style={styles.scenarioInput}
                        value={guidanceOpEokByKey[s.mockKey] ?? ''}
                        onChangeText={(t) =>
                          setGuidanceOpEokByKey((p) => ({ ...p, [s.mockKey]: t }))
                        }
                        placeholder="—"
                        placeholderTextColor="#546E7A"
                        keyboardType="decimal-pad"
                      />
                    </View>
                  ))}
                </View>
                <View style={styles.tableBodyRow}>
                  <Text style={[styles.td, styles.thScenarioLabel]}>POR (×4)</Text>
                  {selectedRows.map((s) => (
                    <Text
                      key={`guide-por-${s.mockKey}`}
                      style={[styles.td, styles.thStock, styles.scenarioStockCol]}
                    >
                      {formatPorFromQuarterlyOpEok(
                        marketCapWonByKey[s.mockKey] ?? null,
                        parseScenarioToQuarterlyOpEok(
                          guidanceOpEokByKey[s.mockKey] ?? '',
                          guidanceOpUnitByKey[s.mockKey] ?? 'jo'
                        )
                      )}
                    </Text>
                  ))}
                </View>
              </View>
            </ScrollView>
            <Text style={styles.tableHint}>잠정과 동일 공식: POR = 현재 시총 ÷ (분기 영업이익 억 × 10⁸ × 4).</Text>
          </>
        )}
      </ScrollView>
    </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
  },
  root: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  banner: {
    backgroundColor: 'rgba(66, 165, 245, 0.12)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.25)',
  },
  bannerTitle: {
    color: '#90CAF9',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
  },
  bannerFxChip: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(129, 212, 250, 0.35)',
  },
  bannerFxChipLabel: {
    color: '#81D4FA',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  bannerFxChipValue: {
    color: '#E1F5FE',
    fontSize: 13,
    fontWeight: '700',
  },
  bannerFxChipSource: {
    marginTop: 3,
    color: '#78909C',
    fontSize: 10,
  },
  bannerSub: {
    color: '#B0BEC5',
    fontSize: 12,
    lineHeight: 18,
  },
  primaryFetchBtn: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(66, 165, 245, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.65)',
    alignItems: 'center',
  },
  primaryFetchBtnText: {
    color: '#E3F2FD',
    fontWeight: '800',
    fontSize: 15,
  },
  fxLine: {
    marginTop: 14,
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  dartErrorLine: {
    marginTop: 10,
    color: '#FFAB91',
    fontSize: 12,
    lineHeight: 18,
  },
  dartLoadBtn: {
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(3, 199, 90, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(3, 199, 90, 0.55)',
    alignItems: 'center',
  },
  dartLoadBtnDisabled: {
    opacity: 0.55,
  },
  dartLoadBtnText: {
    color: '#A5D6A7',
    fontWeight: '800',
    fontSize: 14,
  },
  dartHintMuted: {
    marginTop: 12,
    color: '#78909C',
    fontSize: 12,
    lineHeight: 18,
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 10,
    color: '#ECEFF1',
    fontSize: 15,
    fontWeight: '700',
  },
  metricSectionSub: {
    marginTop: -4,
    marginBottom: 10,
    color: '#90A4AE',
    fontSize: 12,
    lineHeight: 17,
  },
  capSummaryCalcMode: {
    marginTop: 4,
    marginBottom: 4,
    color: '#CFD8DC',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  capSummaryGlossary: {
    marginBottom: 10,
    color: '#90A4AE',
    fontSize: 12,
    lineHeight: 18,
  },
  sectionHeaderRow: {
    marginTop: 20,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  resetOrderBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  resetOrderBtnText: {
    color: '#B0BEC5',
    fontWeight: '600',
    fontSize: 12,
  },
  sectionTitleInline: {
    flex: 1,
    marginTop: 0,
    marginBottom: 0,
    marginRight: 4,
  },
  addStockBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(66, 165, 245, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.45)',
  },
  addStockBtnText: {
    color: '#90CAF9',
    fontWeight: '700',
    fontSize: 13,
  },
  addStockBtnLarge: {
    marginTop: 16,
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: 'rgba(66, 165, 245, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.5)',
  },
  addStockBtnLargeText: {
    color: '#E3F2FD',
    fontWeight: '700',
    fontSize: 15,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipOn: {
    backgroundColor: 'rgba(66, 165, 245, 0.25)',
    borderColor: 'rgba(66, 165, 245, 0.5)',
  },
  chipText: {
    color: '#B0BEC5',
    fontWeight: '600',
    fontSize: 14,
  },
  chipTextOn: {
    color: '#FFFFFF',
  },
  periodScroll: {
    gap: 8,
    paddingRight: 8,
  },
  periodChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginRight: 8,
  },
  periodChipOn: {
    backgroundColor: 'rgba(66, 165, 245, 0.3)',
  },
  periodChipText: {
    color: '#B0BEC5',
    fontSize: 13,
    fontWeight: '600',
  },
  periodChipTextOn: {
    color: '#FFFFFF',
  },
  metricTabs: {
    flexDirection: 'column',
    alignSelf: 'stretch',
    gap: 8,
  },
  metricTab: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  metricTabOn: {
    backgroundColor: 'rgba(76, 175, 80, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.45)',
  },
  metricTabText: {
    color: '#CFD8DC',
    fontSize: 13,
    fontWeight: '600',
  },
  metricTabTextOn: {
    color: '#FFFFFF',
  },
  loadingBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#90A4AE',
    fontSize: 13,
  },
  emptyBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  emptyTitle: {
    color: '#ECEFF1',
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 6,
  },
  emptySub: {
    color: '#90A4AE',
    fontSize: 13,
    lineHeight: 20,
  },
  compareOrderHint: {
    color: '#78909C',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  checkList: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  checkRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  reorderStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 6,
    gap: 8,
  },
  reorderArrowsCol: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  reorderJumpCol: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: 6,
  },
  reorderStepBtn: {
    minWidth: 40,
    minHeight: 32,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  reorderStepBtnDisabled: {
    opacity: 0.35,
  },
  reorderStepBtnText: {
    color: '#90CAF9',
    fontSize: 16,
    fontWeight: '700',
  },
  reorderJumpBtn: {
    minWidth: 52,
    minHeight: 28,
    paddingHorizontal: 6,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(66, 165, 245, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.25)',
  },
  reorderJumpBtnText: {
    color: '#90CAF9',
    fontSize: 11,
    fontWeight: '700',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: '#42A5F5',
    borderColor: '#42A5F5',
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  checkTextCol: {
    flex: 1,
    minWidth: 0,
  },
  checkLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  checkTicker: {
    color: '#90A4AE',
    fontSize: 12,
    marginTop: 2,
  },
  tableScroll: {
    marginTop: 4,
    maxHeight: 320,
  },
  /** 연도 모드 5행 + 해외 FROM~TO(최대 3줄) 시 기본 maxHeight로 마지막 행이 잘림 */
  periodTableScrollYearRows: {
    maxHeight: 540,
  },
  tableInner: {
    alignSelf: 'flex-start',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(66, 165, 245, 0.35)',
    paddingBottom: 8,
    marginBottom: 4,
  },
  tableBodyRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  tableBodyRowHighlight: {
    backgroundColor: 'rgba(66, 165, 245, 0.08)',
  },
  th: {
    color: '#90CAF9',
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
  },
  td: {
    color: '#ECEFF1',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  thPeriod: {
    width: 72,
    textAlign: 'left',
    paddingRight: 8,
  },
  thLabel: {
    width: 80,
    textAlign: 'left',
    paddingRight: 8,
  },
  thStock: {
    width: 100,
    paddingHorizontal: 6,
  },
  fsPeriodCellWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  fsPeriodCellValue: {
    paddingHorizontal: 0,
  },
  fsPeriodCellHint: {
    marginTop: 4,
    color: '#78909C',
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 12,
  },
  capSummaryStockHead: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  capSummaryStockName: {
    color: '#90CAF9',
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
  },
  capSummaryStockPeriod: {
    marginTop: 4,
    color: '#90A4AE',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
  tableHint: {
    marginTop: 8,
    color: '#78909C',
    fontSize: 11,
    lineHeight: 16,
  },
  scenarioSub: {
    marginTop: -4,
    marginBottom: 8,
    color: '#90A4AE',
    fontSize: 12,
    lineHeight: 18,
  },
  thScenarioLabel: {
    width: 118,
    textAlign: 'left',
    paddingRight: 8,
  },
  scenarioStockCol: {
    width: 120,
    alignItems: 'stretch',
  },
  unitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  unitChip: {
    width: '48%',
    marginBottom: 4,
    paddingVertical: 5,
    paddingHorizontal: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  unitChipOn: {
    backgroundColor: 'rgba(66, 165, 245, 0.22)',
    borderColor: 'rgba(66, 165, 245, 0.55)',
  },
  unitChipText: {
    color: '#B0BEC5',
    fontSize: 11,
    fontWeight: '600',
  },
  unitChipTextOn: {
    color: '#E3F2FD',
  },
  scenarioInput: {
    width: '100%',
    minHeight: 36,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.35)',
    color: '#ECEFF1',
    fontSize: 13,
    textAlign: 'center',
  },
});
