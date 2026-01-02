// 미국 ETF 티커 -> 기초 자산 티커 매핑
// ETF 종목의 뉴스를 가져올 때 기초 자산 뉴스도 함께 가져오기 위한 매핑
// 주요 레버리지/역ETF 및 섹터 ETF 포함
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
  'QLD': 'QQQ',    // 나스닥 레버리지 ETF (2x) -> QQQ
  'QID': 'QQQ',    // 나스닥 역ETF (2x) -> QQQ
  
  // S&P 500 레버리지 ETF
  'SPXL': 'SPY',   // S&P 500 레버리지 ETF -> SPY
  'SPXS': 'SPY',   // S&P 500 역ETF -> SPY
  'UPRO': 'SPY',   // S&P 500 레버리지 ETF (3x) -> SPY
  'SPXU': 'SPY',   // S&P 500 역ETF (3x) -> SPY
  'SSO': 'SPY',    // S&P 500 레버리지 ETF (2x) -> SPY
  'SDS': 'SPY',    // S&P 500 역ETF (2x) -> SPY
  'IVV': 'SPY',    // S&P 500 ETF -> SPY
  'VOO': 'SPY',    // S&P 500 ETF -> SPY
  
  // 반도체 ETF
  'SOXL': 'SOXX',  // 반도체 레버리지 ETF -> SOXX
  'SOXS': 'SOXX',  // 반도체 역ETF -> SOXX
  
  // 바이오테크 ETF
  'LABU': 'XBI',   // 바이오테크 레버리지 ETF -> XBI
  'LABD': 'XBI',   // 바이오테크 역ETF -> XBI
  
  // 금 ETF
  'NUGT': 'GDX',   // 금광 레버리지 ETF -> GDX
  'DUST': 'GDX',   // 금광 역ETF -> GDX
  'UGL': 'GLD',    // 금 레버리지 ETF -> GLD
  'GLL': 'GLD',    // 금 역ETF -> GLD
  'JNUG': 'GDXJ',  // 주니어 금광 레버리지 ETF -> GDXJ
  'JDST': 'GDXJ',  // 주니어 금광 역ETF -> GDXJ
  
  // 에너지 ETF
  'ERX': 'XLE',    // 에너지 레버리지 ETF -> XLE
  'ERY': 'XLE',    // 에너지 역ETF -> XLE
  'DUG': 'XLE',    // 에너지 역ETF (2x) -> XLE
  
  // 금융 ETF
  'FAS': 'XLF',    // 금융 레버리지 ETF -> XLF
  'FAZ': 'XLF',    // 금융 역ETF -> XLF
  'UYG': 'XLF',    // 금융 레버리지 ETF (2x) -> XLF
  'SKF': 'XLF',    // 금융 역ETF (2x) -> XLF
  
  // 기술 ETF
  'TECL': 'XLK',   // 기술 레버리지 ETF -> XLK
  'TECS': 'XLK',   // 기술 역ETF -> XLK
  'ROM': 'XLK',    // 기술 레버리지 ETF (2x) -> XLK
  'REW': 'XLK',    // 기술 역ETF (2x) -> XLK
  
  // 소비재 ETF
  'RETL': 'XRT',   // 소매 레버리지 ETF -> XRT
  'RETS': 'XRT',   // 소매 역ETF -> XRT
  'UCC': 'XLP',    // 소비재 레버리지 ETF -> XLP
  'SCC': 'XLP',    // 소비재 역ETF -> XLP
  
  // 헬스케어 ETF
  'CURE': 'XLV',   // 헬스케어 레버리지 ETF -> XLV
  'SICK': 'XLV',   // 헬스케어 역ETF -> XLV
  'RXL': 'XLV',    // 헬스케어 레버리지 ETF (2x) -> XLV
  'RXD': 'XLV',    // 헬스케어 역ETF (2x) -> XLV
  
  // 산업 ETF
  'UXI': 'XLI',    // 산업 레버리지 ETF -> XLI
  'SIJ': 'XLI',    // 산업 역ETF -> XLI
  
  // 소재 ETF
  'UYM': 'XLB',    // 소재 레버리지 ETF -> XLB
  'SMN': 'XLB',    // 소재 역ETF -> XLB
  
  // 유틸리티 ETF
  'UPW': 'XLU',    // 유틸리티 레버리지 ETF -> XLU
  'SDP': 'XLU',    // 유틸리티 역ETF -> XLU
  
  // 통신 ETF
  'LTL': 'XTL',    // 통신 레버리지 ETF -> XTL
  'TLL': 'XTL',    // 통신 역ETF -> XTL
  
  // 부동산 ETF
  'URE': 'XLRE',   // 부동산 레버리지 ETF -> XLRE
  'SRS': 'XLRE',   // 부동산 역ETF -> XLRE
  
  // 나스닥 소형주 ETF
  'TNA': 'IWM',    // 러셀 2000 레버리지 ETF -> IWM
  'TZA': 'IWM',    // 러셀 2000 역ETF -> IWM
  'UWM': 'IWM',    // 러셀 2000 레버리지 ETF (2x) -> IWM
  'TWM': 'IWM',    // 러셀 2000 역ETF (2x) -> IWM
  
  // 다우존스 관련
  'UDOW': 'DIA',   // 다우 레버리지 ETF -> DIA
  'SDOW': 'DIA',   // 다우 역ETF -> DIA
  'DXD': 'DIA',    // 다우 역ETF (2x) -> DIA
  'DDM': 'DIA',    // 다우 레버리지 ETF (2x) -> DIA
  
  // 단일 종목 레버리지 ETF
  'AAPU': 'AAPL',  // 애플 레버리지 ETF -> 애플
  'AAPD': 'AAPL',  // 애플 역ETF -> 애플
  'AMZU': 'AMZN',  // 아마존 레버리지 ETF -> 아마존
  'AMZD': 'AMZN',  // 아마존 역ETF -> 아마존
  'FBL': 'META',   // 메타 레버리지 ETF -> 메타
  'FBGX': 'META',  // 메타 레버리지 ETF -> 메타
  'MSFU': 'MSFT',  // 마이크로소프트 레버리지 ETF -> 마이크로소프트
  'MSFD': 'MSFT',  // 마이크로소프트 역ETF -> 마이크로소프트
  'GOOGU': 'GOOGL', // 구글 레버리지 ETF -> 구글
  'GOOGD': 'GOOGL', // 구글 역ETF -> 구글
  'NFLU': 'NFLX',  // 넷플릭스 레버리지 ETF -> 넷플릭스
  'NFLD': 'NFLX',  // 넷플릭스 역ETF -> 넷플릭스
  
  // VIX 관련
  'UVXY': 'VIX',   // VIX 레버리지 ETF -> VIX
  'SVXY': 'VIX',   // VIX 역ETF -> VIX
  'TVIX': 'VIX',   // VIX 레버리지 ETF -> VIX
  
  // 원유 관련
  'UCO': 'USO',    // 원유 레버리지 ETF -> USO
  'SCO': 'USO',    // 원유 역ETF -> USO
  'UWTI': 'USO',   // 원유 레버리지 ETF (3x) -> USO
  'DWTI': 'USO',   // 원유 역ETF (3x) -> USO
  'GUSH': 'XOP',   // 석유 탐사 레버리지 ETF -> XOP
  'DRIP': 'XOP',   // 석유 탐사 역ETF -> XOP
  
  // 천연가스 관련
  'BOIL': 'UNG',   // 천연가스 레버리지 ETF -> UNG
  'KOLD': 'UNG',   // 천연가스 역ETF -> UNG
  'UGAZ': 'UNG',   // 천연가스 레버리지 ETF (3x) -> UNG
  'DGAZ': 'UNG',   // 천연가스 역ETF (3x) -> UNG
  
  // 은 관련
  'AGQ': 'SLV',    // 은 레버리지 ETF -> SLV
  'ZSL': 'SLV',    // 은 역ETF -> SLV
  
  // 채권/고정수익
  'TMF': 'TLT',    // 20년 이상 채권 레버리지 ETF -> TLT
  'TMV': 'TLT',    // 20년 이상 채권 역ETF -> TLT
  'UBT': 'TLT',    // 20년 이상 채권 레버리지 ETF (2x) -> TLT
  'TBT': 'TLT',    // 20년 이상 채권 역ETF (2x) -> TLT
  
  // 중국 관련
  'YINN': 'FXI',   // 중국 레버리지 ETF -> FXI
  'YANG': 'FXI',   // 중국 역ETF -> FXI
  'CWEB': 'FXI',   // 중국 인터넷 레버리지 ETF -> FXI
  'CQQQ': 'QQQ',   // 중국 나스닥 레버리지 ETF -> QQQ
  
  // 일본 관련
  'DXJ': 'EWJ',    // 일본 헤지 ETF -> EWJ
  'EWJV': 'EWJ',   // 일본 소형주 ETF -> EWJ
  
  // 한국 관련
  'FKO': 'EWY',    // 한국 레버리지 ETF -> EWY
  
  // 유럽 관련
  'EFU': 'EZU',    // 유럽 역ETF -> EZU
  'EPV': 'EZU',    // 유럽 역ETF (2x) -> EZU
  'EUO': 'FXE',    // 유로 역ETF -> FXE
  
  // 신흥국 관련
  'EDC': 'EEM',    // 신흥국 레버리지 ETF -> EEM
  'EDZ': 'EEM',    // 신흥국 역ETF -> EEM
  'INDL': 'INDA',  // 인도 레버리지 ETF -> INDA
  'INP': 'INDA',   // 인도 역ETF -> INDA
  
  // 브라질 관련
  'BRZU': 'EWZ',   // 브라질 레버리지 ETF -> EWZ
  'BRZS': 'EWZ',   // 브라질 역ETF -> EWZ
  
  // 러시아 관련
  'RUSL': 'RSX',   // 러시아 레버리지 ETF -> RSX
  'RUSS': 'RSX',   // 러시아 역ETF -> RSX
  
  // 대만 관련
  'TTT': 'EWT',    // 대만 레버리지 ETF -> EWT
  
  // 홍콩 관련
  'EWHS': 'EWH',   // 홍콩 역ETF -> EWH
  
  // 호주 관련
  'AUSE': 'EWA',   // 호주 역ETF -> EWA
  
  // 캐나다 관련
  'CNDA': 'EWC',   // 캐나다 역ETF -> EWC
  
  // 멕시코 관련
  'MEXX': 'EWW',   // 멕시코 레버리지 ETF -> EWW
  
  // ARK 관련
  'TARK': 'ARKK',  // ARK 레버리지 ETF -> ARKK
  
  // 미드캡/소형주
  'UWMC': 'MDY',   // 미드캡 레버리지 ETF -> MDY
  'IJH': 'MDY',    // S&P 400 미드캡 ETF -> MDY
  'MWJ': 'IWM',    // 소형주 레버리지 ETF -> IWM
  'IJR': 'IWM',    // S&P 600 소형주 ETF -> IWM
};
