import { addCommas } from './formatUtils';

/**
 * 수익률 계산기용: 콤마·소수 둘째 자리까지 표시와 동일하게 부호만 반전 (숫자 패드에 − 없을 때).
 */
export function toggleProfitCalculatorPercentSign(
  current: string,
  apply: (next: string) => void
): void {
  const trimmed = current.trim();
  if (trimmed === '') {
    apply('-');
    return;
  }
  if (trimmed === '-') {
    apply('');
    return;
  }
  const cleaned = current.replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const isNeg = cleaned.startsWith('-');
  const absNum = parseFloat(cleaned.replace(/^-/, ''));
  if (!Number.isFinite(absNum)) {
    apply(isNeg ? '' : '-');
    return;
  }
  const value = isNeg ? -absNum : absNum;
  let flipped = -value;
  if (Math.abs(flipped) < 1e-10) {
    apply('');
    return;
  }
  flipped = Math.round(flipped * 100) / 100;
  const isNegative = flipped < 0;
  const av = Math.abs(flipped);
  const profitRateStr = av.toFixed(2);
  const parts = profitRateStr.split('.');
  const integerPart = parts[0];
  const fracDigits = (parts[1] ?? '').slice(0, 2);
  const decimalPart = fracDigits.length ? '.' + fracDigits : '';
  const integerWithCommas = addCommas(integerPart);
  apply((isNegative ? '-' : '') + integerWithCommas + decimalPart);
}

/**
 * 목표가·손절익절 계산기용: 부호만 반전 (입력 핸들러가 콤마 없이 유지하는 경우).
 */
export function togglePlainPercentSign(current: string, apply: (next: string) => void): void {
  const trimmed = current.trim();
  if (trimmed === '') {
    apply('-');
    return;
  }
  if (trimmed === '-') {
    apply('');
    return;
  }
  const cleaned = current.replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const isNeg = cleaned.startsWith('-');
  const absNum = parseFloat(cleaned.replace(/^-/, ''));
  if (!Number.isFinite(absNum)) {
    apply(isNeg ? '' : '-');
    return;
  }
  const value = isNeg ? -absNum : absNum;
  const flipped = -value;
  if (Math.abs(flipped) < 1e-10) {
    apply('');
    return;
  }
  const out = String(flipped);
  if (out === '-0' || out === '0') {
    apply('');
    return;
  }
  apply(out);
}
