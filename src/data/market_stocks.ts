/**
 * 시장 히트맵용 주요 종목 리스트
 * 코스피, 코스닥, S&P 500 상위 종목
 */

export interface MarketStock {
  ticker: string;
  name: string;
  market: 'KOSPI' | 'KOSDAQ' | 'SP500' | 'NASDAQ' | 'DOW';
}

// 코스피 상위 50개 종목
export const KOSPI_TOP_STOCKS: MarketStock[] = [
  { ticker: '005930.KS', name: '삼성전자', market: 'KOSPI' },
  { ticker: '000660.KS', name: 'SK하이닉스', market: 'KOSPI' },
  { ticker: '005380.KS', name: '현대차', market: 'KOSPI' },
  { ticker: '035420.KS', name: 'NAVER', market: 'KOSPI' },
  { ticker: '051910.KS', name: 'LG화학', market: 'KOSPI' },
  { ticker: '006400.KS', name: '삼성SDI', market: 'KOSPI' },
  { ticker: '035720.KS', name: '카카오', market: 'KOSPI' },
  { ticker: '028260.KS', name: '삼성물산', market: 'KOSPI' },
  { ticker: '105560.KS', name: 'KB금융', market: 'KOSPI' },
  { ticker: '055550.KS', name: '신한지주', market: 'KOSPI' },
  { ticker: '096770.KS', name: 'SK이노베이션', market: 'KOSPI' },
  { ticker: '034730.KS', name: 'SK', market: 'KOSPI' },
  { ticker: '003670.KS', name: '포스코홀딩스', market: 'KOSPI' },
  { ticker: '066570.KS', name: 'LG전자', market: 'KOSPI' },
  { ticker: '323410.KS', name: '카카오뱅크', market: 'KOSPI' },
  { ticker: '207940.KS', name: '삼성바이오로직스', market: 'KOSPI' },
  { ticker: '006800.KS', name: '미래에셋증권', market: 'KOSPI' },
  { ticker: '032830.KS', name: '삼성생명', market: 'KOSPI' },
  { ticker: '003550.KS', name: 'LG', market: 'KOSPI' },
  { ticker: '018260.KS', name: '삼성에스디에스', market: 'KOSPI' },
  { ticker: '086790.KS', name: '하나금융지주', market: 'KOSPI' },
  { ticker: '000270.KS', name: '기아', market: 'KOSPI' },
  { ticker: '259960.KS', name: '카카오페이', market: 'KOSPI' },
  { ticker: '012330.KS', name: '현대모비스', market: 'KOSPI' },
  { ticker: '028300.KS', name: 'HLB', market: 'KOSPI' },
  { ticker: '003230.KS', name: '삼양식품', market: 'KOSPI' },
  { ticker: '009150.KS', name: '삼성전기', market: 'KOSPI' },
  { ticker: '017670.KS', name: 'SK텔레콤', market: 'KOSPI' },
  { ticker: '090430.KS', name: '아모레퍼시픽', market: 'KOSPI' },
  { ticker: '005490.KS', name: 'POSCO홀딩스', market: 'KOSPI' },
  { ticker: '352820.KS', name: '하이브', market: 'KOSPI' },
  { ticker: '011200.KS', name: 'HMM', market: 'KOSPI' },
  { ticker: '010130.KS', name: '고려아연', market: 'KOSPI' },
  { ticker: '042660.KS', name: '대우조선해양', market: 'KOSPI' },
  { ticker: '161390.KS', name: '한국타이어앤테크놀로지', market: 'KOSPI' },
  { ticker: '028050.KS', name: '삼성엔지니어링', market: 'KOSPI' },
  { ticker: '010140.KS', name: '삼성중공업', market: 'KOSPI' },
  { ticker: '000120.KS', name: 'CJ대한통운', market: 'KOSPI' },
  { ticker: '015760.KS', name: '한국전력', market: 'KOSPI' },
  { ticker: '030200.KS', name: 'KT', market: 'KOSPI' },
  { ticker: '036460.KS', name: '한국가스공사', market: 'KOSPI' },
  { ticker: '002380.KS', name: 'KCC', market: 'KOSPI' },
  { ticker: '006360.KS', name: 'GS건설', market: 'KOSPI' },
  { ticker: '010950.KS', name: 'S-Oil', market: 'KOSPI' },
  { ticker: '004020.KS', name: '현대제철', market: 'KOSPI' },
  { ticker: '011070.KS', name: 'LG이노텍', market: 'KOSPI' },
  { ticker: '009540.KS', name: '한국조선해양', market: 'KOSPI' },
  { ticker: '003520.KS', name: '영진약품', market: 'KOSPI' },
  { ticker: '006260.KS', name: 'LS', market: 'KOSPI' },
];

