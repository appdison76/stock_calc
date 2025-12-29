import AsyncStorage from '@react-native-async-storage/async-storage';
import { Currency } from '../models/Currency';

const KEY_KRW_TAX_RATE = 'krw_tax_rate';
const KEY_KRW_FEE_RATE = 'krw_fee_rate';
const KEY_USD_TAX_RATE = 'usd_tax_rate';
const KEY_USD_FEE_RATE = 'usd_fee_rate';

// 기본값
const DEFAULT_KRW_TAX_RATE = 0.15;
const DEFAULT_KRW_FEE_RATE = 0.015;
const DEFAULT_USD_TAX_RATE = 0.15;
const DEFAULT_USD_FEE_RATE = 0.015;

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
}



