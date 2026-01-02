import { Currency } from './Currency';

/**
 * 매수/매도 통합 거래 기록
 */
export interface TradingRecord {
  id: string;
  stockId: string; // stocks 테이블의 id 참조
  type: 'BUY' | 'SELL'; // 거래 유형
  
  // 공통 필드
  price: number; // 매수가 또는 매도가
  quantity: number; // 매수/매도 수량
  currency: Currency;
  exchangeRate?: number; // 환율 (USD인 경우)
  
  // 매수 시 (type === 'BUY')
  averagePriceBefore?: number; // 매수 전 평균 단가
  averagePriceAfter?: number; // 매수 후 평균 단가
  
  // 매도 시 (type === 'SELL')
  averagePriceAtSell?: number; // 매도 시점의 평단가 (손익 계산용)
  profit?: number; // 손익 ((매도가 - 평단가) * 수량)
  
  // 공통: 수량 추적
  totalQuantityBefore: number; // 거래 전 총 수량
  totalQuantityAfter: number; // 거래 후 총 수량
  
  createdAt: number; // 거래 시점 (타임스탬프)
}









