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
import { getStockQuote, type StockQuote } from '../src/services/YahooFinanceService';
import { fetchDomesticMarketCapWonFromNaver } from '../src/services/naverFinanceStock';
import { buildYahooFundamentalsGridColumn } from '../src/services/yahooFundamentalsGrid';
import { buildDartFundamentalsGrid } from '../src/services/dart/dartFundamentalsGrid';
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
  fundamentalsQuarterYearChoices,
  buildYearPeriodRowsForChoices,
  buildQuarterPeriodRowsForYear,
  fundamentalsDefaultQuarterWithinChoices,
  FUNDAMENTALS_CALENDAR_YEAR_SPAN,
} from '../src/data/fundamentalsCompareMock';
import { AdmobNativeAd } from '../src/components/AdmobNativeAd';
import StockSearchModal from '../src/components/StockSearchModal';
import { togglePlainPercentSign } from '../src/utils/percentSignToggle';
import { addCommas } from '../src/utils/formatUtils';
import { initDatabase, getAllAccounts, getStocksByAccountId } from '../src/services/DatabaseService';
import type { Stock } from '../src/models/Stock';
import {
  getPriceScenarioRecent,
  pushPriceScenarioRecent,
  removePriceScenarioRecent,
  PRICE_SCENARIO_RECENT_MAX,
  type PriceScenarioRecentEntry,
} from '../src/services/PriceScenarioRecentService';
import { SettingsService, type OpScenarioPersistRow, type OpScenarioPersistUnit } from '../src/services/SettingsService';
import {
  annualizeIncomeForPerPor,
  applyFundamentalsSnapshotFromGrid,
  formatCapBadge,
  formatPerFromCapAndNet,
  formatPorFromCapAndOp,
  formatPorFromQuarterlyOpEok,
  marketCapWonFromQuote,
  OP_SCENARIO_UNITS,
  parseScenarioToQuarterlyOpEok,
  resolveUsdKrwRate,
  type OpScenarioUnit,
  yahooLookupFromMockKey,
} from '../src/lib/capFundamentalsGridResolve';
import {
  buildScenarioStrings,
  parseMoneyInput,
  parsePercentInput,
  resolveScenarioPrice,
  resolveScenarioPriceWithAnchor,
  type ScenarioAnchor,
  type ScenarioParsed,
} from '../src/lib/priceScenarioMath';

function cleanPercentTyping(text: string): string {
  const cleaned = text.replace(/[^0-9.-]/g, '');
  const parts = cleaned.split('.');
  return parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
}

/** 금액·수량 입력: maxFrac 0이면 정수+콤마, 2면 USD식 소수 둘째 자리 */
function formatPriceFieldInput(text: string, maxFrac: number): string {
  if (maxFrac <= 0) {
    const d = text.replace(/[^0-9]/g, '');
    return d === '' ? '' : addCommas(d);
  }
  const c = text.replace(/[^0-9.]/g, '');
  const fd = c.indexOf('.');
  if (fd === -1) {
    const d = c.replace(/[^0-9]/g, '');
    return d === '' ? '' : addCommas(d);
  }
  const intD = c.slice(0, fd).replace(/[^0-9]/g, '');
  const fracRaw = c.slice(fd + 1).replace(/\./g, '');
  const frac = fracRaw.slice(0, maxFrac);
  const intNorm = intD.replace(/^0+(?=\d)/, '');
  const intShow = intNorm === '' ? (intD === '' ? '0' : addCommas(intD)) : addCommas(intNorm);
  if (fracRaw === '' && c.endsWith('.')) return `${intShow}.`;
  return frac === '' ? intShow : `${intShow}.${frac}`;
}

