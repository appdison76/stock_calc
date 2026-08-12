import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Currency } from '../src/models/Currency';
import { ExchangeRateService } from '../src/services/ExchangeRateService';
import { CurrencySwitch } from '../src/components/CurrencySwitch';
import { CalculationResultCard } from '../src/components/CalculationResultCard';
import { SharedResultSection } from '../src/components/SharedResultSection';
import { AdmobNativeAd } from '../src/components/AdmobNativeAd';
import { CompoundStepTable } from '../src/components/baseCompound/CompoundStepTable';
import { PathTimeline } from '../src/components/baseCompound/PathTimeline';
import { baseCompoundStyles as s } from '../src/components/baseCompound/baseCompoundStyles';
import {
  calcBaseRecovery,
  calcCompoundSteps,
  calcContinuousScenario,
  buildBaseRecoveryTimeline,
  buildRecoveryStepRow,
  cumulativeOutcomeWord,
  formatChangePctDescription,
  formatMultiplierDisplay,
  formatPctDisplay,
  signedPctDisplay,
  stepDirectionWord,
  syncBaseRecoveryFields,
  type BaseRecoveryDriver,
  type BaseRecoveryFieldStrings,
  type CompoundStepsResult,
  type ContinuousScenarioResult,
  type CompoundStepRow,
} from '../src/lib/baseCompoundCalc';
import { addCommas, formatCurrency, formatPriceFieldInput } from '../src/utils/formatUtils';
import { togglePlainPercentSign } from '../src/utils/percentSignToggle';

type TabId = 'base' | 'negative' | 'positive' | 'path';
type PathTargetMode = 'pathOnly' | 'price' | 'percent';

type PathScenarioResult =
  | { kind: 'pathOnly'; drops: CompoundStepsResult }
  | { kind: 'withRecovery'; scenario: ContinuousScenarioResult };

const TABS: { id: TabId; label: string }[] = [
  { id: 'path', label: '경로 시나리오' },
  { id: 'base', label: '모수효과' },
  { id: 'negative', label: '음의복리' },
  { id: 'positive', label: '양의복리' },
];

const NEGATIVE_PRESETS = [-10, -20, -30, -50];
const POSITIVE_PRESETS = [10, 20, 30, 50];
const MAX_PATH_STEPS = 20;
const DEFAULT_PATH_STEPS = ['-10', '-10', '-10'];