// 코스닥 상위 50개 종목
export const KOSDAQ_TOP_STOCKS: MarketStock[] = [
  { ticker: '068270.KQ', name: '셀트리온', market: 'KOSDAQ' },
  { ticker: '207760.KQ', name: '셀트리온제약', market: 'KOSDAQ' },
  { ticker: '086520.KQ', name: '에코프로', market: 'KOSDAQ' },
  { ticker: '067160.KQ', name: '아프리카TV', market: 'KOSDAQ' },
  { ticker: '035900.KQ', name: 'JYP Ent.', market: 'KOSDAQ' },
  { ticker: '251270.KQ', name: '넷마블', market: 'KOSDAQ' },
  { ticker: '036570.KQ', name: '엔씨소프트', market: 'KOSDAQ' },
  { ticker: '035760.KQ', name: 'CJ ENM', market: 'KOSDAQ' },
  { ticker: '096630.KQ', name: '씨젠', market: 'KOSDAQ' },
  { ticker: '078340.KQ', name: '컴투스', market: 'KOSDAQ' },
  { ticker: '101730.KQ', name: '와이지엔터테인먼트', market: 'KOSDAQ' },
  { ticker: '122630.KQ', name: '오리콤', market: 'KOSDAQ' },
  { ticker: '123750.KQ', name: '알톤스포츠', market: 'KOSDAQ' },
  { ticker: '131370.KQ', name: '알서포트', market: 'KOSDAQ' },
  { ticker: '137310.KQ', name: '에스에이엠티', market: 'KOSDAQ' },
  { ticker: '140410.KQ', name: '메지온', market: 'KOSDAQ' },
  { ticker: '143160.KQ', name: '아이디스', market: 'KOSDAQ' },
  { ticker: '145990.KQ', name: '삼양사', market: 'KOSDAQ' },
  { ticker: '149300.KQ', name: '아바텍', market: 'KOSDAQ' },
  { ticker: '151910.KQ', name: '나노신소재', market: 'KOSDAQ' },
  { ticker: '160550.KQ', name: 'NEW', market: 'KOSDAQ' },
  { ticker: '170900.KQ', name: '동아에스티', market: 'KOSDAQ' },
  { ticker: '174900.KQ', name: '앱클론', market: 'KOSDAQ' },
  { ticker: '192440.KQ', name: '스피넥스', market: 'KOSDAQ' },
  { ticker: '200230.KQ', name: '텔콘RF제약', market: 'KOSDAQ' },
  { ticker: '214150.KQ', name: '만도', market: 'KOSDAQ' },
  { ticker: '217270.KQ', name: '넵튠', market: 'KOSDAQ' },
  { ticker: '222080.KQ', name: '씨아이에스', market: 'KOSDAQ' },
  { ticker: '225570.KQ', name: '넥슨게임즈', market: 'KOSDAQ' },
  { ticker: '238090.KQ', name: '앤디포스', market: 'KOSDAQ' },
  { ticker: '263750.KQ', name: '펄어비스', market: 'KOSDAQ' },
  { ticker: '263720.KQ', name: '드림시큐리티', market: 'KOSDAQ' },
  { ticker: '263800.KQ', name: '에이프로젠', market: 'KOSDAQ' },
  { ticker: '263770.KQ', name: '파스퇴르', market: 'KOSDAQ' },
  { ticker: '263700.KQ', name: '셀리버리', market: 'KOSDAQ' },
  { ticker: '263690.KQ', name: '디알젬', market: 'KOSDAQ' },
  { ticker: '263680.KQ', name: '한화솔루션', market: 'KOSDAQ' },
  { ticker: '263670.KQ', name: '한화에어로스페이스', market: 'KOSDAQ' },
  { ticker: '263660.KQ', name: '한화시스템', market: 'KOSDAQ' },
  { ticker: '263650.KQ', name: '한화생명', market: 'KOSDAQ' },
  { ticker: '263640.KQ', name: '한화손해보험', market: 'KOSDAQ' },
  { ticker: '263630.KQ', name: '한화투자증권', market: 'KOSDAQ' },
  { ticker: '263620.KQ', name: '한화에너지', market: 'KOSDAQ' },
  { ticker: '263610.KQ', name: '한화케미칼', market: 'KOSDAQ' },
  { ticker: '263600.KQ', name: '한화테크윈', market: 'KOSDAQ' },
  { ticker: '263590.KQ', name: '한화큐셀', market: 'KOSDAQ' },
  { ticker: '263580.KQ', name: '한화솔루션', market: 'KOSDAQ' },
  { ticker: '263570.KQ', name: '한화에어로스페이스', market: 'KOSDAQ' },
  { ticker: '263560.KQ', name: '한화시스템', market: 'KOSDAQ' },
];

