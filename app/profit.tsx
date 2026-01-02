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
import { ProfitCalculation } from '../src/models/ProfitCalculation';
import { SettingsService } from '../src/services/SettingsService';
import { ExchangeRateService } from '../src/services/ExchangeRateService';
import { CurrencySwitch } from '../src/components/CurrencySwitch';
import { CalculationResultCard } from '../src/components/CalculationResultCard';
import { SharedResultSection } from '../src/components/SharedResultSection';
import { CoupangBannerSection, CoupangBannerSectionRef } from '../src/components/CoupangBannerSection';
import { formatCurrency, formatNumber, getKrwEquivalent, addCommas } from '../src/utils/formatUtils';
import { Share } from 'react-native';

export default function ProfitCalculatorView() {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(Currency.KRW);
  
  // 통화별 입력값 분리
  const [krwBuyPrice, setKrwBuyPrice] = useState('');
  const [krwSellPrice, setKrwSellPrice] = useState('');
  const [krwProfitRate, setKrwProfitRate] = useState(''); // 수익률 입력값
  const [krwQuantity, setKrwQuantity] = useState('');
  
  const [usdBuyPrice, setUsdBuyPrice] = useState('');
  const [usdSellPrice, setUsdSellPrice] = useState('');
  const [usdProfitRate, setUsdProfitRate] = useState(''); // 수익률 입력값
  const [usdQuantity, setUsdQuantity] = useState('');
  const [usdExchangeRate, setUsdExchangeRate] = useState('1350');
  
  const [calculation, setCalculation] = useState<ProfitCalculation | null>(null);
  const [isLoadingExchangeRate, setIsLoadingExchangeRate] = useState(false);
  const [isExchangeRateLoaded, setIsExchangeRateLoaded] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const coupangBannerRef = useRef<CoupangBannerSectionRef>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const resultTitleRef = useRef<View>(null);
  const resultContainerY = useRef<number>(0);
  
  // 현재 선택된 통화의 입력값 getter
  const buyPrice = selectedCurrency === Currency.KRW ? krwBuyPrice : usdBuyPrice;
  const sellPrice = selectedCurrency === Currency.KRW ? krwSellPrice : usdSellPrice;
  const profitRate = selectedCurrency === Currency.KRW ? krwProfitRate : usdProfitRate;
  const quantity = selectedCurrency === Currency.KRW ? krwQuantity : usdQuantity;
  const exchangeRate = selectedCurrency === Currency.USD ? usdExchangeRate : '1350';
  
  const setBuyPrice = selectedCurrency === Currency.KRW ? setKrwBuyPrice : setUsdBuyPrice;
  const setSellPrice = selectedCurrency === Currency.KRW ? setKrwSellPrice : setUsdSellPrice;
  const setProfitRate = selectedCurrency === Currency.KRW ? setKrwProfitRate : setUsdProfitRate;
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

  // 가격 입력 핸들러 (천단위 콤마 자동 추가, 매도가 입력 시 수익률 자동 계산)
  const handlePriceInputChange = async (text: string, setter: (value: string) => void, currency: Currency, isSellPrice: boolean = false) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const formatted = parts.length > 2 
      ? parts[0] + '.' + parts.slice(1).join('')
      : cleaned;
    
    if (formatted === '' || formatted === '.') {
      setter(formatted);
      if (isSellPrice) {
        setProfitRate('');
      }
      return;
    }

    if (currency === Currency.USD) {
      setter(addCommas(formatted));
    } else {
      const integerOnly = formatted.split('.')[0];
      if (integerOnly === '') {
        setter('');
        if (isSellPrice) {
          setProfitRate('');
        }
        return;
      } else {
        setter(addCommas(integerOnly));
      }
    }
    
    // 매도가 입력 시 수익률 자동 계산 (수량은 내부적으로 1 사용)
    if (isSellPrice && buyPrice) {
      const sellPriceNum = parseFloat(removeCommas(formatted));
      if (!isNaN(sellPriceNum) && sellPriceNum > 0) {
        try {
          const taxRate = await SettingsService.getTaxRate(selectedCurrency);
          const feeRate = await SettingsService.getFeeRate(selectedCurrency);
          const buyPriceNum = parseFloat(removeCommas(buyPrice));
          const quantityNum = quantity ? parseInt(removeCommas(quantity), 10) : 1;
          
          if (buyPriceNum > 0 && quantityNum > 0) {
            const tempCalc = new ProfitCalculation({
              buyPrice: buyPriceNum,
              sellPrice: sellPriceNum,
              quantity: quantityNum,
              taxRate,
              feeRate,
              currency: selectedCurrency,
            });
            
            const calculatedProfitRate = tempCalc.profitRate;
            // 수익률에 천단위 콤마 적용 (소수점 앞 정수 부분에만)
            const profitRateStr = calculatedProfitRate.toFixed(2);
            const isNegative = calculatedProfitRate < 0;
            const absValue = Math.abs(calculatedProfitRate);
            const parts = profitRateStr.split('.');
            const integerPart = parts[0].replace('-', '');
            const decimalPart = parts[1] ? '.' + parts[1] : '';
            const integerWithCommas = addCommas(integerPart);
            const profitRateWithCommas = (isNegative ? '-' : '') + integerWithCommas + decimalPart;
            setProfitRate(profitRateWithCommas);
          }
        } catch (error) {
          console.error('수익률 계산 오류:', error);
        }
      }
    }
    
    // 매수가 입력 시: 수익률이 입력되어 있으면 매도가 계산, 매도가가 입력되어 있으면 수익률 계산
    if (!isSellPrice) {
      const buyPriceNum = parseFloat(removeCommas(formatted));
      if (!isNaN(buyPriceNum) && buyPriceNum > 0) {
        try {
          const taxRate = await SettingsService.getTaxRate(selectedCurrency);
          const feeRate = await SettingsService.getFeeRate(selectedCurrency);
          
          // 수익률이 입력되어 있으면 매도가 계산
          if (profitRate) {
            const cleanedProfitRate = removeCommas(profitRate.replace('-', ''));
            const profitRateNum = parseFloat(cleanedProfitRate);
            const profitRateValue = profitRate.startsWith('-') ? -profitRateNum : profitRateNum;
            if (!isNaN(profitRateValue)) {
              const calculatedSellPrice = buyPriceNum * (1 + feeRate / 100) * (1 + profitRateValue / 100) / (1 - feeRate / 100 - taxRate / 100);
              if (selectedCurrency === Currency.USD) {
                setSellPrice(addCommas(calculatedSellPrice.toFixed(2)));
              } else {
                setSellPrice(addCommas(Math.round(calculatedSellPrice).toString()));
              }
            }
          }
          // 수익률이 없고 매도가가 입력되어 있으면 수익률 계산
          else if (sellPrice) {
            const sellPriceNum = parseFloat(removeCommas(sellPrice));
            if (!isNaN(sellPriceNum) && sellPriceNum > 0) {
              const quantityNum = quantity ? parseInt(removeCommas(quantity), 10) : 1;
              const tempCalc = new ProfitCalculation({
                buyPrice: buyPriceNum,
                sellPrice: sellPriceNum,
                quantity: quantityNum,
                taxRate,
                feeRate,
                currency: selectedCurrency,
              });
              
              const calculatedProfitRate = tempCalc.profitRate;
              // 수익률에 천단위 콤마 적용 (소수점 앞 정수 부분에만)
              const profitRateStr = calculatedProfitRate.toFixed(2);
              const isNegative = calculatedProfitRate < 0;
              const absValue = Math.abs(calculatedProfitRate);
              const parts = profitRateStr.split('.');
              const integerPart = parts[0].replace('-', '');
              const decimalPart = parts[1] ? '.' + parts[1] : '';
              const integerWithCommas = addCommas(integerPart);
              const profitRateWithCommas = (isNegative ? '-' : '') + integerWithCommas + decimalPart;
              setProfitRate(profitRateWithCommas);
            }
          }
        } catch (error) {
          console.error('매수가 변경 시 계산 오류:', error);
        }
      }
    }
  };

  // 수익률 입력 핸들러 (소수점 허용, 음수 허용, 천단위 콤마 자동 추가)
  const handleProfitRateInputChange = async (text: string, setter: (value: string) => void) => {
    const cleaned = text.replace(/[^0-9.-]/g, '');
    const parts = cleaned.split('.');
    const formatted = parts.length > 2 
      ? parts[0] + '.' + parts.slice(1).join('')
      : cleaned;
    
    // 음수는 맨 앞에만 허용
    let finalValue = formatted.replace(/(?!^)-/g, '');
    
    // 천단위 콤마 적용 (소수점 앞 정수 부분에만)
    if (finalValue && finalValue !== '-') {
      const isNegative = finalValue.startsWith('-');
      const valueWithoutSign = isNegative ? finalValue.substring(1) : finalValue;
      const decimalParts = valueWithoutSign.split('.');
      const integerPart = decimalParts[0];
      const decimalPart = decimalParts[1] ? '.' + decimalParts[1] : '';
      
      if (integerPart) {
        const integerWithCommas = addCommas(integerPart);
        finalValue = (isNegative ? '-' : '') + integerWithCommas + decimalPart;
      }
    }
    
    setter(finalValue);
    
    // 수익률 입력 시 매도가 자동 계산 (수량은 내부적으로 1 사용)
    if (finalValue && buyPrice) {
      const profitRateNum = parseFloat(removeCommas(finalValue.replace('-', '')));
      const profitRateValue = finalValue.startsWith('-') ? -profitRateNum : profitRateNum;
      if (!isNaN(profitRateValue)) {
        try {
          const taxRate = await SettingsService.getTaxRate(selectedCurrency);
          const feeRate = await SettingsService.getFeeRate(selectedCurrency);
          const buyPriceNum = parseFloat(removeCommas(buyPrice));
          
          if (buyPriceNum > 0) {
            // 수익률로부터 매도가 계산 (수량과 무관하므로 수량 1 기준)
            // sellPrice = buyPrice * (1 + buyFeeRate) * (1 + profitRate / 100) / (1 - sellFeeRate - taxRate)
            const calculatedSellPrice = buyPriceNum * (1 + feeRate / 100) * (1 + profitRateValue / 100) / (1 - feeRate / 100 - taxRate / 100);
            
            if (selectedCurrency === Currency.USD) {
              setSellPrice(addCommas(calculatedSellPrice.toFixed(2)));
            } else {
              setSellPrice(addCommas(Math.round(calculatedSellPrice).toString()));
            }
          }
        } catch (error) {
          console.error('수익률 계산 오류:', error);
        }
      }
    } else if (!finalValue) {
      // 수익률이 비워지면 매도가도 비움
      setSellPrice('');
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
      setKrwBuyPrice('');
      setKrwSellPrice('');
      setKrwProfitRate('');
      setKrwQuantity('');
    } else {
      setUsdBuyPrice('');
      setUsdSellPrice('');
      setUsdProfitRate('');
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

    if (!buyPrice || !quantity) {
      Alert.alert('입력 오류', '매수가와 수량을 입력해주세요.');
      return;
    }
    
    // 매도가와 수익률 중 하나는 반드시 입력해야 함
    if (!sellPrice && !profitRate) {
      Alert.alert('입력 오류', '매도가 또는 수익률 중 하나를 입력해주세요.');
      return;
    }

    const buyPriceNum = parseFloat(removeCommas(buyPrice));
    let sellPriceNum = sellPrice ? parseFloat(removeCommas(sellPrice)) : NaN;
    const profitRateNum = profitRate ? parseFloat(removeCommas(profitRate.replace('-', ''))) * (profitRate.startsWith('-') ? -1 : 1) : NaN;
    const quantityNum = parseInt(removeCommas(quantity), 10);
    const exchangeRateNum = selectedCurrency === Currency.USD ? parseFloat(removeCommas(usdExchangeRate)) : undefined;

    if (isNaN(buyPriceNum) || buyPriceNum <= 0) {
      Alert.alert('입력 오류', '올바른 매수가를 입력하세요.');
      return;
    }

    if (isNaN(quantityNum) || quantityNum <= 0) {
      Alert.alert('입력 오류', '올바른 수량을 입력하세요.');
      return;
    }
    
    // 수익률이 입력되었고 매도가가 없으면 매도가 계산
    if (!isNaN(profitRateNum) && (isNaN(sellPriceNum) || sellPriceNum <= 0)) {
      const taxRate = await SettingsService.getTaxRate(selectedCurrency);
      const feeRate = await SettingsService.getFeeRate(selectedCurrency);
      sellPriceNum = buyPriceNum * (1 + feeRate / 100) * (1 + profitRateNum / 100) / (1 - feeRate / 100 - taxRate / 100);
    }
    
    if (isNaN(sellPriceNum) || sellPriceNum <= 0) {
      Alert.alert('입력 오류', '올바른 매도가 또는 수익률을 입력하세요.');
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

    // 5. 화면 자동 스크롤 (계산 결과 타이틀로)
    setTimeout(() => {
      if (resultContainerY.current > 0) {
        scrollViewRef.current?.scrollTo({ y: resultContainerY.current - 50, animated: true });
      } else {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }
    }, 400);
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
    const profitRateStr = calculation.profitRate.toFixed(2);
    const isNegative = calculation.profitRate < 0;
    const parts = profitRateStr.split('.');
    const integerPart = parts[0].replace('-', '');
    const decimalPart = parts[1] ? '.' + parts[1] : '';
    const integerWithCommas = addCommas(integerPart);
    const profitRateWithCommas = (isNegative ? '-' : '') + integerWithCommas + decimalPart;
    buffer.push(`수익률: ${profitRateWithCommas}%`);
      buffer.push(`총 매수 금액: ${formatCurrency(calculation.totalBuyAmount, calculation.currency)}`);
      buffer.push(`총 매도 금액: ${formatCurrency(calculation.totalSellAmount, calculation.currency)}`);
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

  // 계산 결과용 (기존 로직 유지)
  const getKrwEquivalentDisplay = (usdValue: number): string | null => {
    if (selectedCurrency === Currency.USD && calculation?.exchangeRate) {
      const krwValue = usdValue * calculation.exchangeRate;
      return `\n원화 ${addCommas(krwValue.toFixed(0))}원`;
    }
    return null;
  };

  // 입력창용 (입력된 환율 사용)
  const getKrwEquivalentDisplayForInput = (usdValue: number): string | null => {
    if (selectedCurrency === Currency.USD) {
      const exchangeRateNum = parseFloat(exchangeRate.replace(/,/g, ''));
      if (exchangeRateNum && !isNaN(exchangeRateNum) && exchangeRateNum > 0) {
        const krwValue = usdValue * exchangeRateNum;
        return `원화 ${addCommas(krwValue.toFixed(0))}원`;
      }
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
                onChangeText={handleExchangeRateInputChange}
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
            onChangeText={(text) => handlePriceInputChange(text, setBuyPrice, selectedCurrency, false)}
            keyboardType="numeric"
          />
          {selectedCurrency === Currency.USD &&
            buyPrice &&
            !isNaN(parseFloat(buyPrice.replace(/,/g, ''))) &&
            getKrwEquivalentDisplayForInput(parseFloat(buyPrice.replace(/,/g, ''))) && (
              <Text style={styles.helperText}>
                {getKrwEquivalentDisplayForInput(parseFloat(buyPrice.replace(/,/g, '')))}
              </Text>
            )}

          <TextInput
            style={styles.input}
            placeholder={selectedCurrency === Currency.USD ? '매도가 (USD)' : '매도가 (원)'}
            placeholderTextColor="#757575"
            value={sellPrice}
            onChangeText={(text) => handlePriceInputChange(text, setSellPrice, selectedCurrency, true)}
            keyboardType="numeric"
          />
          {selectedCurrency === Currency.USD && sellPrice && !isNaN(parseFloat(sellPrice.replace(/,/g, ''))) && getKrwEquivalentDisplayForInput(parseFloat(sellPrice.replace(/,/g, ''))) && (
            <Text style={styles.helperText}>
              {getKrwEquivalentDisplayForInput(parseFloat(sellPrice.replace(/,/g, '')))}
              {profitRate && sellPrice && buyPrice ? `  수익률: ${profitRate}%` : ''}
            </Text>
          )}
          {selectedCurrency === Currency.KRW && profitRate && sellPrice && buyPrice && (
            <Text style={styles.helperText}>
              수익률: {profitRate}%
            </Text>
          )}
          <TextInput
            style={styles.input}
            placeholder="수익률 (%)"
            placeholderTextColor="#757575"
            value={profitRate}
            onChangeText={(text) => handleProfitRateInputChange(text, setProfitRate)}
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
            onLayout={(event) => {
              const { y } = event.nativeEvent.layout;
              resultContainerY.current = y;
            }}
          >
            <SharedResultSection
              watermarkText="만든 사람: 네오비저닝"
              onTextShare={shareResultAsText}
            >
              <View ref={resultTitleRef}>
                <Text style={styles.resultTitle}>계산 결과</Text>
              </View>
              <View style={styles.resultCards}>
                <CalculationResultCard
                  key="net-profit"
                  title="순수익"
                  value={`${formatCurrency(calculation.netProfit, calculation.currency)}${getKrwEquivalentDisplay(calculation.netProfit) || ''}`}
                  valueColor={calculation.netProfit >= 0 ? '#4CAF50' : '#F44336'}
                />
                <View key="spacer-1" style={{ height: 12 }} />
                <CalculationResultCard
                  key="profit-rate"
                  title="수익률"
                  value={(() => {
                    const profitRateStr = calculation.profitRate.toFixed(2);
                    const isNegative = calculation.profitRate < 0;
                    const absValue = Math.abs(calculation.profitRate);
                    const parts = profitRateStr.split('.');
                    const integerPart = parts[0].replace('-', '');
                    const decimalPart = parts[1] ? '.' + parts[1] : '';
                    const integerWithCommas = addCommas(integerPart);
                    const profitRateWithCommas = (isNegative ? '-' : '') + integerWithCommas + decimalPart;
                    return `${profitRateWithCommas}%`;
                  })()}
                  valueColor={calculation.profitRate >= 0 ? '#4CAF50' : '#F44336'}
                />
                <View key="spacer-2" style={{ height: 12 }} />
                <CalculationResultCard
                  key="total-buy-amount"
                  title="총 매수 금액"
                  value={`${formatCurrency(calculation.totalBuyAmount, calculation.currency)}${getKrwEquivalentDisplay(calculation.totalBuyAmount) || ''}`}
                />
                <View key="spacer-3" style={{ height: 12 }} />
                <CalculationResultCard
                  key="total-sell-amount"
                  title="총 매도 금액"
                  value={`${formatCurrency(calculation.totalSellAmount, calculation.currency)}${
                    calculation.simpleDifference !== 0
                      ? ` (${calculation.simpleDifference >= 0 ? '+' : '-'} ${formatCurrency(Math.abs(calculation.simpleDifference), calculation.currency)})`
                      : ''
                  }${
                    calculation.currency === Currency.USD && calculation.exchangeRate
                      ? calculation.simpleDifference !== 0
                        ? `\n원화 ${addCommas((calculation.totalSellAmount * calculation.exchangeRate).toFixed(0))}원 (${calculation.simpleDifference >= 0 ? '+' : '-'} ${addCommas((Math.abs(calculation.simpleDifference) * calculation.exchangeRate).toFixed(0))}원)`
                        : `\n원화 ${addCommas((calculation.totalSellAmount * calculation.exchangeRate).toFixed(0))}원`
                      : getKrwEquivalentDisplay(calculation.totalSellAmount) || ''
                  }`}
                  valueColor="#FFFFFF"
                />
              </View>
            </SharedResultSection>

            <CoupangBannerSection ref={coupangBannerRef} />
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
  resultTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  resultCards: {
  },
});

