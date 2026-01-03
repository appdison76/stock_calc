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
  'SOXX': 'NVDA',  // 반도체 ETF -> NVDA (주요 구성종목)
  'SMH': 'NVDA',   // 반도체 ETF (VanEck) -> NVDA (주요 구성종목)
  
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
  'AMDL': 'AMD',   // AMD 레버리지 ETF -> AMD
  'AMDS': 'AMD',   // AMD 역ETF -> AMD
  'AVGG': 'AVGO',  // 브로드컴 레버리지 ETF -> 브로드컴
  'AVGD': 'AVGO',  // 브로드컴 역ETF -> 브로드컴
  'ORCLU': 'ORCL', // 오라클 레버리지 ETF -> 오라클
  'ORCLD': 'ORCL', // 오라클 역ETF -> 오라클
  'JPMU': 'JPM',   // JP모건 레버리지 ETF -> JP모건
  'JPMD': 'JPM',   // JP모건 역ETF -> JP모건
  'VU': 'V',       // 비자 레버리지 ETF -> 비자
  'VD': 'V',       // 비자 역ETF -> 비자
  'MAU': 'MA',     // 마스터카드 레버리지 ETF -> 마스터카드
  'MAD': 'MA',     // 마스터카드 역ETF -> 마스터카드
  'JNJU': 'JNJ',   // 존슨앤존슨 레버리지 ETF -> 존슨앤존슨
  'NJJD': 'JNJ',   // 존슨앤존슨 역ETF -> 존슨앤존슨
  'UNHU': 'UNH',   // 유나이티드헬스 레버리지 ETF -> 유나이티드헬스
  'UNHD': 'UNH',   // 유나이티드헬스 역ETF -> 유나이티드헬스
  'WMTU': 'WMT',   // 월마트 레버리지 ETF -> 월마트
  'WMTD': 'WMT',   // 월마트 역ETF -> 월마트
  'COSTU': 'COST', // 코스트코 레버리지 ETF -> 코스트코
  'COSTD': 'COST', // 코스트코 역ETF -> 코스트코
  'INTCU': 'INTC', // 인텔 레버리지 ETF -> 인텔
  'INTCD': 'INTC', // 인텔 역ETF -> 인텔
  'QCOMU': 'QCOM', // 퀄컴 레버리지 ETF -> 퀄컴
  'QCOMD': 'QCOM', // 퀄컴 역ETF -> 퀄컴
  'CRMU': 'CRM',   // 세일즈포스 레버리지 ETF -> 세일즈포스
  'CRMD': 'CRM',   // 세일즈포스 역ETF -> 세일즈포스
  'ADBEU': 'ADBE', // 어도비 레버리지 ETF -> 어도비
  'ADBED': 'ADBE', // 어도비 역ETF -> 어도비
  'CSCOU': 'CSCO', // 시스코 레버리지 ETF -> 시스코
  'CSCOD': 'CSCO', // 시스코 역ETF -> 시스코
  'IBMU': 'IBM',   // IBM 레버리지 ETF -> IBM
  'IBMD': 'IBM',   // IBM 역ETF -> IBM
  'TXNU': 'TXN',   // 텍사스인스트루먼츠 레버리지 ETF -> 텍사스인스트루먼츠
  'TXND': 'TXN',   // 텍사스인스트루먼츠 역ETF -> 텍사스인스트루먼츠
  'BACU': 'BAC',   // 뱅크오브아메리카 레버리지 ETF -> 뱅크오브아메리카
  'BACD': 'BAC',   // 뱅크오브아메리카 역ETF -> 뱅크오브아메리카
  'GSU': 'GS',     // 골드만삭스 레버리지 ETF -> 골드만삭스
  'GSD': 'GS',     // 골드만삭스 역ETF -> 골드만삭스
  'MSU': 'MS',     // 모건스탠리 레버리지 ETF -> 모건스탠리
  'MSD': 'MS',     // 모건스탠리 역ETF -> 모건스탠리
  'DISU': 'DIS',   // 디즈니 레버리지 ETF -> 디즈니
  'DISD': 'DIS',   // 디즈니 역ETF -> 디즈니
  'NKEU': 'NKE',   // 나이키 레버리지 ETF -> 나이키
  'NKED': 'NKE',   // 나이키 역ETF -> 나이키
  'SBUXU': 'SBUX', // 스타벅스 레버리지 ETF -> 스타벅스
  'SBUXD': 'SBUX', // 스타벅스 역ETF -> 스타벅스
  'HDU': 'HD',     // 홈디포 레버리지 ETF -> 홈디포
  'HDD': 'HD',     // 홈디포 역ETF -> 홈디포
  'MCDU': 'MCD',   // 맥도날드 레버리지 ETF -> 맥도날드
  'MCDD': 'MCD',   // 맥도날드 역ETF -> 맥도날드
  'PFEU': 'PFE',   // 화이자 레버리지 ETF -> 화이자
  'PFED': 'PFE',   // 화이자 역ETF -> 화이자
  'XOMU': 'XOM',   // 엑손모빌 레버리지 ETF -> 엑손모빌
  'XOMD': 'XOM',   // 엑손모빌 역ETF -> 엑손모빌
  'CVXU': 'CVX',   // 체브론 레버리지 ETF -> 체브론
  'CVXD': 'CVX',   // 체브론 역ETF -> 체브론
  
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
