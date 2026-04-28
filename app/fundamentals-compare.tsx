import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
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
  type DartCellBundle,
  type DartFundamentalsGrid,
} from '../src/services/dart/dartFundamentalsGrid';
import { formatWonShortKr } from '../src/services/dart/dartFormatKr';
import { fetchDomesticMarketCapWonFromNaver } from '../src/services/naverFinanceStock';
import {
  getMultipleStockQuotesBatch,
  normalizeYahooTickerKey,
  type StockQuote,
} from '../src/services/YahooFinanceService';

/** Metro·adb logcat에서 `[CAP_PER]`로 필터링 (시총·PER 진단) */
function capPerTrace(message: string, data?: Record<string, unknown>): void {
  if (data !== undefined) {
    console.warn('[CAP_PER]', message, data);
  } else {
    console.warn('[CAP_PER]', message);
  }
}

/** 연도 격자 + 직전 분기(PER용) 분기 격자 병합 — 기간 키가 섞이면 year 분기에서 분기 키가 무시됨 */
function mergeDartFundamentalsGrids(
  a: DartFundamentalsGrid,
  b: DartFundamentalsGrid
): DartFundamentalsGrid {
  const out: DartFundamentalsGrid = { ...a };
  for (const pk of Object.keys(b)) {
    out[pk] = { ...(out[pk] ?? {}), ...b[pk] };
  }
  return out;
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

function formatFundamentalsMarketCapKr(q: StockQuote | null): string {
  if (!q?.marketCap || !Number.isFinite(q.marketCap)) return '—';
  const cur = (q.currency || '').toUpperCase();
  if (cur === 'KRW') return formatWonShortKr(q.marketCap);
  return formatWonShortKr(q.marketCap * FUNDAMENTALS_USD_KRW_RATE);
}

function marketCapWonFromQuote(q: StockQuote | null): number | null {
  if (!q?.marketCap || !Number.isFinite(q.marketCap)) return null;
  const cur = (q.currency || '').toUpperCase();
  if (cur === 'KRW') return q.marketCap;
  return q.marketCap * FUNDAMENTALS_USD_KRW_RATE;
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
  const snapshotPeriodKeyUi = snapshotQuarterInfo.periodKey;
  const latestQuarterCandidates = useMemo(() => buildDartLatestQuarterCandidates(new Date(), 12), []);

  const [dartGrid, setDartGrid] = useState<DartFundamentalsGrid | null>(null);
  const [dartLoading, setDartLoading] = useState(false);
  const [dartError, setDartError] = useState<string | null>(null);
  const [dartLoadTicket, setDartLoadTicket] = useState(0);
  /** 시총(Yahoo→네이버) 수동 재조회 — 조회 버튼 */
  const [quoteRefreshKey, setQuoteRefreshKey] = useState(0);
  const [marketCapKrByKey, setMarketCapKrByKey] = useState<Record<string, string>>({});
  const [marketCapWonByKey, setMarketCapWonByKey] = useState<Record<string, number | null>>({});
  const [marketCapLoading, setMarketCapLoading] = useState(false);

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
      setDeduped(list);
      setSelectedKeys(new Set(list.map((x) => x.mockKey)));
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
  }, [granularity, periodKey, quarterYear, quarterYearChoices]);

  /** 분기 연도 칩만 사용(Q1~Q4 칩 없음) — 같은 해면 직전 달력 분기, 아니면 해당 연도 Q4 */
  const setQuarterYearFromChip = useCallback(
    (y: number) => {
      setQuarterYear(y);
      setPeriodKey(y === snapshotQuarterInfo.year ? snapshotPeriodKeyUi : `${y}Q4`);
    },
    [snapshotQuarterInfo.year, snapshotPeriodKeyUi]
  );

  const selectedRows = useMemo(
    () => deduped.filter((r) => selectedKeys.has(r.mockKey)),
    [deduped, selectedKeys]
  );

  /**
   * 상단 시총·PER·실적 요약에 쓰는 DART 기준 기간.
   * 연도 모드 → 표 연도 칩 순서상 가장 최근 연도부터 순이익·실적 매칭.
   * 분기 모드 → 최근 분기 후보 순으로 매칭.
   */
  const dartCapTableSnapshotPeriodKey = useMemo(() => {
    const yearFallback =
      yearPeriodRows[0]?.periodKey ?? String(fundamentalsDefaultPreviousCalendarYear(new Date()));
    const quarterFallback = latestQuarterCandidates[0] ?? '2025Q4';
    if (!dartGrid) {
      return granularity === 'year' ? yearFallback : quarterFallback;
    }

    const hasNetIncome = (slice: Record<string, DartCellBundle> | undefined): boolean => {
      if (!slice) return false;
      for (const row of selectedRows) {
        if (!/^\d{6}$/.test(row.mockKey)) continue;
        const c = slice[row.mockKey];
        if (c?.netIncomeWon != null && Number.isFinite(c.netIncomeWon)) return true;
      }
      return false;
    };

    const hasAnyDart = (slice: Record<string, DartCellBundle> | undefined): boolean => {
      if (!slice) return false;
      for (const row of selectedRows) {
        if (!/^\d{6}$/.test(row.mockKey)) continue;
        const c = slice[row.mockKey];
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
        if (hasNetIncome(dartGrid[r.periodKey])) return r.periodKey;
      }
      for (const r of yearPeriodRows) {
        if (hasAnyDart(dartGrid[r.periodKey])) return r.periodKey;
      }
      return yearFallback;
    }

    for (const pk of latestQuarterCandidates) {
      if (hasNetIncome(dartGrid[pk])) return pk;
    }
    for (const pk of latestQuarterCandidates) {
      if (hasAnyDart(dartGrid[pk])) return pk;
    }
    return quarterFallback;
  }, [dartGrid, granularity, latestQuarterCandidates, selectedRows, yearPeriodRows]);

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

  /** 국내 6자리는 mockKey만 넘기면 .KS/.KQ 병렬 조회가 동작해 시총 누락이 줄어듦 */
  const yahooQuoteLookupKey = useCallback((row: DedupedStockRow) => {
    if (/^\d{6}$/.test(row.mockKey)) return row.mockKey;
    return normalizeYahooTickerKey((row.displayTicker || row.mockKey).trim());
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
    const tickers = [...new Set(selectedRows.map((r) => yahooQuoteLookupKey(r)))];
    capPerTrace('yahoo_batch_start', {
      requestKeys: tickers,
      rows: selectedRows.map((r) => ({
        mockKey: r.mockKey,
        displayTicker: r.displayTicker,
        yahooLookupKey: yahooQuoteLookupKey(r),
      })),
    });
    void (async () => {
      try {
        const batch = await getMultipleStockQuotesBatch(tickers, 5, 150);
        if (cancelled) return;
        const next: Record<string, string> = {};
        const nextWon: Record<string, number | null> = {};
        const byRow: Record<string, unknown>[] = [];
        for (const row of selectedRows) {
          const lookupKey = yahooQuoteLookupKey(row);
          const q = batch.get(lookupKey) ?? null;
          next[row.mockKey] = formatFundamentalsMarketCapKr(q);
          nextWon[row.mockKey] = marketCapWonFromQuote(q);
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
            capMissingReason,
            hint:
              capMissingReason != null
                ? 'PER/POR도 시총(원) 없으면 계산 불가. logcat에서 [YAHOO_QUOTE] 동시 확인.'
                : undefined,
          });
        }
        capPerTrace('yahoo_batch_done', {
          mapSize: batch.size,
          note: '국내 6자리는 시총 null일 때 네이버 폴백. 상세 [YAHOO_QUOTE]·[NAVER_CAP]',
          byRow,
        });

        const needNaver = selectedRows.filter(
          (r) =>
            /^\d{6}$/.test(r.mockKey) &&
            (nextWon[r.mockKey] == null || !Number.isFinite(nextWon[r.mockKey] as number))
        );
        if (needNaver.length > 0) {
          capPerTrace('naver_cap_fallback_start', {
            mockKeys: needNaver.map((r) => r.mockKey),
          });
          for (const row of needNaver) {
            const won = await fetchDomesticMarketCapWonFromNaver(row.mockKey);
            if (won != null && Number.isFinite(won) && won > 0) {
              next[row.mockKey] = formatWonShortKr(won);
              nextWon[row.mockKey] = won;
              const br = byRow.find((x) => x.mockKey === row.mockKey);
              if (br && typeof br === 'object') {
                Object.assign(br as object, {
                  capDisplayKr: next[row.mockKey],
                  capWon: won,
                  capMissingReason: null,
                  naverCapFallback: true,
                });
              }
            }
            await new Promise((res) => setTimeout(res, 100));
          }
          capPerTrace('naver_cap_fallback_done', {
            filled: needNaver.filter((r) => nextWon[r.mockKey] != null).map((r) => r.mockKey),
          });
        }

        setMarketCapKrByKey(next);
        setMarketCapWonByKey(nextWon);
      } catch (e: unknown) {
        capPerTrace('yahoo_batch_error', {
          message: e instanceof Error ? e.message : String(e),
          requestKeys: tickers,
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
      rows,
    });
  }, [
    selectedStocksForCapSig,
    marketCapLoading,
    marketCapWonByKey,
    marketCapKrByKey,
    dartGrid,
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

  /** 기간·종목 선택이 바뀌면 그리드 초기화 후 DART 자동 재조회 */
  useEffect(() => {
    setDartGrid(null);
    setDartError(null);
    setDartLoadTicket((t) => t + 1);
  }, [dartDataScopeSignature]);

  const handleFetchAll = useCallback(() => {
    setQuoteRefreshKey((k) => k + 1);
    setDartLoadTicket((t) => t + 1);
  }, []);

  const dartApiKeyPresent = getDartApiKey().length > 0;
  const hasDomesticSelected = useMemo(
    () => selectedRows.some((r) => /^\d{6}$/.test(r.mockKey)),
    [selectedRows]
  );
  const isFundamentalsFetching =
    (dartLoading && dartApiKeyPresent && hasDomesticSelected) ||
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

        const fetchLatestQuarterOverlay = async (): Promise<DartFundamentalsGrid> => {
          let acc: DartFundamentalsGrid = {};
          for (const pk of overlayCandidates) {
            if (cancelled) return acc;
            dartTrace('dart_latest_quarter_try', { periodKey: pk });
            const g = await buildDartFundamentalsGrid({
              apiKey,
              domesticTickerKeys: tickerKeys,
              periodKeys: [pk],
              granularity: 'quarter',
            });
            acc = mergeDartFundamentalsGrids(acc, g);
            const ok = tickerKeys.some((tk) => {
              const b = g[pk]?.[tk];
              return (
                b &&
                (b.revenueKr !== '—' ||
                  (b.netIncomeWon != null && Number.isFinite(b.netIncomeWon)) ||
                  b.operatingIncomeKr !== '—')
              );
            });
            if (ok) {
              dartTrace('dart_latest_quarter_resolved', { periodKey: pk });
              break;
            }
          }
          return acc;
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

  const displayCell = useCallback(
    (tab: FundamentalsPeriodMetricTab, row: MockFundamentalsPeriodRow, mockKey: string): string => {
      const isDomestic = /^\d{6}$/.test(mockKey);
      const bundle = isDomestic ? dartGrid?.[row.periodKey]?.[mockKey] : undefined;
      const fromDart = pickDartCellDisplay(tab, bundle);
      if (fromDart !== '—') return fromDart;
      return '—';
    },
    [dartGrid]
  );

  const capPerTableCell = useCallback(
    (rowId: 'cap' | 'por' | 'per' | 'net' | 'op' | 'rev', s: DedupedStockRow): string => {
      const k = s.mockKey;
      const isDomestic = /^\d{6}$/.test(k);
      const dCell = isDomestic ? dartGrid?.[dartCapTableSnapshotPeriodKey]?.[k] : undefined;
      const capWon = marketCapWonByKey[k] ?? null;

      const netIncomeWonForPer = (): number | null => {
        if (!isDomestic || !dartGrid) return null;
        for (const pk of perNetIncomeSearchPeriodKeys) {
          const n = dartGrid[pk]?.[k]?.netIncomeWon;
          if (n != null && Number.isFinite(n)) return n;
        }
        return null;
      };

      const operatingIncomeWonForPor = (): number | null => {
        if (!isDomestic || !dartGrid) return null;
        for (const pk of perNetIncomeSearchPeriodKeys) {
          const o = dartGrid[pk]?.[k]?.operatingIncomeWon;
          if (o != null && Number.isFinite(o)) return o;
        }
        return null;
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
          return dCell != null && dCell.operatingIncomeKr !== '—' ? dCell.operatingIncomeKr : '—';
        case 'rev':
          return dCell != null && dCell.revenueKr !== '—' ? dCell.revenueKr : '—';
        default:
          return '—';
      }
    },
    [
      dartGrid,
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

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#000000', '#121212', '#1A1A1A']} style={StyleSheet.absoluteFill} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.banner, { marginTop: insets.top + 8 }]}>
          <Text style={styles.bannerTitle}>실적·시총 조회</Text>
          <Text style={styles.bannerSub}>
            {dartApiKeyPresent
              ? '국내 실적은 DART, 시총은 Yahoo→(없으면)네이버입니다. 연도 모드의 PER·POR은 연간 이익 기준, 분기 모드는 분기 이익×4(연율화)로 계산합니다. 기간·종목을 바꾸면 자동으로 다시 불러옵니다.'
              : '국내 실적을 보려면 프로젝트에 DART_API_KEY를 설정하세요. 시총·해외 종목 시세는 Yahoo/네이버로 조회합니다.'}
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
          <TouchableOpacity style={styles.addStockBtn} onPress={handleAddStock} activeOpacity={0.85}>
            <Text style={styles.addStockBtnText}>+ 종목 추가</Text>
          </TouchableOpacity>
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
          <View style={styles.checkList}>
            {deduped.map((row) => {
              const on = selectedKeys.has(row.mockKey);
              return (
                <Pressable
                  key={row.mockKey}
                  style={({ pressed }) => [styles.checkRow, pressed && { opacity: 0.85 }]}
                  onPress={() => toggleKey(row.mockKey)}
                >
                  <View style={[styles.checkbox, on && styles.checkboxOn]}>
                    {on ? <Text style={styles.checkMark}>✓</Text> : null}
                  </View>
                  <View style={styles.checkTextCol}>
                    <Text style={styles.checkLabel} numberOfLines={1}>
                      {row.label}
                    </Text>
                    <Text style={styles.checkTicker} numberOfLines={1}>
                      {row.displayTicker}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {!dartApiKeyPresent ? (
          <Text style={styles.dartHintMuted}>
            `.env`에 DART_API_KEY를 넣으면 국내 매출·이익 등이 표시됩니다.
          </Text>
        ) : !hasDomesticSelected ? (
          <Text style={styles.dartHintMuted}>국내(6자리) 종목을 선택하면 DART 실적이 반영됩니다.</Text>
        ) : null}

        <Text style={styles.fxLine}>
          해외 시총 USD 표시는 1USD = {FUNDAMENTALS_USD_KRW_RATE.toLocaleString()}원으로 환산합니다. (환경변수
          EXPO_PUBLIC_USD_KRW_RATE로 변경)
        </Text>
        {dartApiKeyPresent ? <Text style={styles.fxLine}>{DART_FUNDAMENTALS_DISCLOSURE}</Text> : null}
        {dartError ? <Text style={styles.dartErrorLine}>DART: {dartError}</Text> : null}

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
              const d = new Date();
              const choices = fundamentalsQuarterYearChoices(d, FUNDAMENTALS_CALENDAR_YEAR_SPAN);
              const next = fundamentalsDefaultQuarterWithinChoices(d, choices);
              setGranularity('quarter');
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
            <Text style={styles.metricSectionSub}>기간별 표에 적용 · 아래 시총 요약과 별개</Text>
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
              <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
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
                      {selectedRows.map((s) => (
                        <Text key={`${r.periodKey}-${s.mockKey}`} style={[styles.td, styles.thStock]}>
                          {displayCell(metricTab, r, s.mockKey)}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
              <Text style={styles.tableHint}>
                가로로 스크롤하여 열을 확인할 수 있습니다. 이 표만 연·분기 단위가 적용됩니다. 기간·종목 변경 또는 「조회」 시 최신 데이터가 반영됩니다.
              </Text>
            </>

            <Text style={styles.sectionTitle}>
              {granularity === 'year' ? '최신 연도 환산 실적' : '최신 분기 실적 ×4 환산 실적'} (DART {dartCapTableSnapshotPeriodKey})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
              <View style={styles.tableInner}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.th, styles.thLabel]}>항목</Text>
                  {selectedRows.map((s) => (
                    <Text key={s.mockKey} style={[styles.th, styles.thStock]} numberOfLines={2}>
                      {s.label}
                    </Text>
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
                ? '시총은 Yahoo(조회 시점). POR=시총÷연간 영업이익, PER=시총÷연간 당기순이익(DART 기준).「영업이익」「당기순이익」행은 표시용 분기·연 실적.'
                : '시총은 Yahoo(조회 시점). PER·POR은 분기 이익을 ×4 연율화한 값을 분모로 사용합니다(분기 실적을 1년으로 환산).「영업이익」「당기순이익」행은 해당 분기 금액.'}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  sectionHeaderRow: {
    marginTop: 20,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
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
  checkList: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
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
  tableHint: {
    marginTop: 8,
    color: '#78909C',
    fontSize: 11,
    lineHeight: 16,
  },
});
