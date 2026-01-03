import { Currency } from '../models/Currency';

/**
 * 티커를 기반으로 통화를 판단합니다.
 * - .KS 또는 .KQ로 끝나면 한국 주식 (KRW)
 * - 그 외는 미국 주식 (USD)
 * 
 * @param ticker 종목 티커 (예: 'AAPL', '005930.KS')
 * @returns Currency.KRW 또는 Currency.USD
 */
export function getCurrencyFromTicker(ticker: string): Currency {
  const upperTicker = ticker.toUpperCase();
  
  // .KS 또는 .KQ로 끝나면 한국 주식
  if (upperTicker.endsWith('.KS') || upperTicker.endsWith('.KQ')) {
    return Currency.KRW;
  }
  
  // 그 외는 미국 주식
  return Currency.USD;
}


