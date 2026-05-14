import { addCommas } from '../utils/formatUtils';

/** 콤마·공백 제거 후 숫자 파싱 (가격·수량·수익금) */
export function parseMoneyInput(raw: string): number | null {
  const t = raw.replace(/,/g, '').trim();
  if (t === '' || t === '-' || t === '.' || t === '-.') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function parsePercentInput(raw: string): number | null {
  const t = raw.replace(/,/g, '').trim();
  if (t === '' || t === '-' || t === '.' || t === '-.') return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

export type ScenarioParsed = {
  target: number | null;
  deltaPct: number | null;
  myReturnPct: number | null;
  profitWon: number | null;
};

/** 사용자가 방금 고친 시나리오 입력 — 이 필드로만 P1을 먼저 잡음 */
export type ScenarioAnchor = 'target' | 'delta' | 'return' | 'profit';

/** 목표가 > 변동률 > 내 수익률 > 수익금 순으로 P1 후보 결정 */
export function resolveScenarioPrice(
  P0: number | null,
  Pbuy: number | null,
  Q: number | null,
  p: ScenarioParsed
): number | null {
  if (p.target != null && Number.isFinite(p.target) && p.target > 0) return p.target;
  if (P0 != null && P0 > 0 && p.deltaPct != null && Number.isFinite(p.deltaPct)) {
    return P0 * (1 + p.deltaPct / 100);
  }
  if (Pbuy != null && Pbuy > 0 && p.myReturnPct != null && Number.isFinite(p.myReturnPct)) {
    return Pbuy * (1 + p.myReturnPct / 100);
  }
  if (Pbuy != null && Q != null && Q > 0 && p.profitWon != null && Number.isFinite(p.profitWon)) {
    return Pbuy + p.profitWon / Q;
  }
  return null;
}

/** 앵커 필드만으로 P1 (유효할 때만) */
export function resolveScenarioPriceFromAnchor(
  anchor: ScenarioAnchor,
  P0: number | null,
  Pbuy: number | null,
  Q: number | null,
  p: ScenarioParsed
): number | null {
  switch (anchor) {
    case 'target':
      if (p.target != null && Number.isFinite(p.target) && p.target > 0) return p.target;
      return null;
    case 'delta':
      if (P0 != null && P0 > 0 && p.deltaPct != null && Number.isFinite(p.deltaPct)) {
        return P0 * (1 + p.deltaPct / 100);
      }
      return null;
    case 'return':
      if (Pbuy != null && Pbuy > 0 && p.myReturnPct != null && Number.isFinite(p.myReturnPct)) {
        return Pbuy * (1 + p.myReturnPct / 100);
      }
      return null;
    case 'profit':
      if (Pbuy != null && Q != null && Q > 0 && p.profitWon != null && Number.isFinite(p.profitWon)) {
        return Pbuy + p.profitWon / Q;
      }
      return null;
    default:
      return null;
  }
}

/** 앵커가 있으면 그 필드만 사용(부분 입력·삭제 시 목표가 등으로 덮어쓰지 않음) */
export function resolveScenarioPriceWithAnchor(
  anchor: ScenarioAnchor | null | undefined,
  P0: number | null,
  Pbuy: number | null,
  Q: number | null,
  p: ScenarioParsed
): number | null {
  if (anchor) {
    return resolveScenarioPriceFromAnchor(anchor, P0, Pbuy, Q, p);
  }
  return resolveScenarioPrice(P0, Pbuy, Q, p);
}

export function formatPriceDisplay(n: number, maxFrac: number): string {
  if (maxFrac <= 0) return addCommas(String(Math.round(n)));
  const s = n.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: maxFrac });
  return s;
}

/** 변동률·표시: 소수 둘째 자리까지 (불필요한 0 제거) */
export function formatPercentMax2DecimalsDisplay(n: number): string {
  if (!Number.isFinite(n)) return '';
  return String(Number(n.toFixed(2)));
}

/** P1을 가격 표시 단위(원화 정수·USD 소수 maxFrac)로 맞춤 — 부동소수로 목표가·수익금이 지저분해지는 것 방지 */
function scenarioP1DisplayRounded(P1: number, priceMaxFrac: number): number {
  if (!Number.isFinite(P1)) return P1;
  if (priceMaxFrac > 0) {
    const f = 10 ** priceMaxFrac;
    return Math.round(P1 * f) / f;
  }
  return Math.round(P1);
}

/** P1 기준으로 시나리오 필드 문자열 생성 */
export function buildScenarioStrings(args: {
  P0: number | null;
  Pbuy: number | null;
  Q: number | null;
  P1: number;
  priceMaxFrac: number;
}): { target: string; deltaPct: string; myReturnPct: string; profitWon: string } {
  const { P0, Pbuy, Q, P1, priceMaxFrac } = args;
  const P1u = scenarioP1DisplayRounded(P1, priceMaxFrac);
  const target = formatPriceDisplay(P1u, priceMaxFrac);
  let deltaPct = '';
  if (P0 != null && P0 > 0) {
    const d = (P1u / P0 - 1) * 100;
    if (Number.isFinite(d)) deltaPct = formatPercentMax2DecimalsDisplay(d);
  }
  let myReturnPct = '';
  if (Pbuy != null && Pbuy > 0) {
    const r = (P1u / Pbuy - 1) * 100;
    if (Number.isFinite(r)) myReturnPct = formatPercentMax2DecimalsDisplay(r);
  }
  let profitWon = '';
  if (Pbuy != null && Q != null && Q > 0) {
    const g = (P1u - Pbuy) * Q;
    if (Number.isFinite(g)) profitWon = formatPriceDisplay(g, priceMaxFrac);
  }
  return { target, deltaPct, myReturnPct, profitWon };
}
