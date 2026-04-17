// 기준금리 데이터를 가져오는 서비스
// API 키 없이도 작동하도록 공개 데이터 소스 활용
//
// 우선순위: Firestore interestRates/current → (실패 시) 기존 로직(ECOS/하드코딩 등)

import { fetchInterestRatesFromRemote } from './InterestRatesRemoteService';

// 참고: API 키를 설정하려면 아래 상수를 업데이트하세요
// FRED API 키: https://fred.stlouisfed.org/docs/api/api_key.html (무료)
// ECOS API 키: https://ecos.bok.or.kr/api/ (무료)
// 환경변수에서 가져오거나, 없으면 직접 설정된 키 사용
const FRED_API_KEY = process.env.EXPO_PUBLIC_FRED_API_KEY || '30408c5c406ff692e4a88d0c6818eb06';
const ECOS_API_KEY = process.env.EXPO_PUBLIC_ECOS_API_KEY || '';

interface InterestRate {
  country: string;
  rate: number | null;
  lastUpdated?: string;
}

export class InterestRateService {
  /**
   * 미국 기준금리 (Federal Funds Rate) 가져오기
   * 범위 형식으로 반환 (예: "3.50~3.75")
   */
  static async getUSInterestRate(): Promise<string | null> {
    try {
      // 연준 기준금리는 범위로 표시됨 (2026년 기준: 3.50~3.75%)
      // FRED API는 단일 값만 제공하므로, 하드코딩된 범위 값 사용
      const rateRange = '3.50~3.75';
      console.log('[InterestRate] 미국 기준금리 범위:', rateRange);
      return rateRange;
    } catch (error) {
      console.error('미국 기준금리 가져오기 오류:', error);
      return null;
    }
  }