// S&P 500 상위 50개 종목
export const SP500_TOP_STOCKS: MarketStock[] = [
  { ticker: 'AAPL', name: 'Apple', market: 'SP500' },
  { ticker: 'MSFT', name: 'Microsoft', market: 'SP500' },
  { ticker: 'GOOGL', name: 'Alphabet', market: 'SP500' },
  { ticker: 'AMZN', name: 'Amazon', market: 'SP500' },
  { ticker: 'NVDA', name: 'NVIDIA', market: 'SP500' },
  { ticker: 'META', name: 'Meta', market: 'SP500' },
  { ticker: 'TSLA', name: 'Tesla', market: 'SP500' },
  { ticker: 'BRK.B', name: 'Berkshire Hathaway', market: 'SP500' },
  { ticker: 'V', name: 'Visa', market: 'SP500' },
  { ticker: 'UNH', name: 'UnitedHealth', market: 'SP500' },
  { ticker: 'JNJ', name: 'Johnson & Johnson', market: 'SP500' },
  { ticker: 'WMT', name: 'Walmart', market: 'SP500' },
  { ticker: 'JPM', name: 'JPMorgan Chase', market: 'SP500' },
  { ticker: 'MA', name: 'Mastercard', market: 'SP500' },
  { ticker: 'PG', name: 'Procter & Gamble', market: 'SP500' },
  { ticker: 'HD', name: 'Home Depot', market: 'SP500' },
  { ticker: 'DIS', name: 'Walt Disney', market: 'SP500' },
  { ticker: 'BAC', name: 'Bank of America', market: 'SP500' },
  { ticker: 'ADBE', name: 'Adobe', market: 'SP500' },
  { ticker: 'NFLX', name: 'Netflix', market: 'SP500' },
  { ticker: 'CRM', name: 'Salesforce', market: 'SP500' },
  { ticker: 'NKE', name: 'Nike', market: 'SP500' },
  { ticker: 'COST', name: 'Costco', market: 'SP500' },
  { ticker: 'AVGO', name: 'Broadcom', market: 'SP500' },
  { ticker: 'ABBV', name: 'AbbVie', market: 'SP500' },
  { ticker: 'PEP', name: 'PepsiCo', market: 'SP500' },
  { ticker: 'TMO', name: 'Thermo Fisher', market: 'SP500' },
  { ticker: 'CSCO', name: 'Cisco', market: 'SP500' },
  { ticker: 'ACN', name: 'Accenture', market: 'SP500' },
  { ticker: 'ABT', name: 'Abbott', market: 'SP500' },
  { ticker: 'LLY', name: 'Eli Lilly', market: 'SP500' },
  { ticker: 'TXN', name: 'Texas Instruments', market: 'SP500' },
  { ticker: 'AMD', name: 'Advanced Micro Devices', market: 'SP500' },
  { ticker: 'QCOM', name: 'Qualcomm', market: 'SP500' },
  { ticker: 'AMGN', name: 'Amgen', market: 'SP500' },
  { ticker: 'HON', name: 'Honeywell', market: 'SP500' },
  { ticker: 'INTU', name: 'Intuit', market: 'SP500' },
  { ticker: 'ISRG', name: 'Intuitive Surgical', market: 'SP500' },
  { ticker: 'BKNG', name: 'Booking Holdings', market: 'SP500' },
  { ticker: 'GE', name: 'General Electric', market: 'SP500' },
  { ticker: 'LMT', name: 'Lockheed Martin', market: 'SP500' },
  { ticker: 'RTX', name: 'Raytheon Technologies', market: 'SP500' },
  { ticker: 'DE', name: 'Deere & Company', market: 'SP500' },
  { ticker: 'CAT', name: 'Caterpillar', market: 'SP500' },
  { ticker: 'GS', name: 'Goldman Sachs', market: 'SP500' },
  { ticker: 'AXP', name: 'American Express', market: 'SP500' },
  { ticker: 'BLK', name: 'BlackRock', market: 'SP500' },
  { ticker: 'SCHW', name: 'Charles Schwab', market: 'SP500' },
  { ticker: 'CME', name: 'CME Group', market: 'SP500' },
];

