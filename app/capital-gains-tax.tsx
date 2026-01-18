import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Animated,
  Vibration,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
// DateTimePicker는 네이티브 모듈이므로 간단한 날짜 선택 UI로 대체
import { Currency } from '../src/models/Currency';
import { ExchangeRateService } from '../src/services/ExchangeRateService';
import { CurrencySwitch } from '../src/components/CurrencySwitch';
import { CalculationResultCard } from '../src/components/CalculationResultCard';
import { SharedResultSection } from '../src/components/SharedResultSection';
import { CoupangDynamicBanner } from '../src/components/CoupangDynamicBanner';
import { formatCurrency, formatNumber, getKrwEquivalent, addCommas } from '../src/utils/formatUtils';
import { Share } from 'react-native';

type TaxCountry = 'KR' | 'US';

interface CapitalGainsTaxCalculation {
  country: TaxCountry;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  buyDate: string; // YYYY-MM-DD
  sellDate: string; // YYYY-MM-DD
  holdingPeriod: number; // 일수
  isLongTerm: boolean; // 장기 보유 여부 (미국)
  grossProfit: number; // 총 양도차익
  taxExemptAmount: number; // 비과세 금액
  taxableAmount: number; // 과세 대상 금액
  taxRate: number; // 세율 (%)
  taxAmount: number; // 세액
  netProfit: number; // 순수익 (세금 제외)
  currency: Currency;
  exchangeRate?: number;
}

