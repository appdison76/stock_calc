import { Currency } from './Currency';

export interface Stock {
  id: string;
  accountId: string;
  ticker: string; // 종목 코드 (예: 'AAPL', '005930')
  name?: string; // 종목명 (선택)
  quantity: number; // 보유 주식 수
  averagePrice: number; // 현재 평균 단가
  currentPrice?: number; // 현재가 (Yahoo Finance에서 가져옴)
  currency: Currency;
  createdAt: number;
  updatedAt: number;
}

