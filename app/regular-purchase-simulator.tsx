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
import { CoupangBannerSection, CoupangBannerSectionRef } from '../src/components/CoupangBannerSection';
import { formatCurrency, formatNumber, getKrwEquivalent, addCommas } from '../src/utils/formatUtils';
import { Share } from 'react-native';

interface RegularPurchasePeriod {
  price: number;
  purchaseAmount: number;
  quantity: number;
}

interface RegularPurchaseSimulation {
  initialAmount: number;
  regularAmount: number;
  periodCount: number;
  periods: RegularPurchasePeriod[];
  totalInvestment: number;
  totalQuantity: number;
  averagePrice: number;
  finalPrice: number;
  finalValue: number;
  profitAmount: number;
  profitRate: number;
  currency: Currency;
  exchangeRate?: number;
}

type PurchaseCycle = 'daily' | 'weekly' | 'monthly';

export default function RegularPurchaseSimulatorView() {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(Currency.KRW);
  const [purchaseCycle, setPurchaseCycle] = useState<PurchaseCycle>('monthly');
  
  // 통화별 입력값 분리
  const [krwInitialAmount, setKrwInitialAmount] = useState('');
  const [krwRegularAmount, setKrwRegularAmount] = useState('');
  const [krwPeriodCount, setKrwPeriodCount] = useState('');
  const [krwPrices, setKrwPrices] = useState<string[]>(['']);
  
  const [usdInitialAmount, setUsdInitialAmount] = useState('');
  const [usdRegularAmount, setUsdRegularAmount] = useState('');
  const [usdPeriodCount, setUsdPeriodCount] = useState('');
  const [usdPrices, setUsdPrices] = useState<string[]>(['']);
  const [usdExchangeRate, setUsdExchangeRate] = useState('1350');
  
  const [simulation, setSimulation] = useState<RegularPurchaseSimulation | null>(null);
  const [isLoadingExchangeRate, setIsLoadingExchangeRate] = useState(false);
  const [isExchangeRateLoaded, setIsExchangeRateLoaded] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const coupangBannerRef = useRef<CoupangBannerSectionRef>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const resultContainerY = useRef<number>(0);
  
  // 현재 선택된 통화의 입력값 getter
  const initialAmount = selectedCurrency === Currency.KRW ? krwInitialAmount : usdInitialAmount;
  const regularAmount = selectedCurrency === Currency.KRW ? krwRegularAmount : usdRegularAmount;
  const periodCount = selectedCurrency === Currency.KRW ? krwPeriodCount : usdPeriodCount;
  const prices = selectedCurrency === Currency.KRW ? krwPrices : usdPrices;
  const exchangeRate = selectedCurrency === Currency.USD ? usdExchangeRate : '1350';
  
  const setInitialAmount = selectedCurrency === Currency.KRW ? setKrwInitialAmount : setUsdInitialAmount;
  const setRegularAmount = selectedCurrency === Currency.KRW ? setKrwRegularAmount : setUsdRegularAmount;
  const setPeriodCount = selectedCurrency === Currency.KRW ? setKrwPeriodCount : setUsdPeriodCount;
  const setPrices = selectedCurrency === Currency.KRW ? setKrwPrices : setUsdPrices;
  const setExchangeRate = setUsdExchangeRate;

  useEffect(() => {
    if (selectedCurrency === Currency.USD) {
      loadExchangeRate();
    }
  }, [selectedCurrency]);

  useEffect(() => {
    // 기간 수가 변경되면 가격 입력 필드 개수 조정
    const count = parseInt(periodCount) || 0;
    if (count > 0 && count !== prices.length) {
      const newPrices = Array(count).fill('').map((_, i) => prices[i] || '');
      setPrices(newPrices);
    }
  }, [periodCount]);

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

  // 금액 입력 핸들러 (천단위 콤마 자동 추가)
  const handleAmountInputChange = (text: string, setter: (value: string) => void, currency: Currency) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned === '') {
      setter('');
    } else {
      setter(addCommas(cleaned));
    }
  };

  // 기간 수 입력 핸들러
  const handlePeriodCountInputChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setPeriodCount(cleaned);
  };

  // 가격 입력 핸들러 (천단위 콤마 자동 추가)
  const handlePriceInputChange = (text: string, index: number, currency: Currency) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const formatted = parts.length > 2 
      ? parts[0] + '.' + parts.slice(1).join('')
      : cleaned;
    
    const newPrices = [...prices];
    if (currency === Currency.USD) {
      newPrices[index] = formatted === '' || formatted === '.' ? '' : addCommas(formatted);
    } else {
      const integerOnly = formatted.split('.')[0];
      newPrices[index] = integerOnly === '' ? '' : addCommas(integerOnly);
    }
    setPrices(newPrices);
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
      setKrwInitialAmount('');
      setKrwRegularAmount('');
      setKrwPeriodCount('');
      setKrwPrices(['']);
    } else {
      setUsdInitialAmount('');
      setUsdRegularAmount('');
      setUsdPeriodCount('');
      setUsdPrices(['']);
    }
    setSimulation(null);
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

    if (!regularAmount || !periodCount) {
      Alert.alert('입력 오류', '정기 매수 금액과 기간 수를 입력해주세요.');
      return;
    }

    const initialAmountNum = initialAmount ? parseFloat(removeCommas(initialAmount)) : 0;
    const regularAmountNum = parseFloat(removeCommas(regularAmount));
    const periodCountNum = parseInt(periodCount, 10);
    const exchangeRateNum = selectedCurrency === Currency.USD ? parseFloat(removeCommas(usdExchangeRate)) : undefined;

    if (isNaN(regularAmountNum) || regularAmountNum <= 0) {
      Alert.alert('입력 오류', '올바른 정기 매수 금액을 입력하세요.');
      return;
    }

    if (isNaN(periodCountNum) || periodCountNum <= 0) {
      Alert.alert('입력 오류', '올바른 기간 수를 입력하세요.');
      return;
    }

    if (periodCountNum > 50) {
      Alert.alert('입력 오류', '기간 수는 50개 이하여야 합니다.');
      return;
    }

    // 가격 입력 검증
    const priceValues: number[] = [];
    for (let i = 0; i < periodCountNum; i++) {
      const priceStr = prices[i] || '';
      if (!priceStr) {
        Alert.alert('입력 오류', `모든 기간의 주가를 입력해주세요. (${i + 1}번째 기간)`);
        return;
      }
      const priceNum = parseFloat(removeCommas(priceStr));
      if (isNaN(priceNum) || priceNum <= 0) {
        Alert.alert('입력 오류', `올바른 주가를 입력하세요. (${i + 1}번째 기간)`);
        return;
      }
      priceValues.push(priceNum);
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

    // 각 기간별 매수 계산
    const periods: RegularPurchasePeriod[] = [];
    let totalInvestment = initialAmountNum;
    let totalQuantity = 0;

    // 초기 투자금이 있으면 첫 번째 기간 가격으로 매수
    if (initialAmountNum > 0 && priceValues.length > 0) {
      const initialQuantity = initialAmountNum / priceValues[0];
      totalQuantity += initialQuantity;
      periods.push({
        price: priceValues[0],
        purchaseAmount: initialAmountNum,
        quantity: initialQuantity,
      });
    }

    // 정기 매수 계산
    for (let i = 0; i < periodCountNum; i++) {
      const price = priceValues[i];
      const quantity = regularAmountNum / price;
      totalQuantity += quantity;
      totalInvestment += regularAmountNum;
      
      periods.push({
        price,
        purchaseAmount: regularAmountNum,
        quantity,
      });
    }

    // 평균 매수가 계산
    const averagePrice = totalInvestment / totalQuantity;
    
    // 최종 가격 (마지막 기간의 가격)
    const finalPrice = priceValues[priceValues.length - 1];
    
    // 최종 평가액
    const finalValue = finalPrice * totalQuantity;
    
    // 수익금
    const profitAmount = finalValue - totalInvestment;
    
    // 수익률
    const profitRate = totalInvestment > 0 ? (profitAmount / totalInvestment) * 100 : 0;

    const newSimulation: RegularPurchaseSimulation = {
      initialAmount: initialAmountNum,
      regularAmount: regularAmountNum,
      periodCount: periodCountNum,
      periods,
      totalInvestment,
      totalQuantity,
      averagePrice,
      finalPrice,
      finalValue,
      profitAmount,
      profitRate,
      currency: selectedCurrency,
      exchangeRate: exchangeRateNum,
    };

    setSimulation(newSimulation);
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
    if (!simulation) return;

    const cycleText = purchaseCycle === 'daily' ? '매일' : purchaseCycle === 'weekly' ? '매주' : '매월';

    const buffer: string[] = [];
    buffer.push('정기 매수 시뮬레이션 결과\n');
    buffer.push(`매수 주기: ${cycleText}`);
    if (simulation.initialAmount > 0) {
      buffer.push(`초기 투자금: ${formatCurrency(simulation.initialAmount, simulation.currency)}`);
    }
    buffer.push(`정기 매수 금액: ${formatCurrency(simulation.regularAmount, simulation.currency)}`);
    buffer.push(`매수 기간 수: ${simulation.periodCount}개`);
    buffer.push(`총 투자금액: ${formatCurrency(simulation.totalInvestment, simulation.currency)}`);
    buffer.push(`총 매수 수량: ${addCommas(simulation.totalQuantity.toFixed(2))}주`);
    buffer.push(`평균 매수가: ${formatNumber(simulation.averagePrice, simulation.currency)}`);
    buffer.push(`최종 주가: ${formatNumber(simulation.finalPrice, simulation.currency)}`);
    buffer.push(`최종 평가액: ${formatCurrency(simulation.finalValue, simulation.currency)}`);
    buffer.push(`수익률: ${simulation.profitRate >= 0 ? '+' : ''}${simulation.profitRate.toFixed(2)}%`);
    buffer.push(`수익금: ${formatCurrency(simulation.profitAmount, simulation.currency)}`);
    buffer.push('');
    buffer.push('만든 사람: 네오비저닝');

    const text = buffer.join('\n');

    try {
      await Share.share({
        message: text,
        title: '정기 매수 시뮬레이션 결과',
      });
    } catch (e) {
      console.error('텍스트 공유에 실패했습니다:', e);
      Alert.alert('공유 오류', '텍스트 공유에 실패했습니다.');
    }
  };

  const getCycleText = (cycle: PurchaseCycle): string => {
    switch (cycle) {
      case 'daily':
        return '매일';
      case 'weekly':
        return '매주';
      case 'monthly':
        return '매월';
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
              setSimulation(null);
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
            placeholder="초기 투자금 (선택)"
            placeholderTextColor="#757575"
            value={initialAmount}
            onChangeText={(text) => handleAmountInputChange(text, setInitialAmount, selectedCurrency)}
            keyboardType="numeric"
          />
          <Text style={styles.helperText}>첫 번째 기간에 투자할 금액 (선택사항)</Text>

          <TextInput
            style={styles.input}
            placeholder={
              selectedCurrency === Currency.USD
                ? '정기 매수 금액 (USD)'
                : '정기 매수 금액 (원)'
            }
            placeholderTextColor="#757575"
            value={regularAmount}
            onChangeText={(text) => handleAmountInputChange(text, setRegularAmount, selectedCurrency)}
            keyboardType="numeric"
          />
          <Text style={styles.helperText}>각 기간마다 매수할 금액</Text>

          <View style={styles.cycleSelector}>
            <Text style={styles.cycleLabel}>매수 주기:</Text>
            <View style={styles.cycleButtons}>
              <TouchableOpacity
                style={[styles.cycleButton, purchaseCycle === 'daily' && styles.cycleButtonActive]}
                onPress={() => setPurchaseCycle('daily')}
              >
                <Text style={[styles.cycleButtonText, purchaseCycle === 'daily' && styles.cycleButtonTextActive]}>
                  매일
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cycleButton, purchaseCycle === 'weekly' && styles.cycleButtonActive]}
                onPress={() => setPurchaseCycle('weekly')}
              >
                <Text style={[styles.cycleButtonText, purchaseCycle === 'weekly' && styles.cycleButtonTextActive]}>
                  매주
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cycleButton, purchaseCycle === 'monthly' && styles.cycleButtonActive]}
                onPress={() => setPurchaseCycle('monthly')}
              >
                <Text style={[styles.cycleButtonText, purchaseCycle === 'monthly' && styles.cycleButtonTextActive]}>
                  매월
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TextInput
            style={styles.input}
            placeholder="기간 수"
            placeholderTextColor="#757575"
            value={periodCount}
            onChangeText={handlePeriodCountInputChange}
            keyboardType="numeric"
          />
          <Text style={styles.helperText}>예: 12 (12개월, 12주, 12일)</Text>

          {parseInt(periodCount) > 0 && (
            <View style={styles.pricesContainer}>
              <Text style={styles.pricesTitle}>각 기간별 주가 입력</Text>
              {Array.from({ length: parseInt(periodCount) || 0 }).map((_, index) => (
                <View key={index} style={styles.priceInputRow}>
                  <Text style={styles.priceLabel}>{index + 1}기간:</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder={
                      selectedCurrency === Currency.USD
                        ? '주가 (USD)'
                        : '주가 (원)'
                    }
                    placeholderTextColor="#757575"
                    value={prices[index] || ''}
                    onChangeText={(text) => handlePriceInputChange(text, index, selectedCurrency)}
                    keyboardType="numeric"
                  />
                </View>
              ))}
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
                <Text style={styles.calculateButtonText}>시뮬레이션 실행</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.resetButton} onPress={reset}>
              <Text style={styles.resetButtonText}>초기화</Text>
            </TouchableOpacity>
          </View>
        </View>

        {simulation && (
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
                <Text style={styles.resultTitle}>정기 매수 시뮬레이션 결과</Text>
                <Text style={styles.resultSubtitle}>매수 주기: {getCycleText(purchaseCycle)}</Text>
              </View>

              <View style={styles.resultGrid}>
                <View style={styles.gridRow}>
                  <View style={styles.gridItem}>
                    <CalculationResultCard
                      title="총 투자금액"
                      value={
                        formatCurrency(simulation.totalInvestment, simulation.currency) +
                        (simulation.exchangeRate
                          ? getKrwEquivalent(simulation.totalInvestment, simulation.exchangeRate) || ''
                          : '')
                      }
                    />
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={styles.gridItem}>
                    <CalculationResultCard
                      title="총 매수 수량"
                      value={`${addCommas(simulation.totalQuantity.toFixed(2))}주`}
                    />
                  </View>
                </View>
                <View style={styles.gridRow}>
                  <View style={styles.gridItem}>
                    <CalculationResultCard
                      title="평균 매수가"
                      value={
                        formatNumber(simulation.averagePrice, simulation.currency) +
                        (simulation.exchangeRate
                          ? getKrwEquivalent(simulation.averagePrice, simulation.exchangeRate) || ''
                          : '')
                      }
                      valueColor="#FFD700"
                    />
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={styles.gridItem}>
                    <CalculationResultCard
                      title="최종 주가"
                      value={
                        formatNumber(simulation.finalPrice, simulation.currency) +
                        (simulation.exchangeRate
                          ? getKrwEquivalent(simulation.finalPrice, simulation.exchangeRate) || ''
                          : '')
                      }
                    />
                  </View>
                </View>
              </View>

              <View style={styles.resultCardsVertical}>
                <CalculationResultCard
                  title="최종 평가액"
                  value={
                    formatCurrency(simulation.finalValue, simulation.currency) +
                    (simulation.exchangeRate
                      ? getKrwEquivalent(simulation.finalValue, simulation.exchangeRate) || ''
                      : '')
                  }
                />
                <View style={{ height: 12 }} />
                <CalculationResultCard
                  title="수익률"
                  value={`${simulation.profitRate >= 0 ? '+' : ''}${simulation.profitRate.toFixed(2)}%`}
                  valueColor={simulation.profitRate >= 0 ? '#4CAF50' : '#EF5350'}
                />
                <View style={{ height: 12 }} />
                <CalculationResultCard
                  title="수익금"
                  value={
                    formatCurrency(simulation.profitAmount, simulation.currency) +
                    (simulation.exchangeRate
                      ? getKrwEquivalent(simulation.profitAmount, simulation.exchangeRate) || ''
                      : '')
                  }
                  valueColor={simulation.profitAmount >= 0 ? '#4CAF50' : '#EF5350'}
                />
              </View>
            </SharedResultSection>
          </Animated.View>
        )}

        {simulation && <CoupangBannerSection ref={coupangBannerRef} />}
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
  cycleSelector: {
    marginBottom: 16,
  },
  cycleLabel: {
    fontSize: 14,
    color: '#B0BEC5',
    marginBottom: 8,
  },
  cycleButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  cycleButton: {
    flex: 1,
    backgroundColor: 'rgba(27, 38, 59, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleButtonActive: {
    backgroundColor: 'rgba(66, 165, 245, 0.3)',
    borderColor: 'rgba(66, 165, 245, 0.5)',
  },
  cycleButtonText: {
    fontSize: 14,
    color: '#B0BEC5',
    fontWeight: '500',
  },
  cycleButtonTextActive: {
    color: '#42A5F5',
    fontWeight: 'bold',
  },
  pricesContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  pricesTitle: {
    fontSize: 14,
    color: '#B0BEC5',
    marginBottom: 12,
    fontWeight: '600',
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 14,
    color: '#B0BEC5',
    width: 60,
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    backgroundColor: 'rgba(27, 38, 59, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
    padding: 12,
    color: '#FFFFFF',
    fontSize: 15,
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
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#B0BEC5',
    marginTop: 4,
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











