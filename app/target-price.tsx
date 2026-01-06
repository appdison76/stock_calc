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

interface TargetPriceCalculation {
  currentPrice: number;
  targetProfitRate: number;
  quantity: number;
  targetPrice: number;
  expectedProfit: number;
  expectedProfitAmount: number;
  currency: Currency;
  exchangeRate?: number;
}

export default function TargetPriceCalculatorView() {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(Currency.KRW);
  
  // 통화별 입력값 분리
  const [krwCurrentPrice, setKrwCurrentPrice] = useState('');
  const [krwTargetProfitRate, setKrwTargetProfitRate] = useState('');
  const [krwQuantity, setKrwQuantity] = useState('');
  
  const [usdCurrentPrice, setUsdCurrentPrice] = useState('');
  const [usdTargetProfitRate, setUsdTargetProfitRate] = useState('');
  const [usdQuantity, setUsdQuantity] = useState('');
  const [usdExchangeRate, setUsdExchangeRate] = useState('1350');
  
  const [calculation, setCalculation] = useState<TargetPriceCalculation | null>(null);
  const [isLoadingExchangeRate, setIsLoadingExchangeRate] = useState(false);
  const [isExchangeRateLoaded, setIsExchangeRateLoaded] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const coupangBannerRef = useRef<CoupangBannerSectionRef>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const resultContainerY = useRef<number>(0);
  
  // 현재 선택된 통화의 입력값 getter
  const currentPrice = selectedCurrency === Currency.KRW ? krwCurrentPrice : usdCurrentPrice;
  const targetProfitRate = selectedCurrency === Currency.KRW ? krwTargetProfitRate : usdTargetProfitRate;
  const quantity = selectedCurrency === Currency.KRW ? krwQuantity : usdQuantity;
  const exchangeRate = selectedCurrency === Currency.USD ? usdExchangeRate : '1350';
  
  const setCurrentPrice = selectedCurrency === Currency.KRW ? setKrwCurrentPrice : setUsdCurrentPrice;
  const setTargetProfitRate = selectedCurrency === Currency.KRW ? setKrwTargetProfitRate : setUsdTargetProfitRate;
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
      setKrwCurrentPrice('');
      setKrwTargetProfitRate('');
      setKrwQuantity('');
    } else {
      setUsdCurrentPrice('');
      setUsdTargetProfitRate('');
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

    if (!currentPrice || !targetProfitRate) {
      Alert.alert('입력 오류', '현재가와 목표 수익률을 입력해주세요.');
      return;
    }

    const currentPriceNum = parseFloat(removeCommas(currentPrice));
    const targetProfitRateNum = parseFloat(removeCommas(targetProfitRate.replace('-', ''))) * (targetProfitRate.startsWith('-') ? -1 : 1);
    const quantityNum = quantity ? parseInt(removeCommas(quantity), 10) : 1;
    const exchangeRateNum = selectedCurrency === Currency.USD ? parseFloat(removeCommas(usdExchangeRate)) : undefined;

    if (isNaN(currentPriceNum) || currentPriceNum <= 0) {
      Alert.alert('입력 오류', '올바른 현재가를 입력하세요.');
      return;
    }

    if (isNaN(targetProfitRateNum)) {
      Alert.alert('입력 오류', '올바른 목표 수익률을 입력하세요.');
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

    // 목표가 계산: 현재가 × (1 + 목표 수익률 / 100)
    const targetPrice = currentPriceNum * (1 + targetProfitRateNum / 100);
    
    // 예상 수익 (1주당)
    const expectedProfit = targetPrice - currentPriceNum;
    
    // 예상 수익금 (총)
    const expectedProfitAmount = expectedProfit * quantityNum;

    const newCalculation: TargetPriceCalculation = {
      currentPrice: currentPriceNum,
      targetProfitRate: targetProfitRateNum,
      quantity: quantityNum,
      targetPrice,
      expectedProfit,
      expectedProfitAmount,
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
    buffer.push('목표가 계산 결과\n');
    buffer.push(`현재가: ${formatNumber(calculation.currentPrice, calculation.currency)}`);
    buffer.push(`목표 수익률: ${calculation.targetProfitRate >= 0 ? '+' : ''}${calculation.targetProfitRate.toFixed(2)}%`);
    buffer.push(`목표가: ${formatNumber(calculation.targetPrice, calculation.currency)}`);
    buffer.push(`예상 수익 (1주당): ${formatNumber(calculation.expectedProfit, calculation.currency)}`);
    buffer.push(`보유 수량: ${addCommas(calculation.quantity.toString())}주`);
    buffer.push(`예상 수익금 (총): ${formatCurrency(calculation.expectedProfitAmount, calculation.currency)}`);
    buffer.push('');
    buffer.push('만든 사람: 네오비저닝');

    const text = buffer.join('\n');

    try {
      await Share.share({
        message: text,
        title: '목표가 계산 결과',
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
                ? '현재가 (USD)'
                : '현재가 (원)'
            }
            placeholderTextColor="#757575"
            value={currentPrice}
            onChangeText={(text) => handlePriceInputChange(text, setCurrentPrice, selectedCurrency)}
            keyboardType="numeric"
          />
          {selectedCurrency === Currency.USD &&
            currentPrice &&
            !isNaN(parseFloat(currentPrice)) &&
            calculation &&
            calculation.exchangeRate &&
            getKrwEquivalent(parseFloat(currentPrice), calculation.exchangeRate) && (
              <Text style={styles.helperText}>
                {getKrwEquivalent(parseFloat(currentPrice), calculation.exchangeRate)}
              </Text>
            )}

          <TextInput
            style={styles.input}
            placeholder="목표 수익률 (%)"
            placeholderTextColor="#757575"
            value={targetProfitRate}
            onChangeText={(text) => handleProfitRateInputChange(text, setTargetProfitRate)}
            keyboardType="numeric"
          />
          <Text style={styles.helperText}>예: 10 (10% 수익률), -5 (-5% 손실률)</Text>

          <TextInput
            style={styles.input}
            placeholder="보유 수량 (주)"
            placeholderTextColor="#757575"
            value={quantity}
            onChangeText={(text) => handleQuantityInputChange(text, setQuantity)}
            keyboardType="numeric"
          />
          <Text style={styles.helperText}>수량을 입력하면 예상 수익금을 계산합니다</Text>

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
                <Text style={styles.resultTitle}>목표가 계산 결과</Text>
              </View>

              <View style={styles.resultGrid}>
                <View style={styles.gridRow}>
                  <View style={styles.gridItem}>
                    <CalculationResultCard
                      title="현재가"
                      value={
                        formatNumber(calculation.currentPrice, calculation.currency) +
                        (calculation.exchangeRate
                          ? getKrwEquivalent(calculation.currentPrice, calculation.exchangeRate) || ''
                          : '')
                      }
                    />
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={styles.gridItem}>
                    <CalculationResultCard
                      title="목표 수익률"
                      value={`${calculation.targetProfitRate >= 0 ? '+' : ''}${calculation.targetProfitRate.toFixed(2)}%`}
                      valueColor={calculation.targetProfitRate >= 0 ? '#4CAF50' : '#EF5350'}
                    />
                  </View>
                </View>
                <View style={styles.gridRow}>
                  <View style={styles.gridItem}>
                    <CalculationResultCard
                      title="목표가"
                      value={
                        formatNumber(calculation.targetPrice, calculation.currency) +
                        (calculation.exchangeRate
                          ? getKrwEquivalent(calculation.targetPrice, calculation.exchangeRate) || ''
                          : '')
                      }
                      valueColor="#FFD700"
                    />
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={styles.gridItem}>
                    <CalculationResultCard
                      title="예상 수익 (1주당)"
                      value={
                        (calculation.expectedProfit !== 0 ? (calculation.expectedProfit > 0 ? '+ ' : '- ') : '') +
                        formatNumber(Math.abs(calculation.expectedProfit), calculation.currency) +
                        (calculation.exchangeRate
                          ? getKrwEquivalent(Math.abs(calculation.expectedProfit), calculation.exchangeRate) || ''
                          : '')
                      }
                      valueColor={calculation.expectedProfit >= 0 ? '#4CAF50' : '#EF5350'}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.resultCardsVertical}>
                <CalculationResultCard
                  title="보유 수량"
                  value={`${addCommas(calculation.quantity.toString())}주`}
                />
                <View style={{ height: 12 }} />
                <CalculationResultCard
                  title="예상 수익금 (총)"
                  value={
                    formatCurrency(calculation.expectedProfitAmount, calculation.currency) +
                    (calculation.exchangeRate
                      ? getKrwEquivalent(calculation.expectedProfitAmount, calculation.exchangeRate) || ''
                      : '')
                  }
                  valueColor={calculation.expectedProfitAmount >= 0 ? '#4CAF50' : '#EF5350'}
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


