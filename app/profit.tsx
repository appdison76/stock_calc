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
import * as Haptics from 'expo-haptics';
import { Currency } from '../src/models/Currency';
import { ProfitCalculation } from '../src/models/ProfitCalculation';
import { SettingsService } from '../src/services/SettingsService';
import { ExchangeRateService } from '../src/services/ExchangeRateService';
import { CurrencySwitch } from '../src/components/CurrencySwitch';
import { CalculationResultCard } from '../src/components/CalculationResultCard';
import { SharedResultSection } from '../src/components/SharedResultSection';
import { CoupangBannerSection, CoupangBannerSectionRef } from '../src/components/CoupangBannerSection';
import { formatCurrency, formatNumber, getKrwEquivalent } from '../src/utils/formatUtils';
import { Share } from 'react-native';

export default function ProfitCalculatorView() {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(Currency.KRW);
  
  // 통화별 입력값 분리
  const [krwBuyPrice, setKrwBuyPrice] = useState('');
  const [krwSellPrice, setKrwSellPrice] = useState('');
  const [krwQuantity, setKrwQuantity] = useState('');
  
  const [usdBuyPrice, setUsdBuyPrice] = useState('');
  const [usdSellPrice, setUsdSellPrice] = useState('');
  const [usdQuantity, setUsdQuantity] = useState('');
  const [usdExchangeRate, setUsdExchangeRate] = useState('1350');
  
  const [calculation, setCalculation] = useState<ProfitCalculation | null>(null);
  const [isLoadingExchangeRate, setIsLoadingExchangeRate] = useState(false);
  const [isExchangeRateLoaded, setIsExchangeRateLoaded] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const coupangBannerRef = useRef<CoupangBannerSectionRef>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const resultOpacity = useRef(new Animated.Value(0)).current;
  
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
      setKrwBuyPrice('');
      setKrwSellPrice('');
      setKrwQuantity('');
    } else {
      setUsdBuyPrice('');
      setUsdSellPrice('');
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
        // Android에서는 Vibration API 사용
        Vibration.vibrate(50);
      }
    } catch (e) {
      // 진동 피드백 실패 시 무시
      console.log('Haptic feedback not available');
    }

    if (!buyPrice || !sellPrice || !quantity) {
      Alert.alert('입력 오류', '모든 필드를 입력해주세요.');
      return;
    }

    const buyPriceNum = parseFloat(buyPrice);
    const sellPriceNum = parseFloat(sellPrice);
    const quantityNum = parseInt(quantity, 10);
    const exchangeRateNum = selectedCurrency === Currency.USD ? parseFloat(usdExchangeRate) : undefined;

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

    // 3. 로딩 상태 시작
    setIsCalculating(true);
    resultOpacity.setValue(0);

    // 계산 처리 (0.5초 지연)
    await new Promise(resolve => setTimeout(resolve, 500));

    const taxRate = await SettingsService.getTaxRate(selectedCurrency);
    const feeRate = await SettingsService.getFeeRate(selectedCurrency);

    const newCalculation = new ProfitCalculation({
      buyPrice: buyPriceNum,
      sellPrice: sellPriceNum,
      quantity: quantityNum,
      taxRate,
      feeRate,
      currency: selectedCurrency,
      exchangeRate: exchangeRateNum,
    });

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
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const shareResultAsText = async () => {
    if (!calculation) return;

    const buffer: string[] = [];
    buffer.push('수익률 계산 결과\n');
    buffer.push(`매수가: ${formatCurrency(calculation.buyPrice, calculation.currency)}`);
    buffer.push(`매도가: ${formatCurrency(calculation.sellPrice, calculation.currency)}`);
    buffer.push(`수량: ${calculation.quantity}주`);
    buffer.push(`거래세: ${calculation.taxRate}%`);
    buffer.push(`수수료: ${calculation.feeRate}%`);
    if (calculation.exchangeRate) {
      buffer.push(`환율: ${calculation.exchangeRate.toFixed(2)}`);
    }
    buffer.push('');
    buffer.push(`순수익: ${formatCurrency(calculation.netProfit, calculation.currency)}`);
    buffer.push(`수익률: ${calculation.profitRate.toFixed(2)}%`);
    buffer.push(`총 매수 금액: ${formatCurrency(calculation.totalBuyAmount, calculation.currency)}`);
    buffer.push(`총 매도 금액: ${formatCurrency(calculation.totalSellAmount, calculation.currency)}`);
    buffer.push(`총 비용: ${formatCurrency(calculation.buyFee, calculation.currency)}`);
    buffer.push(`손익분기점: ${formatNumber(calculation.breakEvenPrice, calculation.currency)}`);
    buffer.push('');
    buffer.push('만든 사람: 네오비저닝');

    const text = buffer.join('\n');

    try {
      await Share.share({
        message: text,
        title: '수익률 계산 결과',
      });
    } catch (e) {
      console.error('텍스트 공유에 실패했습니다:', e);
      Alert.alert('공유 오류', '텍스트 공유에 실패했습니다.');
    }
  };

  const getKrwEquivalentDisplay = (usdValue: number): string | null => {
    if (selectedCurrency === Currency.USD && calculation?.exchangeRate) {
      return getKrwEquivalent(usdValue, calculation.exchangeRate);
    }
    return null;
  };

  const animatedStyle = {
    opacity: resultOpacity,
    transform: [
      {
        translateY: resultOpacity.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      },
    ],
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
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
              // 통화 전환 시 계산 결과만 초기화 (입력값은 유지)
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
          <Text style={styles.cardTitle}>매매 정보</Text>

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
            placeholder={selectedCurrency === Currency.USD ? '매수가 (USD)' : '매수가 (원)'}
            placeholderTextColor="#757575"
            value={buyPrice}
            onChangeText={setBuyPrice}
            keyboardType="numeric"
          />
          {selectedCurrency === Currency.USD &&
            buyPrice &&
            !isNaN(parseFloat(buyPrice)) &&
            getKrwEquivalentDisplay(parseFloat(buyPrice)) && (
              <Text style={styles.helperText}>
                {getKrwEquivalentDisplay(parseFloat(buyPrice))}
              </Text>
            )}

          <TextInput
            style={styles.input}
            placeholder={selectedCurrency === Currency.USD ? '매도가 (USD)' : '매도가 (원)'}
            placeholderTextColor="#757575"
            value={sellPrice}
            onChangeText={setSellPrice}
            keyboardType="numeric"
          />
          {selectedCurrency === Currency.USD &&
            sellPrice &&
            !isNaN(parseFloat(sellPrice)) &&
            getKrwEquivalentDisplay(parseFloat(sellPrice)) && (
              <Text style={styles.helperText}>
                {getKrwEquivalentDisplay(parseFloat(sellPrice))}
              </Text>
            )}

          <TextInput
            style={styles.input}
            placeholder="수량 (주)"
            placeholderTextColor="#757575"
            value={quantity}
            onChangeText={setQuantity}
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
                <Text style={styles.calculateButtonText}>계산하기</Text>
              )}
            </TouchableOpacity>
            <View style={{ width: 12 }} />
            <TouchableOpacity style={styles.resetButton} onPress={reset}>
              <Text style={styles.resetButtonText}>초기화</Text>
            </TouchableOpacity>
          </View>
        </View>

        {calculation && (
          <Animated.View
            style={[styles.resultContainer, animatedStyle]}
          >
            <SharedResultSection
              watermarkText="만든 사람: 네오비저닝"
              onTextShare={shareResultAsText}
            >
              <Text style={styles.resultTitle}>계산 결과</Text>
              <View style={styles.resultCards}>
                <CalculationResultCard
                  key="net-profit"
                  title="순수익"
                  value={`${formatCurrency(calculation.netProfit, calculation.currency)}${getKrwEquivalentDisplay(calculation.netProfit) || ''}`}
                  valueColor={calculation.netProfit >= 0 ? '#EF5350' : '#42A5F5'}
                  icon={calculation.netProfit >= 0 ? '📈' : '📉'}
                />
                <View key="spacer-1" style={{ height: 12 }} />
                <CalculationResultCard
                  key="profit-rate"
                  title="수익률"
                  value={`${calculation.profitRate.toFixed(2)}%`}
                  valueColor={calculation.profitRate >= 0 ? '#EF5350' : '#42A5F5'}
                  icon="%"
                />
                <View key="spacer-2" style={{ height: 12 }} />
                <CalculationResultCard
                  key="total-buy-amount"
                  title="총 매수 금액"
                  value={`${formatCurrency(calculation.totalBuyAmount, calculation.currency)}${getKrwEquivalentDisplay(calculation.totalBuyAmount) || ''}`}
                  icon="🛒"
                />
                <View key="spacer-3" style={{ height: 12 }} />
                <CalculationResultCard
                  key="total-sell-amount"
                  title="총 매도 금액"
                  value={`${formatCurrency(calculation.totalSellAmount, calculation.currency)}${getKrwEquivalentDisplay(calculation.totalSellAmount) || ''}`}
                  icon="💰"
                />
                <View key="spacer-4" style={{ height: 12 }} />
                <CalculationResultCard
                  key="total-cost"
                  title="총 비용"
                  value={`${formatCurrency(calculation.buyFee, calculation.currency)}${getKrwEquivalentDisplay(calculation.buyFee) || ''}`}
                  icon="💳"
                />
                <View key="spacer-5" style={{ height: 12 }} />
                <CalculationResultCard
                  key="break-even"
                  title="손익분기점"
                  value={formatNumber(calculation.breakEvenPrice, calculation.currency)}
                  icon="⚖️"
                />
              </View>
            </SharedResultSection>

            <CoupangBannerSection ref={coupangBannerRef} />
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
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
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#424242',
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
    backgroundColor: '#2C2C2C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#616161',
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
    marginTop: 8,
  },
  calculateButton: {
    flex: 1,
    backgroundColor: '#1976D2',
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
    borderColor: '#757575',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    color: '#BDBDBD',
    fontSize: 16,
  },
  resultContainer: {
    marginBottom: 24,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  resultCards: {
  },
});

