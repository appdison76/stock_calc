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

  /// 미니배너 영역 표시 여부 가져오기
  static async getShowMiniBanners(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(KEY_SHOW_MINI_BANNERS);
      return value !== null ? value === 'true' : DEFAULT_SHOW_MINI_BANNERS;
    } catch (e) {
      return DEFAULT_SHOW_MINI_BANNERS;
    }
  }

  /// 미니배너 영역 표시 여부 저장하기
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
}



