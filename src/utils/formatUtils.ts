import { Currency } from '../models/Currency';

/// 천단위 콤마를 추가하는 헬퍼 함수
export function addCommas(numberString: string): string {
  const parts = numberString.split('.');
  const integerPart = parts[0];
  const decimalPart = parts.length > 1 ? `.${parts[1]}` : '';
  
  let buffer = '';
  for (let i = 0; i < integerPart.length; i++) {
    if (i > 0 && (integerPart.length - i) % 3 === 0) {
      buffer += ',';
    }
    buffer += integerPart[i];
  }
  
  return `${buffer}${decimalPart}`;
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
    // 항상 원 단위로 표시 (천단위 콤마 포함)
    return `(${addCommas(krwValue.toFixed(0))}원)`;
  }
  return null;
}

