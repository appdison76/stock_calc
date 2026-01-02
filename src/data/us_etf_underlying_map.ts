// 미국 ETF 티커 -> 기초 자산 티커 매핑 (단계적 확장 예정)
// ETF 종목의 뉴스를 가져올 때 기초 자산 뉴스도 함께 가져오기 위한 매핑
export const US_ETF_TO_UNDERLYING_MAP: Record<string, string> = {
  // 엔비디아 관련 ETF
  'NVDX': 'NVDA',  // 엔비디아 ETF -> 엔비디아
  'NVDS': 'NVDA',  // 엔비디아 역ETF -> 엔비디아
  
  // 테슬라 관련 ETF
  'TSLL': 'TSLA',  // 테슬라 레버리지 ETF -> 테슬라
  'TSLQ': 'TSLA',  // 테슬라 역ETF -> 테슬라
  
  // QQQ (나스닥 100) 레버리지 ETF
  'TQQQ': 'QQQ',   // 나스닥 레버리지 ETF -> QQQ
  'SQQQ': 'QQQ',   // 나스닥 역ETF -> QQQ
  
  // S&P 500 레버리지 ETF
  'SPXL': 'SPY',   // S&P 500 레버리지 ETF -> SPY
  'SPXS': 'SPY',   // S&P 500 역ETF -> SPY
  
  // 미래에 추가할 주요 단일 자산 ETF들
  // 'SOXL': 'SOXX',  // 반도체 레버리지 ETF -> SOXX
  // 'LABU': 'LABD',  // 바이오 ETF -> LABD
};