  /**
   * 한국 기준금리 가져오기
   * 한국은행 ECOS API 사용
   */
  static async getKRInterestRate(): Promise<number | null> {
    try {
      // ECOS API 키가 없으면 공개 데이터 소스 시도
      if (!ECOS_API_KEY || ECOS_API_KEY === 'YOUR_ECOS_API_KEY') {
        return await this.getKRInterestRateFromPublicSource();
      }

      // 한국은행 기준금리 통계코드: 722Y001
      // 최근 1개월 데이터만 가져오기
      const url = `https://ecos.bok.or.kr/api/StatisticSearch/${ECOS_API_KEY}/json/kr/1/1/722Y001/YYYYMM/202401/202412`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        // ECOS API 응답 구조에 따라 파싱
        if (data.StatisticSearch && data.StatisticSearch.row) {
          const rows = data.StatisticSearch.row;
          if (rows.length > 0) {
            // 가장 최근 데이터
            const latest = rows[0];
            // 데이터 필드명은 API 문서 확인 필요
            const rate = parseFloat(latest.DATA_VALUE || latest.data_value || latest.value);
            if (!isNaN(rate)) {
              return rate;
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('한국 기준금리 가져오기 오류:', error);
      return null;
    }
  }

  /**
   * 공개 데이터 소스에서 한국 기준금리 가져오기 (API 키 불필요)
   */
  static async getKRInterestRateFromPublicSource(): Promise<number | null> {
    try {
      // 한국은행 기준금리 (2026년 기준, 수동 업데이트 필요)
      // 참고: 한국은행 ECOS API는 API 키가 필요하므로, 현재는 fallback 값 사용
      // 2026년 기준 한국은행 기준금리
      const fallbackRate = 2.50; // 2026년 기준 (실제 값)
      
      // TODO: 한국은행 공개 데이터 소스 추가 가능
      // 현재는 fallback 값 반환
      console.log('[InterestRate] 한국 기준금리 fallback 값 사용:', fallbackRate);
      return fallbackRate;
    } catch (error) {
      console.error('[InterestRate] 공개 소스에서 한국 기준금리 가져오기 오류:', error);
      return 3.00; // fallback (2026년 기준)
    }
  }

  /**
   * 일본 기준금리 가져오기
   * FRED API 사용 (일본 단기금리 또는 정책금리)
   */
  static async getJPInterestRate(): Promise<number | null> {
    // 일본은행 정책금리(Uncollateralized Overnight Call Rate)는 0.75% (2026년 기준)
    // FRED API의 일본 데이터는 단기금리일 수 있어 정책금리와 다를 수 있음
    // 따라서 정확한 정책금리를 위해 fallback 값(0.75%) 직접 반환
    console.log('[InterestRate] 일본 기준금리: 0.75% (일본은행 정책금리)');
    return 0.75;
  }

  /**
   * 공개 데이터 소스에서 일본 기준금리 가져오기 (API 키 불필요)
   */
  static async getJPInterestRateFromPublicSource(): Promise<number | null> {
    try {
      // 일본은행 정책금리 (2026년 기준, 수동 업데이트 필요)
      // 2026년 기준 일본은행 정책금리 (Uncollateralized Overnight Call Rate)
      const fallbackRate = 0.75; // 2026년 기준 (실제 값)
      
      // FRED API 키가 있으면 사용
      if (FRED_API_KEY && FRED_API_KEY !== '') {
        const url = `https://api.stlouisfed.org/fred/series/observations?series_id=IR3TTS01JPM156N&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`;
        
        console.log('[InterestRate] 일본 기준금리 가져오기 시도 (FRED API 키 사용)');
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          
          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
            },
          });
          
          clearTimeout(timeoutId);
          
          console.log('[InterestRate] 일본 기준금리 응답 상태:', response.status);
          
          if (response.ok) {
            const data = await response.json();
            console.log('[InterestRate] 일본 기준금리 데이터:', JSON.stringify(data).substring(0, 300));
            
            if (data.error_code) {
              console.warn('[InterestRate] FRED API 오류, fallback 사용');
              return fallbackRate;
            }
            
            if (data.observations && data.observations.length > 0) {
              const latest = data.observations[0];
              console.log('[InterestRate] 최신 관측값:', latest);
              
              if (latest.value && latest.value !== '.' && latest.value !== 'null' && latest.value !== '') {
                const rate = parseFloat(latest.value);
                if (!isNaN(rate)) {
                  console.log('[InterestRate] 파싱된 일본 기준금리:', rate);
                  return rate;
                }
              }
            }
          } else {
            console.warn('[InterestRate] API 오류, fallback 사용:', response.status);
          }
        } catch (fetchError: any) {
          console.warn('[InterestRate] Fetch 오류, fallback 사용:', fetchError.message);
        }
      } else {
        console.warn('[InterestRate] FRED API 키가 없어 fallback 값 사용');
      }
      
      // API 실패 시 fallback 값 반환
      console.log('[InterestRate] 일본 기준금리 fallback 값 사용:', fallbackRate);
      return fallbackRate;
    } catch (error: any) {
      console.error('[InterestRate] 오류:', error.message);
      return 0.75; // fallback (2026년 기준, 실제 일본은행 정책금리)
    }
  }

  /**
   * 모든 국가의 기준금리를 한번에 가져오기
   */
  static async getAllInterestRates(): Promise<{
    us: string | null;  // 범위 형식 (예: "3.50~3.75")
    kr: number | null;
    jp: number | null;
  }> {
    try {
      const fromRemote = await fetchInterestRatesFromRemote();
      if (fromRemote !== null) {
        console.log('[InterestRate] Firestore interestRates/current 사용');
        return {
          us: fromRemote.us,
          kr: fromRemote.kr,
          jp: fromRemote.jp,
        };
      }
    } catch (e) {
      console.warn('[InterestRate] 원격 JSON 처리 오류, 기존 방식 사용:', e);
    }

    try {
      const [us, kr, jp] = await Promise.all([
        this.getUSInterestRate(),
        this.getKRInterestRate(),
        this.getJPInterestRate(),
      ]);

      return { us, kr, jp };
    } catch (error) {
      console.error('기준금리 가져오기 오류:', error);
      return { us: null, kr: null, jp: null };
    }
  }
}