function parsePrice(raw: string): number | null {
  const n = parseFloat(raw.replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parsePct(raw: string): number | null {
  const n = parseFloat(raw.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseCount(raw: string): number {
  const n = parseInt(raw.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 50) : 1;
}

function priceMaxFrac(currency: Currency): 0 | 2 {
  return currency === Currency.USD ? 2 : 0;
}

function cleanPriceTyping(text: string, currency: Currency): string {
  return formatPriceFieldInput(text, priceMaxFrac(currency));
}

function cleanPctTyping(text: string): string {
  const cleaned = text.replace(/[^0-9.\-+]/g, '');
  const parts = cleaned.split('.');
  return parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
}

function formatKrwFromUsd(usd: number, exchangeRate: number): string {
  return `${addCommas(String(Math.round(usd * exchangeRate)))}원`;
}

function parsePathStepPcts(steps: string[]): number[] | null {
  if (steps.length === 0) return null;
  const pcts: number[] = [];
  for (const raw of steps) {
    if (raw.trim() === '') return null;
    const n = parsePct(raw);
    if (n == null) return null;
    pcts.push(n);
  }
  return pcts;
}

export default function BaseCompoundCalculatorView() {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(Currency.KRW);
  const [activeTab, setActiveTab] = useState<TabId>('path');
  const [usdExchangeRate, setUsdExchangeRate] = useState('1350');
  const [isLoadingExchangeRate, setIsLoadingExchangeRate] = useState(false);

  // 모수효과
  const [krwPeak, setKrwPeak] = useState('');
  const [usdPeak, setUsdPeak] = useState('');
  const [krwBottom, setKrwBottom] = useState('');
  const [usdBottom, setUsdBottom] = useState('');
  const [krwTarget, setKrwTarget] = useState('');
  const [usdTarget, setUsdTarget] = useState('');
  const [dropPct, setDropPct] = useState('-10');

  // 음·양 복리 (탭별 시작가)
  const [krwNegStart, setKrwNegStart] = useState('');
  const [usdNegStart, setUsdNegStart] = useState('');
  const [krwPosStart, setKrwPosStart] = useState('');
  const [usdPosStart, setUsdPosStart] = useState('');
  const [negStepPct, setNegStepPct] = useState('-10');
  const [posStepPct, setPosStepPct] = useState('10');
  const [negStepCount, setNegStepCount] = useState('3');
  const [posStepCount, setPosStepCount] = useState('3');

  // 경로 시나리오 (탭 전용 시작·최종)
  const [krwPathStart, setKrwPathStart] = useState('');
  const [usdPathStart, setUsdPathStart] = useState('');
  const [krwPathTarget, setKrwPathTarget] = useState('');
  const [usdPathTarget, setUsdPathTarget] = useState('');
  const [pathStepPcts, setPathStepPcts] = useState<string[]>(DEFAULT_PATH_STEPS);
  const [pathTargetMode, setPathTargetMode] = useState<PathTargetMode>('pathOnly');
  const [pathProfitPct, setPathProfitPct] = useState('30');

  const peak = selectedCurrency === Currency.KRW ? krwPeak : usdPeak;
  const bottom = selectedCurrency === Currency.KRW ? krwBottom : usdBottom;
  const baseTarget = selectedCurrency === Currency.KRW ? krwTarget : usdTarget;
  const negStart = selectedCurrency === Currency.KRW ? krwNegStart : usdNegStart;
  const posStart = selectedCurrency === Currency.KRW ? krwPosStart : usdPosStart;
  const pathStart = selectedCurrency === Currency.KRW ? krwPathStart : usdPathStart;
  const pathTarget = selectedCurrency === Currency.KRW ? krwPathTarget : usdPathTarget;

  const setPeak = selectedCurrency === Currency.KRW ? setKrwPeak : setUsdPeak;
  const setBottom = selectedCurrency === Currency.KRW ? setKrwBottom : setUsdBottom;
  const setBaseTarget = selectedCurrency === Currency.KRW ? setKrwTarget : setUsdTarget;
  const setNegStart = selectedCurrency === Currency.KRW ? setKrwNegStart : setUsdNegStart;
  const setPosStart = selectedCurrency === Currency.KRW ? setKrwPosStart : setUsdPosStart;
  const setPathStart = selectedCurrency === Currency.KRW ? setKrwPathStart : setUsdPathStart;
  const setPathTarget = selectedCurrency === Currency.KRW ? setKrwPathTarget : setUsdPathTarget;

  const exchangeRateNum =
    selectedCurrency === Currency.USD ? parseFloat(usdExchangeRate.replace(/,/g, '')) : undefined;

  useEffect(() => {
    if (selectedCurrency === Currency.USD) {
      loadExchangeRate();
    }
  }, [selectedCurrency]);

  const loadExchangeRate = async () => {
    setIsLoadingExchangeRate(true);
    try {
      const rate = await ExchangeRateService.getUsdToKrwRate();
      setUsdExchangeRate(rate.toFixed(2));
    } catch {
      /* 기본값 유지 */
    } finally {
      setIsLoadingExchangeRate(false);
    }
  };

  const handlePriceInput = useCallback(
    (text: string, setter: (v: string) => void) => {
      setter(formatPriceFieldInput(text, priceMaxFrac(selectedCurrency)));
    },
    [selectedCurrency],
  );

  const syncBaseForCurrency = useCallback(
    (driver: BaseRecoveryDriver, patch: Partial<BaseRecoveryFieldStrings>) => {
      const isKrw = selectedCurrency === Currency.KRW;
      const syncOptions = { priceMaxFractionDigits: priceMaxFrac(selectedCurrency) };

      const values: BaseRecoveryFieldStrings = {
        peak: patch.peak ?? (isKrw ? krwPeak : usdPeak),
        bottom: patch.bottom ?? (isKrw ? krwBottom : usdBottom),
        target: patch.target ?? (isKrw ? krwTarget : usdTarget),
        dropPct: patch.dropPct ?? dropPct,
      };

      const next = syncBaseRecoveryFields(driver, values, syncOptions);

      if (isKrw) {
        setKrwPeak(next.peak);
        setKrwBottom(next.bottom);
        setKrwTarget(next.target);
      } else {
        setUsdPeak(next.peak);
        setUsdBottom(next.bottom);
        setUsdTarget(next.target);
      }
      setDropPct(next.dropPct);
    },
    [selectedCurrency, krwPeak, krwBottom, krwTarget, usdPeak, usdBottom, usdTarget, dropPct],
  );

  const handleBasePeakInput = useCallback(
    (text: string) => syncBaseForCurrency('peak', { peak: cleanPriceTyping(text, selectedCurrency) }),
    [syncBaseForCurrency, selectedCurrency],
  );

  const handleBaseBottomInput = useCallback(
    (text: string) => syncBaseForCurrency('bottom', { bottom: cleanPriceTyping(text, selectedCurrency) }),
    [syncBaseForCurrency, selectedCurrency],
  );

  const handleBaseDropInput = useCallback(
    (text: string) => syncBaseForCurrency('drop', { dropPct: cleanPctTyping(text) }),
    [syncBaseForCurrency],
  );

  const handleBaseDropSignToggle = useCallback(() => {
    togglePlainPercentSign(dropPct, (next) => syncBaseForCurrency('drop', { dropPct: next }));
  }, [dropPct, syncBaseForCurrency]);

  const handleBaseTargetInput = useCallback(
    (text: string) => syncBaseForCurrency('target', { target: cleanPriceTyping(text, selectedCurrency) }),
    [syncBaseForCurrency, selectedCurrency],
  );

  const handleResetTargetToStart = useCallback(() => {
    if (!peak) return;
    syncBaseForCurrency('target', { target: peak });
  }, [peak, syncBaseForCurrency]);

  const targetMatchesStart = peak !== '' && baseTarget === peak;
  const pathTargetMatchesStart = pathStart !== '' && pathTarget === pathStart;

  const handleResetPathTargetToStart = useCallback(() => {
    if (!pathStart) return;
    setPathTarget(pathStart);
  }, [pathStart, setPathTarget]);

  const handlePathStartInput = useCallback(
    (text: string) => {
      const formatted = formatPriceFieldInput(text, priceMaxFrac(selectedCurrency));
      setPathStart(formatted);
      if (pathTargetMode === 'price') {
        setPathTarget(formatted);
      }
    },
    [pathTargetMode, selectedCurrency, setPathStart, setPathTarget],
  );

  const selectPathPriceMode = useCallback(() => {
    setPathTargetMode('price');
    if (pathStart && pathTarget === '') {
      setPathTarget(pathStart);
    }
  }, [pathStart, pathTarget, setPathTarget]);

  const handlePctInput = useCallback((text: string, setter: (v: string) => void) => {
    const cleaned = text.replace(/[^0-9.\-+]/g, '');
    const parts = cleaned.split('.');
    const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
    setter(formatted);
  }, []);

  const handleCountInput = useCallback((text: string, setter: (v: string) => void) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setter(cleaned);
  }, []);

  const updatePathStep = useCallback((index: number, value: string) => {
    setPathStepPcts((prev) => prev.map((step, i) => (i === index ? value : step)));
  }, []);

  const togglePathStepSign = useCallback((index: number) => {
    setPathStepPcts((prev) => {
      let nextValue = prev[index];
      togglePlainPercentSign(prev[index], (v) => {
        nextValue = v;
      });
      return prev.map((step, i) => (i === index ? nextValue : step));
    });
  }, []);

  const addPathStep = useCallback(() => {
    setPathStepPcts((prev) => (prev.length >= MAX_PATH_STEPS ? prev : [...prev, '-10']));
  }, []);

  const removePathStep = useCallback((index: number) => {
    setPathStepPcts((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  const baseResult = useMemo(() => {
    return calcBaseRecovery({
      peak: parsePrice(peak),
      bottom: parsePrice(bottom),
      target: parsePrice(baseTarget),
      dropPct: parsePct(dropPct),
    });
  }, [peak, bottom, baseTarget, dropPct]);

  const negResult = useMemo(() => {
    const startN = parsePrice(negStart);
    const pct = parsePct(negStepPct);
    const count = parseCount(negStepCount);
    if (startN == null || pct == null) return null;
    const steps = Array.from({ length: count }, () => pct);
    return calcCompoundSteps(startN, steps);
  }, [negStart, negStepPct, negStepCount]);

  const posResult = useMemo(() => {
    const startN = parsePrice(posStart);
    const pct = parsePct(posStepPct);
    const count = parseCount(posStepCount);
    if (startN == null || pct == null) return null;
    const steps = Array.from({ length: count }, () => pct);
    return calcCompoundSteps(startN, steps);
  }, [posStart, posStepPct, posStepCount]);

  const pathResult = useMemo((): PathScenarioResult | null => {
    const startN = parsePrice(pathStart);
    const stepPcts = parsePathStepPcts(pathStepPcts);
    if (startN == null || stepPcts == null) return null;

    const drops = calcCompoundSteps(startN, stepPcts);
    if (!drops) return null;

    if (pathTargetMode === 'pathOnly') {
      return { kind: 'pathOnly', drops };
    }

    let targetN: number | null = null;
    if (pathTargetMode === 'price') {
      targetN = parsePrice(pathTarget) ?? startN;
    } else {
      const profit = parsePct(pathProfitPct);
      if (profit == null) return null;
      targetN = drops.final * (1 + profit / 100);
    }

    if (targetN == null || targetN <= 0) return null;
    const scenario = calcContinuousScenario({
      start: startN,
      stepPcts,
      target: targetN,
    });
    if (!scenario) return null;
    return { kind: 'withRecovery', scenario };
  }, [pathStart, pathTarget, pathStepPcts, pathTargetMode, pathProfitPct]);

  const hasBaseResult = baseResult != null;
  const hasNegResult = negResult != null;
  const hasPosResult = posResult != null;
  const hasPathResult = pathResult != null;

  const buildShareText = (): string => {
    const cur = selectedCurrency === Currency.KRW ? 'KRW' : 'USD';
    const lines: string[] = ['[음·양 복리·모수 계산기]'];

    if (activeTab === 'base' && baseResult) {
      lines.push(
        `시작가 ${formatCurrency(baseResult.peak, selectedCurrency)}`,
        `변동 후 ${formatCurrency(baseResult.bottom, selectedCurrency)} (변동 ${signedPctDisplay(baseResult.dropPct)})`,
        `최종 ${formatCurrency(baseResult.target, selectedCurrency)}`,
        `최종 가격까지 ${signedPctDisplay(baseResult.recoveryPct)} (${formatMultiplierDisplay(baseResult.multiplier)}배)`,
      );
    } else if (activeTab === 'negative' && negResult) {
      const stepPctN = parsePct(negStepPct) ?? 0;
      lines.push(
        `시작 ${formatCurrency(negResult.start, selectedCurrency)}`,
        `${negStepCount}회 ${signedPctDisplay(stepPctN)} → ${formatCurrency(negResult.final, selectedCurrency)}`,
        `총 ${signedPctDisplay(negResult.totalPct)} (${formatMultiplierDisplay(negResult.multiplier)}배)`,
      );
      if (negResult.breakevenToStartPct != null) {
        lines.push(`원래가까지 ${signedPctDisplay(negResult.breakevenToStartPct)}`);
      }
    } else if (activeTab === 'positive' && posResult) {
      const stepPctN = parsePct(posStepPct) ?? 0;
      lines.push(
        `시작 ${formatCurrency(posResult.start, selectedCurrency)}`,
        `${posStepCount}회 ${signedPctDisplay(stepPctN)} → ${formatCurrency(posResult.final, selectedCurrency)}`,
        `총 ${signedPctDisplay(posResult.totalPct)} (${formatMultiplierDisplay(posResult.multiplier)}배)`,
      );
      if (posResult.breakevenToStartPct != null) {
        lines.push(`원래가까지 ${signedPctDisplay(posResult.breakevenToStartPct)}`);
      }
    } else if (activeTab === 'path' && pathResult) {
      const stepLabels = pathStepPcts
        .map((raw) => signedPctDisplay(parsePct(raw) ?? 0))
        .join(' → ');
      if (pathResult.kind === 'pathOnly') {
        const drops = pathResult.drops;
        lines.push(
          `시작 ${formatCurrency(drops.start, selectedCurrency)}`,
          `경로 ${stepLabels}`,
          `→ 변동 후 ${formatCurrency(drops.final, selectedCurrency)}`,
          `누적 ${signedPctDisplay(drops.totalPct)} (${formatMultiplierDisplay(drops.multiplier)}배)`,
        );
        if (drops.breakevenToStartPct != null) {
          lines.push(`원래가까지 ${signedPctDisplay(drops.breakevenToStartPct)}`);
        }
      } else {
        const { scenario } = pathResult;
        lines.push(
          `시작 ${formatCurrency(scenario.drops.start, selectedCurrency)}`,
          `경로 ${stepLabels}`,
          `→ 변동 후 ${formatCurrency(scenario.bottom, selectedCurrency)} (누적 ${signedPctDisplay(scenario.drops.totalPct)})`,
          `→ 최종 ${formatCurrency(scenario.target, selectedCurrency)}`,
          `최종 가격까지 ${signedPctDisplay(scenario.recoveryPct)} (${formatMultiplierDisplay(scenario.multiplier)}배)`,
        );
      }
    } else {
      lines.push('값을 입력하면 결과를 공유할 수 있습니다.');
    }

    lines.push(`통화: ${cur}`);
    if (selectedCurrency === Currency.USD && exchangeRateNum) {
      lines.push(`환율: ${addCommas(String(Math.round(exchangeRateNum)))}원/USD`);
    }
    lines.push('', '주식 계산기 앱');
    return lines.join('\n');
  };

  const handleTextShare = async () => {
    try {
      await Share.share({ message: buildShareText() });
    } catch {
      /* cancelled */
    }
  };

  const renderPriceField = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder?: string,
  ) => (
    <View>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={selectedCurrency === Currency.USD ? 'decimal-pad' : 'number-pad'}
        placeholder={placeholder ?? (selectedCurrency === Currency.KRW ? '100,000' : '150.25')}
        placeholderTextColor="#616161"
      />
    </View>
  );

  const renderPercentField = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    helper?: string,
    onSignToggle?: () => void,
  ) => (
    <View>
      <Text style={s.label}>{label}</Text>
      <View style={s.percentRow}>
        <TextInput
          style={[s.input, s.percentInput]}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder="-10"
          placeholderTextColor="#616161"
        />
        <TouchableOpacity
          style={s.signToggleBtn}
          onPress={onSignToggle ?? (() => togglePlainPercentSign(value, onChangeText))}
          accessibilityLabel="부호 전환"
        >
          <Text style={s.signToggleText}>±</Text>
        </TouchableOpacity>
      </View>
      {helper ? <Text style={s.helperText}>{helper}</Text> : null}
    </View>
  );

  const renderBaseTab = () => {
    const baseTimeline = baseResult ? buildBaseRecoveryTimeline(baseResult) : null;

    return (
    <>
      <View style={s.card}>
        <Text style={s.cardTitle}>모수효과</Text>
        <View style={[s.insightBox, { marginTop: 0, marginBottom: 12 }]}>
          <Text style={s.conceptTitle}>모수효과란?</Text>
          <Text style={s.insightText}>
            같은 % 숫자라도 시작가 대비 얼마나 변했는지에 따라, 다시 돌아가거나 최종까지 가는 데 필요한 %가
            대칭이 아닙니다.
          </Text>
          <Text style={[s.insightText, { marginTop: 8 }]}>
            예: 100 → 50 (-50%) → 다시 100이 되려면 +100% 필요{'\n'}
            (50%만 올려서는 원래가가 되지 않습니다)
          </Text>
        </View>
        <Text style={s.usageHintText}>
          시작가·변동률·변동 후 가격·최종 가격이 연동됩니다. 마지막으로 수정한 항목 기준으로 나머지가 계산됩니다.
        </Text>
        {renderPriceField('시작가', peak, handleBasePeakInput)}
        {renderPercentField(
          '변동률 (%)',
          dropPct,
          handleBaseDropInput,
          '음수=하락 · 양수=상승. 시작가·변동률 수정 → 변동 후 가격 · 변동 후 가격 수정 → 변동률',
          handleBaseDropSignToggle,
        )}
        {renderPriceField('변동 후 가격', bottom, handleBaseBottomInput)}
        {renderPriceField(
          '최종 가격',
          baseTarget,
          handleBaseTargetInput,
          '직접 수정 · 아래 버튼으로 시작가와 동일하게',
        )}
        <TouchableOpacity
          style={[s.resetTargetBtn, (!peak || targetMatchesStart) && s.resetTargetBtnDisabled]}
          onPress={handleResetTargetToStart}
          disabled={!peak || targetMatchesStart}
          activeOpacity={0.7}
        >
          <Text style={s.resetTargetBtnText}>시작가와 동일하게</Text>
        </TouchableOpacity>
      </View>

      {hasBaseResult && baseResult && (
        <SharedResultSection onTextShare={handleTextShare}>
          <View style={s.card}>
            <Text style={s.cardTitle}>변동 경로</Text>
            {baseTimeline ? (
              <PathTimeline
                start={baseTimeline.start}
                steps={baseTimeline.steps}
                currency={selectedCurrency}
                recoveryStep={baseTimeline.recoveryStep}
                getStepLabel={() => '변동 후'}
              />
            ) : null}
            <View style={s.resultGrid}>
              <CalculationResultCard
                title="변동률"
                value={signedPctDisplay(baseResult.dropPct)}
                valueColor={baseResult.dropPct >= 0 ? '#66BB6A' : '#EF5350'}
                icon={baseResult.dropPct >= 0 ? '▲' : '▼'}
              />
              <CalculationResultCard
                title="최종 가격까지"
                value={signedPctDisplay(baseResult.recoveryPct)}
                valueColor={baseResult.recoveryPct >= 0 ? '#66BB6A' : '#EF5350'}
                icon={baseResult.recoveryPct >= 0 ? '▲' : '▼'}
              />
              <CalculationResultCard
                title="배수 (변동 후→최종)"
                value={`${formatMultiplierDisplay(baseResult.multiplier)}배`}
                icon="×"
              />
            </View>
            <View style={s.insightBox}>
              <Text style={s.insightText}>
                시작가 {formatCurrency(baseResult.peak, selectedCurrency)} ({signedPctDisplay(baseResult.dropPct)}) →{' '}
                변동 후 가격 {formatCurrency(baseResult.bottom, selectedCurrency)} →{' '}
                최종 {formatCurrency(baseResult.target, selectedCurrency)} :{' '}
                <Text style={{ fontWeight: '700' }}>최종 가격까지 {signedPctDisplay(baseResult.recoveryPct)}</Text>
                {baseResult.peak === baseResult.target ? (
                  <>
                    . {formatChangePctDescription(baseResult.dropPct)}와 대칭이 아닙니다.
                  </>
                ) : (
                  '가 필요합니다.'
                )}
              </Text>
            </View>
            {selectedCurrency === Currency.USD && exchangeRateNum ? (
              <View style={s.krwEquivalentBlock}>
                <Text style={s.krwEquivalentTitle}>원화 환산</Text>
                <Text style={s.krwEquivalentLine}>
                  시작가: {formatKrwFromUsd(baseResult.peak, exchangeRateNum)}
                </Text>
                <Text style={s.krwEquivalentLine}>
                  변동 후 가격: {formatKrwFromUsd(baseResult.bottom, exchangeRateNum)}
                </Text>
                <Text style={s.krwEquivalentLine}>
                  최종 가격: {formatKrwFromUsd(baseResult.target, exchangeRateNum)}
                </Text>
              </View>
            ) : null}
          </View>
        </SharedResultSection>
      )}
    </>
    );
  };

  const renderCompoundTab = (mode: 'negative' | 'positive') => {
    const isNeg = mode === 'negative';
    const stepPct = isNeg ? negStepPct : posStepPct;
    const setStepPct = isNeg ? setNegStepPct : setPosStepPct;
    const stepCount = isNeg ? negStepCount : posStepCount;
    const setStepCount = isNeg ? setNegStepCount : setPosStepCount;
    const result = isNeg ? negResult : posResult;
    const presets = isNeg ? NEGATIVE_PRESETS : POSITIVE_PRESETS;
    const hasResult = isNeg ? hasNegResult : hasPosResult;
    const stepPctN = parsePct(stepPct) ?? 0;

    const compoundStart = isNeg ? negStart : posStart;
    const setCompoundStart = isNeg ? setNegStart : setPosStart;

    return (
      <>
        <View style={s.card}>
          <Text style={s.cardTitle}>{isNeg ? '음의복리' : '양의복리'}</Text>
          <Text style={s.helperText}>
            동일 % 변동이 N회 반복될 때 누적 변동·배수와 시작가까지 되돌리는 %를 계산합니다.
          </Text>
          {renderPriceField('시작가', compoundStart, (t) => handlePriceInput(t, setCompoundStart))}
          {renderPercentField('회당 변동 (%)', stepPct, (t) => handlePctInput(t, setStepPct))}
          <Text style={s.label}>빠른 선택</Text>
          <View style={s.chipRow}>
            {presets.map((p) => (
              <TouchableOpacity key={p} style={s.quickChip} onPress={() => setStepPct(String(p))}>
                <Text style={s.quickChipText}>{p > 0 ? '+' : ''}{p}%</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.label}>반복 횟수</Text>
          <TextInput
            style={s.input}
            value={stepCount}
            onChangeText={(t) => handleCountInput(t, setStepCount)}
            keyboardType="number-pad"
            placeholder="3"
            placeholderTextColor="#616161"
          />
        </View>

        {hasResult && result && (
          <SharedResultSection onTextShare={handleTextShare}>
            <View style={s.card}>
              <Text style={s.cardTitle}>변동 경로</Text>
              <PathTimeline
                start={result.start}
                steps={result.steps}
                currency={selectedCurrency}
              />
              <View style={s.resultGrid}>
                <CalculationResultCard
                  title="최종가"
                  value={formatCurrency(result.final, selectedCurrency)}
                  valueColor={result.totalPct >= 0 ? '#66BB6A' : '#EF5350'}
                />
                <CalculationResultCard
                  title="누적 변동"
                  value={`${result.totalPct >= 0 ? '+' : ''}${formatPctDisplay(result.totalPct)}%`}
                  valueColor={result.totalPct >= 0 ? '#66BB6A' : '#EF5350'}
                />
                <CalculationResultCard
                  title="배수"
                  value={`${formatMultiplierDisplay(result.multiplier)}배`}
                />
                {result.breakevenToStartPct != null ? (
                  <CalculationResultCard
                    title="원래가까지"
                    value={signedPctDisplay(result.breakevenToStartPct)}
                    valueColor="#FFB74D"
                    icon="↩"
                  />
                ) : null}
              </View>
              <Text style={s.stepTableSectionTitle}>단계별 상세</Text>
              <CompoundStepTable steps={result.steps} currency={selectedCurrency} />
              {result.breakevenToStartPct != null ? (
                <View style={s.insightBox}>
                  <Text style={s.insightText}>
                    {formatPctDisplay(Math.abs(stepPctN))}%씩 {stepCount}번{' '}
                    {stepDirectionWord(stepPctN)}하면 {formatPctDisplay(Math.abs(result.totalPct))}%{' '}
                    {cumulativeOutcomeWord(result.totalPct)}입니다. 시작가로 돌아가려면{' '}
                    <Text style={{ fontWeight: '700' }}>
                      원래가까지 {signedPctDisplay(result.breakevenToStartPct)}
                    </Text>
                    가 필요합니다.
                  </Text>
                </View>
              ) : null}
            </View>
          </SharedResultSection>
        )}
      </>
    );
  };

  const renderPathResultBody = (
    drops: CompoundStepsResult,
    options?: { recoveryStep?: CompoundStepRow; recoveryMultiplier?: number },
  ) => {
    const recoveryStep = options?.recoveryStep;
    const recoveryMultiplier = options?.recoveryMultiplier;

    return (
    <>
      <PathTimeline
        start={drops.start}
        steps={drops.steps}
        currency={selectedCurrency}
        recoveryStep={recoveryStep}
      />
      <View style={s.resultGrid}>
        {!recoveryStep ? (
          <>
            <CalculationResultCard
              title="변동 후 가격"
              value={formatCurrency(drops.final, selectedCurrency)}
            />
            <CalculationResultCard
              title="경로 누적"
              value={signedPctDisplay(drops.totalPct)}
              valueColor={drops.totalPct >= 0 ? '#66BB6A' : '#EF5350'}
            />
            <CalculationResultCard
              title="배수"
              value={`${formatMultiplierDisplay(drops.multiplier)}배`}
            />
            {drops.breakevenToStartPct != null ? (
              <CalculationResultCard
                title="원래가까지"
                value={signedPctDisplay(drops.breakevenToStartPct)}
                valueColor="#FFB74D"
                icon="↩"
              />
            ) : null}
          </>
        ) : (
          <>
            <CalculationResultCard
              title="변동 후 가격"
              value={formatCurrency(drops.final, selectedCurrency)}
            />
            <CalculationResultCard
              title="경로 누적"
              value={signedPctDisplay(drops.totalPct)}
              valueColor={drops.totalPct >= 0 ? '#66BB6A' : '#EF5350'}
            />
            <CalculationResultCard
              title="최종 가격까지"
              value={signedPctDisplay(recoveryStep.stepPct)}
              valueColor={recoveryStep.stepPct >= 0 ? '#66BB6A' : '#EF5350'}
            />
            <CalculationResultCard
              title="변동 후→최종 배수"
              value={`${formatMultiplierDisplay(recoveryMultiplier ?? recoveryStep.priceAfter / drops.final)}배`}
            />
          </>
        )}
      </View>
      <Text style={s.stepTableSectionTitle}>단계별 상세</Text>
      <CompoundStepTable
        steps={drops.steps}
        currency={selectedCurrency}
        recoveryStep={recoveryStep}
      />
    </>
    );
  };

  const renderPathTab = () => (
    <>
      <View style={s.card}>
        <Text style={s.cardTitle}>경로 시나리오</Text>
        <Text style={s.helperText}>
          시작가부터 +/− 변동이 중첩되는 경로를 봅니다. 필요하면 변동 후 → 최종 회복 구간을 추가하세요.
        </Text>
        {renderPriceField('시작가', pathStart, handlePathStartInput)}
        <Text style={s.label}>변동 경로 (단계별 %)</Text>
        <Text style={[s.helperText, { marginTop: 0 }]}>
          +/− 섞여도 직전 가격 기준으로 중첩됩니다. 같은 % 반복은 음·양 복리 탭을 이용하세요.
        </Text>
        <View style={s.pathStepList}>
          {pathStepPcts.map((stepPct, index) => (
            <View key={`path-step-${index}`} style={s.pathStepRow}>
              <Text style={s.pathStepIndex}>{index + 1}</Text>
              <TextInput
                style={[s.input, s.pathStepInput]}
                value={stepPct}
                onChangeText={(t) => {
                  const cleaned = t.replace(/[^0-9.\-+]/g, '');
                  const parts = cleaned.split('.');
                  const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
                  updatePathStep(index, formatted);
                }}
                keyboardType="decimal-pad"
                placeholder="-10"
                placeholderTextColor="#616161"
              />
              <Text style={s.pathStepSuffix}>%</Text>
              <TouchableOpacity
                style={s.signToggleBtn}
                onPress={() => togglePathStepSign(index)}
                accessibilityLabel="부호 전환"
              >
                <Text style={s.signToggleText}>±</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.pathRemoveBtn, pathStepPcts.length <= 1 && s.pathAddBtnDisabled]}
                onPress={() => removePathStep(index)}
                disabled={pathStepPcts.length <= 1}
                accessibilityLabel="단계 삭제"
              >
                <Text style={s.pathRemoveBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={[s.pathAddBtn, pathStepPcts.length >= MAX_PATH_STEPS && s.pathAddBtnDisabled]}
          onPress={addPathStep}
          disabled={pathStepPcts.length >= MAX_PATH_STEPS}
          activeOpacity={0.7}
        >
          <Text style={s.pathAddBtnText}>+ 단계 추가</Text>
        </TouchableOpacity>
        <Text style={s.label}>회복 구간 (선택)</Text>
        <View style={s.modeRow}>
          <TouchableOpacity
            style={[s.modeChip, pathTargetMode === 'pathOnly' && s.modeChipActive]}
            onPress={() => setPathTargetMode('pathOnly')}
          >
            <Text style={[s.modeChipText, pathTargetMode === 'pathOnly' && s.modeChipTextActive]}>경로만</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.modeChip, pathTargetMode === 'price' && s.modeChipActive]}
            onPress={selectPathPriceMode}
          >
            <Text style={[s.modeChipText, pathTargetMode === 'price' && s.modeChipTextActive]}>최종 가격</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.modeChip, pathTargetMode === 'percent' && s.modeChipActive]}
            onPress={() => setPathTargetMode('percent')}
          >
            <Text style={[s.modeChipText, pathTargetMode === 'percent' && s.modeChipTextActive]}>변동 후 최종 %</Text>
          </TouchableOpacity>
        </View>
        {pathTargetMode === 'price' ? (
          <>
            {renderPriceField(
              '최종 가격',
              pathTarget,
              (t) => handlePriceInput(t, setPathTarget),
              '직접 수정 · 아래 버튼으로 시작가와 동일하게',
            )}
            <TouchableOpacity
              style={[s.resetTargetBtn, (!pathStart || pathTargetMatchesStart) && s.resetTargetBtnDisabled]}
              onPress={handleResetPathTargetToStart}
              disabled={!pathStart || pathTargetMatchesStart}
              activeOpacity={0.7}
            >
              <Text style={s.resetTargetBtnText}>시작가와 동일하게</Text>
            </TouchableOpacity>
          </>
        ) : pathTargetMode === 'percent' ? (
          renderPercentField(
            '변동 후 → 최종 (%)',
            pathProfitPct,
            (t) => handlePctInput(t, setPathProfitPct),
            '경로 끝(변동 후) 가격에서 최종까지의 %',
          )
        ) : null}
      </View>

      {hasPathResult && pathResult && (
        <SharedResultSection onTextShare={handleTextShare}>
          <View style={s.card}>
            <Text style={s.cardTitle}>변동 경로</Text>
            {pathResult.kind === 'pathOnly'
              ? renderPathResultBody(pathResult.drops)
              : renderPathResultBody(pathResult.scenario.drops, {
                  recoveryStep: buildRecoveryStepRow(pathResult.scenario),
                  recoveryMultiplier: pathResult.scenario.multiplier,
                })}
          </View>
        </SharedResultSection>
      )}
    </>
  );

  return (
    <LinearGradient colors={['#1a1a2e', '#121212', '#0a0a0a']} style={s.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={s.hero}>
            <Text style={s.heroTitle}>음·양 복리·모수 계산기</Text>
            <Text style={s.heroSub}>
              음·양 복리, 모수효과, 경로 시나리오를 계산합니다.
            </Text>
          </View>

          <View style={s.currencySwitchContainer}>
            <CurrencySwitch selectedCurrency={selectedCurrency} onChanged={setSelectedCurrency} />
          </View>

          {selectedCurrency === Currency.USD && (
            <View style={s.exchangeRateRow}>
              {isLoadingExchangeRate ? (
                <ActivityIndicator size="small" color="#42A5F5" />
              ) : (
                <Text style={s.exchangeRateText}>환율 1 USD = {addCommas(usdExchangeRate)} KRW</Text>
              )}
            </View>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabScroll}>
            <View style={s.tabRow}>
              {TABS.map((tab) => (
                <TouchableOpacity
                  key={tab.id}
                  style={[s.tabChip, activeTab === tab.id && s.tabChipActive]}
                  onPress={() => setActiveTab(tab.id)}
                >
                  <Text style={[s.tabChipText, activeTab === tab.id && s.tabChipTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {activeTab === 'base' && renderBaseTab()}
          {activeTab === 'negative' && renderCompoundTab('negative')}
          {activeTab === 'positive' && renderCompoundTab('positive')}
          {activeTab === 'path' && renderPathTab()}

          <Text style={s.disclaimer}>
            투자 참고용 계산이며 실제 수익을 보장하지 않습니다. %와 배수는 통화와 무관하게 동일합니다.
          </Text>

          <AdmobNativeAd />
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
