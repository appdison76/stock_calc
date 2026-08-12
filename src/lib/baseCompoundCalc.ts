export type CompoundStepRow = {
  index: number;
  priceBefore: number;
  priceAfter: number;
  stepPct: number;
  cumulativePct: number;
};

export type CompoundStepsResult = {
  start: number;
  final: number;
  totalPct: number;
  multiplier: number;
  /** 시작가까지 되돌리려면 필요한 % (final<start: +, final>start: −) */
  breakevenToStartPct: number | null;
  steps: CompoundStepRow[];
};

export type BaseRecoveryResult = {
  peak: number;
  bottom: number;
  target: number;
  dropPct: number;
  recoveryPct: number;
  multiplier: number;
};

export type ContinuousScenarioResult = {
  drops: CompoundStepsResult;
  bottom: number;
  target: number;
  recoveryPct: number;
  multiplier: number;
  profitPctFromBottom: number;
};

export type BaseRecoveryDriver = 'peak' | 'drop' | 'bottom' | 'target';

export type BaseRecoveryFieldStrings = {
  peak: string;
  bottom: string;
  target: string;
  dropPct: string;
};

import { addCommas } from '../utils/formatUtils';

function parsePriceInput(raw: string): number | null {
  const n = parseFloat(raw.replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parsePctInput(raw: string): number | null {
  const n = parseFloat(raw.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function formatPriceInput(n: number, maxFractionDigits: 0 | 2 = 0): string {
  if (!Number.isFinite(n) || n <= 0) return '';
  if (maxFractionDigits === 0) {
    return new Intl.NumberFormat('en-US').format(Math.round(n));
  }
  const rounded = Math.round(n * 100) / 100;
  return addCommas(rounded.toFixed(2));
}

export type SyncBaseRecoveryOptions = {
  priceMaxFractionDigits?: 0 | 2;
};

function formatPctInput(n: number): string {
  if (!Number.isFinite(n)) return '';
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}

/** 마지막 수정 필드(driver) 기준으로 peak·drop·bottom·target 연동 */
export function syncBaseRecoveryFields(
  driver: BaseRecoveryDriver,
  values: BaseRecoveryFieldStrings,
  options?: SyncBaseRecoveryOptions,
): BaseRecoveryFieldStrings {
  const next = { ...values };
  const priceFrac = options?.priceMaxFractionDigits ?? 0;
  const fmtPrice = (n: number) => formatPriceInput(n, priceFrac);
  const peakN = parsePriceInput(values.peak);
  const bottomN = parsePriceInput(values.bottom);
  const dropN = parsePctInput(values.dropPct);

  switch (driver) {
    case 'peak': {
      const peakEmpty = values.peak.trim() === '' || peakN == null;
      if (peakEmpty) {
        next.bottom = '';
        next.target = '';
      } else {
        if (dropN != null) {
          next.bottom = fmtPrice(peakN * (1 + dropN / 100));
        }
        next.target = fmtPrice(peakN);
      }
      break;
    }
    case 'drop': {
      if (peakN != null && dropN != null) {
        next.bottom = fmtPrice(peakN * (1 + dropN / 100));
      } else if (bottomN != null && dropN != null) {
        const denom = 1 + dropN / 100;
        if (denom > 0) {
          next.peak = fmtPrice(bottomN / denom);
        }
      }
      break;
    }
    case 'bottom': {
      if (peakN != null && bottomN != null) {
        next.dropPct = formatPctInput((bottomN / peakN - 1) * 100);
      } else if (bottomN != null && dropN != null) {
        const denom = 1 + dropN / 100;
        if (denom > 0) {
          next.peak = fmtPrice(bottomN / denom);
        }
      }
      break;
    }
    case 'target':
      break;
  }

  return next;
}

function isPositiveFinite(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n) && n > 0;
}

/** N회 연속 % 변동 (음·양 공통) */
export function calcCompoundSteps(start: number, stepPcts: number[]): CompoundStepsResult | null {
  if (!isPositiveFinite(start) || stepPcts.length === 0) return null;
  if (stepPcts.some((p) => !Number.isFinite(p))) return null;

  const steps: CompoundStepRow[] = [];
  let price = start;
  for (let i = 0; i < stepPcts.length; i++) {
    const pct = stepPcts[i];
    const before = price;
    const after = before * (1 + pct / 100);
    if (!Number.isFinite(after)) return null;
    steps.push({
      index: i + 1,
      priceBefore: before,
      priceAfter: after,
      stepPct: pct,
      cumulativePct: (after / start - 1) * 100,
    });
    price = after;
  }

  const final = price;
  const totalPct = (final / start - 1) * 100;
  const breakevenToStartPct = final !== start ? (start / final - 1) * 100 : null;

  return {
    start,
    final,
    totalPct,
    multiplier: final / start,
    breakevenToStartPct,
    steps,
  };
}

/**
 * 모수효과 — peak/bottom/target/dropPct 중 2~3개로 나머지 유도.
 * dropPct는 시작가 대비 변동률(음수=하락, 양수=상승).
 */
export function calcBaseRecovery(input: {
  peak?: number | null;
  bottom?: number | null;
  target?: number | null;
  dropPct?: number | null;
}): BaseRecoveryResult | null {
  let peak = input.peak ?? null;
  let bottom = input.bottom ?? null;
  let dropPct = input.dropPct ?? null;
  const targetRaw = input.target ?? null;

  // 시작가·변동 후 가격이 둘 다 있으면 변동률은 여기서 우선 계산
  if (isPositiveFinite(peak) && isPositiveFinite(bottom)) {
    dropPct = (bottom / peak - 1) * 100;
  } else if (isPositiveFinite(peak) && dropPct != null && Number.isFinite(dropPct) && bottom == null) {
    bottom = peak * (1 + dropPct / 100);
  } else if (isPositiveFinite(bottom) && dropPct != null && Number.isFinite(dropPct) && peak == null) {
    const denom = 1 + dropPct / 100;
    if (denom <= 0) return null;
    peak = bottom / denom;
  }

  if (!isPositiveFinite(peak) || !isPositiveFinite(bottom)) return null;
  if (dropPct == null || !Number.isFinite(dropPct)) {
    dropPct = (bottom / peak - 1) * 100;
  }

  const target = isPositiveFinite(targetRaw) ? targetRaw : peak;
  if (!isPositiveFinite(target) || bottom <= 0) return null;

  const recoveryPct = (target / bottom - 1) * 100;
  const multiplier = target / bottom;

  return { peak, bottom, target, dropPct, recoveryPct, multiplier };
}

export function calcContinuousScenario(input: {
  start: number;
  stepPcts: number[];
  target: number;
}): ContinuousScenarioResult | null {
  const drops = calcCompoundSteps(input.start, input.stepPcts);
  if (!drops) return null;
  const bottom = drops.final;
  if (!isPositiveFinite(bottom) || !isPositiveFinite(input.target)) return null;

  const recoveryPct = (input.target / bottom - 1) * 100;
  const multiplier = input.target / bottom;

  return {
    drops,
    bottom,
    target: input.target,
    recoveryPct,
    multiplier,
    profitPctFromBottom: recoveryPct,
  };
}

export type BaseRecoveryTimeline = {
  start: number;
  steps: CompoundStepRow[];
  recoveryStep?: CompoundStepRow;
};

/** 모수효과 — 시작→변동 후(1단계) + 선택적 회복(↩) */
export function buildBaseRecoveryTimeline(base: BaseRecoveryResult): BaseRecoveryTimeline {
  const { peak, bottom, target, dropPct, recoveryPct } = base;
  const steps: CompoundStepRow[] = [
    {
      index: 1,
      priceBefore: peak,
      priceAfter: bottom,
      stepPct: dropPct,
      cumulativePct: dropPct,
    },
  ];
  const recoveryStep =
    target !== bottom
      ? {
          index: 2,
          priceBefore: bottom,
          priceAfter: target,
          stepPct: recoveryPct,
          cumulativePct: (target / peak - 1) * 100,
        }
      : undefined;
  return { start: peak, steps, recoveryStep };
}

/** 경로 시나리오 — 변동 후 → 최종 회복 행 */
export function buildRecoveryStepRow(scenario: ContinuousScenarioResult): CompoundStepRow {
  const { drops, bottom, target, recoveryPct } = scenario;
  return {
    index: drops.steps.length + 1,
    priceBefore: bottom,
    priceAfter: target,
    stepPct: recoveryPct,
    cumulativePct: (target / drops.start - 1) * 100,
  };
}

export function formatPctDisplay(n: number, maxFrac = 2): string {
  if (!Number.isFinite(n)) return '—';
  const max = Math.abs(n) >= 100 ? 1 : maxFrac;
  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: max,
  }).format(n);
}

export function formatMultiplierDisplay(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

/** 변동률 부호에 맞는 설명 (하락 30% / 상승 30%) */
export function formatChangePctDescription(pct: number): string {
  if (!Number.isFinite(pct)) return '—';
  if (pct < 0) return `하락 ${formatPctDisplay(Math.abs(pct))}%`;
  if (pct > 0) return `상승 ${formatPctDisplay(pct)}%`;
  return '변동 0%';
}

/** 회당 % 부호 → 하락/상승 */
export function stepDirectionWord(pct: number): string {
  if (!Number.isFinite(pct) || pct >= 0) return '상승';
  return '하락';
}

/** 누적 % 부호 → 손실/수익 */
export function cumulativeOutcomeWord(totalPct: number): string {
  if (!Number.isFinite(totalPct) || totalPct >= 0) return '수익';
  return '손실';
}

export function signedPctDisplay(pct: number): string {
  if (!Number.isFinite(pct)) return '—';
  const prefix = pct > 0 ? '+' : '';
  return `${prefix}${formatPctDisplay(pct)}%`;
}
