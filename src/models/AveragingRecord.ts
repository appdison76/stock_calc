import { Currency } from './Currency';

export interface AveragingRecord {
  id: string;
  stockId: string; // stocks 테이블의 id 참조
  buyPrice: number; // 매수가
  quantity: number; // 매수 수량
  feeRate: number; // 수수료율
  currency: Currency;
  exchangeRate?: number; // 환율 (USD인 경우)
  averagePriceBefore: number; // 매수 전 평균 단가
  averagePriceAfter: number; // 매수 후 평균 단가
  totalQuantityBefore: number; // 매수 전 총 수량
  totalQuantityAfter: number; // 매수 후 총 수량
  createdAt: number; // 매수 시점 (타임스탬프)
}