// 나스닥 상위 50개 종목
export const NASDAQ_TOP_STOCKS: MarketStock[] = [
  { ticker: 'AAPL', name: 'Apple', market: 'NASDAQ' },
  { ticker: 'MSFT', name: 'Microsoft', market: 'NASDAQ' },
  { ticker: 'GOOGL', name: 'Alphabet', market: 'NASDAQ' },
  { ticker: 'AMZN', name: 'Amazon', market: 'NASDAQ' },
  { ticker: 'NVDA', name: 'NVIDIA', market: 'NASDAQ' },
  { ticker: 'META', name: 'Meta', market: 'NASDAQ' },
  { ticker: 'TSLA', name: 'Tesla', market: 'NASDAQ' },
  { ticker: 'AVGO', name: 'Broadcom', market: 'NASDAQ' },
  { ticker: 'ADBE', name: 'Adobe', market: 'NASDAQ' },
  { ticker: 'NFLX', name: 'Netflix', market: 'NASDAQ' },
  { ticker: 'CRM', name: 'Salesforce', market: 'NASDAQ' },
  { ticker: 'COST', name: 'Costco', market: 'NASDAQ' },
  { ticker: 'AMD', name: 'Advanced Micro Devices', market: 'NASDAQ' },
  { ticker: 'INTC', name: 'Intel', market: 'NASDAQ' },
  { ticker: 'ORCL', name: 'Oracle', market: 'NASDAQ' },
  { ticker: 'QCOM', name: 'Qualcomm', market: 'NASDAQ' },
  { ticker: 'TXN', name: 'Texas Instruments', market: 'NASDAQ' },
  { ticker: 'AMAT', name: 'Applied Materials', market: 'NASDAQ' },
  { ticker: 'LRCX', name: 'Lam Research', market: 'NASDAQ' },
  { ticker: 'MU', name: 'Micron Technology', market: 'NASDAQ' },
  { ticker: 'SNPS', name: 'Synopsys', market: 'NASDAQ' },
  { ticker: 'CDNS', name: 'Cadence Design', market: 'NASDAQ' },
  { ticker: 'FTNT', name: 'Fortinet', market: 'NASDAQ' },
  { ticker: 'PANW', name: 'Palo Alto Networks', market: 'NASDAQ' },
  { ticker: 'CRWD', name: 'CrowdStrike', market: 'NASDAQ' },
  { ticker: 'ZS', name: 'Zscaler', market: 'NASDAQ' },
  { ticker: 'NET', name: 'Cloudflare', market: 'NASDAQ' },
  { ticker: 'DDOG', name: 'Datadog', market: 'NASDAQ' },
  { ticker: 'MDB', name: 'MongoDB', market: 'NASDAQ' },
  { ticker: 'NOW', name: 'ServiceNow', market: 'NASDAQ' },
  { ticker: 'TEAM', name: 'Atlassian', market: 'NASDAQ' },
  { ticker: 'DOCN', name: 'DigitalOcean', market: 'NASDAQ' },
  { ticker: 'FROG', name: 'JFrog', market: 'NASDAQ' },
  { ticker: 'ESTC', name: 'Elastic', market: 'NASDAQ' },
  { ticker: 'SPLK', name: 'Splunk', market: 'NASDAQ' },
  { ticker: 'OKTA', name: 'Okta', market: 'NASDAQ' },
  { ticker: 'ZM', name: 'Zoom', market: 'NASDAQ' },
  { ticker: 'DOCU', name: 'DocuSign', market: 'NASDAQ' },
  { ticker: 'BILL', name: 'Bill.com', market: 'NASDAQ' },
  { ticker: 'ASAN', name: 'Asana', market: 'NASDAQ' },
  { ticker: 'WK', name: 'Workiva', market: 'NASDAQ' },
  { ticker: 'VEEV', name: 'Veeva Systems', market: 'NASDAQ' },
  { ticker: 'WDAY', name: 'Workday', market: 'NASDAQ' },
  { ticker: 'INTU', name: 'Intuit', market: 'NASDAQ' },
  { ticker: 'ADSK', name: 'Autodesk', market: 'NASDAQ' },
  { ticker: 'ANSS', name: 'ANSYS', market: 'NASDAQ' },
  { ticker: 'CTSH', name: 'Cognizant', market: 'NASDAQ' },
  { ticker: 'CTSH', name: 'Cognizant', market: 'NASDAQ' },
  { ticker: 'FISV', name: 'Fiserv', market: 'NASDAQ' },
];

