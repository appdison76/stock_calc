import { Currency } from '../models/Currency';

/// 천단위 콤마를 추가하는 헬퍼 함수
export function addCommas(numberString: string): string {
  const parts = numberString.split('.');
  let integerPart = parts[0];
  const decimalPart = parts.length > 1 ? `.${parts[1]}` : '';
  
  // 음수 부호 처리
  let isNegative = false;
  if (integerPart.startsWith('-')) {
    isNegative = true;
    integerPart = integerPart.substring(1);
  }
  
  // 천단위 미만이면 콤마 없이 반환
  if (integerPart.length <= 3) {
    return `${isNegative ? '-' : ''}${integerPart}${decimalPart}`;
  }
  
  // 천단위 이상일 때만 콤마 추가
  let buffer = '';
  for (let i = 0; i < integerPart.length; i++) {
    if (i > 0 && (integerPart.length - i) % 3 === 0) {
      buffer += ',';
    }
    buffer += integerPart[i];
  }
  
  return `${isNegative ? '-' : ''}${buffer}${decimalPart}`;
}

/** 금액 입력: maxFrac 0=정수+콤마(KRW), 2=소수 둘째 자리(USD) */
export function formatPriceFieldInput(text: string, maxFrac: number): string {
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

export function formatCurrency(value: number, currency: Currency): string {
  // null, undefined, NaN 체크
  if (value == null || isNaN(value) || !isFinite(value)) {
    return '-';
  }
  
  if (currency === Currency.USD) {
    return `$${addCommas(value.toFixed(2))}`;
  } else {
    // 항상 원 단위로 표시 (천단위 콤마 포함)
    return `${addCommas(value.toFixed(0))}원`;
  }
}

export function formatNumber(value: number, currency: Currency): string {
  if (currency === Currency.USD) {
    return `$${addCommas(value.toFixed(2))}`;
  } else {
    return `${addCommas(value.toFixed(0))}원`;
  }
}

export function getKrwEquivalent(
  usdValue: number,
  exchangeRate?: number
): string | null {
  if (exchangeRate != null) {
    const krwValue = usdValue * exchangeRate;
    // 항상 원 단위로 표시 (천단위 콤마 포함, 줄바꿈으로 표시)
    return `\n(${addCommas(krwValue.toFixed(0))}원)`;
  }
  return null;
}

