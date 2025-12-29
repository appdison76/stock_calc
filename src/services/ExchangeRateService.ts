const API_URL = 'https://api.frankfurter.app/latest?from=USD&to=KRW';
const DEFAULT_RATE = 1350.0;

export class ExchangeRateService {
  /// USD-KRW 환율을 가져옵니다
  static async getUsdToKrwRate(): Promise<number> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(API_URL, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const rates = data.rates as Record<string, number>;
        const krwRate = rates['KRW'];
        return krwRate || DEFAULT_RATE;
      } else {
        throw new Error('Failed to load exchange rate');
      }
    } catch (e) {
      // 에러 발생 시 기본값 반환
      return DEFAULT_RATE;
    }
  }
}



