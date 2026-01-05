import { Currency } from '../models/Currency';

export interface BrokerFee {
  name: string;
  feeRate: number; // 수수료율 (%)
  fixedFee?: number; // 거래당 고정 수수료
  minFee?: number; // 최소 수수료
  maxFee?: number; // 최대 수수료
}

// Google Apps Script API URL (크롤링 서버)
// TODO: 실제 크롤링 서버 URL로 교체 필요
const BROKER_FEE_API_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';

// 로컬 기본값 (API 실패 시 사용)
// 참고: 
// - 일반적으로 한국 주식 거래 수수료는 0.01% ~ 0.015% 정도입니다
// - 대부분의 증권사가 비슷한 수준이지만, 이벤트/프로모션/계좌 유형에 따라 달라질 수 있습니다
// - 비대면 계좌나 특별 이벤트 시 더 낮은 수수료(0.003% ~ 0.01%)를 제공하기도 합니다
// - 아래 값은 일반 온라인 계좌 기준이며, 실제 수수료는 증권사 공식 홈페이지에서 확인하시기 바랍니다
const DEFAULT_BROKERS_KRW: BrokerFee[] = [
  { name: '키움증권', feeRate: 0.0145, minFee: 0, maxFee: 0 }, // 0.0145% (ATS 거래 기준, 일반 0.015%)
  { name: '미래에셋증권', feeRate: 0.015, minFee: 0, maxFee: 0 }, // 0.015% (비대면 계좌 시 더 낮음)
  { name: 'NH투자증권', feeRate: 0.015, minFee: 0, maxFee: 0 }, // 0.015%
  { name: 'KB증권', feeRate: 0.015, minFee: 0, maxFee: 0 }, // 0.015%
  { name: '삼성증권', feeRate: 0.015, minFee: 0, maxFee: 0 }, // 0.015% (비대면 계좌 시 더 낮음)
  { name: '한국투자증권', feeRate: 0.015, minFee: 0, maxFee: 0 }, // 0.015%
  { name: '대신증권', feeRate: 0.015, minFee: 0, maxFee: 0 }, // 0.015%
  { name: '교보증권', feeRate: 0.015, minFee: 0, maxFee: 0 }, // 0.015%
  { name: '하나증권', feeRate: 0.015, minFee: 0, maxFee: 0 }, // 0.015%
  { name: '신한투자증권', feeRate: 0.015, minFee: 0, maxFee: 0 }, // 0.015%
];

const DEFAULT_BROKERS_USD: BrokerFee[] = [
  { name: '키움증권', feeRate: 0.15, minFee: 0, maxFee: 0 },
  { name: '미래에셋증권', feeRate: 0.15, minFee: 0, maxFee: 0 },
  { name: 'NH투자증권', feeRate: 0.15, minFee: 0, maxFee: 0 },
  { name: 'KB증권', feeRate: 0.15, minFee: 0, maxFee: 0 },
  { name: '삼성증권', feeRate: 0.15, minFee: 0, maxFee: 0 },
  { name: '한국투자증권', feeRate: 0.15, minFee: 0, maxFee: 0 },
  { name: '대신증권', feeRate: 0.15, minFee: 0, maxFee: 0 },
  { name: '교보증권', feeRate: 0.15, minFee: 0, maxFee: 0 },
  { name: '하나증권', feeRate: 0.15, minFee: 0, maxFee: 0 },
  { name: '신한투자증권', feeRate: 0.15, minFee: 0, maxFee: 0 },
];

export class BrokerFeeService {
  /// 증권사별 수수료 정보를 가져옵니다 (API 또는 기본값)
  static async getBrokerFees(currency: Currency): Promise<BrokerFee[]> {
    try {
      // API에서 최신 정보 가져오기 시도
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${BROKER_FEE_API_URL}?currency=${currency}`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.brokers && Array.isArray(data.brokers)) {
          return data.brokers as BrokerFee[];
        }
      }
    } catch (e) {
      console.warn('증권사 수수료 API 호출 실패, 기본값 사용:', e);
    }

    // API 실패 시 기본값 반환
    return currency === Currency.KRW ? DEFAULT_BROKERS_KRW : DEFAULT_BROKERS_USD;
  }

  /// 기본 증권사 목록 반환
  static getDefaultBrokers(currency: Currency): BrokerFee[] {
    return currency === Currency.KRW ? DEFAULT_BROKERS_KRW : DEFAULT_BROKERS_USD;
  }
}

