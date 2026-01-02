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
import { Currency } from '../src/models/Currency';
import { AveragingCalculation } from '../src/models/AveragingCalculation';
import { SettingsService } from '../src/services/SettingsService';
import { ExchangeRateService } from '../src/services/ExchangeRateService';
import { CurrencySwitch } from '../src/components/CurrencySwitch';
import { CalculationResultCard } from '../src/components/CalculationResultCard';
import { SharedResultSection } from '../src/components/SharedResultSection';
import { CoupangBannerSection, CoupangBannerSectionRef } from '../src/components/CoupangBannerSection';
import { formatCurrency, formatNumber, getKrwEquivalent, addCommas } from '../src/utils/formatUtils';
import { Share } from 'react-native';
import { useRouter } from 'expo-router';
import { initDatabase, saveCalculationAsScenario, getAllAccounts, createAccount, updateStockCurrentPrice } from '../src/services/DatabaseService';
import StockSearchModal from '../src/components/StockSearchModal';

export default function AveragingCalculatorView() {
  const router = useRouter();
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(Currency.KRW);
  
  // 통화별 입력값 분리
  const [krwCurrentAveragePrice, setKrwCurrentAveragePrice] = useState('');
  const [krwCurrentQuantity, setKrwCurrentQuantity] = useState('');
  const [krwAdditionalBuyPrice, setKrwAdditionalBuyPrice] = useState('');
  const [krwAdditionalQuantity, setKrwAdditionalQuantity] = useState('');
  
  const [usdCurrentAveragePrice, setUsdCurrentAveragePrice] = useState('');
  const [usdCurrentQuantity, setUsdCurrentQuantity] = useState('');
  const [usdAdditionalBuyPrice, setUsdAdditionalBuyPrice] = useState('');
  const [usdAdditionalQuantity, setUsdAdditionalQuantity] = useState('');
  const [usdExchangeRate, setUsdExchangeRate] = useState('1350');
  
  const [calculationHistory, setCalculationHistory] = useState<AveragingCalculation[]>([]);
  const [isLoadingExchangeRate, setIsLoadingExchangeRate] = useState(false);
  const [isExchangeRateLoaded, setIsExchangeRateLoaded] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSavingScenario, setIsSavingScenario] = useState(false);
  const [showTickerInput, setShowTickerInput] = useState(false);
  const [tickerInput, setTickerInput] = useState('');
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [selectedOfficialName, setSelectedOfficialName] = useState<string | null>(null);
  const [showStockNameInput, setShowStockNameInput] = useState(false);
  const [stockNameInput, setStockNameInput] = useState('');
  const coupangBannerRef = useRef<CoupangBannerSectionRef>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const lastResultContainerRef = useRef<View>(null);
  const resultContainerY = useRef<number>(0);
  
  // 현재 선택된 통화의 입력값 getter
  const currentAveragePrice = selectedCurrency === Currency.KRW ? krwCurrentAveragePrice : usdCurrentAveragePrice;
  const currentQuantity = selectedCurrency === Currency.KRW ? krwCurrentQuantity : usdCurrentQuantity;
  const additionalBuyPrice = selectedCurrency === Currency.KRW ? krwAdditionalBuyPrice : usdAdditionalBuyPrice;
  const additionalQuantity = selectedCurrency === Currency.KRW ? krwAdditionalQuantity : usdAdditionalQuantity;
  const exchangeRate = selectedCurrency === Currency.USD ? usdExchangeRate : '1350';
  
  const setCurrentAveragePrice = selectedCurrency === Currency.KRW ? setKrwCurrentAveragePrice : setUsdCurrentAveragePrice;
  const setCurrentQuantity = selectedCurrency === Currency.KRW ? setKrwCurrentQuantity : setUsdCurrentQuantity;
  const setAdditionalBuyPrice = selectedCurrency === Currency.KRW ? setKrwAdditionalBuyPrice : setUsdAdditionalBuyPrice;
  const setAdditionalQuantity = selectedCurrency === Currency.KRW ? setKrwAdditionalQuantity : setUsdAdditionalQuantity;
  const setExchangeRate = setUsdExchangeRate;

  useEffect(() => {
    if (selectedCurrency === Currency.USD) {
      loadExchangeRate();
    }
  }, [selectedCurrency]);

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

  const reset = () => {
    if (selectedCurrency === Currency.KRW) {
      setKrwCurrentAveragePrice('');
      setKrwCurrentQuantity('');
      setKrwAdditionalBuyPrice('');
      setKrwAdditionalQuantity('');
    } else {
      setUsdCurrentAveragePrice('');
      setUsdCurrentQuantity('');
      setUsdAdditionalBuyPrice('');
      setUsdAdditionalQuantity('');
    }
    setCalculationHistory([]);
  };

  const calculate = async () => {
    // 1. 키보드 닫기
    Keyboard.dismiss();
    
    // 2. 진동 피드백
    try {
      if (Platform.OS === 'ios') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        // Android에서는 Vibration API 사용
        Vibration.vibrate(50);
      }
    } catch (e) {
      // 진동 피드백 실패 시 무시
      console.log('Haptic feedback not available');
    }

    if (!currentAveragePrice || !currentQuantity || !additionalBuyPrice || !additionalQuantity) {
      Alert.alert('입력 오류', '모든 필드를 입력해주세요.');
      return;
    }

    const currentAveragePriceNum = parseFloat(removeCommas(currentAveragePrice));
    const currentQuantityNum = parseInt(removeCommas(currentQuantity), 10);
    const additionalBuyPriceNum = parseFloat(removeCommas(additionalBuyPrice));
    const additionalQuantityNum = parseInt(removeCommas(additionalQuantity), 10);
    const exchangeRateNum = selectedCurrency === Currency.USD ? parseFloat(removeCommas(usdExchangeRate)) : undefined;

    if (isNaN(currentAveragePriceNum) || currentAveragePriceNum <= 0) {
      Alert.alert('입력 오류', '올바른 현재 평균 단가를 입력하세요.');
      return;
    }

    if (isNaN(currentQuantityNum) || currentQuantityNum <= 0) {
      Alert.alert('입력 오류', '올바른 현재 보유 수량을 입력하세요.');
      return;
    }

    if (isNaN(additionalBuyPriceNum) || additionalBuyPriceNum <= 0) {
      Alert.alert('입력 오류', '올바른 추가 매수가를 입력하세요.');
      return;
    }

    if (isNaN(additionalQuantityNum) || additionalQuantityNum <= 0) {
      Alert.alert('입력 오류', '올바른 추가 매수 수량을 입력하세요.');
      return;
    }

    if (selectedCurrency === Currency.USD) {
      if (!exchangeRateNum || isNaN(exchangeRateNum) || exchangeRateNum <= 0) {
        Alert.alert('입력 오류', '올바른 환율을 입력하세요.');
        return;
      }
    }

    // 3. 로딩 상태 시작
    setIsCalculating(true);
    resultOpacity.setValue(0);

    // 계산 처리 (0.5초 지연)
    await new Promise(resolve => setTimeout(resolve, 500));

    const feeRate = await SettingsService.getFeeRate(selectedCurrency);

    // 히스토리가 있으면 마지막 계산 결과를 기반으로, 없으면 입력값을 기반으로
    let baseAveragePrice: number;
    let baseQuantity: number;

    if (calculationHistory.length > 0) {
      const lastCalc = calculationHistory[calculationHistory.length - 1];
      baseAveragePrice = lastCalc.newAveragePriceWithoutFee;
      baseQuantity = lastCalc.newTotalQuantity;
    } else {
      baseAveragePrice = currentAveragePriceNum;
      baseQuantity = currentQuantityNum;
    }

    const newCalculation = new AveragingCalculation({
      currentAveragePrice: baseAveragePrice,
      currentQuantity: baseQuantity,
      additionalBuyPrice: additionalBuyPriceNum,
      additionalQuantity: additionalQuantityNum,
      feeRate,
      currency: selectedCurrency,
      exchangeRate: exchangeRateNum,
    });

    const updatedHistory = [...calculationHistory, newCalculation];
    setCalculationHistory(updatedHistory);
    setIsCalculating(false);
    
    // 현재 보유 정보를 계산 결과로 업데이트 (천단위 콤마 포함)
    if (selectedCurrency === Currency.KRW) {
      // KRW는 정수로 반올림하고 천단위 콤마 추가
      setKrwCurrentAveragePrice(addCommas(Math.round(newCalculation.newAveragePriceWithoutFee).toString()));
      setKrwCurrentQuantity(addCommas(newCalculation.newTotalQuantity.toString()));
      setKrwAdditionalBuyPrice('');
      setKrwAdditionalQuantity('');
    } else {
      // USD는 소수점 두자리 유지하고 천단위 콤마 추가
      setUsdCurrentAveragePrice(addCommas(newCalculation.newAveragePriceWithoutFee.toFixed(2)));
      setUsdCurrentQuantity(addCommas(newCalculation.newTotalQuantity.toString()));
      setUsdAdditionalBuyPrice('');
      setUsdAdditionalQuantity('');
    }
    
    coupangBannerRef.current?.refreshRandomProducts();

    // 4. 결과 애니메이션
    Animated.timing(resultOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // 5. 화면 자동 스크롤 (마지막 물타기 타이틀로)
    // resultContainerY를 초기화하여 onLayout에서 새로 측정되도록 함
    resultContainerY.current = -1; // -1로 초기화하여 설정 여부 확인
    // onLayout이 실행될 시간을 충분히 주기 위해 지연 사용
    setTimeout(() => {
      if (resultContainerY.current >= 0) {
        scrollViewRef.current?.scrollTo({ y: resultContainerY.current - 50, animated: true });
      }
      // resultContainerY가 설정되지 않았으면 스크롤하지 않음
    }, 600);
  };

  const continueAveraging = () => {
    if (calculationHistory.length === 0) return;

    const lastCalc = calculationHistory[calculationHistory.length - 1];
    if (selectedCurrency === Currency.KRW) {
      // KRW는 정수로 반올림하고 천단위 콤마 추가
      setKrwCurrentAveragePrice(addCommas(Math.round(lastCalc.newAveragePriceWithoutFee).toString()));
      setKrwCurrentQuantity(addCommas(lastCalc.newTotalQuantity.toString()));
      setKrwAdditionalBuyPrice('');
      setKrwAdditionalQuantity('');
    } else {
      // USD는 소수점 두자리 유지하고 천단위 콤마 추가
      setUsdCurrentAveragePrice(addCommas(lastCalc.newAveragePriceWithoutFee.toFixed(2)));
      setUsdCurrentQuantity(addCommas(lastCalc.newTotalQuantity.toString()));
      setUsdAdditionalBuyPrice('');
      setUsdAdditionalQuantity('');
    }

    // 스크롤을 상단으로 이동
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, 300);
  };

  const deleteLastCalculation = () => {
    if (calculationHistory.length === 0) return;

    const newHistory = [...calculationHistory];
    newHistory.pop();
    setCalculationHistory(newHistory);
  };

  const saveAsScenario = async () => {
    if (calculationHistory.length === 0) {
      Alert.alert('알림', '저장할 계산 결과가 없습니다.');
      return;
    }

    try {
      setIsSavingScenario(true);

      // 데이터베이스 초기화 (에러 핸들링)
      try {
        await initDatabase();
      } catch (dbError) {
        console.error('Database initialization error:', dbError);
        Alert.alert('오류', '데이터베이스 초기화에 실패했습니다.');
        setIsSavingScenario(false);
        return;
      }

      // 계좌 목록 조회
      let accounts = await getAllAccounts();
      
      // 계좌가 없으면 기본 포트폴리오 자동 생성 (선택한 통화로)
      if (accounts.length === 0) {
        const defaultAccount = await createAccount('나의 포트폴리오', selectedCurrency);
        accounts = [defaultAccount];
      }

      // 계좌 선택 로직:
      // 1. 선택한 통화와 일치하는 포트폴리오 중에서
      // 2. 먼저 "나의 포트폴리오" (기본 포트폴리오)를 찾고
      // 3. 없으면 같은 통화의 첫 번째 포트폴리오를 선택
      // 4. 같은 통화의 포트폴리오가 없으면 기본 포트폴리오 생성
      const sameCurrencyAccounts = accounts.filter(a => a.currency === selectedCurrency);
      let account = sameCurrencyAccounts.find(a => a.name === '나의 포트폴리오') 
        || sameCurrencyAccounts[0];
      
      // 같은 통화의 포트폴리오가 없으면 기본 포트폴리오 생성
      if (!account) {
        account = await createAccount('나의 포트폴리오', selectedCurrency);
      }

      // 종목명 입력 모달 표시
      setTickerInput('');
      setShowTickerInput(true);
    } catch (error) {
      console.error('시나리오 저장 오류:', error);
      Alert.alert('오류', '시나리오 저장에 실패했습니다.');
      setIsSavingScenario(false);
    }
  };

  const handleStockSelect = async (ticker: string, officialName: string) => {
    setShowTickerInput(false);
    
    // 선택한 종목 정보 저장
    setSelectedTicker(ticker);
    setSelectedOfficialName(officialName);
    
    // 별명 입력 모달 표시 (기본값은 officialName)
    setStockNameInput(officialName);
    setShowStockNameInput(true);
  };
  
  const handleStockNameConfirm = async () => {
    if (!selectedTicker || !selectedOfficialName) {
      Alert.alert('오류', '종목 정보가 없습니다.');
      return;
    }
    
    const stockName = stockNameInput.trim() || selectedOfficialName;
    setShowStockNameInput(false);
    
    try {
      // 계좌 조회 및 선택
      const accounts = await getAllAccounts();
      const sameCurrencyAccounts = accounts.filter(a => a.currency === selectedCurrency);
      let account = sameCurrencyAccounts.find(a => a.name === '나의 포트폴리오') 
        || sameCurrencyAccounts[0];
      
      // 같은 통화의 포트폴리오가 없으면 기본 포트폴리오 생성
      if (!account) {
        account = await createAccount('나의 포트폴리오', selectedCurrency);
      }

      // 종목 저장 (별명 사용)
      await saveScenario(account, selectedTicker, selectedOfficialName, stockName);
      
      // 상태 초기화
      setSelectedTicker(null);
      setSelectedOfficialName(null);
      setStockNameInput('');
    } catch (error) {
      console.error('종목 저장 오류:', error);
      Alert.alert('오류', '종목 저장에 실패했습니다.');
    }
  };

  const saveScenario = async (
    account: { id: string; name: string },
    ticker: string,
    officialName: string,
    stockName: string
  ) => {
    try {
      // 계산 히스토리를 데이터베이스 형식으로 변환
      const historyData = calculationHistory.map((calc) => ({
        additionalBuyPrice: calc.additionalBuyPrice,
        additionalQuantity: calc.additionalQuantity,
        feeRate: calc.feeRate,
        exchangeRate: calc.exchangeRate,
        newAveragePriceWithoutFee: calc.newAveragePriceWithoutFee,
        newTotalQuantity: calc.newTotalQuantity,
        currentAveragePrice: calc.currentAveragePrice,
        currentQuantity: calc.currentQuantity,
      }));

      const result = await saveCalculationAsScenario(
        account.id,
        ticker,
        officialName,
        stockName || officialName,
        historyData,
        selectedCurrency
      );

      // 현재가 자동 조회
      try {
        await updateStockCurrentPrice(result.stock.id);
      } catch (priceError) {
        console.warn('현재가 조회 실패 (종목은 저장됨):', priceError);
        // 현재가 조회 실패해도 종목 저장은 성공한 것으로 처리
      }

      Alert.alert(
        '저장 완료',
        `종목이 저장되었습니다.\n\n포트폴리오: ${account.name}\n종목: ${stockName || officialName}`,
        [
          {
            text: '확인',
            onPress: () => setIsSavingScenario(false),
          },
          {
            text: '종목 상세 보기',
            onPress: () => {
              setIsSavingScenario(false);
              router.push(`/stock-detail?id=${result.stock.id}`);
            },
          },
        ]
      );
    } catch (error) {
      console.error('시나리오 저장 오류:', error);
      Alert.alert('오류', '시나리오 저장에 실패했습니다.');
      setIsSavingScenario(false);
    }
  };

  const shareAllResultsAsText = async () => {
    if (calculationHistory.length === 0) return;

    const buffer: string[] = [];
    buffer.push('물타기 계산 결과\n');

    calculationHistory.forEach((calc, index) => {
      buffer.push(`${index + 1}차 물타기`);
      buffer.push(`기존 평균 단가: ${formatNumber(calc.currentAveragePrice, calc.currency)}`);
      buffer.push(`물타기 평균 단가: ${formatNumber(calc.newAveragePriceWithoutFee, calc.currency)}`);
      buffer.push(`평단 변화량: ${formatNumber(calc.averagePriceChange, calc.currency)}`);
      buffer.push(`평단 변화율: ${calc.averagePriceChangeRate.toFixed(2)}%`);
      buffer.push(`기존 매수 수량: ${addCommas(calc.currentQuantity.toString())}주`);
      buffer.push(`추가 매수 수량: ${addCommas(calc.additionalQuantity.toString())}주`);
      buffer.push(`총 매수 수량: ${addCommas(calc.newTotalQuantity.toString())}주`);
      buffer.push(`기존 매수 금액: ${formatCurrency(calc.currentTotalAmount, calc.currency)}`);
      buffer.push(`추가 매수 금액: ${formatCurrency(calc.additionalTotalAmount, calc.currency)}`);
      buffer.push(`총 매수 금액: ${formatCurrency(calc.newTotalAmountWithoutFee, calc.currency)}`);
      buffer.push('');
    });

    buffer.push('만든 사람: 네오비저닝');

    const text = buffer.join('\n');

    try {
      await Share.share({
        message: text,
        title: '물타기 계산 결과',
      });
    } catch (e) {
      console.error('텍스트 공유에 실패했습니다:', e);
      Alert.alert('공유 오류', '텍스트 공유에 실패했습니다.');
    }
  };

  const getKrwEquivalentDisplay = (usdValue: number): string | null => {
    if (selectedCurrency === Currency.USD && calculationHistory.length > 0) {
      const lastCalc = calculationHistory[calculationHistory.length - 1];
      if (lastCalc.exchangeRate) {
        return getKrwEquivalent(usdValue, lastCalc.exchangeRate);
      }
    }
    return null;
  };

  const currentCalculation = calculationHistory.length > 0 
    ? calculationHistory[calculationHistory.length - 1] 
    : null;

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
        <View style={styles.currencySwitchContainer}>
          <CurrencySwitch
            selectedCurrency={selectedCurrency}
            onChanged={(currency) => {
              setSelectedCurrency(currency);
              setCalculationHistory([]);
              if (currency === Currency.USD) {
                loadExchangeRate();
              }
            }}
          />
        </View>

        {selectedCurrency === Currency.USD && (
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
          <Text style={styles.cardTitle}>현재 보유 정보</Text>

          {selectedCurrency === Currency.USD && (
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
                ? '현재 평균 단가 (USD)'
                : '현재 평균 단가 (원)'
            }
            placeholderTextColor="#757575"
            value={currentAveragePrice}
            onChangeText={(text) => handlePriceInputChange(text, setCurrentAveragePrice, selectedCurrency)}
            keyboardType="numeric"
          />
          {selectedCurrency === Currency.USD &&
            currentAveragePrice &&
            !isNaN(parseFloat(currentAveragePrice)) &&
            currentCalculation &&
            currentCalculation.exchangeRate &&
            getKrwEquivalent(parseFloat(currentAveragePrice), currentCalculation.exchangeRate) && (
              <Text style={styles.helperText}>
                {getKrwEquivalent(parseFloat(currentAveragePrice), currentCalculation.exchangeRate)}
              </Text>
            )}

          <TextInput
            style={styles.input}
            placeholder="현재 보유 수량 (주)"
            placeholderTextColor="#757575"
            value={currentQuantity}
            onChangeText={(text) => handleQuantityInputChange(text, setCurrentQuantity)}
            keyboardType="numeric"
          />

          <Text style={[styles.cardTitle, { marginTop: 24 }]}>추가 매수 정보</Text>

          <TextInput
            style={styles.input}
            placeholder={
              selectedCurrency === Currency.USD ? '추가 매수가 (USD)' : '추가 매수가 (원)'
            }
            placeholderTextColor="#757575"
            value={additionalBuyPrice}
            onChangeText={(text) => handlePriceInputChange(text, setAdditionalBuyPrice, selectedCurrency)}
            keyboardType="numeric"
          />
          {selectedCurrency === Currency.USD &&
            additionalBuyPrice &&
            !isNaN(parseFloat(additionalBuyPrice)) &&
            currentCalculation &&
            currentCalculation.exchangeRate &&
            getKrwEquivalent(parseFloat(additionalBuyPrice), currentCalculation.exchangeRate) && (
              <Text style={styles.helperText}>
                {getKrwEquivalent(parseFloat(additionalBuyPrice), currentCalculation.exchangeRate)}
              </Text>
            )}

          <TextInput
            style={styles.input}
            placeholder="추가 매수 수량 (주)"
            placeholderTextColor="#757575"
            value={additionalQuantity}
            onChangeText={(text) => handleQuantityInputChange(text, setAdditionalQuantity)}
            keyboardType="numeric"
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.calculateButton, isCalculating && styles.calculateButtonDisabled]} 
              onPress={calculate}
              disabled={isCalculating}
            >
              {isCalculating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.calculateButtonText}>
                  {calculationHistory.length === 0 ? '물타기' : '추가 매수 계속하기'}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.resetButton} onPress={reset}>
              <Text style={styles.resetButtonText}>초기화</Text>
            </TouchableOpacity>
          </View>
        </View>

        {calculationHistory.length > 0 && (
          <>
            {calculationHistory.map((calc, index) => {
              const round = index + 1;
              const isLast = index === calculationHistory.length - 1;
              // index를 기반으로 고유한 key 생성 (항상 고유함)
              const baseKey = `calc-${index}`;

              // 마지막 결과만 애니메이션 적용
              const ResultWrapper = isLast ? Animated.View : View;
              const resultStyle = isLast ? {
                opacity: resultOpacity,
                transform: [{
                  translateY: resultOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                }],
              } : {};

              return (
                <ResultWrapper 
                  key={baseKey} 
                  style={[styles.resultContainer, resultStyle]}
                  ref={isLast ? lastResultContainerRef : undefined}
                  onLayout={(event) => {
                    if (isLast) {
                      const { y } = event.nativeEvent.layout;
                      // onLayout의 y는 ScrollView content 내에서의 절대 위치
                      resultContainerY.current = y;
                    }
                  }}
                >
                  <SharedResultSection
                    watermarkText="만든 사람: 네오비저닝"
                    onTextShare={shareAllResultsAsText}
                    actionButtons={[
                      ...(isLast && calculationHistory.length > 0
                        ? [
                            {
                              icon: '🗑️',
                              onPress: deleteLastCalculation,
                            },
                          ]
                        : []),
                      {
                        icon: '🔄',
                        onPress: reset,
                      },
                      ...(isLast && calculationHistory.length > 0
                        ? [
                            {
                              label: '물타기 기록 저장',
                              onPress: saveAsScenario,
                              disabled: isSavingScenario,
                            },
                          ]
                        : []),
                    ]}
                  >
                    <View style={styles.resultHeader}>
                      <View style={styles.roundBadge}>
                        <Text style={styles.roundBadgeText}>{round}차 물타기</Text>
                      </View>
                    </View>

                    <View style={styles.resultGrid}>
                      <View key={`${baseKey}-grid-row-1`} style={styles.gridRow}>
                        <View style={styles.gridItem}>
                          <CalculationResultCard
                            key={`${baseKey}-current-avg`}
                            title="기존 평균 단가"
                            value={
                              formatNumber(calc.currentAveragePrice, calc.currency) +
                              (calc.exchangeRate
                                ? getKrwEquivalent(calc.currentAveragePrice, calc.exchangeRate) || ''
                                : '')
                            }
                          />
                          <View style={{ height: 12 }} />
                          <CalculationResultCard
                            key={`${baseKey}-additional-price`}
                            title="추가 매수 단가"
                            value={
                              formatNumber(calc.additionalBuyPrice, calc.currency) +
                              (calc.exchangeRate
                                ? getKrwEquivalent(calc.additionalBuyPrice, calc.exchangeRate) || ''
                                : '')
                            }
                          />
                        </View>
                        <View key={`${baseKey}-spacer-1`} style={{ width: 12 }} />
                        <View style={styles.gridItem}>
                          <CalculationResultCard
                            key={`${baseKey}-current-qty`}
                            title="기본 보유 수량"
                            value={`${addCommas(calc.currentQuantity.toString())}주`}
                          />
                          <View style={{ height: 12 }} />
                          <CalculationResultCard
                            key={`${baseKey}-additional-qty`}
                            title="추가 매수 수량"
                            value={`${addCommas(calc.additionalQuantity.toString())}주`}
                          />
                        </View>
                      </View>
                      <View key={`${baseKey}-grid-row-2`} style={styles.gridRow}>
                        <View style={styles.gridItem}>
                          <CalculationResultCard
                            key={`${baseKey}-change-rate`}
                            title="평단 변화율"
                            value={`${calc.averagePriceChangeRate !== 0 ? (calc.averagePriceChangeRate > 0 ? '+ ' : '- ') : ''}${Math.abs(calc.averagePriceChangeRate).toFixed(2)}%`}
                            valueColor={calc.averagePriceChangeRate >= 0 ? '#EF5350' : '#42A5F5'}
                          />
                        </View>
                        <View key={`${baseKey}-spacer-2`} style={{ width: 12 }} />
                        <View style={styles.gridItem}>
                          <CalculationResultCard
                            key={`${baseKey}-price-change`}
                            title="평단 변화량"
                            value={
                              (calc.averagePriceChange !== 0 ? (calc.averagePriceChange > 0 ? '+ ' : '- ') : '') +
                              formatNumber(Math.abs(calc.averagePriceChange), calc.currency) +
                              (calc.exchangeRate
                                ? getKrwEquivalent(Math.abs(calc.averagePriceChange), calc.exchangeRate) || ''
                                : '')
                            }
                            valueColor={calc.averagePriceChange >= 0 ? '#EF5350' : '#42A5F5'}
                          />
                        </View>
                      </View>
                      <View key={`${baseKey}-grid-row-3`} style={styles.gridRow}>
                        <View style={styles.gridItem}>
                          <CalculationResultCard
                            key={`${baseKey}-new-avg`}
                            title="물타기 평균 단가"
                            value={
                              formatNumber(calc.newAveragePriceWithoutFee, calc.currency) +
                              (calc.exchangeRate
                                ? getKrwEquivalent(calc.newAveragePriceWithoutFee, calc.exchangeRate) || ''
                                : '')
                            }
                            valueColor={
                              calc.newAveragePriceWithoutFee > calc.currentAveragePrice ? '#EF5350' :
                              calc.newAveragePriceWithoutFee < calc.currentAveragePrice ? '#42A5F5' :
                              '#FFFFFF'
                            }
                          />
                        </View>
                        <View key={`${baseKey}-spacer-3`} style={{ width: 12 }} />
                        <View style={styles.gridItem}>
                          <CalculationResultCard
                            key={`${baseKey}-total-qty`}
                            title="총 매수 수량"
                            value={`${addCommas(calc.newTotalQuantity.toString())}주`}
                            valueColor="#9CCC65"
                          />
                        </View>
                      </View>
                    </View>

                    <View style={styles.resultCardsVertical}>
                      <CalculationResultCard
                        key={`${baseKey}-current-amount`}
                        title="기존 매수 금액"
                        value={
                          formatCurrency(calc.currentTotalAmount, calc.currency) +
                          (calc.exchangeRate
                            ? getKrwEquivalent(calc.currentTotalAmount, calc.exchangeRate) || ''
                            : '')
                        }
                      />
                      <View key={`${baseKey}-spacer-5`} style={{ height: 12 }} />
                      <CalculationResultCard
                        key={`${baseKey}-additional-amount`}
                        title="추가 매수 금액"
                        value={
                          formatCurrency(calc.additionalTotalAmount, calc.currency) +
                          (calc.exchangeRate
                            ? getKrwEquivalent(calc.additionalTotalAmount, calc.exchangeRate) || ''
                            : '')
                        }
                      />
                      <View key={`${baseKey}-spacer-6`} style={{ height: 12 }} />
                      <CalculationResultCard
                        key={`${baseKey}-total-amount`}
                        title="총 매수 금액"
                        value={
                          formatCurrency(calc.newTotalAmountWithoutFee, calc.currency) +
                          (calc.exchangeRate
                            ? getKrwEquivalent(calc.newTotalAmountWithoutFee, calc.exchangeRate) || ''
                            : '')
                        }
                        valueColor="#FFD700"
                      />
                    </View>
                  </SharedResultSection>

                  {isLast && (
                    <TouchableOpacity
                      style={styles.continueButton}
                      onPress={continueAveraging}
                    >
                      <Text style={styles.continueButtonText}>➕ 추가 매수 계속하기</Text>
                    </TouchableOpacity>
                  )}
                </ResultWrapper>
              );
            })}

            <CoupangBannerSection ref={coupangBannerRef} />
          </>
        )}
        </ScrollView>

        {/* 종목 검색 모달 */}
        <StockSearchModal
          visible={showTickerInput}
          onClose={() => {
            setShowTickerInput(false);
            setIsSavingScenario(false);
          }}
          onSelect={handleStockSelect}
          title="종목 검색 및 저장"
          placeholder="예: 삼성전자, Apple Inc"
        />
        
        {/* 별명 입력 모달 */}
        <Modal
          visible={showStockNameInput}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            setShowStockNameInput(false);
            setSelectedTicker(null);
            setSelectedOfficialName(null);
            setStockNameInput('');
            setIsSavingScenario(false);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>종목 별명 설정</Text>
              
              {selectedOfficialName && (
                <Text style={styles.modalHelperText}>
                  실제 종목명: {selectedOfficialName}
                </Text>
              )}
              
              <TextInput
                style={styles.modalInput}
                placeholder="종목 별명을 입력하세요"
                placeholderTextColor="#757575"
                value={stockNameInput}
                onChangeText={setStockNameInput}
                autoFocus={true}
                selectTextOnFocus={true}
              />
              
              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setShowStockNameInput(false);
                    setSelectedTicker(null);
                    setSelectedOfficialName(null);
                    setStockNameInput('');
                    setIsSavingScenario(false);
                  }}
                >
                  <Text style={styles.modalButtonCancelText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                  onPress={handleStockNameConfirm}
                >
                  <Text style={styles.modalButtonConfirmText}>저장</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  roundBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(66, 165, 245, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
  },
  roundBadgeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#42A5F5',
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
  continueButton: {
    backgroundColor: '#42A5F5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.3)',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: 'rgba(13, 27, 42, 0.95)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.3)',
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: '#B0BEC5',
    marginBottom: 16,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: 'rgba(27, 38, 59, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
    padding: 16,
    color: '#FFFFFF',
    fontSize: 17,
    marginBottom: 20,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.3)',
  },
  modalHelperText: {
    fontSize: 13,
    color: '#B0BEC5',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalButtonConfirm: {
    backgroundColor: '#42A5F5',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#B0BEC5',
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#B0BEC5',
  },
  modalButtonConfirmText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

