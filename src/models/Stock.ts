import { Currency } from './Currency';

export interface Stock {
  id: string;
  accountId: string;
  ticker: string; // 종목 티커 (예: 'AAPL', '005930.KS') - 변경 불가
  officialName?: string; // 실제 종목명 (예: '삼성전자', 'Apple Inc.') - 변경 불가, Yahoo Finance에서 가져옴
  name?: string; // 종목 별명 - 사용자가 수정 가능, 기본값: officialName
  quantity: number; // 보유 주식 수
  averagePrice: number; // 현재 평균 단가
  currentPrice?: number; // 현재가 (Yahoo Finance에서 가져옴)
  currency: Currency;
  createdAt: number;
  updatedAt: number;
}