/** 등락률(%): 소수 둘째 자리까지, 음수·중간 입력(5.) 허용 */
function cleanDeltaPctInput(text: string): string {
  const cleaned = text.replace(/[^0-9.-]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  const head = cleaned.slice(0, firstDot + 1);
  const after = cleaned.slice(firstDot + 1).replace(/\./g, '');
  return head + after.slice(0, 2);
}

export default function PriceScenarioProfitScreen() {
  const [currentPriceStr, setCurrentPriceStr] = useState('');
  const [buyPriceStr, setBuyPriceStr] = useState('');
  const [qtyStr, setQtyStr] = useState('');
  const [targetPriceStr, setTargetPriceStr] = useState('');
  const [deltaPctStr, setDeltaPctStr] = useState('');
  const [myReturnPctStr, setMyReturnPctStr] = useState('');
  const [profitWonStr, setProfitWonStr] = useState('');
  const [priceMaxFrac, setPriceMaxFrac] = useState(0);

  const [tickerInput, setTickerInput] = useState('');
  const [showStockModal, setShowStockModal] = useState(false);
  const [granularity, setGranularity] = useState<'year' | 'quarter'>('quarter');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mockKeyResolved, setMockKeyResolved] = useState<string | null>(null);
  const scenarioPersistReadyRef = useRef<string | null>(null);
  const [stockDisplayName, setStockDisplayName] = useState<string | null>(null);
  const [pickedOfficialName, setPickedOfficialName] = useState<string | null>(null);
  const [capWon, setCapWon] = useState<number | null>(null);
  const [quotePrice, setQuotePrice] = useState<number | null>(null);
  const [quoteCurrency, setQuoteCurrency] = useState<string>('KRW');
  const [periodKeyUsed, setPeriodKeyUsed] = useState<string | null>(null);
  const [fsPeriodLabel, setFsPeriodLabel] = useState<string | null>(null);
  const [netIncomeWon, setNetIncomeWon] = useState<number | null>(null);
  const [operatingIncomeWon, setOperatingIncomeWon] = useState<number | null>(null);
  const [displayRevenueKr, setDisplayRevenueKr] = useState<string | null>(null);
  const [displayOperatingIncomeKr, setDisplayOperatingIncomeKr] = useState<string | null>(null);
  const [displayNetIncomeKr, setDisplayNetIncomeKr] = useState<string | null>(null);
  const [revenueWon, setRevenueWon] = useState<number | null>(null);
  const [revenuePeriodSuffix, setRevenuePeriodSuffix] = useState<string | null>(null);
  const [operatingPeriodSuffix, setOperatingPeriodSuffix] = useState<string | null>(null);
  const [netIncomePeriodSuffix, setNetIncomePeriodSuffix] = useState<string | null>(null);

  const [provisionalOpEok, setProvisionalOpEok] = useState('');
  const [provisionalUnit, setProvisionalUnit] = useState<OpScenarioUnit>('jo');
  const [guidanceOpEok, setGuidanceOpEok] = useState('');
  const [guidanceUnit, setGuidanceUnit] = useState<OpScenarioUnit>('jo');

  const [usdKrwApplied, setUsdKrwApplied] = useState(FUNDAMENTALS_USD_KRW_RATE);
  const [portfolioStocks, setPortfolioStocks] = useState<Stock[]>([]);
  const [recentEntries, setRecentEntries] = useState<PriceScenarioRecentEntry[]>([]);

  const quarterYearChoices = useMemo(
    () => fundamentalsQuarterYearChoices(new Date(), FUNDAMENTALS_CALENDAR_YEAR_SPAN),
    []
  );
  const yearPeriodRows = useMemo(() => buildYearPeriodRowsForChoices(quarterYearChoices), [quarterYearChoices]);
  const initQuarter = useMemo(
    () => fundamentalsDefaultQuarterWithinChoices(new Date(), quarterYearChoices),
    [quarterYearChoices]
  );
  const [quarterYear] = useState(initQuarter.quarterYear);
  const latestQuarterCandidates = useMemo(() => buildDartLatestQuarterCandidates(new Date(), 12), []);

  const syncScenarioBlock = useCallback(
    (
      override: Partial<{
        currentPriceStr: string;
        buyPriceStr: string;
        qtyStr: string;
        targetPriceStr: string;
        deltaPctStr: string;
        myReturnPctStr: string;
        profitWonStr: string;
      }>,
      scenarioAnchor?: ScenarioAnchor | null
    ) => {
      const curS = override.currentPriceStr ?? currentPriceStr;
      const buyS = override.buyPriceStr ?? buyPriceStr;
      const qtyS = override.qtyStr ?? qtyStr;
      const tgtS = override.targetPriceStr ?? targetPriceStr;
      const dS = override.deltaPctStr ?? deltaPctStr;
      const rS = override.myReturnPctStr ?? myReturnPctStr;
      const pS = override.profitWonStr ?? profitWonStr;

      const P0 = parseMoneyInput(curS);
      const Pbuy = parseMoneyInput(buyS);
      const Q = parseMoneyInput(qtyS);
      const parsed: ScenarioParsed = {
        target: parseMoneyInput(tgtS),
        deltaPct: parsePercentInput(dS),
        myReturnPct: parsePercentInput(rS),
        profitWon: parseMoneyInput(pS),
      };
      const anchor = scenarioAnchor ?? null;
      let P1 = resolveScenarioPriceWithAnchor(anchor, P0, Pbuy, Q, parsed);
      /** 목표가를 지웠거나 0 이하면 앵커만으로는 P1이 없음 → 목표가 없이 나머지 필드로만 재해석 */
      if (
        anchor === 'target' &&
        (parsed.target == null || !Number.isFinite(parsed.target) || parsed.target <= 0)
      ) {
        P1 = resolveScenarioPrice(P0, Pbuy, Q, { ...parsed, target: null });
      }
      if (P1 == null || !Number.isFinite(P1) || P1 <= 0) {
        if (anchor === 'target') {
          setDeltaPctStr('');
          setMyReturnPctStr('');
          setProfitWonStr('');
        }
        return;
      }
      const s = buildScenarioStrings({ P0, Pbuy, Q, P1, priceMaxFrac });
      /** 방금 고친 칸(앵커)은 입력 문자열 그대로 두고, 나머지 필드만 재계산 결과로 맞춤 */
      const ed = scenarioAnchor === 'delta';
      const er = scenarioAnchor === 'return';
      const et = scenarioAnchor === 'target';
      const ep = scenarioAnchor === 'profit';

      setTargetPriceStr(et ? tgtS : s.target);
      setDeltaPctStr(ed ? dS : s.deltaPct);
      setMyReturnPctStr(er ? rS : s.myReturnPct);
      setProfitWonStr(ep ? pS : s.profitWon);
    },
    [
      priceMaxFrac,
      buyPriceStr,
      currentPriceStr,
      deltaPctStr,
      myReturnPctStr,
      profitWonStr,
      qtyStr,
      targetPriceStr,
    ]
  );

  const syncScenarioBlockRef = useRef(syncScenarioBlock);
  syncScenarioBlockRef.current = syncScenarioBlock;

  useEffect(() => {
    if (mockKeyResolved == null) {
      scenarioPersistReadyRef.current = null;
      setProvisionalOpEok('');
      setProvisionalUnit('jo');
      setGuidanceOpEok('');
      setGuidanceUnit('jo');
      setBuyPriceStr('');
      setQtyStr('');
      setTargetPriceStr('');
      setDeltaPctStr('');
      setMyReturnPctStr('');
      setProfitWonStr('');
      return;
    }
    scenarioPersistReadyRef.current = null;
    const mkLocal = mockKeyResolved;
    let cancelled = false;
    void (async () => {
      const map = await SettingsService.getOpScenarioByMockKey();
      if (cancelled) return;
      const row = map[mkLocal];
      if (row) {
        setProvisionalOpEok(row.provisionalEok);
        setProvisionalUnit(row.provisionalUnit as OpScenarioUnit);
        setGuidanceOpEok(row.guidanceEok);
        setGuidanceUnit(row.guidanceUnit as OpScenarioUnit);
      } else {
        setProvisionalOpEok('');
        setProvisionalUnit('jo');
        setGuidanceOpEok('');
        setGuidanceUnit('jo');
      }
      const ps = row?.priceScenarioInputs;
      if (ps) {
        setBuyPriceStr(ps.buyPriceStr ?? '');
        setQtyStr(ps.qtyStr ?? '');
        setTargetPriceStr(ps.targetPriceStr ?? '');
        setDeltaPctStr(ps.deltaPctStr ?? '');
        setMyReturnPctStr(ps.myReturnPctStr ?? '');
        setProfitWonStr(ps.profitWonStr ?? '');
      } else {
        setBuyPriceStr('');
        setQtyStr('');
        setTargetPriceStr('');
        setDeltaPctStr('');
        setMyReturnPctStr('');
        setProfitWonStr('');
      }
      setTimeout(() => {
        if (cancelled) return;
        syncScenarioBlockRef.current({});
        scenarioPersistReadyRef.current = mkLocal;
      }, 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [mockKeyResolved]);

  useEffect(() => {
    if (mockKeyResolved == null || scenarioPersistReadyRef.current !== mockKeyResolved) return;
    const key = mockKeyResolved;
    const snap: OpScenarioPersistRow = {
      provisionalEok: provisionalOpEok,
      provisionalUnit: provisionalUnit as OpScenarioPersistUnit,
      guidanceEok: guidanceOpEok,
      guidanceUnit: guidanceUnit as OpScenarioPersistUnit,
      priceScenarioInputs: {
        buyPriceStr,
        qtyStr,
        targetPriceStr,
        deltaPctStr,
        myReturnPctStr,
        profitWonStr,
      },
    };
    const t = setTimeout(() => {
      void (async () => {
        const map = await SettingsService.getOpScenarioByMockKey();
        map[key] = snap;
        await SettingsService.setOpScenarioByMockKey(map);
      })();
    }, 400);
    return () => {
      clearTimeout(t);
      void (async () => {
        const map = await SettingsService.getOpScenarioByMockKey();
        map[key] = snap;
        await SettingsService.setOpScenarioByMockKey(map);
      })();
    };
  }, [
    mockKeyResolved,
    provisionalOpEok,
    provisionalUnit,
    guidanceOpEok,
    guidanceUnit,
    buyPriceStr,
    qtyStr,
    targetPriceStr,
    deltaPctStr,
    myReturnPctStr,
    profitWonStr,
  ]);

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

  const perPorBasisFootnote = useMemo(
    () =>
      granularity === 'quarter'
        ? '※ PER·POR는 분기 당기순이익·영업이익을 각각 ×4(연율화)한 금액을 분모로 씁니다.'
        : '※ PER·POR는 연간 당기순이익·영업이익을 분모로 씁니다.',
    [granularity]
  );

  const fsAmountPeriodLabel = granularity === 'quarter' ? '분기' : '연간';

  /** 미국 종목(USD)일 때 수익금(달러) → 적용 환율 기준 원화 안내(금액만 UI에서 강조) */
  const profitUsdKrwHintParts = useMemo(() => {
    if (quoteCurrency !== 'USD') return null;
    if (usdKrwApplied == null || !Number.isFinite(usdKrwApplied) || usdKrwApplied <= 0) return null;
    const usd = parseMoneyInput(profitWonStr);
    if (usd == null || !Number.isFinite(usd)) return null;
    const won = Math.round(usd * usdKrwApplied);
    const rateStr = usdKrwApplied.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
    return {
      wonFormatted: addCommas(String(won)),
      rateStr,
    };
  }, [quoteCurrency, profitWonStr, usdKrwApplied]);

  const scenarioRatio = useMemo(() => {
    const P0 = parseMoneyInput(currentPriceStr);
    const P1 = parseMoneyInput(targetPriceStr);
    if (P0 == null || P0 <= 0 || P1 == null || P1 <= 0) return null;
    return P1 / P0;
  }, [currentPriceStr, targetPriceStr]);

  /** 불러온 시총·시세 기준 → 입력 현재가에 맞게 비례 조정(유통주식수 불변) */
  const inputBasisCapWon = useMemo(() => {
    if (capWon == null || !Number.isFinite(capWon)) return null;
    const P0 = parseMoneyInput(currentPriceStr);
    if (
      quotePrice == null ||
      !Number.isFinite(quotePrice) ||
      quotePrice <= 0 ||
      P0 == null ||
      P0 <= 0
    ) {
      return capWon;
    }
    return capWon * (P0 / quotePrice);
  }, [capWon, currentPriceStr, quotePrice]);

  /** 입력한 현재가가 시세와 다를 때만 입력 기준 시가총액을 따로 표시 */
  const inputPriceDiffersFromQuote = useMemo(() => {
    const P0 = parseMoneyInput(currentPriceStr);
    if (
      quotePrice == null ||
      !Number.isFinite(quotePrice) ||
      quotePrice <= 0 ||
      P0 == null ||
      P0 <= 0
    ) {
      return false;
    }
    const tol = quoteCurrency === 'USD' ? 0.005 : 0.5;
    return Math.abs(P0 - quotePrice) > tol;
  }, [currentPriceStr, quotePrice, quoteCurrency]);

  const scenarioCapWon = useMemo(() => {
    if (inputBasisCapWon == null || !Number.isFinite(inputBasisCapWon) || scenarioRatio == null) {
      return null;
    }
    return inputBasisCapWon * scenarioRatio;
  }, [inputBasisCapWon, scenarioRatio]);

  const provisionalQOp = useMemo(
    () => parseScenarioToQuarterlyOpEok(provisionalOpEok, provisionalUnit),
    [provisionalOpEok, provisionalUnit]
  );
  const guidanceQOp = useMemo(
    () => parseScenarioToQuarterlyOpEok(guidanceOpEok, guidanceUnit),
    [guidanceOpEok, guidanceUnit]
  );

  const perCurrent = formatPerFromCapAndNet(inputBasisCapWon, perDenominator);
  const porCurrent = formatPorFromCapAndOp(inputBasisCapWon, porDenominator);
  const perScenario = formatPerFromCapAndNet(scenarioCapWon, perDenominator);
  const porScenario = formatPorFromCapAndOp(scenarioCapWon, porDenominator);

  const showResults = mockKeyResolved != null && periodKeyUsed != null;

  type FetchFundamentalsOpts = {
    ticker?: string;
    officialNameFromModal?: string | null;
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
          ? opts?.officialNameFromModal?.trim() || null
          : pickedOfficialName;

      const softRefresh = opts?.sameTickerGranularityChange === true;

      const recordRecentIfNeeded = (displayName: string | null) => {
        if (softRefresh) return;
        void pushPriceScenarioRecent(mk, displayName?.trim() || mk).then(setRecentEntries);
      };

      setLoading(true);
      setError(null);
      if (!softRefresh) {
        setMockKeyResolved(null);
        setStockDisplayName(null);
        setCapWon(null);
        setQuotePrice(null);
        setPeriodKeyUsed(null);
        setFsPeriodLabel(null);
        setNetIncomeWon(null);
        setOperatingIncomeWon(null);
        setDisplayRevenueKr(null);
        setDisplayOperatingIncomeKr(null);
        setDisplayNetIncomeKr(null);
        setRevenueWon(null);
        setRevenuePeriodSuffix(null);
        setOperatingPeriodSuffix(null);
        setNetIncomePeriodSuffix(null);
        setBuyPriceStr('');
        setQtyStr('');
        setTargetPriceStr('');
        setDeltaPctStr('');
        setMyReturnPctStr('');
        setProfitWonStr('');
      }

      try {
        const yahooSym = yahooLookupFromMockKey(mk);
        const [usdKrw, quote] = await Promise.all([resolveUsdKrwRate(), getStockQuote(yahooSym)]);
        setUsdKrwApplied(usdKrw);
        if (quote != null && Number.isFinite(quote.price) && quote.price > 0) {
          setQuotePrice(quote.price);
          const cur = (quote.currency || 'KRW').toUpperCase();
          setQuoteCurrency(cur);
          setPriceMaxFrac(cur === 'USD' ? 2 : 0);
          if (!softRefresh) {
            if (cur === 'USD') {
              const x = Math.round(quote.price * 100) / 100;
              const [inte, fr] = x.toFixed(2).split('.');
              setCurrentPriceStr(`${addCommas(inte)}.${fr}`);
            } else {
              setCurrentPriceStr(addCommas(String(Math.round(quote.price))));
            }
          }
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
          const periodKeysQ = [
            ...new Set([
              ...buildQuarterPeriodRowsForYear(quarterYear).map((r) => r.periodKey),
              ...latestQuarterCandidates,
            ]),
          ];
          const periodKeys = granularity === 'year' ? periodKeysYear : periodKeysQ;

          const [grid, naverCap] = await Promise.all([
            buildDartFundamentalsGrid({
              apiKey,
              domesticTickerKeys: [mk],
              periodKeys,
              granularity,
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
            yearPeriodRows
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
          const resolvedLabel = labelFromPicker || (quote?.name && quote.name.trim()) || null;
          setStockDisplayName(resolvedLabel);
          recordRecentIfNeeded(resolvedLabel);
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
            setRevenueWon(null);
            recordRecentIfNeeded(labelFromPicker || (quote?.name && quote.name.trim()) || null);
            setLoading(false);
            return;
          }

          setNetIncomeWon(resolved.netIncomeWon);
          setOperatingIncomeWon(resolved.operatingIncomeWon);
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

          const resolvedLabel = labelFromPicker || (quote?.name && quote.name.trim()) || null;
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
    [
      tickerInput,
      granularity,
      quarterYear,
      latestQuarterCandidates,
      yearPeriodRows,
      pickedOfficialName,
    ]
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
    void getPriceScenarioRecent().then(setRecentEntries);
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
        console.error('주가 시나리오 계산기 포트폴리오 로드 오류:', e);
      }
    };
    void loadPortfolioStocks();
  }, []);

  useEffect(() => {
    if (mockKeyResolved == null) return;
    void fetchFundamentals({
      ticker: mockKeyResolved,
      sameTickerGranularityChange: true,
    });
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
    (entry: PriceScenarioRecentEntry) => {
      const trimmed = entry.officialName.trim() === entry.mockKey ? null : entry.officialName.trim() || null;
      setTickerInput(entry.mockKey);
      setPickedOfficialName(trimmed);
      void fetchFundamentals({ ticker: entry.mockKey, officialNameFromModal: trimmed });
    },
    [fetchFundamentals]
  );

  const onRemoveRecentEntry = useCallback((mockKey: string) => {
    void removePriceScenarioRecent(mockKey).then(setRecentEntries);
  }, []);

  const onTickerInputChange = useCallback((text: string) => {
    setTickerInput(text);
    setPickedOfficialName(null);
  }, []);

  const handleDeltaPctChange = useCallback(
    (text: string) => {
      const t = cleanDeltaPctInput(text);
      setDeltaPctStr(t);
      syncScenarioBlock({ deltaPctStr: t }, 'delta');
    },
    [syncScenarioBlock]
  );

  const handleMyReturnPctChange = useCallback(
    (text: string) => {
      const t = cleanPercentTyping(text);
      setMyReturnPctStr(t);
      syncScenarioBlock({ myReturnPctStr: t }, 'return');
    },
    [syncScenarioBlock]
  );

  const handleTargetChange = useCallback(
    (text: string) => {
      const t = formatPriceFieldInput(text, priceMaxFrac);
      setTargetPriceStr(t);
      syncScenarioBlock({ targetPriceStr: t }, 'target');
    },
    [syncScenarioBlock, priceMaxFrac]
  );

  const handleProfitWonChange = useCallback(
    (text: string) => {
      const t = formatPriceFieldInput(text, priceMaxFrac);
      setProfitWonStr(t);
      syncScenarioBlock({ profitWonStr: t }, 'profit');
    },
    [syncScenarioBlock, priceMaxFrac]
  );

  const handleCurrentPriceChange = useCallback(
    (text: string) => {
      const t = formatPriceFieldInput(text, priceMaxFrac);
      setCurrentPriceStr(t);
      syncScenarioBlock({ currentPriceStr: t });
    },
    [syncScenarioBlock, priceMaxFrac]
  );

  const handleBuyChange = useCallback(
    (text: string) => {
      const t = formatPriceFieldInput(text, priceMaxFrac);
      setBuyPriceStr(t);
      syncScenarioBlock({ buyPriceStr: t });
    },
    [syncScenarioBlock, priceMaxFrac]
  );

  const handleQtyChange = useCallback(
    (text: string) => {
      const t = formatPriceFieldInput(text, 0);
      setQtyStr(t);
      syncScenarioBlock({ qtyStr: t });
    },
    [syncScenarioBlock]
  );

  const formatPriceLine = (p: number | null, cur: string) => {
    if (p == null || !Number.isFinite(p)) return '—';
    return `${cur === 'USD' ? '$' : ''}${p.toLocaleString('ko-KR', { maximumFractionDigits: cur === 'USD' ? 2 : 0 })}${cur === 'USD' ? '' : ' 원'}`;
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={['#1565c0', '#121212']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroTitle}>주가 시나리오 수익 계산기</Text>
          <Text style={styles.heroSub}>
            ① 현재가·등락률·목표 주가와 ② 매수가·수량·수익률·수익금이 서로 연동됩니다. 종목은 선택 사항이며, 불러오면 시총·PER·POR·잠정·가이던스를 함께 볼 수 있습니다.
          </Text>
        </LinearGradient>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>종목 (선택사항)</Text>
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
              <Text style={[styles.subSectionLabel, styles.subSectionInCard]}>최근 {PRICE_SCENARIO_RECENT_MAX}개</Text>
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
              ? '포트폴리오·검색·최근에서 불러오면 시세로 현재가를 채우고, 더 아래에 기간 단위·요약·시총·PER·POR이 나타납니다. 현재가는 아래 주가 시나리오에서 언제든 수정할 수 있습니다.'
              : '검색·최근·티커 입력 후 불러오기를 사용하세요. 최근 항목 ✕는 목록에서만 삭제합니다.'}
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

        <View style={styles.sectionCard}>
          <Text style={[styles.sectionHeading, styles.sectionHeadingUserInput]}>
            ① 주가 시나리오 <Text style={styles.sectionHeadingUserInputSuffix}>(현재가 기준)</Text>
          </Text>
          <Text style={styles.sheetLead}>
            등락률(%)과 목표 주가 모두 직접 입력할 수 있습니다. 한쪽을 고치면 다른 쪽·② 포지션 값이 그에 맞춰집니다.
          </Text>
          <Text style={styles.fieldLabel}>현재가 (직접 수정 가능)</Text>
          <TextInput
            style={[styles.input, styles.inputInCard]}
            placeholder="종목을 선택하면 현재가를 가져올 수 있습니다."
            placeholderTextColor="#888"
            keyboardType="decimal-pad"
            value={currentPriceStr}
            onChangeText={handleCurrentPriceChange}
          />
          {quotePrice != null ? (
            <Text style={styles.hintMuted}>불러온 시세: {formatPriceLine(quotePrice, quoteCurrency)}</Text>
          ) : null}
          <Text style={styles.fieldLabel}>등락률 (%)</Text>
          <View style={[styles.percentRow, styles.percentRowInCard]}>
            <TextInput
              style={[styles.input, styles.inputInCard, styles.percentInput]}
              placeholder="예: 5, -3, 1.25"
              placeholderTextColor="#888"
              keyboardType="decimal-pad"
              value={deltaPctStr}
              onChangeText={handleDeltaPctChange}
            />
            <TouchableOpacity
              style={styles.signToggleBtn}
              onPress={() =>
                togglePlainPercentSign(deltaPctStr, (next) => handleDeltaPctChange(cleanDeltaPctInput(next)))
              }
              activeOpacity={0.75}
              accessibilityLabel="부호 바꾸기"
            >
              <Text style={styles.signToggleText}>±</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.fieldLabel}>목표 주가</Text>
          <TextInput
            style={[styles.input, styles.inputInCard]}
            placeholder="시나리오 주가"
            placeholderTextColor="#888"
            keyboardType="decimal-pad"
            value={targetPriceStr}
            onChangeText={handleTargetChange}
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={[styles.sectionHeading, styles.sectionHeadingUserInput]}>
            ② 내 포지션 <Text style={styles.sectionHeadingUserInputSuffix}>(매수가 기준)</Text>
          </Text>
          <Text style={styles.sheetLead}>
            매수가·수량·내 수익률·수익금이 연동됩니다. 전체 우선순위는 목표가 → 등락률 → 수익률 → 수익금 순입니다.
          </Text>
          <Text style={styles.fieldLabel}>매수가</Text>
          <TextInput
            style={[styles.input, styles.inputInCard]}
            placeholder="평균 매수가"
            placeholderTextColor="#888"
            keyboardType="decimal-pad"
            value={buyPriceStr}
            onChangeText={handleBuyChange}
          />
          <Text style={styles.fieldLabel}>수량</Text>
          <TextInput
            style={[styles.input, styles.inputInCard]}
            placeholder="보유 수량"
            placeholderTextColor="#888"
            keyboardType="decimal-pad"
            value={qtyStr}
            onChangeText={handleQtyChange}
          />
          <Text style={styles.fieldLabel}>내 수익률 (%)</Text>
          <View style={[styles.percentRow, styles.percentRowInCard]}>
            <TextInput
              style={[styles.input, styles.inputInCard, styles.percentInput]}
              placeholder="매수가 대비"
              placeholderTextColor="#888"
              keyboardType="decimal-pad"
              value={myReturnPctStr}
              onChangeText={handleMyReturnPctChange}
            />
            <TouchableOpacity
              style={styles.signToggleBtn}
              onPress={() => togglePlainPercentSign(myReturnPctStr, handleMyReturnPctChange)}
              activeOpacity={0.75}
              accessibilityLabel="부호 바꾸기"
            >
              <Text style={styles.signToggleText}>±</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.fieldLabel}>수익금 (추정)</Text>
          <TextInput
            style={[styles.input, styles.inputInCard]}
            placeholder="순손익 금액"
            placeholderTextColor="#888"
            keyboardType="decimal-pad"
            value={profitWonStr}
            onChangeText={handleProfitWonChange}
          />
          {profitUsdKrwHintParts != null ? (
            <Text style={[styles.hintBelowInput, styles.profitKrwHintRow]}>
              <Text style={styles.profitKrwHintLead}>원화 환산 약 </Text>
              <Text style={styles.profitKrwHintAmount}>{profitUsdKrwHintParts.wonFormatted}원</Text>
              <Text style={styles.profitKrwHintTail}>
                {' '}
                (수익금 USD × {profitUsdKrwHintParts.rateStr})
              </Text>
            </Text>
          ) : null}
        </View>

        {showResults ? (
          <>
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
                실적 기준 PER/POR에 쓰입니다. 분기는 당분기 손익 ×4 연율화, 연도는 연간 손익 그대로입니다. 바꾸면 아래 수치가 자동으로 다시 맞춰집니다.
              </Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeading}>요약 (불러온 종목)</Text>
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
                {inputPriceDiffersFromQuote && quotePrice != null ? (
                  <>
                    <Text style={styles.line}>
                      <Text style={styles.summaryLblPrice}>현재가: </Text>
                      <Text style={styles.summaryVal}>
                        {formatPriceLine(quotePrice, quoteCurrency)}
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
                    <Text style={styles.line}>
                      <Text style={styles.summaryLblPrice}>입력한 현재가: </Text>
                      <Text style={styles.summaryVal}>
                        {formatPriceLine(parseMoneyInput(currentPriceStr), quoteCurrency)}
                      </Text>
                    </Text>
                    <Text style={styles.line}>
                      <Text style={styles.summaryLblCap}>시가총액(입력한 현재가 기준): </Text>
                      <Text style={styles.summaryValStrong}>
                        {inputBasisCapWon != null
                          ? formatWonShortKr(inputBasisCapWon, {
                              maxAbsWon: FORMAT_WON_SHORT_KR_MARKET_CAP_MAX_ABS,
                            })
                          : '—'}
                      </Text>
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.line}>
                      <Text style={styles.summaryLblPrice}>현재가: </Text>
                      <Text style={styles.summaryVal}>
                        {formatPriceLine(parseMoneyInput(currentPriceStr), quoteCurrency)}
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
                  </>
                )}
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
                <Text style={styles.emRow}>PER {perCurrent} · POR {porCurrent}</Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={[styles.sectionHeading, styles.sectionHeadingUserInput]}>
                시나리오 시총 · PER · POR{' '}
                <Text style={styles.sectionHeadingUserInputSuffix}>(위 목표가 반영)</Text>
              </Text>
              <Text style={styles.sheetLead}>
                {inputPriceDiffersFromQuote
                  ? '시가총액(입력한 현재가 기준)에 (목표 주가 ÷ 입력 현재가) 비율을 곱합니다. 유통주식수 불변 가정입니다.'
                  : '시가총액에 (목표 주가 ÷ 입력 현재가) 비율을 곱합니다. 유통주식수 불변 가정입니다.'}
              </Text>
              <View style={[styles.card, styles.cardInSection]}>
                <Text style={styles.line}>
                  <Text style={styles.summaryLblPrice}>목표 주가: </Text>
                  <Text style={styles.summaryVal}>
                    {parseMoneyInput(targetPriceStr) != null
                      ? formatPriceLine(parseMoneyInput(targetPriceStr), quoteCurrency)
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
                  PER {perScenario} · POR {porScenario}
                </Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={[styles.sectionHeading, styles.sectionHeadingUserInput]}>
                잠정 분기 영업이익 ×4 (선택){' '}
                <Text style={styles.sectionHeadingUserInputSuffix}>시총계산기와 동일 저장</Text>
              </Text>
              <Text style={styles.sheetLead}>분기 영업이익 숫자·단위 입력 → ×4 연율화 후 POR만 표시.</Text>
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
                  <Text style={styles.summaryLblPrice}>
                    {inputPriceDiffersFromQuote ? '입력한 현재가 시총 기준 POR: ' : '현재 시총 기준 POR: '}
                  </Text>
                  <Text style={styles.summaryValStrong}>
                    {formatPorFromQuarterlyOpEok(inputBasisCapWon, provisionalQOp)}
                  </Text>
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.summaryLblScenarioCap}>시나리오 시총 기준 POR: </Text>
                  <Text style={styles.summaryValScenarioStrong}>
                    {formatPorFromQuarterlyOpEok(scenarioCapWon, provisionalQOp)}
                  </Text>
                </Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={[styles.sectionHeading, styles.sectionHeadingUserInput]}>
                가이던스 분기 영업이익 ×4 (선택){' '}
                <Text style={styles.sectionHeadingUserInputSuffix}>동일 저장 키</Text>
              </Text>
              <Text style={styles.sheetLead}>잠정과 동일 규칙으로 가이던스 분기 영업이익을 넣으면 POR을 봅니다.</Text>
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
                  <Text style={styles.summaryLblPrice}>
                    {inputPriceDiffersFromQuote ? '입력한 현재가 시총 기준 POR: ' : '현재 시총 기준 POR: '}
                  </Text>
                  <Text style={styles.summaryValStrong}>
                    {formatPorFromQuarterlyOpEok(inputBasisCapWon, guidanceQOp)}
                  </Text>
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.summaryLblScenarioCap}>시나리오 시총 기준 POR: </Text>
                  <Text style={styles.summaryValScenarioStrong}>{formatPorFromQuarterlyOpEok(scenarioCapWon, guidanceQOp)}</Text>
                </Text>
              </View>
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
  fieldLabel: { color: '#90a4ae', fontSize: 13, marginBottom: 6, marginTop: 4 },
  hintMuted: { color: '#78909c', fontSize: 12, marginBottom: 8 },
  hintBelowInput: { marginTop: -4, marginBottom: 6 },
  profitKrwHintRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' },
  profitKrwHintLead: { color: '#90a4ae', fontSize: 13 },
  profitKrwHintAmount: {
    color: '#fff9c4',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  profitKrwHintTail: { color: '#78909c', fontSize: 12 },
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
  stockTabsPortfolioWrap: { marginBottom: 4, marginTop: 0 },
  stockTabsRecentWrap: { marginBottom: 8, marginTop: 0 },
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
