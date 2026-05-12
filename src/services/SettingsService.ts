import AsyncStorage from '@react-native-async-storage/async-storage';
import { Currency } from '../models/Currency';

const KEY_KRW_TAX_RATE = 'krw_tax_rate';
const KEY_KRW_FEE_RATE = 'krw_fee_rate';
const KEY_USD_TAX_RATE = 'usd_tax_rate';
const KEY_USD_FEE_RATE = 'usd_fee_rate';

// 메인화면 표시 설정 키
const KEY_SHOW_MARKET_INDICATORS = 'show_market_indicators';
const KEY_SHOW_MINI_BANNERS = 'show_mini_banners';
const KEY_SHOW_PORTFOLIO = 'show_portfolio';
const KEY_SHOW_RELATED_NEWS = 'show_related_news';
const KEY_SHOW_LATEST_NEWS = 'show_latest_news';
const KEY_SHOW_WORLD_TIME = 'show_world_time';
const KEY_SHOW_INTEREST_RATES = 'show_interest_rates';
const KEY_SHOW_ISSUE_KEYWORDS = 'show_issue_keywords';
const KEY_SHOW_DAILY_SETTLEMENT = 'show_daily_settlement';
const KEY_SHOW_MY_SHORTCUTS = 'show_my_shortcuts';
const KEY_SHOW_RECOMMENDED_SHORTCUTS = 'show_recommended_shortcuts';

// 종목 목록 정렬/필터 설정 키
const KEY_PORTFOLIO_SORT_OPTION = 'portfolio_sort_option';
const KEY_PORTFOLIO_FILTER_OPTION = 'portfolio_filter_option';

/** 기업 실적 비교 — 종목 열 순서(mockKey 배열 JSON) */
const KEY_FUNDAMENTALS_COMPARE_COLUMN_ORDER = 'fundamentals_compare_column_order';

/** 기업 실적 비교 — 체크한 종목 + 직전 포트폴리오 스냅샷(신규 종목 자동 체크용) */
const KEY_FUNDAMENTALS_COMPARE_SELECTION_V1 = 'fundamentals_compare_selection_v1';

export type FundamentalsCompareSelectionPersisted = {
  selectedMockKeys: string[];
  /** 직전 저장 시점 포트폴리오에 있던 mockKey(정렬·중복 제거) */
  portfolioSnapshotMockKeys: string[];
};

// 알림 설정 키
const KEY_ENABLE_NEWS_NOTIFICATIONS = 'enable_news_notifications';
const KEY_ENABLE_STOCK_NOTIFICATIONS = 'enable_stock_notifications';

// 기본값
const DEFAULT_KRW_TAX_RATE = 0.15;
const DEFAULT_KRW_FEE_RATE = 0.015;
const DEFAULT_USD_TAX_RATE = 0.15;
const DEFAULT_USD_FEE_RATE = 0.015;

// 메인화면 표시 설정 기본값 (모두 true)
const DEFAULT_SHOW_MARKET_INDICATORS = true;
const DEFAULT_SHOW_MINI_BANNERS = true;
const DEFAULT_SHOW_PORTFOLIO = true;
const DEFAULT_SHOW_RELATED_NEWS = true;
const DEFAULT_SHOW_LATEST_NEWS = true;
const DEFAULT_SHOW_WORLD_TIME = true;
const DEFAULT_SHOW_INTEREST_RATES = true;
const DEFAULT_SHOW_ISSUE_KEYWORDS = true;
const DEFAULT_SHOW_DAILY_SETTLEMENT = true;
const DEFAULT_SHOW_MY_SHORTCUTS = true;
const DEFAULT_SHOW_RECOMMENDED_SHORTCUTS = true;

// 종목 목록 정렬/필터 기본값
const DEFAULT_PORTFOLIO_SORT_OPTION = 'name'; // 이름순
const DEFAULT_PORTFOLIO_FILTER_OPTION = 'all'; // 전체

