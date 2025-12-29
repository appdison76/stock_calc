import { Currency } from './Currency';

export class AveragingCalculation {
  id: string; // 고유 ID
  currentAveragePrice: number;
  currentQuantity: number;
  additionalBuyPrice: number;
  additionalQuantity: number;
  feeRate: number;
  currency: Currency;
  exchangeRate?: number; // 환율 (USD to KRW)

  constructor({
    currentAveragePrice,
    currentQuantity,
    additionalBuyPrice,
    additionalQuantity,
    feeRate = 0.015, // 기본 0.015% (수수료)
    currency = Currency.KRW,
    exchangeRate,
    id, // 선택적 ID (없으면 자동 생성)
  }: {
    currentAveragePrice: number;
    currentQuantity: number;
    additionalBuyPrice: number;
    additionalQuantity: number;
    feeRate?: number;
    currency?: Currency;
    exchangeRate?: number;
    id?: string; // 선택적 ID (없으면 자동 생성)
  }) {
    // 고유한 ID 생성: timestamp + 랜덤 문자열 + 카운터
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const counter = Math.floor(Math.random() * 1000000);
    this.id = id || `calc-${timestamp}-${random}-${counter}`;
    this.currentAveragePrice = currentAveragePrice;
    this.currentQuantity = currentQuantity;
    this.additionalBuyPrice = additionalBuyPrice;
    this.additionalQuantity = additionalQuantity;
    this.feeRate = feeRate;
    this.currency = currency;
    this.exchangeRate = exchangeRate;
  }

  // 현재 총 매수 금액
  get currentTotalAmount(): number {
    return this.currentAveragePrice * this.currentQuantity;
  }

  // 추가 매수 금액
  get additionalTotalAmount(): number {
    return this.additionalBuyPrice * this.additionalQuantity;
  }

  // 추가 매수 수수료
  get additionalFee(): number {
    return this.additionalTotalAmount * (this.feeRate / 100);
  }

  // 새로운 총 수량
  get newTotalQuantity(): number {
    return this.currentQuantity + this.additionalQuantity;
  }

  // 새로운 총 매수 금액 (수수료 포함) - 평균 단가 계산용
  get newTotalAmount(): number {
    return this.currentTotalAmount + this.additionalTotalAmount + this.additionalFee;
  }

  // 새로운 평균 단가 (수수료 포함)
  get newAveragePrice(): number {
    if (this.newTotalQuantity <= 0) return 0;
    const price = this.newTotalAmount / this.newTotalQuantity;
    // 소수점 둘째 자리까지 반올림하여 부동소수점 오차 제거
    return parseFloat(price.toFixed(2));
  }

  // 새로운 총 매수 금액 (수수료 제외) - 표시용
  get newTotalAmountWithoutFee(): number {
    return this.currentTotalAmount + this.additionalTotalAmount;
  }

  // 새로운 평균 단가 (수수료 제외) - 다음 계산의 기존 평균 단가로 사용
  get newAveragePriceWithoutFee(): number {
    if (this.newTotalQuantity <= 0) return 0;
    const price = this.newTotalAmountWithoutFee / this.newTotalQuantity;
    // 소수점 둘째 자리까지 반올림하여 부동소수점 오차 제거
    return parseFloat(price.toFixed(2));
  }

  // 평단 변화량 (수수료 제외)
  get averagePriceChange(): number {
    const newAvg = this.newAveragePriceWithoutFee;
    const currentAvg = parseFloat(this.currentAveragePrice.toFixed(2));
    const change = newAvg - currentAvg;
    // 부동소수점 오차 처리: 절댓값이 0.005보다 작거나 같으면 0으로 처리 (반올림 오차 고려)
    return Math.abs(change) <= 0.005 ? 0 : parseFloat(change.toFixed(2));
  }

  // 평단 변화율 (%)
  get averagePriceChangeRate(): number {
    if (this.currentAveragePrice <= 0) return 0;
    const change = this.averagePriceChange;
    // 변화량이 0이면 변화율도 0
    if (change === 0) return 0;
    const changeRate = (change / this.currentAveragePrice) * 100;
    // 부동소수점 오차 처리: 절댓값이 0.001보다 작거나 같으면 0으로 처리
    return Math.abs(changeRate) <= 0.001 ? 0 : parseFloat(changeRate.toFixed(2));
  }
}

