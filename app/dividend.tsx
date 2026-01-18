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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Currency } from '../src/models/Currency';
import { ExchangeRateService } from '../src/services/ExchangeRateService';
import { CurrencySwitch } from '../src/components/CurrencySwitch';
import { CalculationResultCard } from '../src/components/CalculationResultCard';
import { SharedResultSection } from '../src/components/SharedResultSection';
import { CoupangDynamicBanner } from '../src/components/CoupangDynamicBanner';
import { formatCurrency, formatNumber, getKrwEquivalent, addCommas } from '../src/utils/formatUtils';
import { Share } from 'react-native';

interface DividendCalculation {
  dividendPerShare: number; // 주당 배당금
  dividendRate: number; // 배당률 (%)
  quantity: number; // 보유 수량
  annualDividend: number; // 연간 배당금
  dividendYield: number; // 배당 수익률 (%)
  currency: Currency;
  exchangeRate?: number;
}

export default function DividendCalculatorView() {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(Currency.KRW);
  
  // 통화별 입력값 분리
  const [krwDividendPerShare, setKrwDividendPerShare] = useState('');
  const [krwDividendRate, setKrwDividendRate] = useState('');
  const [krwQuantity, setKrwQuantity] = useState('');
  const [krwCurrentPrice, setKrwCurrentPrice] = useState('');
  
  const [usdDividendPerShare, setUsdDividendPerShare] = useState('');
  const [usdDividendRate, setUsdDividendRate] = useState('');
  const [usdQuantity, setUsdQuantity] = useState('');
  const [usdCurrentPrice, setUsdCurrentPrice] = useState('');
  const [usdExchangeRate, setUsdExchangeRate] = useState('1350');
  
  const [calculation, setCalculation] = useState<DividendCalculation | null>(null);
  const [isLoadingExchangeRate, setIsLoadingExchangeRate] = useState(false);
  const [isExchangeRateLoaded, setIsExchangeRateLoaded] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const resultContainerY = useRef<number>(0);
  
  // 현재 선택된 통화의 입력값 getter
  const dividendPerShare = selectedCurrency === Currency.KRW ? krwDividendPerShare : usdDividendPerShare;
  const dividendRate = selectedCurrency === Currency.KRW ? krwDividendRate : usdDividendRate;
  const quantity = selectedCurrency === Currency.KRW ? krwQuantity : usdQuantity;
  const currentPrice = selectedCurrency === Currency.KRW ? krwCurrentPrice : usdCurrentPrice;
  const exchangeRate = selectedCurrency === Currency.USD ? usdExchangeRate : '1350';
  
  const setDividendPerShare = selectedCurrency === Currency.KRW ? setKrwDividendPerShare : setUsdDividendPerShare;
  const setDividendRate = selectedCurrency === Currency.KRW ? setKrwDividendRate : setUsdDividendRate;
  const setQuantity = selectedCurrency === Currency.KRW ? setKrwQuantity : setUsdQuantity;
  const setCurrentPrice = selectedCurrency === Currency.KRW ? setKrwCurrentPrice : setUsdCurrentPrice;
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

  // 수익률 입력 핸들러
  const handleRateInputChange = (text: string, setter: (value: string) => void) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const formatted = parts.length > 2 
      ? parts[0] + '.' + parts.slice(1).join('')
      : cleaned;
    
    if (formatted === '' || formatted === '.') {
      setter(formatted);
      return;
    }
    
    setter(formatted);
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
      setKrwDividendPerShare('');
      setKrwDividendRate('');
      setKrwQuantity('');
      setKrwCurrentPrice('');
    } else {
      setUsdDividendPerShare('');
      setUsdDividendRate('');
      setUsdQuantity('');
      setUsdCurrentPrice('');
    }
    setCalculation(null);
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

    // 주당 배당금 또는 배당률 중 하나는 반드시 입력해야 함
    if (!dividendPerShare && !dividendRate) {
      Alert.alert('입력 오류', '주당 배당금 또는 배당률 중 하나를 입력해주세요.');
      return;
    }

    if (!quantity) {
      Alert.alert('입력 오류', '보유 수량을 입력해주세요.');
      return;
    }

    const dividendPerShareNum = dividendPerShare ? parseFloat(removeCommas(dividendPerShare)) : NaN;
    const dividendRateNum = dividendRate ? parseFloat(removeCommas(dividendRate)) : NaN;
    const quantityNum = parseInt(removeCommas(quantity), 10);
    const currentPriceNum = currentPrice ? parseFloat(removeCommas(currentPrice)) : NaN;
    const exchangeRateNum = selectedCurrency === Currency.USD ? parseFloat(removeCommas(usdExchangeRate)) : undefined;

    if (isNaN(quantityNum) || quantityNum <= 0) {
      Alert.alert('입력 오류', '올바른 보유 수량을 입력하세요.');
      return;
    }

    // 주당 배당금이 없으면 배당률과 현재가로 계산
    let finalDividendPerShare = dividendPerShareNum;
    if (isNaN(finalDividendPerShare) || finalDividendPerShare <= 0) {
      if (isNaN(dividendRateNum) || dividendRateNum <= 0) {
        Alert.alert('입력 오류', '올바른 배당률을 입력하세요.');
        return;
      }
      if (isNaN(currentPriceNum) || currentPriceNum <= 0) {
        Alert.alert('입력 오류', '배당률을 사용하려면 현재가를 입력해주세요.');
        return;
      }
      // 배당률로 주당 배당금 계산: 주당 배당금 = 현재가 × (배당률 / 100)
      finalDividendPerShare = currentPriceNum * (dividendRateNum / 100);
    }

    // 배당률이 없으면 주당 배당금과 현재가로 계산
    let finalDividendRate = dividendRateNum;
    if (isNaN(finalDividendRate) || finalDividendRate <= 0) {
      if (isNaN(currentPriceNum) || currentPriceNum <= 0) {
        Alert.alert('입력 오류', '배당률을 계산하려면 현재가를 입력해주세요.');
        return;
      }
      // 주당 배당금으로 배당률 계산: 배당률 = (주당 배당금 / 현재가) × 100
      finalDividendRate = (finalDividendPerShare / currentPriceNum) * 100;
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

    // 연간 배당금 계산: 주당 배당금 × 보유 수량
    const annualDividend = finalDividendPerShare * quantityNum;
    
    // 배당 수익률 계산: (연간 배당금 / 총 투자금액) × 100
    // 총 투자금액이 없으면 배당률을 그대로 사용
    let dividendYield = finalDividendRate;
    if (!isNaN(currentPriceNum) && currentPriceNum > 0) {
      const totalInvestment = currentPriceNum * quantityNum;
      dividendYield = (annualDividend / totalInvestment) * 100;
    }

    const newCalculation: DividendCalculation = {
      dividendPerShare: finalDividendPerShare,
      dividendRate: finalDividendRate,
      quantity: quantityNum,
      annualDividend,
      dividendYield,
      currency: selectedCurrency,
      exchangeRate: exchangeRateNum,
    };

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

  const shareResultAsText = async () => {
    if (!calculation) return;

    const buffer: string[] = [];
    buffer.push('배당금 계산 결과\n');
    buffer.push(`주당 배당금: ${formatNumber(calculation.dividendPerShare, calculation.currency)}`);
    buffer.push(`배당률: ${calculation.dividendRate.toFixed(2)}%`);
    buffer.push(`보유 수량: ${addCommas(calculation.quantity.toString())}주`);
    buffer.push(`연간 배당금: ${formatCurrency(calculation.annualDividend, calculation.currency)}`);
    buffer.push(`배당 수익률: ${calculation.dividendYield.toFixed(2)}%`);
    buffer.push('');
    buffer.push('만든 사람: 네오비저닝');

    const text = buffer.join('\n');

    try {
      await Share.share({
        message: text,
        title: '배당금 계산 결과',
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
          <Text style={styles.cardTitle}>입력 정보</Text>

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
                ? '주당 배당금 (USD)'
                : '주당 배당금 (원)'
            }
            placeholderTextColor="#757575"
            value={dividendPerShare}
            onChangeText={(text) => handlePriceInputChange(text, setDividendPerShare, selectedCurrency)}
            keyboardType="numeric"
          />
          <Text style={styles.helperText}>예: 100 (1주당 100원 배당) - 배당률 입력 시 생략 가능</Text>

          <TextInput
            style={styles.input}
            placeholder="배당률 (%)"
            placeholderTextColor="#757575"
            value={dividendRate}
            onChangeText={(text) => handleRateInputChange(text, setDividendRate)}
            keyboardType="numeric"
          />
          <Text style={styles.helperText}>예: 3.5 (3.5% 배당률) - 주당 배당금 입력 시 생략 가능</Text>

          <TextInput
            style={styles.input}
            placeholder={
              selectedCurrency === Currency.USD
                ? '현재가 (USD) - 선택'
                : '현재가 (원) - 선택'
            }
            placeholderTextColor="#757575"
            value={currentPrice}
            onChangeText={(text) => handlePriceInputChange(text, setCurrentPrice, selectedCurrency)}
            keyboardType="numeric"
          />
          <Text style={styles.helperText}>배당률 계산 또는 배당 수익률 계산에 필요</Text>

          <TextInput
            style={styles.input}
            placeholder="보유 수량 (주)"
            placeholderTextColor="#757575"
            value={quantity}
            onChangeText={(text) => handleQuantityInputChange(text, setQuantity)}
            keyboardType="numeric"
          />
          <Text style={styles.helperText}>보유하고 있는 주식 수량</Text>

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
            style={[styles.resultContainer, { opacity: resultOpacity }]}
            onLayout={(event) => {
              const { y } = event.nativeEvent.layout;
              resultContainerY.current = y;
            }}
          >
            <SharedResultSection
              watermarkText="만든 사람: 네오비저닝"
              onTextShare={shareResultAsText}
              actionButtons={[
                {
                  icon: '🔄',
                  onPress: reset,
                },
              ]}
            >
              <View style={styles.resultHeader}>
                <Text style={styles.resultTitle}>배당금 계산 결과</Text>
              </View>

              <View style={styles.resultGrid}>
                <View style={styles.gridRow}>
                  <View style={styles.gridItem}>
                    <CalculationResultCard
                      title="주당 배당금"
                      value={
                        formatNumber(calculation.dividendPerShare, calculation.currency) +
                        (calculation.exchangeRate
                          ? getKrwEquivalent(calculation.dividendPerShare, calculation.exchangeRate) || ''
                          : '')
                      }
                    />
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={styles.gridItem}>
                    <CalculationResultCard
                      title="배당률"
                      value={`${calculation.dividendRate.toFixed(2)}%`}
                      valueColor="#4CAF50"
                    />
                  </View>
                </View>
                <View style={styles.gridRow}>
                  <View style={styles.gridItem}>
                    <CalculationResultCard
                      title="보유 수량"
                      value={`${addCommas(calculation.quantity.toString())}주`}
                    />
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={styles.gridItem}>
                    <CalculationResultCard
                      title="배당 수익률"
                      value={`${calculation.dividendYield.toFixed(2)}%`}
                      valueColor="#4CAF50"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.resultCardsVertical}>
                <CalculationResultCard
                  title="연간 배당금"
                  value={
                    formatCurrency(calculation.annualDividend, calculation.currency) +
                    (calculation.exchangeRate
                      ? getKrwEquivalent(calculation.annualDividend, calculation.exchangeRate) || ''
                      : '')
                  }
                  valueColor="#FFD700"
                />
              </View>
            </SharedResultSection>
          </Animated.View>
        )}

        {calculation && <CoupangDynamicBanner width={320} height={140} />}
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
  resultTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  resultGrid: {
    marginBottom: 16,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  gridItem: {
    flex: 1,
  },
  resultCardsVertical: {
    marginTop: 4,
  },
});