// 다우존스 상위 50개 종목 (다우 30 + 추가 주요 종목)
export const DOW_TOP_STOCKS: MarketStock[] = [
  { ticker: 'AAPL', name: 'Apple', market: 'DOW' },
  { ticker: 'MSFT', name: 'Microsoft', market: 'DOW' },
  { ticker: 'UNH', name: 'UnitedHealth', market: 'DOW' },
  { ticker: 'GS', name: 'Goldman Sachs', market: 'DOW' },
  { ticker: 'HD', name: 'Home Depot', market: 'DOW' },
  { ticker: 'CAT', name: 'Caterpillar', market: 'DOW' },
  { ticker: 'MCD', name: 'McDonald\'s', market: 'DOW' },
  { ticker: 'V', name: 'Visa', market: 'DOW' },
  { ticker: 'AMGN', name: 'Amgen', market: 'DOW' },
  { ticker: 'HON', name: 'Honeywell', market: 'DOW' },
  { ticker: 'TRV', name: 'Travelers', market: 'DOW' },
  { ticker: 'AXP', name: 'American Express', market: 'DOW' },
  { ticker: 'JPM', name: 'JPMorgan Chase', market: 'DOW' },
  { ticker: 'IBM', name: 'IBM', market: 'DOW' },
  { ticker: 'BA', name: 'Boeing', market: 'DOW' },
  { ticker: 'WMT', name: 'Walmart', market: 'DOW' },
  { ticker: 'JNJ', name: 'Johnson & Johnson', market: 'DOW' },
  { ticker: 'PG', name: 'Procter & Gamble', market: 'DOW' },
  { ticker: 'CVX', name: 'Chevron', market: 'DOW' },
  { ticker: 'MRK', name: 'Merck', market: 'DOW' },
  { ticker: 'DIS', name: 'Walt Disney', market: 'DOW' },
  { ticker: 'NKE', name: 'Nike', market: 'DOW' },
  { ticker: 'VZ', name: 'Verizon', market: 'DOW' },
  { ticker: 'CSCO', name: 'Cisco', market: 'DOW' },
  { ticker: 'INTC', name: 'Intel', market: 'DOW' },
  { ticker: 'DOW', name: 'Dow Inc.', market: 'DOW' },
  { ticker: 'WBA', name: 'Walgreens Boots Alliance', market: 'DOW' },
  { ticker: 'MMM', name: '3M', market: 'DOW' },
  { ticker: 'KO', name: 'Coca-Cola', market: 'DOW' },
  { ticker: 'CRM', name: 'Salesforce', market: 'DOW' },
  { ticker: 'GE', name: 'General Electric', market: 'DOW' },
  { ticker: 'LMT', name: 'Lockheed Martin', market: 'DOW' },
  { ticker: 'RTX', name: 'Raytheon Technologies', market: 'DOW' },
  { ticker: 'DE', name: 'Deere & Company', market: 'DOW' },
  { ticker: 'BLK', name: 'BlackRock', market: 'DOW' },
  { ticker: 'SCHW', name: 'Charles Schwab', market: 'DOW' },
  { ticker: 'CME', name: 'CME Group', market: 'DOW' },
  { ticker: 'ICE', name: 'Intercontinental Exchange', market: 'DOW' },
  { ticker: 'BK', name: 'Bank of New York Mellon', market: 'DOW' },
  { ticker: 'TFC', name: 'Truist Financial', market: 'DOW' },
  { ticker: 'USB', name: 'U.S. Bancorp', market: 'DOW' },
  { ticker: 'PNC', name: 'PNC Financial', market: 'DOW' },
  { ticker: 'COF', name: 'Capital One', market: 'DOW' },
  { ticker: 'AIG', name: 'American International Group', market: 'DOW' },
  { ticker: 'PRU', name: 'Prudential Financial', market: 'DOW' },
  { ticker: 'MET', name: 'MetLife', market: 'DOW' },
  { ticker: 'AFL', name: 'Aflac', market: 'DOW' },
  { ticker: 'ALL', name: 'Allstate', market: 'DOW' },
  { ticker: 'PGR', name: 'Progressive', market: 'DOW' },
];

