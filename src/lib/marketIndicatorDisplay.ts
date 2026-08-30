/** 주요 지표 표시용 (currency: KRW | USD | PCT) */
export function formatMarketIndicatorPrice(price: number, currency: string): string {
  if (currency === 'PCT') {
    return `${price.toFixed(2)}%`;
  }
  if (currency === 'USD') {
    if (price < 100) {
      return `$${price.toFixed(2)}`;
    }
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  return `${Math.round(price).toLocaleString()}원`;
}

export const US10Y_YAHOO_SYMBOL = '^TNX';
