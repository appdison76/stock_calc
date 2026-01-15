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
import { SettingsService } from '../src/services/SettingsService';
import { ExchangeRateService } from '../src/services/ExchangeRateService';
import { CurrencySwitch } from '../src/components/CurrencySwitch';
import { CalculationResultCard } from '../src/components/CalculationResultCard';
import { SharedResultSection } from '../src/components/SharedResultSection';
import { CoupangBannerSection, CoupangBannerSectionRef } from '../src/components/CoupangBannerSection';
import { formatCurrency, formatNumber, getKrwEquivalent, addCommas } from '../src/utils/formatUtils';
import { Share } from 'react-native';

interface StopLossTakeProfitCalculation {
  buyPrice: number;
  takeProfitRate: number;
  stopLossRate: number;
  quantity: number;
  targetPrice: number; // 익절가
  stopLossPrice: number; // 손절가
  takeProfitAmount: number; // 익절 시 예상 수익 (1주당)
  stopLossAmount: number; // 손절 시 예상 손실 (1주당)
  takeProfitTotalAmount: number; // 익절 시 예상 수익금 (총)
  stopLossTotalAmount: number; // 손절 시 예상 손실금 (총)
  currency: Currency;
  exchangeRate?: number;
}

export default function StopLossTakeProfitCalculatorView() {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(Currency.KRW);
  
  // 통화별 입력값 분리
  const [krwBuyPrice, setKrwBuyPrice] = useState('');
  const [krwTakeProfitRate, setKrwTakeProfitRate] = useState('');
  const [krwStopLossRate, setKrwStopLossRate] = useState('');
  const [krwQuantity, setKrwQuantity] = useState('');
  
  const [usdBuyPrice, setUsdBuyPrice] = useState('');
  const [usdTakeProfitRate, setUsdTakeProfitRate] = useState('');
  const [usdStopLossRate, setUsdStopLossRate] = useState('');
  const [usdQuantity, setUsdQuantity] = useState('');
  const [usdExchangeRate, setUsdExchangeRate] = useState('1350');
  
  const [calculation, setCalculation] = useState<StopLossTakeProfitCalculation | null>(null);
  const [isLoadingExchangeRate, setIsLoadingExchangeRate] = useState(false);
  const [isExchangeRateLoaded, setIsExchangeRateLoaded] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const coupangBannerRef = useRef<CoupangBannerSectionRef>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const resultContainerY = useRef<number>(0);
  
  // 현재 선택된 통화의 입력값 getter
  const buyPrice = selectedCurrency === Currency.KRW ? krwBuyPrice : usdBuyPrice;
  const takeProfitRate = selectedCurrency === Currency.KRW ? krwTakeProfitRate : usdTakeProfitRate;
  const stopLossRate = selectedCurrency === Currency.KRW ? krwStopLossRate : usdStopLossRate;
  const quantity = selectedCurrency === Currency.KRW ? krwQuantity : usdQuantity;
  const exchangeRate = selectedCurrency === Currency.USD ? usdExchangeRate : '1350';
  
  const setBuyPrice = selectedCurrency === Currency.KRW ? setKrwBuyPrice : setUsdBuyPrice;
  const setTakeProfitRate = selectedCurrency === Currency.KRW ? setKrwTakeProfitRate : setUsdTakeProfitRate;
  const setStopLossRate = selectedCurrency === Currency.KRW ? setKrwStopLossRate : setUsdStopLossRate;
  const setQuantity = selectedCurrency === Currency.KRW ? setKrwQuantity : setUsdQuantity;
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

  // 수익률 입력 핸들러 (천단위 콤마 자동 추가)
  const handleProfitRateInputChange = (text: string, setter: (value: string) => void) => {
    const cleaned = text.replace(/[^0-9.-]/g, '');
    const parts = cleaned.split('.');
    const formatted = parts.length > 2 
      ? parts[0] + '.' + parts.slice(1).join('')
      : cleaned;
    
    if (formatted === '' || formatted === '.' || formatted === '-') {
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
      setKrwBuyPrice('');
      setKrwTakeProfitRate('');
      setKrwStopLossRate('');
      setKrwQuantity('');
    } else {
      setUsdBuyPrice('');
      setUsdTakeProfitRate('');
      setUsdStopLossRate('');
      setUsdQuantity('');
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

    if (!buyPrice || !takeProfitRate || !stopLossRate) {
      Alert.alert('입력 오류', '매수가, 목표 수익률, 손절 수익률을 모두 입력해주세요.');
      return;
    }

    const buyPriceNum = parseFloat(removeCommas(buyPrice));
    const takeProfitRateNum = parseFloat(removeCommas(takeProfitRate.replace('-', ''))) * (takeProfitRate.startsWith('-') ? -1 : 1);
    const stopLossRateNum = parseFloat(removeCommas(stopLossRate.replace('-', ''))) * (stopLossRate.startsWith('-') ? -1 : 1);
    const quantityNum = quantity ? parseInt(removeCommas(quantity), 10) : 1;
    const exchangeRateNum = selectedCurrency === Currency.USD ? parseFloat(removeCommas(usdExchangeRate)) : undefined;

    if (isNaN(buyPriceNum) || buyPriceNum <= 0) {
      Alert.alert('입력 오류', '올바른 매수가를 입력하세요.');
      return;
    }

    if (isNaN(takeProfitRateNum)) {
      Alert.alert('입력 오류', '올바른 목표 수익률을 입력하세요.');
      return;
    }

    if (isNaN(stopLossRateNum)) {
      Alert.alert('입력 오류', '올바른 손절 수익률을 입력하세요.');
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

    // 3. 로딩 상태 시작
    setIsCalculating(true);
    resultOpacity.setValue(0);

    // 계산 처리 (0.5초 지연)
    await new Promise(resolve => setTimeout(resolve, 500));

    // 목표가 계산: 매수가 × (1 + 목표 수익률 / 100)
    const targetPrice = buyPriceNum * (1 + takeProfitRateNum / 100);
    
    // 손절가 계산: 매수가 × (1 + 손절 수익률 / 100)
    const stopLossPrice = buyPriceNum * (1 + stopLossRateNum / 100);
    
    // 익절 시 예상 수익 (1주당)
    const takeProfitAmount = targetPrice - buyPriceNum;
    
    // 손절 시 예상 손실 (1주당)
    const stopLossAmount = stopLossPrice - buyPriceNum;
    
    // 익절 시 예상 수익금 (총)
    const takeProfitTotalAmount = takeProfitAmount * quantityNum;
    
    // 손절 시 예상 손실금 (총)
    const stopLossTotalAmount = stopLossAmount * quantityNum;

    const newCalculation: StopLossTakeProfitCalculation = {
      buyPrice: buyPriceNum,
      takeProfitRate: takeProfitRateNum,
      stopLossRate: stopLossRateNum,
      quantity: quantityNum,
      targetPrice,
      stopLossPrice,
      takeProfitAmount,
      stopLossAmount,
      takeProfitTotalAmount,
      stopLossTotalAmount,
      currency: selectedCurrency,
      exchangeRate: exchangeRateNum,
    };

    setCalculation(newCalculation);
    setIsCalculating(false);
    
    coupangBannerRef.current?.refreshRandomProducts();

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
    buffer.push('손절/익절 계산 결과\n');
    buffer.push(`매수가: ${formatNumber(calculation.buyPrice, calculation.currency)}`);
    buffer.push(`목표 수익률: ${calculation.takeProfitRate >= 0 ? '+' : ''}${calculation.takeProfitRate.toFixed(2)}%`);
    buffer.push(`손절 수익률: ${calculation.stopLossRate >= 0 ? '+' : ''}${calculation.stopLossRate.toFixed(2)}%`);
    buffer.push(`목표가 (익절가): ${formatNumber(calculation.targetPrice, calculation.currency)}`);
    buffer.push(`손절가: ${formatNumber(calculation.stopLossPrice, calculation.currency)}`);
    buffer.push(`익절 시 예상 수익 (1주당): ${formatNumber(calculation.takeProfitAmount, calculation.currency)}`);
    buffer.push(`손절 시 예상 손실 (1주당): ${formatNumber(calculation.stopLossAmount, calculation.currency)}`);
    buffer.push(`보유 수량: ${addCommas(calculation.quantity.toString())}주`);
    buffer.push(`익절 시 예상 수익금 (총): ${formatCurrency(calculation.takeProfitTotalAmount, calculation.currency)}`);
    buffer.push(`손절 시 예상 손실금 (총): ${formatCurrency(calculation.stopLossTotalAmount, calculation.currency)}`);
    buffer.push('');
    buffer.push('만든 사람: 네오비저닝');

    const text = buffer.join('\n');

    try {
      await Share.share({
        message: text,
        title: '손절/익절 계산 결과',
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
                ? '매수가 (USD)'
                : '매수가 (원)'
            }
            placeholderTextColor="#757575"
            value={buyPrice}
            onChangeText={(text) => handlePriceInputChange(text, setBuyPrice, selectedCurrency)}
            keyboardType="numeric"
          />
          {selectedCurrency === Currency.USD &&
            buyPrice &&
            !isNaN(parseFloat(buyPrice)) &&
            calculation &&
            calculation.exchangeRate &&
            getKrwEquivalent(parseFloat(buyPrice), calculation.exchangeRate) && (
              <Text style={styles.helperText}>
                {getKrwEquivalent(parseFloat(buyPrice), calculation.exchangeRate)}
              </Text>
            )}

          <TextInput
            style={styles.input}
            placeholder="목표 수익률 (%)"
            placeholderTextColor="#757575"
            value={takeProfitRate}
            onChangeText={(text) => handleProfitRateInputChange(text, setTakeProfitRate)}
            keyboardType="numeric"
          />
          <Text style={styles.helperText}>예: 10 (10% 수익률)</Text>

          <TextInput
            style={styles.input}
            placeholder="손절 수익률 (%)"
            placeholderTextColor="#757575"
            value={stopLossRate}
            onChangeText={(text) => handleProfitRateInputChange(text, setStopLossRate)}
            keyboardType="numeric"
          />
          <Text style={styles.helperText}>예: -5 (-5% 손실률)</Text>

          <TextInput
            style={styles.input}
            placeholder="보유 수량 (주)"
            placeholderTextColor="#757575"
            value={quantity}
            onChangeText={(text) => handleQuantityInputChange(text, setQuantity)}
            keyboardType="numeric"
          />
          <Text style={styles.helperText}>수량을 입력하면 예상 수익금/손실금을 계산합니다</Text>

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
                <Text style={styles.resultTitle}>손절/익절 계산 결과</Text>
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
                      title="목표 수익률"
                      value={`${calculation.takeProfitRate >= 0 ? '+' : ''}${calculation.takeProfitRate.toFixed(2)}%`}
                      valueColor="#4CAF50"
                    />
                  </View>
                </View>
                <View style={styles.gridRow}>
                  <View style={styles.gridItem}>
                    <CalculationResultCard
                      title="손절 수익률"
                      value={`${calculation.stopLossRate >= 0 ? '+' : ''}${calculation.stopLossRate.toFixed(2)}%`}
                      valueColor="#EF5350"
                    />
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={styles.gridItem}>
                    <CalculationResultCard
                      title="보유 수량"
                      value={`${addCommas(calculation.quantity.toString())}주`}
                    />
                  </View>
                </View>
                <View style={styles.gridRow}>
                  <View style={styles.gridItem}>
                    <CalculationResultCard
                      title="목표가 (익절가)"
                      value={
                        formatNumber(calculation.targetPrice, calculation.currency) +
                        (calculation.exchangeRate
                          ? getKrwEquivalent(calculation.targetPrice, calculation.exchangeRate) || ''
                          : '')
                      }
                      valueColor="#4CAF50"
                    />
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={styles.gridItem}>
                    <CalculationResultCard
                      title="손절가"
                      value={
                        formatNumber(calculation.stopLossPrice, calculation.currency) +
                        (calculation.exchangeRate
                          ? getKrwEquivalent(calculation.stopLossPrice, calculation.exchangeRate) || ''
                          : '')
                      }
                      valueColor="#EF5350"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.resultCardsVertical}>
                <CalculationResultCard
                  title="익절 시 예상 수익 (1주당)"
                  value={
                    (calculation.takeProfitAmount !== 0 ? (calculation.takeProfitAmount > 0 ? '+ ' : '- ') : '') +
                    formatNumber(Math.abs(calculation.takeProfitAmount), calculation.currency) +
                    (calculation.exchangeRate
                      ? getKrwEquivalent(Math.abs(calculation.takeProfitAmount), calculation.exchangeRate) || ''
                      : '')
                  }
                  valueColor="#4CAF50"
                />
                <View style={{ height: 12 }} />
                <CalculationResultCard
                  title="손절 시 예상 손실 (1주당)"
                  value={
                    (calculation.stopLossAmount !== 0 ? (calculation.stopLossAmount > 0 ? '+ ' : '- ') : '') +
                    formatNumber(Math.abs(calculation.stopLossAmount), calculation.currency) +
                    (calculation.exchangeRate
                      ? getKrwEquivalent(Math.abs(calculation.stopLossAmount), calculation.exchangeRate) || ''
                      : '')
                  }
                  valueColor="#EF5350"
                />
                <View style={{ height: 12 }} />
                <CalculationResultCard
                  title="익절 시 예상 수익금 (총)"
                  value={
                    formatCurrency(calculation.takeProfitTotalAmount, calculation.currency) +
                    (calculation.exchangeRate
                      ? getKrwEquivalent(calculation.takeProfitTotalAmount, calculation.exchangeRate) || ''
                      : '')
                  }
                  valueColor="#4CAF50"
                />
                <View style={{ height: 12 }} />
                <CalculationResultCard
                  title="손절 시 예상 손실금 (총)"
                  value={
                    formatCurrency(calculation.stopLossTotalAmount, calculation.currency) +
                    (calculation.exchangeRate
                      ? getKrwEquivalent(calculation.stopLossTotalAmount, calculation.exchangeRate) || ''
                      : '')
                  }
                  valueColor="#EF5350"
                />
              </View>
            </SharedResultSection>
          </Animated.View>
        )}

        {calculation && <CoupangBannerSection ref={coupangBannerRef} />}
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