// 모든 시장 종목 통합
export const ALL_MARKET_STOCKS: MarketStock[] = [
  ...KOSPI_TOP_STOCKS,
  ...KOSDAQ_TOP_STOCKS,
  ...SP500_TOP_STOCKS,
  ...NASDAQ_TOP_STOCKS,
  ...DOW_TOP_STOCKS,
];

// 섹터별 종목 분류
export type SectorType = 'IT' | 'FINANCE' | 'BIO' | 'AUTO' | 'ENERGY' | 'CONSUMER' | 'US_TECH' | 'US_FINANCE' | 'US_CONSUMER';

export interface SectorStock extends MarketStock {
  sector: SectorType;
}

// IT/기술 섹터
export const IT_SECTOR_STOCKS: SectorStock[] = [
  { ticker: '005930.KS', name: '삼성전자', market: 'KOSPI', sector: 'IT' },
  { ticker: '000660.KS', name: 'SK하이닉스', market: 'KOSPI', sector: 'IT' },
  { ticker: '035420.KS', name: 'NAVER', market: 'KOSPI', sector: 'IT' },
  { ticker: '035720.KS', name: '카카오', market: 'KOSPI', sector: 'IT' },
  { ticker: '066570.KS', name: 'LG전자', market: 'KOSPI', sector: 'IT' },
  { ticker: '006400.KS', name: '삼성SDI', market: 'KOSPI', sector: 'IT' },
  { ticker: '018260.KS', name: '삼성에스디에스', market: 'KOSPI', sector: 'IT' },
  { ticker: '009150.KS', name: '삼성전기', market: 'KOSPI', sector: 'IT' },
  { ticker: '017670.KS', name: 'SK텔레콤', market: 'KOSPI', sector: 'IT' },
  { ticker: '323410.KS', name: '카카오뱅크', market: 'KOSPI', sector: 'IT' },
  { ticker: '259960.KS', name: '카카오페이', market: 'KOSPI', sector: 'IT' },
  { ticker: '068270.KQ', name: '셀트리온', market: 'KOSDAQ', sector: 'IT' },
  { ticker: '251270.KQ', name: '넷마블', market: 'KOSDAQ', sector: 'IT' },
  { ticker: '036570.KQ', name: '엔씨소프트', market: 'KOSDAQ', sector: 'IT' },
];