// 알림 설정 기본값 (기본적으로 모두 활성화)
const DEFAULT_ENABLE_NEWS_NOTIFICATIONS = true;
const DEFAULT_ENABLE_STOCK_NOTIFICATIONS = true;

export class SettingsService {
  /// 원화 거래세율 가져오기
  static async getKrwTaxRate(): Promise<number> {
    try {
      const value = await AsyncStorage.getItem(KEY_KRW_TAX_RATE);
      return value ? parseFloat(value) : DEFAULT_KRW_TAX_RATE;
    } catch (e) {
      return DEFAULT_KRW_TAX_RATE;
    }
  }

  /// 원화 거래세율 저장하기
  static async setKrwTaxRate(value: number): Promise<void> {
    await AsyncStorage.setItem(KEY_KRW_TAX_RATE, value.toString());
  }

  /// 원화 수수료율 가져오기
  static async getKrwFeeRate(): Promise<number> {
    try {
      const value = await AsyncStorage.getItem(KEY_KRW_FEE_RATE);
      return value ? parseFloat(value) : DEFAULT_KRW_FEE_RATE;
    } catch (e) {
      return DEFAULT_KRW_FEE_RATE;
    }
  }

  /// 원화 수수료율 저장하기
  static async setKrwFeeRate(value: number): Promise<void> {
    await AsyncStorage.setItem(KEY_KRW_FEE_RATE, value.toString());
  }

  /// 달러 거래세율 가져오기
  static async getUsdTaxRate(): Promise<number> {
    try {
      const value = await AsyncStorage.getItem(KEY_USD_TAX_RATE);
      return value ? parseFloat(value) : DEFAULT_USD_TAX_RATE;
    } catch (e) {
      return DEFAULT_USD_TAX_RATE;
    }
  }

  /// 달러 거래세율 저장하기
  static async setUsdTaxRate(value: number): Promise<void> {
    await AsyncStorage.setItem(KEY_USD_TAX_RATE, value.toString());
  }

  /// 달러 수수료율 가져오기
  static async getUsdFeeRate(): Promise<number> {
    try {
      const value = await AsyncStorage.getItem(KEY_USD_FEE_RATE);
      return value ? parseFloat(value) : DEFAULT_USD_FEE_RATE;
    } catch (e) {
      return DEFAULT_USD_FEE_RATE;
    }
  }

  /// 달러 수수료율 저장하기
  static async setUsdFeeRate(value: number): Promise<void> {
    await AsyncStorage.setItem(KEY_USD_FEE_RATE, value.toString());
  }

  /// 통화별 거래세율 가져오기
  static async getTaxRate(currency: Currency): Promise<number> {
    return currency === Currency.USD
        ? await this.getUsdTaxRate()
        : await this.getKrwTaxRate();
  }

  /// 통화별 수수료율 가져오기
  static async getFeeRate(currency: Currency): Promise<number> {
    return currency === Currency.USD
        ? await this.getUsdFeeRate()
        : await this.getKrwFeeRate();
  }

  // ===== 메인화면 표시 설정 =====

