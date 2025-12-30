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

export function formatCurrency(value: number, currency: Currency): string {
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