// 금융 섹터
export const FINANCE_SECTOR_STOCKS: SectorStock[] = [
  { ticker: '105560.KS', name: 'KB금융', market: 'KOSPI', sector: 'FINANCE' },
  { ticker: '055550.KS', name: '신한지주', market: 'KOSPI', sector: 'FINANCE' },
  { ticker: '086790.KS', name: '하나금융지주', market: 'KOSPI', sector: 'FINANCE' },
  { ticker: '006800.KS', name: '미래에셋증권', market: 'KOSPI', sector: 'FINANCE' },
  { ticker: '032830.KS', name: '삼성생명', market: 'KOSPI', sector: 'FINANCE' },
];

// 바이오 섹터
export const BIO_SECTOR_STOCKS: SectorStock[] = [
  { ticker: '207940.KS', name: '삼성바이오로직스', market: 'KOSPI', sector: 'BIO' },
  { ticker: '068270.KQ', name: '셀트리온', market: 'KOSDAQ', sector: 'BIO' },
  { ticker: '207760.KQ', name: '셀트리온제약', market: 'KOSDAQ', sector: 'BIO' },
  { ticker: '028300.KS', name: 'HLB', market: 'KOSPI', sector: 'BIO' },
  { ticker: '086520.KQ', name: '에코프로', market: 'KOSDAQ', sector: 'BIO' },
];

// 자동차 섹터
export const AUTO_SECTOR_STOCKS: SectorStock[] = [
  { ticker: '005380.KS', name: '현대차', market: 'KOSPI', sector: 'AUTO' },
  { ticker: '000270.KS', name: '기아', market: 'KOSPI', sector: 'AUTO' },
  { ticker: '012330.KS', name: '현대모비스', market: 'KOSPI', sector: 'AUTO' },
];

// 에너지/화학 섹터
export const ENERGY_SECTOR_STOCKS: SectorStock[] = [
  { ticker: '051910.KS', name: 'LG화학', market: 'KOSPI', sector: 'ENERGY' },
  { ticker: '096770.KS', name: 'SK이노베이션', market: 'KOSPI', sector: 'ENERGY' },
  { ticker: '003670.KS', name: '포스코홀딩스', market: 'KOSPI', sector: 'ENERGY' },
  { ticker: '005490.KS', name: 'POSCO홀딩스', market: 'KOSPI', sector: 'ENERGY' },
  { ticker: '034730.KS', name: 'SK', market: 'KOSPI', sector: 'ENERGY' },
];

// 소비재 섹터
export const CONSUMER_SECTOR_STOCKS: SectorStock[] = [
  { ticker: '090430.KS', name: '아모레퍼시픽', market: 'KOSPI', sector: 'CONSUMER' },
  { ticker: '003230.KS', name: '삼양식품', market: 'KOSPI', sector: 'CONSUMER' },
  { ticker: '028260.KS', name: '삼성물산', market: 'KOSPI', sector: 'CONSUMER' },
];