  /// 주요지표 영역 표시 여부 가져오기
  static async getShowMarketIndicators(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(KEY_SHOW_MARKET_INDICATORS);
      return value !== null ? value === 'true' : DEFAULT_SHOW_MARKET_INDICATORS;
    } catch (e) {
      return DEFAULT_SHOW_MARKET_INDICATORS;
    }
  }

  /// 주요지표 영역 표시 여부 저장하기
  static async setShowMarketIndicators(value: boolean): Promise<void> {
    await AsyncStorage.setItem(KEY_SHOW_MARKET_INDICATORS, value.toString());
  }

  /// 앱 기본 메뉴(상단 3×3 아이콘) 표시 여부 가져오기
  static async getShowMiniBanners(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(KEY_SHOW_MINI_BANNERS);
      return value !== null ? value === 'true' : DEFAULT_SHOW_MINI_BANNERS;
    } catch (e) {
      return DEFAULT_SHOW_MINI_BANNERS;
    }
  }

  /// 앱 기본 메뉴(상단 3×3 아이콘) 표시 여부 저장하기
  static async setShowMiniBanners(value: boolean): Promise<void> {
    await AsyncStorage.setItem(KEY_SHOW_MINI_BANNERS, value.toString());
  }

  /// 포트폴리오 영역 표시 여부 가져오기
  static async getShowPortfolio(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(KEY_SHOW_PORTFOLIO);
      return value !== null ? value === 'true' : DEFAULT_SHOW_PORTFOLIO;
    } catch (e) {
      return DEFAULT_SHOW_PORTFOLIO;
    }
  }

  /// 포트폴리오 영역 표시 여부 저장하기
  static async setShowPortfolio(value: boolean): Promise<void> {
    await AsyncStorage.setItem(KEY_SHOW_PORTFOLIO, value.toString());
  }

  /// 관련뉴스 영역 표시 여부 가져오기
  static async getShowRelatedNews(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(KEY_SHOW_RELATED_NEWS);
      return value !== null ? value === 'true' : DEFAULT_SHOW_RELATED_NEWS;
    } catch (e) {
      return DEFAULT_SHOW_RELATED_NEWS;
    }
  }

  /// 관련뉴스 영역 표시 여부 저장하기
  static async setShowRelatedNews(value: boolean): Promise<void> {
    await AsyncStorage.setItem(KEY_SHOW_RELATED_NEWS, value.toString());
  }

  /// 최신뉴스 영역 표시 여부 가져오기
  static async getShowLatestNews(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(KEY_SHOW_LATEST_NEWS);
      return value !== null ? value === 'true' : DEFAULT_SHOW_LATEST_NEWS;
    } catch (e) {
      return DEFAULT_SHOW_LATEST_NEWS;
    }
  }

  /// 최신뉴스 영역 표시 여부 저장하기
  static async setShowLatestNews(value: boolean): Promise<void> {
    await AsyncStorage.setItem(KEY_SHOW_LATEST_NEWS, value.toString());
  }

  // ===== 종목 목록 정렬/필터 설정 =====

  /// 종목 목록 정렬 옵션 가져오기 ('ticker' | 'name' | 'created')
  static async getPortfolioSortOption(): Promise<'ticker' | 'name' | 'created'> {
    try {
      const value = await AsyncStorage.getItem(KEY_PORTFOLIO_SORT_OPTION);
      if (value === 'ticker' || value === 'name' || value === 'created') {
        return value;
      }
      return DEFAULT_PORTFOLIO_SORT_OPTION;
    } catch (e) {
      return DEFAULT_PORTFOLIO_SORT_OPTION;
    }
  }

  /// 종목 목록 정렬 옵션 저장하기
  static async setPortfolioSortOption(value: 'ticker' | 'name' | 'created'): Promise<void> {
    await AsyncStorage.setItem(KEY_PORTFOLIO_SORT_OPTION, value);
  }

  /// 종목 목록 필터 옵션 가져오기 ('all' | 'krw' | 'usd')
  static async getPortfolioFilterOption(): Promise<'all' | 'krw' | 'usd'> {
    try {
      const value = await AsyncStorage.getItem(KEY_PORTFOLIO_FILTER_OPTION);
      if (value === 'all' || value === 'krw' || value === 'usd') {
        return value;
      }
      return DEFAULT_PORTFOLIO_FILTER_OPTION;
    } catch (e) {
      return DEFAULT_PORTFOLIO_FILTER_OPTION;
    }
  }

  /// 종목 목록 필터 옵션 저장하기
  static async setPortfolioFilterOption(value: 'all' | 'krw' | 'usd'): Promise<void> {
    await AsyncStorage.setItem(KEY_PORTFOLIO_FILTER_OPTION, value);
  }

  /// 기업 실적 비교 종목 열 순서 (저장 없으면 null)
  static async getFundamentalsCompareColumnOrder(): Promise<string[] | null> {
    try {
      const raw = await AsyncStorage.getItem(KEY_FUNDAMENTALS_COMPARE_COLUMN_ORDER);
      if (raw == null || raw === '') return null;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return null;
      const keys = parsed.filter((x): x is string => typeof x === 'string');
      return keys.length > 0 ? keys : null;
    } catch {
      return null;
    }
  }

  static async setFundamentalsCompareColumnOrder(keys: string[]): Promise<void> {
    await AsyncStorage.setItem(KEY_FUNDAMENTALS_COMPARE_COLUMN_ORDER, JSON.stringify(keys));
  }

  static async clearFundamentalsCompareColumnOrder(): Promise<void> {
    await AsyncStorage.removeItem(KEY_FUNDAMENTALS_COMPARE_COLUMN_ORDER);
  }

  /// 기업 실적 비교 — 체크 상태·포트폴리오 스냅샷 (없으면 null)
  static async getFundamentalsCompareSelectionPersisted(): Promise<FundamentalsCompareSelectionPersisted | null> {
    try {
      const raw = await AsyncStorage.getItem(KEY_FUNDAMENTALS_COMPARE_SELECTION_V1);
      if (raw == null || raw === '') return null;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return null;
      const o = parsed as Record<string, unknown>;
      const sel = o.selectedMockKeys;
      const snap = o.portfolioSnapshotMockKeys;
      if (!Array.isArray(sel) || !Array.isArray(snap)) return null;
      const selectedMockKeys = sel.filter((x): x is string => typeof x === 'string');
      const portfolioSnapshotMockKeys = snap.filter((x): x is string => typeof x === 'string');
      return { selectedMockKeys, portfolioSnapshotMockKeys };
    } catch {
      return null;
    }
  }

  /**
   * @param selectedMockKeys 현재 체크된 mockKey (표시 순서 `deduped` 기준 필터해도 됨)
   * @param orderedPortfolioMockKeys 현재 `deduped`의 mockKey 순서(스냅샷은 정렬해 저장)
   */
  static async setFundamentalsCompareSelectionPersisted(
    selectedMockKeys: string[],
    orderedPortfolioMockKeys: string[]
  ): Promise<void> {
    const snap = [...new Set(orderedPortfolioMockKeys)].sort();
    const body: FundamentalsCompareSelectionPersisted = {
      selectedMockKeys: [...new Set(selectedMockKeys)].filter((k) => snap.includes(k)),
      portfolioSnapshotMockKeys: snap,
    };
    await AsyncStorage.setItem(KEY_FUNDAMENTALS_COMPARE_SELECTION_V1, JSON.stringify(body));
  }

  // ===== 세계시간 및 기준금리 표시 설정 =====

  /// 세계시간 표시 여부 가져오기
  static async getShowWorldTime(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(KEY_SHOW_WORLD_TIME);
      return value !== null ? value === 'true' : DEFAULT_SHOW_WORLD_TIME;
    } catch (e) {
      return DEFAULT_SHOW_WORLD_TIME;
    }
  }

  /// 세계시간 표시 여부 저장하기
  static async setShowWorldTime(value: boolean): Promise<void> {
    await AsyncStorage.setItem(KEY_SHOW_WORLD_TIME, value ? 'true' : 'false');
  }

  /// 기준금리 표시 여부 가져오기
  static async getShowInterestRates(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(KEY_SHOW_INTEREST_RATES);
      return value !== null ? value === 'true' : DEFAULT_SHOW_INTEREST_RATES;
    } catch (e) {
      return DEFAULT_SHOW_INTEREST_RATES;
    }
  }

  /// 기준금리 표시 여부 저장하기
  static async setShowInterestRates(value: boolean): Promise<void> {
    await AsyncStorage.setItem(KEY_SHOW_INTEREST_RATES, value ? 'true' : 'false');
  }

  /// 실시간 이슈(키워드 칩) 영역 표시 여부 가져오기
  static async getShowIssueKeywords(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(KEY_SHOW_ISSUE_KEYWORDS);
      return value !== null ? value === 'true' : DEFAULT_SHOW_ISSUE_KEYWORDS;
    } catch (e) {
      return DEFAULT_SHOW_ISSUE_KEYWORDS;
    }
  }

  /// 실시간 이슈(키워드 칩) 영역 표시 여부 저장하기
  static async setShowIssueKeywords(value: boolean): Promise<void> {
    await AsyncStorage.setItem(KEY_SHOW_ISSUE_KEYWORDS, value ? 'true' : 'false');
  }

  /// 메인 화면 일일 정산 카드 표시 여부 가져오기
  static async getShowDailySettlement(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(KEY_SHOW_DAILY_SETTLEMENT);
      return value !== null ? value === 'true' : DEFAULT_SHOW_DAILY_SETTLEMENT;
    } catch (e) {
      return DEFAULT_SHOW_DAILY_SETTLEMENT;
    }
  }

  /// 메인 화면 일일 정산 카드 표시 여부 저장하기
  static async setShowDailySettlement(value: boolean): Promise<void> {
    await AsyncStorage.setItem(KEY_SHOW_DAILY_SETTLEMENT, value ? 'true' : 'false');
  }

  /// 나만의 바로가기 영역 표시 여부 가져오기
  static async getShowMyShortcuts(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(KEY_SHOW_MY_SHORTCUTS);
      return value !== null ? value === 'true' : DEFAULT_SHOW_MY_SHORTCUTS;
    } catch (e) {
      return DEFAULT_SHOW_MY_SHORTCUTS;
    }
  }

  /// 나만의 바로가기 영역 표시 여부 저장하기
  static async setShowMyShortcuts(value: boolean): Promise<void> {
    await AsyncStorage.setItem(KEY_SHOW_MY_SHORTCUTS, value ? 'true' : 'false');
  }

  /// 추천 바로가기(관리자 Firestore) 영역 표시 여부 가져오기
  static async getShowRecommendedShortcuts(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(KEY_SHOW_RECOMMENDED_SHORTCUTS);
      return value !== null ? value === 'true' : DEFAULT_SHOW_RECOMMENDED_SHORTCUTS;
    } catch (e) {
      return DEFAULT_SHOW_RECOMMENDED_SHORTCUTS;
    }
  }

  /// 추천 바로가기 영역 표시 여부 저장하기
  static async setShowRecommendedShortcuts(value: boolean): Promise<void> {
    await AsyncStorage.setItem(KEY_SHOW_RECOMMENDED_SHORTCUTS, value ? 'true' : 'false');
  }

  // ===== 알림 설정 =====

  /// 뉴스 알림 활성화 여부 가져오기
  static async getEnableNewsNotifications(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(KEY_ENABLE_NEWS_NOTIFICATIONS);
      return value !== null ? value === 'true' : DEFAULT_ENABLE_NEWS_NOTIFICATIONS;
    } catch (e) {
      return DEFAULT_ENABLE_NEWS_NOTIFICATIONS;
    }
  }

  /// 뉴스 알림 활성화 여부 저장하기
  static async setEnableNewsNotifications(value: boolean): Promise<void> {
    await AsyncStorage.setItem(KEY_ENABLE_NEWS_NOTIFICATIONS, value ? 'true' : 'false');
  }

  /// 종목 알림 활성화 여부 가져오기
  static async getEnableStockNotifications(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(KEY_ENABLE_STOCK_NOTIFICATIONS);
      return value !== null ? value === 'true' : DEFAULT_ENABLE_STOCK_NOTIFICATIONS;
    } catch (e) {
      return DEFAULT_ENABLE_STOCK_NOTIFICATIONS;
    }
  }

  /// 종목 알림 활성화 여부 저장하기
  static async setEnableStockNotifications(value: boolean): Promise<void> {
    await AsyncStorage.setItem(KEY_ENABLE_STOCK_NOTIFICATIONS, value ? 'true' : 'false');
  }
}



