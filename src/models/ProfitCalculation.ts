import { Currency } from './Currency';

export class ProfitCalculation {
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  taxRate: number;
  feeRate: number;
  currency: Currency;
  exchangeRate?: number; // 환율 (USD to KRW)

  constructor({
    buyPrice,
    sellPrice,
    quantity,
    taxRate = 0.15, // 기본 0.15% (거래세)
    feeRate = 0.015, // 기본 0.015% (수수료)
    currency = Currency.KRW,
    exchangeRate,
  }: {
    buyPrice: number;
    sellPrice: number;
    quantity: number;
    taxRate?: number;
    feeRate?: number;
    currency?: Currency;
    exchangeRate?: number;
  }) {
    this.buyPrice = buyPrice;
    this.sellPrice = sellPrice;
    this.quantity = quantity;
    this.taxRate = taxRate;
    this.feeRate = feeRate;
    this.currency = currency;
    this.exchangeRate = exchangeRate;
  }

  // 총 매수 금액
  get totalBuyAmount(): number {
    return this.buyPrice * this.quantity;
  }

  // 총 매도 금액
  get totalSellAmount(): number {
    return this.sellPrice * this.quantity;
  }

  // 매수 수수료
  get buyFee(): number {
    return this.totalBuyAmount * (this.feeRate / 100);
  }

  // 매도 수수료
  get sellFee(): number {
    return this.totalSellAmount * (this.feeRate / 100);
  }

  // 거래세 (매도 시)
  get tax(): number {
    return this.totalSellAmount * (this.taxRate / 100);
  }

  // 총 비용 (매수 금액 + 매수 수수료)
  get totalCost(): number {
    return this.totalBuyAmount + this.buyFee;
  }

  // 총 수익 (매도 금액 - 매도 수수료 - 거래세)
  get totalRevenue(): number {
    return this.totalSellAmount - this.sellFee - this.tax;
  }

  // 순수익
  get netProfit(): number {
    return this.totalRevenue - this.totalCost;
  }

  // 수익률 (%)
  get profitRate(): number {
    return this.totalCost > 0 ? (this.netProfit / this.totalCost) * 100 : 0;
  }

  // 손익분기점 (매도가)
  get breakEvenPrice(): number {
    if (this.quantity === 0) return 0;
    const totalCostWithBuyFee = this.totalCost;
    const sellFeeRate = this.feeRate / 100;
    const taxRateValue = this.taxRate / 100;
    // 매도가 * 수량 * (1 - 수수료율 - 세율) = 총 비용
    // 매도가 = 총 비용 / (수량 * (1 - 수수료율 - 세율))
    return totalCostWithBuyFee / (this.quantity * (1 - sellFeeRate - taxRateValue));
  }

  // 단순 차이 (매도 금액 - 매수 금액, 수수료/거래세 제외)
  get simpleDifference(): number {
    return this.totalSellAmount - this.totalBuyAmount;
  }
}



