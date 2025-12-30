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
import { AveragingCalculation } from '../src/models/AveragingCalculation';
import { SettingsService } from '../src/services/SettingsService';
import { ExchangeRateService } from '../src/services/ExchangeRateService';
import { CurrencySwitch } from '../src/components/CurrencySwitch';
import { CalculationResultCard } from '../src/components/CalculationResultCard';
import { SharedResultSection } from '../src/components/SharedResultSection';
import { CoupangBannerSection, CoupangBannerSectionRef } from '../src/components/CoupangBannerSection';
import { formatCurrency, formatNumber, getKrwEquivalent, addCommas } from '../src/utils/formatUtils';
import { Share } from 'react-native';

export default function AveragingCalculatorView() {
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
  const coupangBannerRef = useRef<CoupangBannerSectionRef>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const resultOpacity = useRef(new Animated.Value(0)).current;
  
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

    const currentAveragePriceNum = parseFloat(currentAveragePrice);
    const currentQuantityNum = parseInt(currentQuantity, 10);
    const additionalBuyPriceNum = parseFloat(additionalBuyPrice);
    const additionalQuantityNum = parseInt(additionalQuantity, 10);
    const exchangeRateNum = selectedCurrency === Currency.USD ? parseFloat(usdExchangeRate) : undefined;

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

    setCalculationHistory([...calculationHistory, newCalculation]);
    setIsCalculating(false);
    
    // 통화별로 추가 매수 정보 초기화
    if (selectedCurrency === Currency.KRW) {
      setKrwAdditionalBuyPrice('');
      setKrwAdditionalQuantity('');
    } else {
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

    // 5. 화면 자동 스크롤
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const continueAveraging = () => {
    if (calculationHistory.length === 0) return;

    const lastCalc = calculationHistory[calculationHistory.length - 1];
    if (selectedCurrency === Currency.KRW) {
      setKrwCurrentAveragePrice(lastCalc.newAveragePriceWithoutFee.toFixed(2));
      setKrwCurrentQuantity(lastCalc.newTotalQuantity.toString());
      setKrwAdditionalBuyPrice('');
      setKrwAdditionalQuantity('');
    } else {
      setUsdCurrentAveragePrice(lastCalc.newAveragePriceWithoutFee.toFixed(2));
      setUsdCurrentQuantity(lastCalc.newTotalQuantity.toString());
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
                onChangeText={setExchangeRate}
                keyboardType="numeric"
              />
              <Text style={styles.helperText}>예: 1350 (1달러 = 1350원)</Text>
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
            onChangeText={setCurrentAveragePrice}
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
            onChangeText={setCurrentQuantity}
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
            onChangeText={setAdditionalBuyPrice}
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
            onChangeText={setAdditionalQuantity}
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
                        </View>
                        <View key={`${baseKey}-spacer-1`} style={{ width: 12 }} />
                        <View style={styles.gridItem}>
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
                      </View>
                      <View key={`${baseKey}-grid-row-2`} style={styles.gridRow}>
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
                        <View key={`${baseKey}-spacer-2`} style={{ width: 12 }} />
                        <View style={styles.gridItem}>
                          <CalculationResultCard
                            key={`${baseKey}-price-change`}
                            title="평단 변화량"
                            value={
                              (calc.averagePriceChange !== 0 ? (calc.averagePriceChange > 0 ? '↑ ' : '↓ ') : '') +
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
                            key={`${baseKey}-change-rate`}
                            title="평단 변화율"
                            value={`${calc.averagePriceChangeRate !== 0 ? (calc.averagePriceChangeRate > 0 ? '↑ ' : '↓ ') : ''}${Math.abs(calc.averagePriceChangeRate).toFixed(2)}%`}
                            valueColor={calc.averagePriceChangeRate >= 0 ? '#EF5350' : '#42A5F5'}
                          />
                        </View>
                        <View key={`${baseKey}-spacer-3`} style={{ width: 12 }} />
                        <View style={styles.gridItem}>
                          <CalculationResultCard
                            key={`${baseKey}-current-qty`}
                            title="기존 매수 수량"
                            value={`${addCommas(calc.currentQuantity.toString())}주`}
                          />
                        </View>
                      </View>
                      <View key={`${baseKey}-grid-row-4`} style={styles.gridRow}>
                        <View style={styles.gridItem}>
                          <CalculationResultCard
                            key={`${baseKey}-additional-qty`}
                            title="추가 매수 수량"
                            value={`${addCommas(calc.additionalQuantity.toString())}주`}
                          />
                        </View>
                        <View key={`${baseKey}-spacer-4`} style={{ width: 12 }} />
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
});