export default function CapitalGainsTaxCalculatorView() {
  const [selectedCountry, setSelectedCountry] = useState<TaxCountry>('KR');
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(Currency.KRW);
  
  // 통화별 입력값 분리
  const [krwBuyPrice, setKrwBuyPrice] = useState('');
  const [krwSellPrice, setKrwSellPrice] = useState('');
  const [krwQuantity, setKrwQuantity] = useState('');
  
  const [usdBuyPrice, setUsdBuyPrice] = useState('');
  const [usdSellPrice, setUsdSellPrice] = useState('');
  const [usdQuantity, setUsdQuantity] = useState('');
  const [usdExchangeRate, setUsdExchangeRate] = useState('1350');
  
  const [buyDate, setBuyDate] = useState('');
  const [sellDate, setSellDate] = useState('');
  const [showBuyCalendar, setShowBuyCalendar] = useState(false);
  const [showSellCalendar, setShowSellCalendar] = useState(false);
  const [buyCalendarYear, setBuyCalendarYear] = useState(new Date().getFullYear());
  const [buyCalendarMonth, setBuyCalendarMonth] = useState(new Date().getMonth());
  const [sellCalendarYear, setSellCalendarYear] = useState(new Date().getFullYear());
  const [sellCalendarMonth, setSellCalendarMonth] = useState(new Date().getMonth());
  
  // 한국 특화 입력
  const [krwIsMajorShareholder, setKrwIsMajorShareholder] = useState(false);
  
  // 미국 특화 입력
  const [usdAnnualIncome, setUsdAnnualIncome] = useState(''); // 연소득 (USD)
  
  const [calculation, setCalculation] = useState<CapitalGainsTaxCalculation | null>(null);
  const [isLoadingExchangeRate, setIsLoadingExchangeRate] = useState(false);
  const [isExchangeRateLoaded, setIsExchangeRateLoaded] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const resultContainerY = useRef<number>(0);
  
  // 현재 선택된 통화의 입력값 getter
  const buyPrice = selectedCurrency === Currency.KRW ? krwBuyPrice : usdBuyPrice;
  const sellPrice = selectedCurrency === Currency.KRW ? krwSellPrice : usdSellPrice;
  const quantity = selectedCurrency === Currency.KRW ? krwQuantity : usdQuantity;
  const exchangeRate = selectedCurrency === Currency.USD ? usdExchangeRate : '1350';
  
  const setBuyPrice = selectedCurrency === Currency.KRW ? setKrwBuyPrice : setUsdBuyPrice;
  const setSellPrice = selectedCurrency === Currency.KRW ? setKrwSellPrice : setUsdSellPrice;
  const setQuantity = selectedCurrency === Currency.KRW ? setKrwQuantity : setUsdQuantity;
  const setExchangeRate = setUsdExchangeRate;

  useEffect(() => {
    if (selectedCurrency === Currency.USD) {
      loadExchangeRate();
    }
  }, [selectedCurrency]);

  // 국가 선택에 따라 통화 자동 설정
  useEffect(() => {
    if (selectedCountry === 'KR') {
      setSelectedCurrency(Currency.KRW);
    } else {
      setSelectedCurrency(Currency.USD);
    }
  }, [selectedCountry]);

  const loadExchangeRate = async () => {
    setIsLoadingExchangeRate(true);
    try {
      const rate = await ExchangeRateService.getUsdToKrwRate();
      setUsdExchangeRate(rate.toFixed(2));
      setIsLoadingExchangeRate(false);
      setIsExchangeRateLoaded(true);
    } catch (e) {
      setIsLoadingExchangeRate(false);
      setIsExchangeRateLoaded(false);
    }
  };

  // 콤마 제거 함수
  const removeCommas = (value: string): string => {
    return value.replace(/,/g, '');
  };

  // 가격 입력 핸들러 (천단위 콤마 자동 추가)
  const handlePriceInputChange = (text: string, setter: (value: string) => void, currency: Currency) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const formatted = parts.length > 2 
      ? parts[0] + '.' + parts.slice(1).join('')
      : cleaned;
    
    if (formatted === '' || formatted === '.') {
      setter(formatted);
      return;
    }

    if (currency === Currency.USD) {
      setter(addCommas(formatted));
    } else {
      const integerOnly = formatted.split('.')[0];
      if (integerOnly === '') {
        setter('');
      } else {
        setter(addCommas(integerOnly));
      }
    }
  };

  // 수량 입력 핸들러 (천단위 콤마 자동 추가)
  const handleQuantityInputChange = (text: string, setter: (value: string) => void) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned === '') {
      setter('');
    } else {
      setter(addCommas(cleaned));
    }
  };

  // 환율 입력 핸들러 (천단위 콤마 자동 추가)
  const handleExchangeRateInputChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned === '') {
      setUsdExchangeRate('');
    } else {
      setUsdExchangeRate(addCommas(cleaned));
    }
  };

  // 날짜 계산 함수
  const calculateDaysBetween = (date1: string, date2: string): number => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // 한국 양도소득세 계산
  const calculateKRTax = (
    buyPrice: number,
    sellPrice: number,
    quantity: number,
    isMajorShareholder: boolean,
    exchangeRate?: number
  ): CapitalGainsTaxCalculation => {
    const grossProfit = (sellPrice - buyPrice) * quantity;
    const grossProfitKrw = exchangeRate ? grossProfit * exchangeRate : grossProfit;
    
    let taxExemptAmount = 0;
    let taxableAmount = 0;
    let taxRate = 0;
    let taxAmount = 0;
    
    // 일반 투자자는 양도소득세 면제 (대주주가 아닌 경우)
    if (!isMajorShareholder) {
      taxExemptAmount = grossProfitKrw;
      taxableAmount = 0;
      taxRate = 0;
      taxAmount = 0;
    } else {
      // 대주주인 경우: 연간 250만원 비과세, 초과분에 대해 22% (일반) 또는 11% (소액)
      taxExemptAmount = Math.min(grossProfitKrw, 2500000); // 250만원 비과세
      taxableAmount = Math.max(0, grossProfitKrw - 2500000);
      
      // 소액공제: 연간 양도소득 1억 2천만원 이하인 경우 11%, 초과 시 22%
      if (grossProfitKrw <= 120000000) {
        taxRate = 11; // 소액공제
      } else {
        taxRate = 22; // 일반
      }
      
      taxAmount = taxableAmount * (taxRate / 100);
    }
    
    const netProfit = grossProfitKrw - taxAmount;
    
    return {
      country: 'KR',
      buyPrice,
      sellPrice,
      quantity,
      buyDate: '',
      sellDate: '',
      holdingPeriod: 0,
      isLongTerm: false,
      grossProfit: grossProfitKrw,
      taxExemptAmount,
      taxableAmount,
      taxRate,
      taxAmount,
      netProfit,
      currency: Currency.KRW,
      exchangeRate,
    };
  };

  // 미국 양도소득세 계산
  const calculateUSTax = (
    buyPrice: number,
    sellPrice: number,
    quantity: number,
    buyDate: string,
    sellDate: string,
    annualIncome: number, // USD
    exchangeRate: number
  ): CapitalGainsTaxCalculation => {
    const grossProfit = (sellPrice - buyPrice) * quantity; // USD
    const grossProfitKrw = grossProfit * exchangeRate;
    
    const holdingPeriod = calculateDaysBetween(buyDate, sellDate);
    const isLongTerm = holdingPeriod >= 365; // 1년 이상이면 장기
    
    // 한국 거주자의 미국 주식 양도소득세
    // 연간 양도차익 250만원 초과 시 22% 부과
    const taxExemptAmount = Math.min(grossProfitKrw, 2500000); // 250만원 비과세
    const taxableAmount = Math.max(0, grossProfitKrw - 2500000);
    
    let taxRate = 0;
    if (taxableAmount > 0) {
      taxRate = 22; // 한국 거주자 기준 22%
    }
    
    const taxAmount = taxableAmount * (taxRate / 100);
    const netProfit = grossProfitKrw - taxAmount;
    
    return {
      country: 'US',
      buyPrice,
      sellPrice,
      quantity,
      buyDate,
      sellDate,
      holdingPeriod,
      isLongTerm,
      grossProfit: grossProfitKrw,
      taxExemptAmount,
      taxableAmount,
      taxRate,
      taxAmount,
      netProfit,
      currency: Currency.USD,
      exchangeRate,
    };
  };

  const reset = () => {
    if (selectedCurrency === Currency.KRW) {
      setKrwBuyPrice('');
      setKrwSellPrice('');
      setKrwQuantity('');
    } else {
      setUsdBuyPrice('');
      setUsdSellPrice('');
      setUsdQuantity('');
    }
    setBuyDate('');
    setSellDate('');
    setShowBuyCalendar(false);
    setShowSellCalendar(false);
    setBuyCalendarYear(new Date().getFullYear());
    setBuyCalendarMonth(new Date().getMonth());
    setSellCalendarYear(new Date().getFullYear());
    setSellCalendarMonth(new Date().getMonth());
    setKrwIsMajorShareholder(false);
    setUsdAnnualIncome('');
    setCalculation(null);
  };

  // 날짜를 YYYY-MM-DD 형식으로 변환
  const formatDate = (year: number, month: number, day: number): string => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  // 달력에서 날짜 선택
  const handleDateSelect = (day: number, isBuyDate: boolean) => {
    if (isBuyDate) {
      const dateStr = formatDate(buyCalendarYear, buyCalendarMonth, day);
      setBuyDate(dateStr);
      setShowBuyCalendar(false);
    } else {
      const dateStr = formatDate(sellCalendarYear, sellCalendarMonth, day);
      setSellDate(dateStr);
      setShowSellCalendar(false);
    }
  };

  // 달력 월 변경
  const changeMonth = (delta: number, isBuyDate: boolean) => {
    if (isBuyDate) {
      const newDate = new Date(buyCalendarYear, buyCalendarMonth + delta, 1);
      setBuyCalendarYear(newDate.getFullYear());
      setBuyCalendarMonth(newDate.getMonth());
    } else {
      const newDate = new Date(sellCalendarYear, sellCalendarMonth + delta, 1);
      setSellCalendarYear(newDate.getFullYear());
      setSellCalendarMonth(newDate.getMonth());
    }
  };

  // 달력 렌더링
  const renderCalendar = (isBuyDate: boolean) => {
    const year = isBuyDate ? buyCalendarYear : sellCalendarYear;
    const month = isBuyDate ? buyCalendarMonth : sellCalendarMonth;
    const selectedDate = isBuyDate ? buyDate : sellDate;
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const isToday = (day: number) => {
      return year === today.getFullYear() &&
             month === today.getMonth() &&
             day === today.getDate();
    };
    const isSelected = (day: number) => {
      const dateStr = formatDate(year, month, day);
      return selectedDate === dateStr;
    };
    const isPast = (day: number) => {
      const date = new Date(year, month, day);
      return date > today;
    };

    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    const days = [];

    // 빈 칸 채우기 (첫 주)
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // 날짜 채우기
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    const canGoNext = !(year === today.getFullYear() && month === today.getMonth());

    return (
      <View style={styles.calendarContainer}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity
            style={styles.calendarNavButton}
            onPress={() => changeMonth(-1, isBuyDate)}
            activeOpacity={0.7}
          >
            <Text style={styles.calendarNavText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.calendarTitle}>
            {year}년 {month + 1}월
          </Text>
          <TouchableOpacity
            style={styles.calendarNavButton}
            onPress={() => changeMonth(1, isBuyDate)}
            activeOpacity={0.7}
            disabled={!canGoNext}
          >
            <Text style={[styles.calendarNavText, !canGoNext && styles.calendarNavDisabled]}>›</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.calendarWeekDays}>
          {weekDays.map((day, index) => (
            <View key={index} style={styles.calendarWeekDay}>
              <Text style={[styles.calendarWeekDayText, index === 0 && styles.calendarSunday, index === 6 && styles.calendarSaturday]}>
                {day}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.calendarDays}>
          {days.map((day, index) => {
            if (day === null) {
              return <View key={index} style={styles.calendarDay} />;
            }
            const past = isPast(day);
            const selected = isSelected(day);
            const today = isToday(day);
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.calendarDay,
                  selected && styles.calendarDaySelected,
                  today && !selected && styles.calendarDayToday,
                  past && styles.calendarDayPast,
                ]}
                onPress={() => !past && handleDateSelect(day, isBuyDate)}
                disabled={past}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.calendarDayText,
                  selected && styles.calendarDayTextSelected,
                  past && styles.calendarDayTextPast,
                  today && !selected && styles.calendarDayTextToday,
                ]}>
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const calculate = async () => {
    // 1. 키보드 닫기
    Keyboard.dismiss();
    
    // 2. 진동 피드백
    try {
      if (Platform.OS === 'ios') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Vibration.vibrate(50);
      }
    } catch (e) {
      console.log('Haptic feedback not available');
    }

    if (!buyPrice || !sellPrice || !quantity) {
      Alert.alert('입력 오류', '모든 필드를 입력해주세요.');
      return;
    }

    if (selectedCountry === 'US' && (!buyDate || !sellDate)) {
      Alert.alert('입력 오류', '매수일과 매도일을 선택해주세요.');
      return;
    }

    const buyPriceNum = parseFloat(removeCommas(buyPrice));
    const sellPriceNum = parseFloat(removeCommas(sellPrice));
    const quantityNum = parseInt(removeCommas(quantity), 10);
    const exchangeRateNum = selectedCurrency === Currency.USD ? parseFloat(removeCommas(usdExchangeRate)) : undefined;

    if (isNaN(buyPriceNum) || buyPriceNum <= 0) {
      Alert.alert('입력 오류', '올바른 매수가를 입력하세요.');
      return;
    }

    if (isNaN(sellPriceNum) || sellPriceNum <= 0) {
      Alert.alert('입력 오류', '올바른 매도가를 입력하세요.');
      return;
    }

    if (isNaN(quantityNum) || quantityNum <= 0) {
      Alert.alert('입력 오류', '올바른 수량을 입력하세요.');
      return;
    }

    if (selectedCurrency === Currency.USD) {
      if (!exchangeRateNum || isNaN(exchangeRateNum) || exchangeRateNum <= 0) {
        Alert.alert('입력 오류', '올바른 환율을 입력하세요.');
        return;
      }
    }

    if (selectedCountry === 'US') {
      const buyDateObj = new Date(buyDate);
      const sellDateObj = new Date(sellDate);
      
      if (isNaN(buyDateObj.getTime()) || isNaN(sellDateObj.getTime())) {
        Alert.alert('입력 오류', '올바른 날짜를 입력하세요.');
        return;
      }
      
      if (sellDateObj < buyDateObj) {
        Alert.alert('입력 오류', '매도일은 매수일 이후여야 합니다.');
        return;
      }
    }

    // 3. 로딩 상태 시작
    setIsCalculating(true);
    resultOpacity.setValue(0);

    // 계산 처리 (0.5초 지연)
    await new Promise(resolve => setTimeout(resolve, 500));

    let newCalculation: CapitalGainsTaxCalculation;

    if (selectedCountry === 'KR') {
      newCalculation = calculateKRTax(
        buyPriceNum,
        sellPriceNum,
        quantityNum,
        krwIsMajorShareholder,
        exchangeRateNum
      );
    } else {
      const annualIncomeNum = usdAnnualIncome ? parseFloat(removeCommas(usdAnnualIncome)) : 0;
      newCalculation = calculateUSTax(
        buyPriceNum,
        sellPriceNum,
        quantityNum,
        buyDate,
        sellDate,
        annualIncomeNum,
        exchangeRateNum || 1350
      );
    }

    setCalculation(newCalculation);
    setIsCalculating(false);

    // 4. 결과 애니메이션
    Animated.timing(resultOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // 5. 화면 자동 스크롤
    setTimeout(() => {
      if (resultContainerY.current >= 0) {
        scrollViewRef.current?.scrollTo({ y: resultContainerY.current - 50, animated: true });
      }
    }, 600);
  };

  const shareResultsAsText = async () => {
    if (!calculation) return;

    const buffer: string[] = [];
    buffer.push(`${calculation.country === 'KR' ? '한국' : '미국'} 양도소득세 계산 결과\n`);
    buffer.push(`매수가: ${formatNumber(calculation.buyPrice, calculation.currency)}`);
    buffer.push(`매도가: ${formatNumber(calculation.sellPrice, calculation.currency)}`);
    buffer.push(`수량: ${addCommas(calculation.quantity.toString())}주`);
    
    if (calculation.country === 'US') {
      buffer.push(`매수일: ${calculation.buyDate}`);
      buffer.push(`매도일: ${calculation.sellDate}`);
      buffer.push(`보유기간: ${calculation.holdingPeriod}일 (${calculation.isLongTerm ? '장기' : '단기'})`);
    }
    
    buffer.push('');
    buffer.push(`총 양도차익: ${formatCurrency(calculation.grossProfit, Currency.KRW)}`);
    buffer.push(`비과세 금액: ${formatCurrency(calculation.taxExemptAmount, Currency.KRW)}`);
    buffer.push(`과세 대상 금액: ${formatCurrency(calculation.taxableAmount, Currency.KRW)}`);
    buffer.push(`세율: ${calculation.taxRate}%`);
    buffer.push(`세액: ${formatCurrency(calculation.taxAmount, Currency.KRW)}`);
    buffer.push(`순수익: ${formatCurrency(calculation.netProfit, Currency.KRW)}`);
    
    if (calculation.exchangeRate) {
      buffer.push('');
      buffer.push(`(환율: ${addCommas(calculation.exchangeRate.toFixed(2))}원)`);
    }
    buffer.push('\n만든 사람: 네오비저닝');

    const text = buffer.join('\n');

    try {
      await Share.share({
        message: text,
        title: '양도소득세 계산 결과',
      });
    } catch (e) {
      console.error('텍스트 공유에 실패했습니다:', e);
      Alert.alert('공유 오류', '텍스트 공유에 실패했습니다.');
    }
  };



  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <LinearGradient
        colors={['#0D1B2A', '#1B263B', '#0F1419']}
        style={styles.gradient}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* 국가 선택 */}
          <View style={styles.countrySelectorContainer}>
            <Text style={styles.sectionTitle}>국가 선택</Text>
            <View style={styles.countrySelector}>
              <TouchableOpacity
                style={[
                  styles.countryButton,
                  selectedCountry === 'KR' && styles.countryButtonActive,
                ]}
                onPress={() => setSelectedCountry('KR')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.countryButtonText,
                    selectedCountry === 'KR' && styles.countryButtonTextActive,
                  ]}
                >
                  🇰🇷 한국
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.countryButton,
                  selectedCountry === 'US' && styles.countryButtonActive,
                ]}
                onPress={() => setSelectedCountry('US')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.countryButtonText,
                    selectedCountry === 'US' && styles.countryButtonTextActive,
                  ]}
                >
                  🇺🇸 미국
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {selectedCountry === 'US' && (
            <View style={styles.currencySwitchContainer}>
              <CurrencySwitch
                selectedCurrency={selectedCurrency}
                onChanged={(currency) => {
                  setSelectedCurrency(currency);
                  setCalculation(null);
                  if (currency === Currency.USD) {
                    loadExchangeRate();
                  }
                }}
              />
            </View>
          )}

          {selectedCountry === 'US' && selectedCurrency === Currency.USD && (
            <View style={styles.exchangeRateStatus}>
              {isLoadingExchangeRate ? (
                <>
                  <ActivityIndicator size="small" color="#42A5F5" />
                  <View style={{ width: 8 }} />
                  <Text style={styles.exchangeRateStatusText}>실시간 환율 적용 중...</Text>
                </>
              ) : isExchangeRateLoaded ? (
                <>
                  <Text style={styles.exchangeRateStatusIcon}>✓</Text>
                  <View style={{ width: 8 }} />
                  <Text style={[styles.exchangeRateStatusText, { color: '#66BB6A' }]}>
                    실시간 환율 적용됨
                  </Text>
                </>
              ) : null}
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>입력 정보</Text>

            {selectedCountry === 'US' && selectedCurrency === Currency.USD && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="환율 (USD → KRW)"
                  placeholderTextColor="#757575"
                  value={exchangeRate}
                  onChangeText={handleExchangeRateInputChange}
                  keyboardType="numeric"
                />
                <Text style={styles.helperText}>예: 1,350 (1달러 = 1350원)</Text>
              </>
            )}

            <TextInput
              style={styles.input}
              placeholder={
                selectedCurrency === Currency.USD
                  ? '매수가 (USD)'
                  : '매수가 (원)'
              }
              placeholderTextColor="#757575"
              value={buyPrice}
              onChangeText={(text) => handlePriceInputChange(text, setBuyPrice, selectedCurrency)}
              keyboardType="numeric"
            />

            <TextInput
              style={styles.input}
              placeholder={
                selectedCurrency === Currency.USD
                  ? '매도가 (USD)'
                  : '매도가 (원)'
              }
              placeholderTextColor="#757575"
              value={sellPrice}
              onChangeText={(text) => handlePriceInputChange(text, setSellPrice, selectedCurrency)}
              keyboardType="numeric"
            />

            <TextInput
              style={styles.input}
              placeholder="수량 (주)"
              placeholderTextColor="#757575"
              value={quantity}
              onChangeText={(text) => handleQuantityInputChange(text, setQuantity)}
              keyboardType="numeric"
            />

            {selectedCountry === 'US' && (
              <>
                <View style={styles.dateInputContainer}>
                  <Text style={styles.dateInputLabel}>매수일</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => {
                      Keyboard.dismiss();
                      if (buyDate) {
                        const parts = buyDate.split('-');
                        setBuyCalendarYear(parseInt(parts[0]));
                        setBuyCalendarMonth(parseInt(parts[1]) - 1);
                      }
                      setShowBuyCalendar(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dateButtonText, !buyDate && styles.dateButtonPlaceholder]}>
                      {buyDate || '날짜 선택'}
                    </Text>
                    <Text style={styles.dateButtonIcon}>📅</Text>
                  </TouchableOpacity>
                  {showBuyCalendar && (
                    <View style={styles.calendarWrapper}>
                      {renderCalendar(true)}
                      <TouchableOpacity
                        style={styles.calendarCloseButton}
                        onPress={() => setShowBuyCalendar(false)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.calendarCloseText}>닫기</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <View style={styles.dateInputContainer}>
                  <Text style={styles.dateInputLabel}>매도일</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => {
                      Keyboard.dismiss();
                      if (sellDate) {
                        const parts = sellDate.split('-');
                        setSellCalendarYear(parseInt(parts[0]));
                        setSellCalendarMonth(parseInt(parts[1]) - 1);
                      }
                      setShowSellCalendar(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dateButtonText, !sellDate && styles.dateButtonPlaceholder]}>
                      {sellDate || '날짜 선택'}
                    </Text>
                    <Text style={styles.dateButtonIcon}>📅</Text>
                  </TouchableOpacity>
                  {showSellCalendar && (
                    <View style={styles.calendarWrapper}>
                      {renderCalendar(false)}
                      <TouchableOpacity
                        style={styles.calendarCloseButton}
                        onPress={() => setShowSellCalendar(false)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.calendarCloseText}>닫기</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </>
            )}

            {selectedCountry === 'KR' && (
              <View style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => setKrwIsMajorShareholder(!krwIsMajorShareholder)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkboxBox, krwIsMajorShareholder && styles.checkboxBoxChecked]}>
                    {krwIsMajorShareholder && <Text style={styles.checkboxCheck}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>대주주 여부</Text>
                </TouchableOpacity>
                <Text style={styles.checkboxHelperText}>
                  일반 투자자는 양도소득세가 면제됩니다. 대주주인 경우에만 체크하세요.
                </Text>
              </View>
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.calculateButton, isCalculating && styles.calculateButtonDisabled]} 
                onPress={calculate}
                disabled={isCalculating}
              >
                {isCalculating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.calculateButtonText}>계산하기</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.resetButton} onPress={reset}>
                <Text style={styles.resetButtonText}>초기화</Text>
              </TouchableOpacity>
            </View>
          </View>

          {calculation && (
            <Animated.View 
              style={[styles.resultContainer, { opacity: resultOpacity, transform: [{ translateY: resultOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }) }] }]}
              onLayout={(event) => {
                const { y } = event.nativeEvent.layout;
                resultContainerY.current = y;
              }}
            >
              <SharedResultSection
                watermarkText="만든 사람: 네오비저닝"
                onTextShare={shareResultsAsText}
                actionButtons={[]}
              >
                <View style={styles.resultHeader}>
                  <Text style={styles.resultTitle}>
                    {calculation.country === 'KR' ? '한국' : '미국'} 양도소득세 계산 결과
                  </Text>
                </View>

                <View style={styles.resultGrid}>
                  <View style={styles.gridRow}>
                    <View style={styles.gridItem}>
                      <CalculationResultCard
                        title="매수가"
                        value={
                          formatNumber(calculation.buyPrice, calculation.currency) +
                          (calculation.exchangeRate
                            ? getKrwEquivalent(calculation.buyPrice, calculation.exchangeRate) || ''
                            : '')
                        }
                      />
                    </View>
                    <View style={{ width: 12 }} />
                    <View style={styles.gridItem}>
                      <CalculationResultCard
                        title="매도가"
                        value={
                          formatNumber(calculation.sellPrice, calculation.currency) +
                          (calculation.exchangeRate
                            ? getKrwEquivalent(calculation.sellPrice, calculation.exchangeRate) || ''
                            : '')
                        }
                      />
                    </View>
                  </View>
                  <View style={styles.gridRow}>
                    <View style={styles.gridItem}>
                      <CalculationResultCard
                        title="수량"
                        value={`${addCommas(calculation.quantity.toString())}주`}
                      />
                    </View>
                    <View style={{ width: 12 }} />
                    {calculation.country === 'US' && (
                      <View style={styles.gridItem}>
                        <CalculationResultCard
                          title="보유기간"
                          value={`${calculation.holdingPeriod}일`}
                          valueColor={calculation.isLongTerm ? '#4CAF50' : '#EF5350'}
                        />
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.resultCardsVertical}>
                  <CalculationResultCard
                    title="총 양도차익"
                    value={formatCurrency(calculation.grossProfit, Currency.KRW)}
                    valueColor={calculation.grossProfit >= 0 ? '#4CAF50' : '#EF5350'}
                  />
                  <View style={{ height: 12 }} />
                  <CalculationResultCard
                    title="비과세 금액"
                    value={formatCurrency(calculation.taxExemptAmount, Currency.KRW)}
                    valueColor="#42A5F5"
                  />
                  <View style={{ height: 12 }} />
                  <CalculationResultCard
                    title="과세 대상 금액"
                    value={formatCurrency(calculation.taxableAmount, Currency.KRW)}
                    valueColor={calculation.taxableAmount > 0 ? '#FFD700' : '#94A3B8'}
                  />
                  <View style={{ height: 12 }} />
                  <CalculationResultCard
                    title="세율"
                    value={`${calculation.taxRate}%`}
                    valueColor={calculation.taxRate > 0 ? '#EF5350' : '#4CAF50'}
                  />
                  <View style={{ height: 12 }} />
                  <CalculationResultCard
                    title="세액"
                    value={formatCurrency(calculation.taxAmount, Currency.KRW)}
                    valueColor={calculation.taxAmount > 0 ? '#EF5350' : '#4CAF50'}
                  />
                  <View style={{ height: 12 }} />
                  <CalculationResultCard
                    title="순수익 (세금 제외)"
                    value={formatCurrency(calculation.netProfit, Currency.KRW)}
                    valueColor={calculation.netProfit >= 0 ? '#4CAF50' : '#EF5350'}
                  />
                </View>
              </SharedResultSection>
              <CoupangDynamicBanner width={320} height={140} />
            </Animated.View>
          )}
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  countrySelectorContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  countrySelector: {
    flexDirection: 'row',
    gap: 12,
  },
  countryButton: {
    flex: 1,
    backgroundColor: 'rgba(27, 38, 59, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countryButtonActive: {
    backgroundColor: 'rgba(66, 165, 245, 0.2)',
    borderColor: '#42A5F5',
  },
  countryButtonText: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '600',
  },
  countryButtonTextActive: {
    color: '#FFFFFF',
  },
  currencySwitchContainer: {
    marginBottom: 16,
  },
  exchangeRateStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  exchangeRateStatusIcon: {
    fontSize: 16,
    color: '#66BB6A',
  },
  exchangeRateStatusText: {
    fontSize: 12,
    color: '#42A5F5',
  },
  card: {
    backgroundColor: 'rgba(13, 27, 42, 0.8)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.1)',
    padding: 16,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  input: {
    backgroundColor: 'rgba(27, 38, 59, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
    padding: 16,
    color: '#FFFFFF',
    fontSize: 17,
    marginBottom: 16,
  },
  helperText: {
    fontSize: 12,
    color: '#757575',
    marginTop: -12,
    marginBottom: 16,
    marginLeft: 4,
  },
  checkboxContainer: {
    marginBottom: 16,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkboxHelperText: {
    fontSize: 12,
    color: '#757575',
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 4,
    lineHeight: 18,
  },
  dateInputContainer: {
    marginBottom: 16,
  },
  dateInputLabel: {
    fontSize: 14,
    color: '#B0BEC5',
    marginBottom: 8,
    fontWeight: '500',
  },
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateInput: {
    backgroundColor: 'rgba(27, 38, 59, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
    padding: 16,
    color: '#FFFFFF',
    fontSize: 17,
    textAlign: 'center',
  },
  dateInputYear: {
    flex: 2,
  },
  dateInputMonthDay: {
    flex: 1,
  },
  dateInputSeparator: {
    fontSize: 20,
    color: '#94A3B8',
    fontWeight: 'bold',
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#42A5F5',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxBoxChecked: {
    backgroundColor: '#42A5F5',
  },
  checkboxCheck: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  calculateButton: {
    flex: 1,
    backgroundColor: '#42A5F5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calculateButtonDisabled: {
    opacity: 0.7,
  },
  calculateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resetButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.3)',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    color: '#B0BEC5',
    fontSize: 16,
  },
  resultContainer: {
    marginBottom: 24,
  },
  resultHeader: {
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  resultGrid: {
    marginBottom: 12,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  gridItem: {
    flex: 1,
  },
  resultCardsVertical: {
  },
  dateButton: {
    backgroundColor: 'rgba(27, 38, 59, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateButtonText: {
    fontSize: 17,
    color: '#FFFFFF',
    flex: 1,
  },
  dateButtonPlaceholder: {
    color: '#757575',
  },
  dateButtonIcon: {
    fontSize: 20,
    marginLeft: 12,
  },
  calendarWrapper: {
    backgroundColor: 'rgba(13, 27, 42, 0.95)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.3)',
    padding: 16,
    marginBottom: 16,
  },
  calendarContainer: {
    marginBottom: 12,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  calendarNavButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(66, 165, 245, 0.2)',
  },
  calendarNavText: {
    fontSize: 24,
    color: '#42A5F5',
    fontWeight: 'bold',
  },
  calendarNavDisabled: {
    color: '#757575',
    opacity: 0.5,
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  calendarWeekDays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  calendarWeekDayText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  calendarSunday: {
    color: '#EF5350',
  },
  calendarSaturday: {
    color: '#42A5F5',
  },
  calendarDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  calendarDayText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  calendarDaySelected: {
    backgroundColor: '#42A5F5',
    borderRadius: 20,
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  calendarDayToday: {
    backgroundColor: 'rgba(66, 165, 245, 0.2)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#42A5F5',
  },
  calendarDayTextToday: {
    color: '#42A5F5',
    fontWeight: 'bold',
  },
  calendarDayPast: {
    opacity: 0.3,
  },
  calendarDayTextPast: {
    color: '#757575',
  },
  calendarCloseButton: {
    backgroundColor: 'rgba(66, 165, 245, 0.2)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  calendarCloseText: {
    fontSize: 16,
    color: '#42A5F5',
    fontWeight: '600',
  },
});

