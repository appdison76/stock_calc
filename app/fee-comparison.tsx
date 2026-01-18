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
import { BrokerFeeService, BrokerFee } from '../src/services/BrokerFeeService';

interface FeeComparison {
  transactionAmount: number;
  transactionCount: number;
  brokers: BrokerFee[];
  totalFees: { brokerName: string; totalFee: number }[];
  currency: Currency;
  exchangeRate?: number;
}


export default function FeeComparisonCalculatorView() {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(Currency.KRW);
  
  // 통화별 입력값 분리
  const [krwTransactionAmount, setKrwTransactionAmount] = useState('');
  const [krwTransactionCount, setKrwTransactionCount] = useState('');
  const [krwBrokers, setKrwBrokers] = useState<BrokerFee[]>([]);
  
  const [usdTransactionAmount, setUsdTransactionAmount] = useState('');
  const [usdTransactionCount, setUsdTransactionCount] = useState('');
  const [usdBrokers, setUsdBrokers] = useState<BrokerFee[]>([]);
  const [usdExchangeRate, setUsdExchangeRate] = useState('1350');
  
  const [isLoadingBrokers, setIsLoadingBrokers] = useState(false);
  
  const [comparison, setComparison] = useState<FeeComparison | null>(null);
  const [isLoadingExchangeRate, setIsLoadingExchangeRate] = useState(false);
  const [isExchangeRateLoaded, setIsExchangeRateLoaded] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const resultContainerY = useRef<number>(0);
  
  // 현재 선택된 통화의 입력값 getter
  const transactionAmount = selectedCurrency === Currency.KRW ? krwTransactionAmount : usdTransactionAmount;
  const transactionCount = selectedCurrency === Currency.KRW ? krwTransactionCount : usdTransactionCount;
  const brokers = selectedCurrency === Currency.KRW ? krwBrokers : usdBrokers;
  const exchangeRate = selectedCurrency === Currency.USD ? usdExchangeRate : '1350';
  
  const setTransactionAmount = selectedCurrency === Currency.KRW ? setKrwTransactionAmount : setUsdTransactionAmount;
  const setTransactionCount = selectedCurrency === Currency.KRW ? setKrwTransactionCount : setUsdTransactionCount;
  const setBrokers = selectedCurrency === Currency.KRW ? setKrwBrokers : setUsdBrokers;
  const setExchangeRate = setUsdExchangeRate;

  useEffect(() => {
    loadBrokerFees();
    if (selectedCurrency === Currency.USD) {
      loadExchangeRate();
    }
  }, [selectedCurrency]);

  const loadBrokerFees = async () => {
    setIsLoadingBrokers(true);
    try {
      // API에서 최신 수수료 정보 가져오기 시도
      const brokers = await BrokerFeeService.getBrokerFees(selectedCurrency);
      if (selectedCurrency === Currency.KRW) {
        setKrwBrokers(brokers);
      } else {
        setUsdBrokers(brokers);
      }
    } catch (e) {
      console.warn('증권사 수수료 로드 실패, 기본값 사용:', e);
      // 기본값 사용
      const defaultBrokers = BrokerFeeService.getDefaultBrokers(selectedCurrency);
      if (selectedCurrency === Currency.KRW) {
        setKrwBrokers(defaultBrokers);
      } else {
        setUsdBrokers(defaultBrokers);
      }
    } finally {
      setIsLoadingBrokers(false);
    }
  };

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

  // 거래 횟수 입력 핸들러
  const handleCountInputChange = (text: string, setter: (value: string) => void) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setter(cleaned);
  };

  // 수수료율 입력 핸들러
  const handleFeeRateInputChange = (text: string, brokerIndex: number) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const formatted = parts.length > 2 
      ? parts[0] + '.' + parts.slice(1).join('')
      : cleaned;
    
    const newBrokers = [...brokers];
    newBrokers[brokerIndex] = {
      ...newBrokers[brokerIndex],
      feeRate: formatted === '' || formatted === '.' ? 0 : parseFloat(formatted) || 0,
    };
    setBrokers(newBrokers);
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
      setKrwTransactionAmount('');
      setKrwTransactionCount('');
      setKrwBrokers(BrokerFeeService.getDefaultBrokers(Currency.KRW));
    } else {
      setUsdTransactionAmount('');
      setUsdTransactionCount('');
      setUsdBrokers(BrokerFeeService.getDefaultBrokers(Currency.USD));
    }
    setComparison(null);
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

    if (!transactionAmount || !transactionCount) {
      Alert.alert('입력 오류', '거래 금액과 거래 횟수를 입력해주세요.');
      return;
    }

    const transactionAmountNum = parseFloat(removeCommas(transactionAmount));
    const transactionCountNum = parseInt(transactionCount, 10);
    const exchangeRateNum = selectedCurrency === Currency.USD ? parseFloat(removeCommas(usdExchangeRate)) : undefined;

    if (isNaN(transactionAmountNum) || transactionAmountNum <= 0) {
      Alert.alert('입력 오류', '올바른 거래 금액을 입력하세요.');
      return;
    }

    if (isNaN(transactionCountNum) || transactionCountNum <= 0) {
      Alert.alert('입력 오류', '올바른 거래 횟수를 입력하세요.');
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

    // 각 증권사별 총 수수료 계산
    const totalFees = brokers.map((broker) => {
      // 1회 거래당 수수료 계산
      let feePerTransaction = (transactionAmountNum * broker.feeRate) / 100;
      
      // 고정 수수료가 있으면 추가
      if (broker.fixedFee) {
        feePerTransaction += broker.fixedFee;
      }
      
      // 최소 수수료 적용
      if (broker.minFee && feePerTransaction < broker.minFee) {
        feePerTransaction = broker.minFee;
      }
      
      // 최대 수수료 적용
      if (broker.maxFee && feePerTransaction > broker.maxFee) {
        feePerTransaction = broker.maxFee;
      }
      
      // 총 수수료 = 1회당 수수료 × 거래 횟수
      const totalFee = feePerTransaction * transactionCountNum;
      
      return {
        brokerName: broker.name,
        totalFee,
      };
    });

    // 수수료가 낮은 순으로 정렬
    totalFees.sort((a, b) => a.totalFee - b.totalFee);

    const newComparison: FeeComparison = {
      transactionAmount: transactionAmountNum,
      transactionCount: transactionCountNum,
      brokers,
      totalFees,
      currency: selectedCurrency,
      exchangeRate: exchangeRateNum,
    };

    setComparison(newComparison);
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
    if (!comparison) return;

    const buffer: string[] = [];
    buffer.push('수수료 비교 계산 결과\n');
    buffer.push(`거래 금액: ${formatCurrency(comparison.transactionAmount, comparison.currency)}`);
    buffer.push(`거래 횟수: ${comparison.transactionCount}회`);
    buffer.push('');
    buffer.push('증권사별 총 수수료:');
    comparison.totalFees.forEach((fee, index) => {
      buffer.push(`${index + 1}. ${fee.brokerName}: ${formatCurrency(fee.totalFee, comparison.currency)}`);
    });
    buffer.push('');
    buffer.push('만든 사람: 네오비저닝');

    const text = buffer.join('\n');

    try {
      await Share.share({
        message: text,
        title: '수수료 비교 계산 결과',
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
              setComparison(null);
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
                ? '거래 금액 (USD)'
                : '거래 금액 (원)'
            }
            placeholderTextColor="#757575"
            value={transactionAmount}
            onChangeText={(text) => handleAmountInputChange(text, setTransactionAmount, selectedCurrency)}
            keyboardType="numeric"
          />
          <Text style={styles.helperText}>1회 거래당 금액</Text>

          <TextInput
            style={styles.input}
            placeholder="거래 횟수"
            placeholderTextColor="#757575"
            value={transactionCount}
            onChangeText={(text) => handleCountInputChange(text, setTransactionCount)}
            keyboardType="numeric"
          />
          <Text style={styles.helperText}>예: 10 (10회 거래)</Text>

          <View style={styles.brokersContainer}>
            <View style={styles.brokersHeader}>
              <Text style={styles.brokersTitle}>증권사별 수수료율 설정</Text>
              <Text style={styles.brokersNote}>
                ※ 대부분의 증권사 기본 수수료는 0.015%로 비슷합니다{'\n'}
                ※ 실제 수수료는 계좌 유형, 이벤트, 거래량에 따라 달라질 수 있습니다{'\n'}
                ※ 본인의 계좌 조건에 맞게 수정하시기 바랍니다
              </Text>
            </View>
            {isLoadingBrokers ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#42A5F5" />
                <Text style={styles.loadingText}>최신 수수료 정보를 불러오는 중...</Text>
              </View>
            ) : brokers.length === 0 ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>증권사 정보를 불러오는 중...</Text>
              </View>
            ) : (
              brokers.map((broker, index) => (
              <View key={index} style={styles.brokerRow}>
                <Text style={styles.brokerName}>{broker.name}</Text>
                <View style={styles.brokerInputContainer}>
                  <TextInput
                    style={styles.brokerInput}
                    placeholder="수수료율 (%)"
                    placeholderTextColor="#757575"
                    value={broker.feeRate === 0 ? '' : broker.feeRate.toString()}
                    onChangeText={(text) => handleFeeRateInputChange(text, index)}
                    keyboardType="numeric"
                  />
                  <Text style={styles.brokerInputUnit}>%</Text>
                </View>
              </View>
              ))
            )}
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.calculateButton, isCalculating && styles.calculateButtonDisabled]} 
              onPress={calculate}
              disabled={isCalculating}
            >
              {isCalculating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.calculateButtonText}>비교하기</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.resetButton} onPress={reset}>
              <Text style={styles.resetButtonText}>초기화</Text>
            </TouchableOpacity>
          </View>
        </View>

        {comparison && (
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
                <Text style={styles.resultTitle}>수수료 비교 결과</Text>
                <Text style={styles.resultSubtitle}>
                  거래 금액: {formatCurrency(comparison.transactionAmount, comparison.currency)} × {comparison.transactionCount}회
                </Text>
              </View>

              <View style={styles.resultCardsVertical}>
                {comparison.totalFees.map((fee, index) => {
                  const isBest = index === 0;
                  const isWorst = index === comparison.totalFees.length - 1;
                  return (
                    <View key={index}>
                      <CalculationResultCard
                        title={fee.brokerName}
                        value={
                          formatCurrency(fee.totalFee, comparison.currency) +
                          (comparison.exchangeRate
                            ? getKrwEquivalent(fee.totalFee, comparison.exchangeRate) || ''
                            : '')
                        }
                        valueColor={
                          isBest ? '#4CAF50' : 
                          isWorst ? '#EF5350' : 
                          '#FFFFFF'
                        }
                      />
                      {index < comparison.totalFees.length - 1 && <View style={{ height: 12 }} />}
                    </View>
                  );
                })}
              </View>

              {comparison.totalFees.length > 1 && (
                <View style={styles.comparisonSummary}>
                  <Text style={styles.comparisonSummaryText}>
                    최저 수수료: {comparison.totalFees[0].brokerName} ({formatCurrency(comparison.totalFees[0].totalFee, comparison.currency)})
                  </Text>
                  <Text style={styles.comparisonSummaryText}>
                    최고 수수료: {comparison.totalFees[comparison.totalFees.length - 1].brokerName} ({formatCurrency(comparison.totalFees[comparison.totalFees.length - 1].totalFee, comparison.currency)})
                  </Text>
                  <Text style={styles.comparisonSummaryText}>
                    차이: {formatCurrency(
                      comparison.totalFees[comparison.totalFees.length - 1].totalFee - comparison.totalFees[0].totalFee,
                      comparison.currency
                    )}
                  </Text>
                </View>
              )}
            </SharedResultSection>
          </Animated.View>
        )}

        {comparison && <CoupangDynamicBanner width={320} height={140} />}
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
  brokersContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  brokersHeader: {
    marginBottom: 12,
  },
  brokersTitle: {
    fontSize: 14,
    color: '#B0BEC5',
    marginBottom: 4,
    fontWeight: '600',
  },
  brokersNote: {
    fontSize: 11,
    color: '#757575',
    fontStyle: 'italic',
  },
  brokerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  brokerName: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    flex: 1,
  },
  brokerInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 12,
  },
  brokerInput: {
    flex: 1,
    backgroundColor: 'rgba(27, 38, 59, 0.6)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
    padding: 10,
    color: '#FFFFFF',
    fontSize: 14,
  },
  brokerInputUnit: {
    fontSize: 14,
    color: '#B0BEC5',
    marginLeft: 8,
    width: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 12,
    color: '#94A3B8',
    marginLeft: 8,
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
  resultCardsVertical: {
    marginTop: 4,
  },
  comparisonSummary: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(66, 165, 245, 0.2)',
  },
  comparisonSummaryText: {
    fontSize: 14,
    color: '#B0BEC5',
    marginBottom: 8,
    textAlign: 'center',
  },
});