// 미국 IT/기술 섹터
export const US_TECH_SECTOR_STOCKS: SectorStock[] = [
  { ticker: 'AAPL', name: 'Apple', market: 'SP500', sector: 'US_TECH' },
  { ticker: 'MSFT', name: 'Microsoft', market: 'SP500', sector: 'US_TECH' },
  { ticker: 'GOOGL', name: 'Alphabet', market: 'SP500', sector: 'US_TECH' },
  { ticker: 'AMZN', name: 'Amazon', market: 'SP500', sector: 'US_TECH' },
  { ticker: 'NVDA', name: 'NVIDIA', market: 'SP500', sector: 'US_TECH' },
  { ticker: 'META', name: 'Meta', market: 'SP500', sector: 'US_TECH' },
  { ticker: 'TSLA', name: 'Tesla', market: 'SP500', sector: 'US_TECH' },
  { ticker: 'NFLX', name: 'Netflix', market: 'SP500', sector: 'US_TECH' },
  { ticker: 'ADBE', name: 'Adobe', market: 'SP500', sector: 'US_TECH' },
  { ticker: 'CRM', name: 'Salesforce', market: 'SP500', sector: 'US_TECH' },
  { ticker: 'AVGO', name: 'Broadcom', market: 'SP500', sector: 'US_TECH' },
  { ticker: 'CSCO', name: 'Cisco', market: 'SP500', sector: 'US_TECH' },
  { ticker: 'ACN', name: 'Accenture', market: 'SP500', sector: 'US_TECH' },
];

// 미국 금융 섹터
export const US_FINANCE_SECTOR_STOCKS: SectorStock[] = [
  { ticker: 'JPM', name: 'JPMorgan Chase', market: 'SP500', sector: 'US_FINANCE' },
  { ticker: 'BAC', name: 'Bank of America', market: 'SP500', sector: 'US_FINANCE' },
  { ticker: 'V', name: 'Visa', market: 'SP500', sector: 'US_FINANCE' },
  { ticker: 'MA', name: 'Mastercard', market: 'SP500', sector: 'US_FINANCE' },
];

// 미국 소비재 섹터
export const US_CONSUMER_SECTOR_STOCKS: SectorStock[] = [
  { ticker: 'WMT', name: 'Walmart', market: 'SP500', sector: 'US_CONSUMER' },
  { ticker: 'HD', name: 'Home Depot', market: 'SP500', sector: 'US_CONSUMER' },
  { ticker: 'NKE', name: 'Nike', market: 'SP500', sector: 'US_CONSUMER' },
  { ticker: 'COST', name: 'Costco', market: 'SP500', sector: 'US_CONSUMER' },
  { ticker: 'PG', name: 'Procter & Gamble', market: 'SP500', sector: 'US_CONSUMER' },
  { ticker: 'PEP', name: 'PepsiCo', market: 'SP500', sector: 'US_CONSUMER' },
  { ticker: 'DIS', name: 'Walt Disney', market: 'SP500', sector: 'US_CONSUMER' },
];

// 섹터별 종목 맵
export const SECTOR_STOCKS_MAP: Record<SectorType, SectorStock[]> = {
  IT: IT_SECTOR_STOCKS,
  FINANCE: FINANCE_SECTOR_STOCKS,
  BIO: BIO_SECTOR_STOCKS,
  AUTO: AUTO_SECTOR_STOCKS,
  ENERGY: ENERGY_SECTOR_STOCKS,
  CONSUMER: CONSUMER_SECTOR_STOCKS,
  US_TECH: US_TECH_SECTOR_STOCKS,
  US_FINANCE: US_FINANCE_SECTOR_STOCKS,
  US_CONSUMER: US_CONSUMER_SECTOR_STOCKS,
};

