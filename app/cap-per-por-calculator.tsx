import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { buildDartFundamentalsGridForSnapshot, type DartFundamentalsGrid } from '../src/services/dart/dartFundamentalsGrid';
import { getDartApiKey } from '../src/services/dart/dartConfig';
import {
  FORMAT_WON_SHORT_KR_MARKET_CAP_MAX_ABS,
  formatWonShortKr,
} from '../src/services/dart/dartFormatKr';
import { dartDomesticWonScaleDown } from '../src/services/dart/dartDomesticCapScaleDown';
import {
  FUNDAMENTALS_USD_KRW_RATE,
  fundamentalsMockKey,
  buildDartLatestQuarterCandidates,
  buildFundamentalsSnapshotFetchQuarterPeriodKeys,
  fundamentalsQuarterYearChoices,
  buildYearPeriodRowsForChoices,
  fundamentalsDefaultQuarterWithinChoices,
  FUNDAMENTALS_CALENDAR_YEAR_SPAN,
} from '../src/data/fundamentalsCompareMock';
import { AdmobNativeAd } from '../src/components/AdmobNativeAd';
import StockSearchModal from '../src/components/StockSearchModal';
import { togglePlainPercentSign } from '../src/utils/percentSignToggle';
import { initDatabase, getAllAccounts, getStocksByAccountId } from '../src/services/DatabaseService';
import type { Stock } from '../src/models/Stock';
import {
  getCapPerPorRecent,
  pushCapPerPorRecent,
  removeCapPerPorRecent,
  CAP_PER_POR_RECENT_MAX,
  type CapPerPorRecentEntry,
} from '../src/services/CapPerPorRecentService';
import { SettingsService, type OpScenarioPersistRow, type OpScenarioPersistUnit } from '../src/services/SettingsService';
import {
  applyFundamentalsSnapshotFromGrid,
  formatAnnualKrFromQuarterlyEok,
  formatOpMarginFromQuarterlyEok,
  formatPbrFromCapAndEquity,
  formatPorFromQuarterlyOpEok,
  formatPsrFromQuarterlyRevEok,
  parseScenarioToQuarterlyOpEok,
  OP_SCENARIO_UNITS,
  fundamentalsValuationBasisFootnote,
  SCENARIO_POR_PSR_METRICS_HINT,
  type OpScenarioUnit,
} from '../src/lib/capFundamentalsGridResolve';

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
  /** 잠정·가이던스 저장 effect가 이전 종목 값으로 덮어쓰지 않도록, hydrate 완료 후에만 허용 */
  const scenarioPersistReadyRef = useRef<string | null>(null);
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
  const [equityWon, setEquityWon] = useState<number | null>(null);
  /** 요약 카드 — 선택 실적 기간의 매출·영업이익(포맷 문자열), 당기순이익 표시용 */
  const [displayRevenueKr, setDisplayRevenueKr] = useState<string | null>(null);
  /** 요약과 동일 스냅샷의 매출(원) — 시총 대비 이상치 경고 */
  const [revenueWon, setRevenueWon] = useState<number | null>(null);
  const [displayOperatingIncomeKr, setDisplayOperatingIncomeKr] = useState<string | null>(null);
  const [displayNetIncomeKr, setDisplayNetIncomeKr] = useState<string | null>(null);
  /** 스냅샷과 다른 칸에서 채운 경우 숫자 옆 표시(해외는 Yahoo fsPeriodLabel 우선) */
  const [revenuePeriodSuffix, setRevenuePeriodSuffix] = useState<string | null>(null);
  const [operatingPeriodSuffix, setOperatingPeriodSuffix] = useState<string | null>(null);
  const [netIncomePeriodSuffix, setNetIncomePeriodSuffix] = useState<string | null>(null);

  const [scenarioPct, setScenarioPct] = useState('5');

  const [provisionalOpEok, setProvisionalOpEok] = useState('');
  const [provisionalUnit, setProvisionalUnit] = useState<OpScenarioUnit>('jo');
  const [provisionalRevEok, setProvisionalRevEok] = useState('');
  const [provisionalRevUnit, setProvisionalRevUnit] = useState<OpScenarioUnit>('jo');
  const [guidanceOpEok, setGuidanceOpEok] = useState('');
  const [guidanceUnit, setGuidanceUnit] = useState<OpScenarioUnit>('jo');
  const [guidanceRevEok, setGuidanceRevEok] = useState('');
  const [guidanceRevUnit, setGuidanceRevUnit] = useState<OpScenarioUnit>('jo');

  const [usdKrwApplied, setUsdKrwApplied] = useState(FUNDAMENTALS_USD_KRW_RATE);

  const [portfolioStocks, setPortfolioStocks] = useState<Stock[]>([]);
  const [recentEntries, setRecentEntries] = useState<CapPerPorRecentEntry[]>([]);

  /** AsyncStorage에서 잠정·가이던스 복원(mockKey 공통, 시총계산기·기업실적비교 동일 키) */
  useEffect(() => {
    if (mockKeyResolved == null) {
      scenarioPersistReadyRef.current = null;
      setProvisionalOpEok('');
      setProvisionalUnit('jo');
      setProvisionalRevEok('');
      setProvisionalRevUnit('jo');
      setGuidanceOpEok('');
      setGuidanceUnit('jo');
      setGuidanceRevEok('');
      setGuidanceRevUnit('jo');
      return;
    }
    scenarioPersistReadyRef.current = null;
    let cancelled = false;
    void (async () => {
      const map = await SettingsService.getOpScenarioByMockKey();
      if (cancelled) return;
      const row = map[mockKeyResolved];
      if (row) {
        setProvisionalOpEok(row.provisionalEok);
        setProvisionalUnit(row.provisionalUnit as OpScenarioUnit);
        setProvisionalRevEok(row.provisionalRevEok ?? '');
        setProvisionalRevUnit((row.provisionalRevUnit ?? 'jo') as OpScenarioUnit);
        setGuidanceOpEok(row.guidanceEok);
        setGuidanceUnit(row.guidanceUnit as OpScenarioUnit);
        setGuidanceRevEok(row.guidanceRevEok ?? '');
        setGuidanceRevUnit((row.guidanceRevUnit ?? 'jo') as OpScenarioUnit);
      } else {
        setProvisionalOpEok('');
        setProvisionalUnit('jo');
        setProvisionalRevEok('');
        setProvisionalRevUnit('jo');
        setGuidanceOpEok('');
        setGuidanceUnit('jo');
        setGuidanceRevEok('');
        setGuidanceRevUnit('jo');
      }
      if (!cancelled) scenarioPersistReadyRef.current = mockKeyResolved;
    })();
    return () => {
      cancelled = true;
    };
  }, [mockKeyResolved]);

  /** 디바운스 저장 · 종목 전환 시 cleanup에서 즉시 flush */
  useEffect(() => {
    if (mockKeyResolved == null || scenarioPersistReadyRef.current !== mockKeyResolved) return;
    const key = mockKeyResolved;
    const t = setTimeout(() => {
      void (async () => {
        const map = await SettingsService.getOpScenarioByMockKey();
        const prev = map[key];
        map[key] = {
          provisionalEok: provisionalOpEok,
          provisionalUnit: provisionalUnit as OpScenarioPersistUnit,
          provisionalRevEok: provisionalRevEok,
          provisionalRevUnit: provisionalRevUnit as OpScenarioPersistUnit,
          guidanceEok: guidanceOpEok,
          guidanceUnit: guidanceUnit as OpScenarioPersistUnit,
          guidanceRevEok: guidanceRevEok,
          guidanceRevUnit: guidanceRevUnit as OpScenarioPersistUnit,
          priceScenarioInputs: prev?.priceScenarioInputs,
        };
        await SettingsService.setOpScenarioByMockKey(map);
      })();
    }, 400);
    return () => {
      clearTimeout(t);
      void (async () => {
        const map = await SettingsService.getOpScenarioByMockKey();
        const prev = map[key];
        map[key] = {
          provisionalEok: provisionalOpEok,
          provisionalUnit: provisionalUnit as OpScenarioPersistUnit,
          provisionalRevEok: provisionalRevEok,
          provisionalRevUnit: provisionalRevUnit as OpScenarioPersistUnit,
          guidanceEok: guidanceOpEok,
          guidanceUnit: guidanceUnit as OpScenarioPersistUnit,
          guidanceRevEok: guidanceRevEok,
          guidanceRevUnit: guidanceRevUnit as OpScenarioPersistUnit,
          priceScenarioInputs: prev?.priceScenarioInputs,
        };
        await SettingsService.setOpScenarioByMockKey(map);
      })();
    };
  }, [
    mockKeyResolved,
    provisionalOpEok,
    provisionalUnit,
    provisionalRevEok,
    provisionalRevUnit,
    guidanceOpEok,
    guidanceUnit,
    guidanceRevEok,
    guidanceRevUnit,
  ]);

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

  /** 국내: 시총 대비 연율 손익이 비정형이면 DART 손익을 동일 ÷1000 보정(천원 과대 스케일 가정) */
  const dartWonScaleDown = useMemo(
    () =>
      dartDomesticWonScaleDown(
        mockKeyResolved,
        capWon,
        revenueWon,
        operatingIncomeWon,
        netIncomeWon,
        granularity
      ),
    [mockKeyResolved, capWon, revenueWon, operatingIncomeWon, netIncomeWon, granularity]
  );

  const perDenominator = useMemo(() => {
    const n =
      netIncomeWon != null && Number.isFinite(netIncomeWon) ? netIncomeWon * dartWonScaleDown : null;
    return annualizeIncomeForPerPor(n, granularity);
  }, [netIncomeWon, granularity, dartWonScaleDown]);
  const porDenominator = useMemo(() => {
    const o =
      operatingIncomeWon != null && Number.isFinite(operatingIncomeWon)
        ? operatingIncomeWon * dartWonScaleDown
        : null;
    return annualizeIncomeForPerPor(o, granularity);
  }, [operatingIncomeWon, granularity, dartWonScaleDown]);

  const pbrDenominator = useMemo(() => {
    if (equityWon == null || !Number.isFinite(equityWon)) return null;
    return equityWon * dartWonScaleDown;
  }, [equityWon, dartWonScaleDown]);

  const displayRevenueKrEff = useMemo(() => {
    if (revenueWon != null && Number.isFinite(revenueWon)) {
      return formatWonShortKr(revenueWon * dartWonScaleDown);
    }
    return displayRevenueKr ?? '—';
  }, [revenueWon, dartWonScaleDown, displayRevenueKr]);

  const displayOperatingIncomeKrEff = useMemo(() => {
    if (operatingIncomeWon != null && Number.isFinite(operatingIncomeWon)) {
      return formatWonShortKr(operatingIncomeWon * dartWonScaleDown);
    }
    return displayOperatingIncomeKr ?? '—';
  }, [operatingIncomeWon, dartWonScaleDown, displayOperatingIncomeKr]);

  const displayNetIncomeKrEff = useMemo(() => {
    if (netIncomeWon != null && Number.isFinite(netIncomeWon)) {
      return formatWonShortKr(netIncomeWon * dartWonScaleDown);
    }
    return displayNetIncomeKr ?? '—';
  }, [netIncomeWon, dartWonScaleDown, displayNetIncomeKr]);

  /** 요약·실적 PER/POR/PBR/PSR 분모 안내 */
  const perPorBasisFootnote = useMemo(
    () => fundamentalsValuationBasisFootnote(granularity),
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
  const provisionalQRev = useMemo(
    () => parseScenarioToQuarterlyOpEok(provisionalRevEok, provisionalRevUnit),
    [provisionalRevEok, provisionalRevUnit]
  );
  const guidanceQRev = useMemo(
    () => parseScenarioToQuarterlyOpEok(guidanceRevEok, guidanceRevUnit),
    [guidanceRevEok, guidanceRevUnit]
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

      const recordRecentIfNeeded = (displayName: string | null) => {
        if (softRefresh) return;
        void pushCapPerPorRecent(mk, displayName?.trim() || mk).then(setRecentEntries);
      };

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
        setEquityWon(null);
        setDisplayRevenueKr(null);
        setDisplayOperatingIncomeKr(null);
        setDisplayNetIncomeKr(null);
        setRevenueWon(null);
        setRevenuePeriodSuffix(null);
        setOperatingPeriodSuffix(null);
        setNetIncomePeriodSuffix(null);
      }

      try {
        const yahooSym = yahooLookupFromMockKey(mk);
        const [usdKrw, quote] = await Promise.all([
          resolveUsdKrwRate(),
          getStockQuote(yahooSym),
        ]);
        setUsdKrwApplied(usdKrw);
        if (quote != null && Number.isFinite(quote.price) && quote.price > 0) {
          setPrice(quote.price);
          setQuoteCurrency((quote.currency || 'KRW').toUpperCase());
        }

        let cap: number | null = null;

        if (domestic) {
          const apiKey = getDartApiKey();
          if (!apiKey) {
            setError('DART API 키가 없습니다. 국내 종목 실적 조회에 필요합니다.');
            setLoading(false);
            return;
          }
          const periodKeysYear = yearPeriodRows.map((r) => r.periodKey);
          const periodKeysQ = buildFundamentalsSnapshotFetchQuarterPeriodKeys(new Date(), quarterYear);
          const periodKeys = granularity === 'year' ? periodKeysYear : periodKeysQ;
          const overlayCandidates = buildDartLatestQuarterCandidates(new Date(), 12);

          const [grid, naverCap] = await Promise.all([
            buildDartFundamentalsGridForSnapshot({
              apiKey,
              domesticTickerKeys: [mk],
              periodKeys,
              granularity,
              overlayCandidates,
            }),
            fetchDomesticMarketCapWonFromNaver(mk),
          ]);

          cap = naverCap;
          if (cap == null || !Number.isFinite(cap)) {
            cap = marketCapWonFromQuote(quote, usdKrw);
          }

          const resolved = applyFundamentalsSnapshotFromGrid(
            grid,
            mk,
            granularity,
            latestQuarterCandidates,
            yearPeriodRows,
            { quarterYear }
          );
          if (!resolved) {
            setError('해당 종목의 실적 데이터를 찾지 못했습니다.');
            setMockKeyResolved(mk);
            setRevenueWon(null);
            if (cap != null) setCapWon(cap);
            recordRecentIfNeeded(labelFromPicker || (quote?.name && quote.name.trim()) || null);
            setLoading(false);
            return;
          }

          setNetIncomeWon(resolved.netIncomeWon);
          setOperatingIncomeWon(resolved.operatingIncomeWon);
          setEquityWon(resolved.equityWon);
          setRevenueWon(resolved.revenueWon ?? null);
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
          recordRecentIfNeeded(resolvedLabel);
        } else {
          const widenedYearKeys = buildYearPeriodRowsForChoices(
            fundamentalsQuarterYearChoices(new Date(), FUNDAMENTALS_CALENDAR_YEAR_SPAN + 6)
          ).map((r) => r.periodKey);
          const periodKeysForYahoo =
            granularity === 'quarter'
              ? buildFundamentalsSnapshotFetchQuarterPeriodKeys(new Date(), quarterYear)
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
            yearPeriodRows,
            { quarterYear }
          );
          if (!resolved) {
            setError('해당 종목의 실적 데이터를 찾지 못했습니다.');
            setMockKeyResolved(mk);
            setRevenueWon(null);
            recordRecentIfNeeded(labelFromPicker || (quote?.name && quote.name.trim()) || null);
            setLoading(false);
            return;
          }

          setNetIncomeWon(resolved.netIncomeWon);
          setOperatingIncomeWon(resolved.operatingIncomeWon);
          setEquityWon(resolved.equityWon);
          setRevenueWon(resolved.revenueWon ?? null);
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
          recordRecentIfNeeded(resolvedLabel);

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

  useEffect(() => {
    void getCapPerPorRecent().then(setRecentEntries);
  }, []);

  useEffect(() => {
    const loadPortfolioStocks = async () => {
      try {
        await initDatabase();
        const accounts = await getAllAccounts();
        const stocksArrays = await Promise.all(accounts.map((account) => getStocksByAccountId(account.id)));
        const allStocks: Stock[] = stocksArrays.flat();
        const uniqueStocksMap = new Map<string, Stock>();
        allStocks.forEach((stock) => {
          const existing = uniqueStocksMap.get(stock.ticker);
          if (!existing || (stock.id && existing.id && stock.id > existing.id)) {
            uniqueStocksMap.set(stock.ticker, stock);
          }
        });
        const uniqueStocks = Array.from(uniqueStocksMap.values()).sort(
          (a, b) => (parseInt(String(a.id), 10) || 0) - (parseInt(String(b.id), 10) || 0)
        );
        setPortfolioStocks(uniqueStocks);
      } catch (e) {
        console.error('시총계산기 포트폴리오 로드 오류:', e);
      }
    };
    void loadPortfolioStocks();
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

  const onPickPortfolioStock = useCallback(
    (stock: Stock) => {
      const mk = fundamentalsMockKey(stock.ticker);
      const trimmed = (stock.officialName || stock.name || '').trim() || null;
      setTickerInput(mk);
      setPickedOfficialName(trimmed);
      void fetchFundamentals({ ticker: mk, officialNameFromModal: trimmed });
    },
    [fetchFundamentals]
  );

  const onPickRecentEntry = useCallback(
    (entry: CapPerPorRecentEntry) => {
      const trimmed = entry.officialName.trim() === entry.mockKey ? null : entry.officialName.trim() || null;
      setTickerInput(entry.mockKey);
      setPickedOfficialName(trimmed);
      void fetchFundamentals({ ticker: entry.mockKey, officialNameFromModal: trimmed });
    },
    [fetchFundamentals]
  );

  const onRemoveRecentEntry = useCallback((mockKey: string) => {
    void removeCapPerPorRecent(mockKey).then(setRecentEntries);
  }, []);

  const onTickerInputChange = useCallback((text: string) => {
    setTickerInput(text);
    setPickedOfficialName(null);
  }, []);

  const perCurrent = formatPerFromCapAndNet(capWon, perDenominator);
  const porCurrent = formatPorFromCapAndOp(capWon, porDenominator);
  const pbrCurrent = formatPbrFromCapAndEquity(capWon, pbrDenominator);
  const perScenario = formatPerFromCapAndNet(scenarioCapWon, perDenominator);
  const porScenario = formatPorFromCapAndOp(scenarioCapWon, porDenominator);
  const pbrScenario = formatPbrFromCapAndEquity(scenarioCapWon, pbrDenominator);

  const showResults = mockKeyResolved != null && periodKeyUsed != null;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={['#1e3a5f', '#121212']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroTitle}>시총·PER·POR·PBR 계산기</Text>
          <Text style={styles.heroSub}>
            시총·실적 기준 PER/POR/PBR, 주가 % 시나리오와 잠정·가이던스 POR·PSR·영업이익률을 한 화면에서 확인합니다.
          </Text>
        </LinearGradient>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>기간 단위</Text>
          <View style={[styles.periodAndFxRow, styles.rowInCard]}>
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
          <Text style={styles.sheetLead}>
            분기: 당분기 손익을 ×4 연율화해 PER/POR. PBR은 해당 분기 순자산. 연도: 연간 손익·연말 순자산. 종목을 불러둔 뒤 분기↔연도만 바꿔도 자동으로 다시 맞춥니다.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>종목</Text>
          <TouchableOpacity
            style={[styles.stockSearchStandaloneBtn, styles.bleedInCard]}
            onPress={() => setShowStockModal(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="종목 검색"
          >
            <Text style={styles.stockSearchStandaloneBtnText}>종목 검색</Text>
          </TouchableOpacity>

          {portfolioStocks.length > 0 ? (
            <>
              <Text style={[styles.subSectionLabel, styles.subSectionInCard]}>포트폴리오 종목</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.stockTabsPortfolioWrap}
                contentContainerStyle={styles.stockTabsContentInCard}
                keyboardShouldPersistTaps="handled"
              >
                {portfolioStocks.map((stock) => {
                  const mkTab = fundamentalsMockKey(stock.ticker);
                  const isActive = mockKeyResolved != null && mockKeyResolved === mkTab;
                  const label = stock.name || stock.officialName || stock.ticker;
                  return (
                    <TouchableOpacity
                      key={stock.id}
                      style={[styles.stockTab, isActive && styles.stockTabActive]}
                      onPress={() => onPickPortfolioStock(stock)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.stockTabText, isActive && styles.stockTabTextActive]} numberOfLines={1}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          {recentEntries.length > 0 ? (
            <>
              <Text style={[styles.subSectionLabel, styles.subSectionInCard]}>최근 {CAP_PER_POR_RECENT_MAX}개</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.stockTabsRecentWrap}
                contentContainerStyle={styles.stockTabsContentInCard}
                keyboardShouldPersistTaps="handled"
              >
                {recentEntries.map((entry) => {
                  const isActive = mockKeyResolved != null && mockKeyResolved === entry.mockKey;
                  return (
                    <View
                      key={entry.mockKey}
                      style={[styles.recentChipWrap, isActive && styles.recentChipWrapActive]}
                    >
                      <TouchableOpacity
                        style={styles.recentChipLabelArea}
                        onPress={() => onPickRecentEntry(entry)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[styles.recentChipText, isActive && styles.recentChipTextActive]}
                          numberOfLines={1}
                        >
                          {entry.officialName}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.recentChipRemoveBtn}
                        onPress={() => onRemoveRecentEntry(entry.mockKey)}
                        activeOpacity={0.65}
                        accessibilityRole="button"
                        accessibilityLabel={`${entry.officialName} 최근에서 삭제`}
                      >
                        <Text
                          style={[
                            styles.recentChipRemoveMark,
                            isActive && styles.recentChipRemoveMarkOnActive,
                          ]}
                        >
                          ✕
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          <Text style={styles.sheetLead}>
            {portfolioStocks.length > 0
              ? '포트폴리오 탭·검색·최근에서 불러옵니다. 최근 항목은 ✕로 목록만 삭제. 티커만 직접 입력한 뒤에는 불러오기를 누르세요.'
              : '포트폴리오가 비어 있으면 검색·최근·티커 입력 후 불러오기를 쓰면 됩니다. 최근은 ✕로 항목만 삭제합니다.'}
          </Text>
          <TextInput
            style={[styles.input, styles.inputInCard]}
            placeholder="예: 005930, AAPL"
            placeholderTextColor="#888"
            value={tickerInput}
            onChangeText={onTickerInputChange}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.primaryBtn, styles.primaryBtnInCard]}
            onPress={() => void fetchFundamentals()}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>불러오기</Text>}
          </TouchableOpacity>

          {error ? <Text style={[styles.errorText, styles.errorInCard]}>{error}</Text> : null}
        </View>

        {showResults ? (
          <>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeading}>요약</Text>
              <View style={[styles.card, styles.cardInSection]}>
                <Text style={styles.mono}>{mockKeyResolved}</Text>
                {stockDisplayName ? <Text style={styles.stockNameLine}>{stockDisplayName}</Text> : null}
                <Text style={styles.line}>
                  <Text style={styles.summaryLblMuted}>실적 기준: </Text>
                  <Text style={styles.summaryVal}>
                    {periodKeyUsed ? formatCapBadge(periodKeyUsed, granularity) : '—'}
                  </Text>
                </Text>
                {fsPeriodLabel ? <Text style={styles.fsLabel}>{fsPeriodLabel}</Text> : null}
                <Text style={styles.line}>
                  <Text style={styles.summaryLblPrice}>현재가: </Text>
                  <Text style={styles.summaryVal}>
                    {price != null
                      ? `${quoteCurrency === 'USD' ? '$' : ''}${price.toLocaleString('ko-KR', { maximumFractionDigits: quoteCurrency === 'USD' ? 2 : 0 })}${quoteCurrency === 'USD' ? '' : ' 원'}`
                      : '—'}
                  </Text>
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.summaryLblCap}>시가총액: </Text>
                  <Text style={styles.summaryValStrong}>
                    {capWon != null
                      ? formatWonShortKr(capWon, { maxAbsWon: FORMAT_WON_SHORT_KR_MARKET_CAP_MAX_ABS })
                      : '—'}
                  </Text>
                </Text>
                <Text style={styles.metricRow}>
                  <Text style={styles.metricLblRev}>매출 ({fsAmountPeriodLabel}): </Text>
                  <Text style={styles.metricVal}>{displayRevenueKrEff}</Text>
                  {revenuePeriodSuffix ? (
                    <Text style={styles.metricPeriodInline}>{` · ${revenuePeriodSuffix}`}</Text>
                  ) : null}
                </Text>
                <Text style={styles.metricRow}>
                  <Text style={styles.metricLblOp}>영업이익 ({fsAmountPeriodLabel}): </Text>
                  <Text style={styles.metricVal}>{displayOperatingIncomeKrEff}</Text>
                  {operatingPeriodSuffix ? (
                    <Text style={styles.metricPeriodInline}>{` · ${operatingPeriodSuffix}`}</Text>
                  ) : null}
                </Text>
                <Text style={styles.metricRow}>
                  <Text style={styles.metricLblNet}>당기순이익 ({fsAmountPeriodLabel}): </Text>
                  <Text style={styles.metricVal}>{displayNetIncomeKrEff}</Text>
                  {netIncomePeriodSuffix ? (
                    <Text style={styles.metricPeriodInline}>{` · ${netIncomePeriodSuffix}`}</Text>
                  ) : null}
                </Text>
                <Text style={styles.perPorNote}>{perPorBasisFootnote}</Text>
                <Text style={styles.emRow}>PER {perCurrent} · POR {porCurrent} · PBR {pbrCurrent}</Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={[styles.sectionHeading, styles.sectionHeadingUserInput]}>
                주가 시나리오{' '}
                <Text style={styles.sectionHeadingUserInputSuffix}>(%)</Text>
              </Text>
              <Text style={styles.sheetLead}>
                현재가·시총에 같은 비율 적용(유통주식수 불변). 양수 상승, 음수 하락.
              </Text>
              <View style={[styles.percentRow, styles.percentRowInCard]}>
                <TextInput
                  style={[styles.input, styles.inputInCard, styles.percentInput]}
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
              <View style={[styles.card, styles.cardInSection]}>
                <Text style={styles.line}>
                  <Text style={styles.summaryLblPrice}>목표 주가: </Text>
                  <Text style={styles.summaryVal}>
                    {scenarioPrice != null
                      ? `${quoteCurrency === 'USD' ? '$' : ''}${scenarioPrice.toLocaleString('ko-KR', { maximumFractionDigits: quoteCurrency === 'USD' ? 2 : 0 })}`
                      : '—'}
                  </Text>
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.summaryLblScenarioCap}>시나리오 시총: </Text>
                  <Text style={styles.summaryValScenarioStrong}>
                    {scenarioCapWon != null
                      ? formatWonShortKr(scenarioCapWon, { maxAbsWon: FORMAT_WON_SHORT_KR_MARKET_CAP_MAX_ABS })
                      : '—'}
                  </Text>
                </Text>
                <Text style={styles.perPorNote}>{perPorBasisFootnote}</Text>
                <Text style={styles.emRowScenario}>
                  PER {perScenario} · POR {porScenario} · PBR {pbrScenario}
                </Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={[styles.sectionHeading, styles.sectionHeadingUserInput]}>
                잠정 분기 실적 ×4 (선택){' '}
                <Text style={styles.sectionHeadingUserInputSuffix}>계산기</Text>
              </Text>
              <Text style={styles.sheetLead}>분기 영업이익·매출 입력 → ×4 연율, POR·PSR·영업이익률.</Text>
              <Text style={styles.sheetLeadSub}>영업이익</Text>
              <View style={[styles.unitRow, styles.unitRowInCard]}>
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
                style={[styles.input, styles.inputInCard]}
                placeholder="분기 영업이익"
                placeholderTextColor="#888"
                keyboardType="decimal-pad"
                value={provisionalOpEok}
                onChangeText={setProvisionalOpEok}
              />
              <View style={[styles.card, styles.cardInSection]}>
                <Text style={styles.line}>
                  <Text style={styles.summaryLblPrice}>연율 영업이익 (×4): </Text>
                  <Text style={styles.summaryVal}>{formatAnnualKrFromQuarterlyEok(provisionalQOp)}</Text>
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.summaryLblPrice}>현재 시총 기준 POR: </Text>
                  <Text style={styles.summaryValStrong}>{formatPorFromQuarterlyOpEok(capWon, provisionalQOp)}</Text>
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.summaryLblScenarioCap}>시나리오 시총 기준 POR: </Text>
                  <Text style={styles.summaryValScenarioStrong}>
                    {formatPorFromQuarterlyOpEok(scenarioCapWon, provisionalQOp)}
                  </Text>
                </Text>
              </View>
              <Text style={[styles.sheetLeadSub, styles.sheetLeadSubSpaced]}>매출</Text>
              <View style={[styles.unitRow, styles.unitRowInCard]}>
                {OP_SCENARIO_UNITS.map((u) => (
                  <TouchableOpacity
                    key={`prov-rev-u-${u.id}`}
                    style={[styles.unitChip, provisionalRevUnit === u.id && styles.unitChipOn]}
                    onPress={() => setProvisionalRevUnit(u.id)}
                  >
                    <Text style={[styles.unitChipText, provisionalRevUnit === u.id && styles.unitChipTextOn]}>{u.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[styles.input, styles.inputInCard]}
                placeholder="분기 매출"
                placeholderTextColor="#888"
                keyboardType="decimal-pad"
                value={provisionalRevEok}
                onChangeText={setProvisionalRevEok}
              />
              <View style={[styles.card, styles.cardInSection]}>
                <Text style={styles.line}>
                  <Text style={styles.summaryLblPrice}>연율 매출 (×4): </Text>
                  <Text style={styles.summaryVal}>{formatAnnualKrFromQuarterlyEok(provisionalQRev)}</Text>
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.summaryLblPrice}>영업이익률: </Text>
                  <Text style={styles.summaryValStrong}>
                    {formatOpMarginFromQuarterlyEok(provisionalQOp, provisionalQRev)}
                  </Text>
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.summaryLblPrice}>현재 시총 기준 PSR: </Text>
                  <Text style={styles.summaryValStrong}>{formatPsrFromQuarterlyRevEok(capWon, provisionalQRev)}</Text>
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.summaryLblScenarioCap}>시나리오 시총 기준 PSR: </Text>
                  <Text style={styles.summaryValScenarioStrong}>
                    {formatPsrFromQuarterlyRevEok(scenarioCapWon, provisionalQRev)}
                  </Text>
                </Text>
              </View>
              <Text style={styles.scenarioMetricsHint}>{SCENARIO_POR_PSR_METRICS_HINT}</Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={[styles.sectionHeading, styles.sectionHeadingUserInput]}>
                가이던스 분기 실적 ×4 (선택){' '}
                <Text style={styles.sectionHeadingUserInputSuffix}>계산기</Text>
              </Text>
              <Text style={styles.sheetLead}>잠정과 동일 규칙 — 가이던스 분기 영업이익·매출.</Text>
              <Text style={styles.sheetLeadSub}>영업이익</Text>
              <View style={[styles.unitRow, styles.unitRowInCard]}>
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
                style={[styles.input, styles.inputInCard]}
                placeholder="분기 영업이익"
                placeholderTextColor="#888"
                keyboardType="decimal-pad"
                value={guidanceOpEok}
                onChangeText={setGuidanceOpEok}
              />
              <View style={[styles.card, styles.cardInSection]}>
                <Text style={styles.line}>
                  <Text style={styles.summaryLblPrice}>연율 영업이익 (×4): </Text>
                  <Text style={styles.summaryVal}>{formatAnnualKrFromQuarterlyEok(guidanceQOp)}</Text>
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.summaryLblPrice}>현재 시총 기준 POR: </Text>
                  <Text style={styles.summaryValStrong}>{formatPorFromQuarterlyOpEok(capWon, guidanceQOp)}</Text>
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.summaryLblScenarioCap}>시나리오 시총 기준 POR: </Text>
                  <Text style={styles.summaryValScenarioStrong}>{formatPorFromQuarterlyOpEok(scenarioCapWon, guidanceQOp)}</Text>
                </Text>
              </View>
              <Text style={[styles.sheetLeadSub, styles.sheetLeadSubSpaced]}>매출</Text>
              <View style={[styles.unitRow, styles.unitRowInCard]}>
                {OP_SCENARIO_UNITS.map((u) => (
                  <TouchableOpacity
                    key={`guide-rev-u-${u.id}`}
                    style={[styles.unitChip, guidanceRevUnit === u.id && styles.unitChipOn]}
                    onPress={() => setGuidanceRevUnit(u.id)}
                  >
                    <Text style={[styles.unitChipText, guidanceRevUnit === u.id && styles.unitChipTextOn]}>{u.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[styles.input, styles.inputInCard]}
                placeholder="분기 매출"
                placeholderTextColor="#888"
                keyboardType="decimal-pad"
                value={guidanceRevEok}
                onChangeText={setGuidanceRevEok}
              />
              <View style={[styles.card, styles.cardInSection]}>
                <Text style={styles.line}>
                  <Text style={styles.summaryLblPrice}>연율 매출 (×4): </Text>
                  <Text style={styles.summaryVal}>{formatAnnualKrFromQuarterlyEok(guidanceQRev)}</Text>
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.summaryLblPrice}>영업이익률: </Text>
                  <Text style={styles.summaryValStrong}>
                    {formatOpMarginFromQuarterlyEok(guidanceQOp, guidanceQRev)}
                  </Text>
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.summaryLblPrice}>현재 시총 기준 PSR: </Text>
                  <Text style={styles.summaryValStrong}>{formatPsrFromQuarterlyRevEok(capWon, guidanceQRev)}</Text>
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.summaryLblScenarioCap}>시나리오 시총 기준 PSR: </Text>
                  <Text style={styles.summaryValScenarioStrong}>
                    {formatPsrFromQuarterlyRevEok(scenarioCapWon, guidanceQRev)}
                  </Text>
                </Text>
              </View>
              <Text style={styles.scenarioMetricsHint}>{SCENARIO_POR_PSR_METRICS_HINT}</Text>
            </View>
          </>
        ) : null}

        <View style={styles.adWrap}>
          <AdmobNativeAd />
        </View>
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
  adWrap: { marginHorizontal: 12, marginTop: 4 },
  flex: { flex: 1, backgroundColor: '#121212' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 36 },
  hero: { padding: 20, marginBottom: 10 },
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  heroSub: { marginTop: 8, fontSize: 14, color: '#b0bec5', lineHeight: 20 },
  sectionCard: {
    marginHorizontal: 12,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#171b20',
    borderWidth: 1,
    borderColor: '#2a3140',
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: '#eceff1',
    marginBottom: 12,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#42a5f5',
  },
  /** 기업 실적 비교와 동일 — 사용자 입력·시나리오 섹션 */
  sectionHeadingUserInput: {
    borderLeftColor: '#ffb74d',
    color: '#ffe0b2',
  },
  sectionHeadingUserInputSuffix: {
    color: '#ff9800',
    fontWeight: '800',
  },
  sheetLead: {
    fontSize: 12,
    color: '#90a4ae',
    lineHeight: 18,
    marginBottom: 10,
  },
  sheetLeadSub: {
    fontSize: 13,
    fontWeight: '600',
    color: '#b0bec5',
    marginBottom: 6,
  },
  sheetLeadSubSpaced: { marginTop: 14 },
  rowInCard: { marginHorizontal: 0 },
  bleedInCard: { marginHorizontal: 0 },
  inputInCard: { marginHorizontal: 0 },
  primaryBtnInCard: { marginHorizontal: 0, marginBottom: 0 },
  errorInCard: { marginHorizontal: 0, marginTop: 8, marginBottom: 0 },
  percentRowInCard: { marginHorizontal: 0 },
  unitRowInCard: { marginHorizontal: 0 },
  cardInSection: { marginHorizontal: 0, marginBottom: 0, marginTop: 4 },
  subSectionInCard: { marginHorizontal: 0 },
  stockTabsContentInCard: {
    gap: 8,
    paddingHorizontal: 0,
    paddingRight: 12,
    alignItems: 'center',
  },
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
  stockSearchStandaloneBtn: {
    marginTop: 2,
    marginBottom: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#f57c00',
    borderWidth: 2,
    borderColor: '#ffe082',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      android: { elevation: 5 },
      ios: {
        shadowColor: '#e65100',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.45,
        shadowRadius: 4,
      },
    }),
  },
  stockSearchStandaloneBtnText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: 0.25,
    textShadowColor: 'rgba(62, 39, 35, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  stockTabsPortfolioWrap: {
    marginBottom: 4,
    marginTop: 0,
  },
  stockTabsRecentWrap: {
    marginBottom: 8,
    marginTop: 0,
  },
  recentChipWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(189, 189, 189, 0.45)',
    marginRight: 8,
    overflow: 'hidden',
  },
  recentChipWrapActive: {
    backgroundColor: '#00695c',
    borderColor: '#26a69a',
  },
  recentChipLabelArea: {
    flexShrink: 1,
    maxWidth: 148,
    paddingVertical: 7,
    paddingLeft: 12,
    paddingRight: 4,
    justifyContent: 'center',
  },
  recentChipText: {
    fontSize: 13,
    color: '#bdbdbd',
    fontWeight: '600',
  },
  recentChipTextActive: {
    color: '#e0f2f1',
    fontWeight: '700',
  },
  recentChipRemoveBtn: {
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.12)',
  },
  recentChipRemoveMark: {
    fontSize: 14,
    color: '#ef9a9a',
    fontWeight: '700',
    lineHeight: 18,
  },
  recentChipRemoveMarkOnActive: {
    color: '#ffcdd2',
  },
  stockTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(66, 165, 245, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 8,
  },
  stockTabActive: {
    backgroundColor: '#42A5F5',
    borderColor: '#42A5F5',
  },
  stockTabText: {
    fontSize: 14,
    color: '#42A5F5',
    fontWeight: '600',
    maxWidth: 160,
  },
  stockTabTextActive: {
    color: '#FFFFFF',
  },
  subSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#90a4ae',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
  },
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
  summaryLblMuted: { color: '#90a4ae', fontSize: 15 },
  summaryLblPrice: { color: '#64b5f6', fontSize: 15, fontWeight: '600' },
  summaryLblCap: { color: '#ffb74d', fontSize: 15, fontWeight: '600' },
  /** 주가 시나리오·잠정/가이던스 내 시나리오 시총 — 기본 시가총액(주황)과 혼동 방지 */
  summaryLblScenarioCap: { color: '#4dd0e1', fontSize: 15, fontWeight: '600' },
  summaryVal: { color: '#eceff1', fontSize: 15 },
  summaryValStrong: { color: '#fff', fontSize: 15, fontWeight: '600' },
  summaryValScenarioStrong: { color: '#b2ebf2', fontSize: 15, fontWeight: '700' },
  metricRow: { marginBottom: 8, fontSize: 15 },
  metricLblRev: { color: '#4db6ac', fontSize: 15, fontWeight: '600' },
  metricLblOp: { color: '#ba68c8', fontSize: 15, fontWeight: '600' },
  metricLblNet: { color: '#81c784', fontSize: 15, fontWeight: '600' },
  metricVal: { color: '#fafafa', fontSize: 15, fontWeight: '600' },
  fsLabel: { color: '#90caf9', fontSize: 13, marginBottom: 8 },
  /** PER/POR 분모(연율화 등) 설명 — emRow 바로 위 */
  perPorNote: {
    color: '#90a4ae',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6,
    marginTop: 2,
  },
  scenarioMetricsHint: {
    color: '#78909c',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 10,
  },
  metricPeriodInline: {
    color: '#78909c',
    fontSize: 12,
    fontWeight: '500',
  },
  emRow: { color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 0 },
  emRowScenario: { color: '#80deea', fontSize: 17, fontWeight: '700', marginTop: 0 },
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
