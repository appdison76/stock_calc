import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { getAccountById, getStocksByAccountId, deleteStock, createStock, updateStock, initDatabase, getTradingRecordsByStockId, updateStockCurrentPrice, updatePortfolioCurrentPrices } from '../src/services/DatabaseService';
import { Account } from '../src/models/Account';
import { Stock } from '../src/models/Stock';
import { Currency } from '../src/models/Currency';
import { ExchangeRateService } from '../src/services/ExchangeRateService';
import { getStockQuote } from '../src/services/YahooFinanceService';
import { addCommas } from '../src/utils/formatUtils';
import { getCurrencyFromTicker } from '../src/utils/stockUtils';
import StockSearchModal from '../src/components/StockSearchModal';

export default function PortfolioDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [portfolio, setPortfolio] = useState<Account | null>(null);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [stocksWithRecordCount, setStocksWithRecordCount] = useState<Array<Stock & { recordCount: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showEditStockModal, setShowEditStockModal] = useState(false);
  const [editingStock, setEditingStock] = useState<Stock | null>(null);
  const [stockNameInput, setStockNameInput] = useState(''); // 편집 모달용
  const [quantityInput, setQuantityInput] = useState('');
  const [averagePriceInput, setAveragePriceInput] = useState('');
  const [selectedTickerForAdd, setSelectedTickerForAdd] = useState<string | null>(null);
  const [selectedOfficialNameForAdd, setSelectedOfficialNameForAdd] = useState<string | null>(null);
  const [showStockNameInputForAdd, setShowStockNameInputForAdd] = useState(false);
  const [stockNameInputForAdd, setStockNameInputForAdd] = useState('');
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  // USD 가격에 대한 원화 변환값 표시 (작은 글씨)
  const getKrwEquivalentForDisplay = (usdValue: number | undefined | null): string | null => {
    if (usdValue === undefined || usdValue === null || !exchangeRate) return null;
    const krwValue = usdValue * exchangeRate;
    return `원화 ${addCommas(krwValue.toFixed(0))}원`;
  };

  useFocusEffect(
    React.useCallback(() => {
      if (id) {
        loadPortfolioDetail();
      }
    }, [id])
  );

  const loadPortfolioDetail = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      
      // 데이터베이스 초기화 먼저 수행
      await initDatabase();
      
      // 환율 로드 (USD 종목이 있는 경우)
      try {
        const usdkrwQuote = await getStockQuote('USDKRW=X');
        if (usdkrwQuote) {
          setExchangeRate(usdkrwQuote.price);
        } else {
          const rate = await ExchangeRateService.getUsdToKrwRate();
          setExchangeRate(rate);
        }
      } catch (rateError) {
        console.warn('환율 로드 실패:', rateError);
        const rate = await ExchangeRateService.getUsdToKrwRate();
        setExchangeRate(rate);
      }
      
      const account = await getAccountById(id);
      if (!account) {
        Alert.alert('오류', '포트폴리오를 찾을 수 없습니다.');
        router.back();
        return;
      }

      setPortfolio(account);
      const portfolioStocks = await getStocksByAccountId(id);
      setStocks(portfolioStocks);
      
      // 현재가 갱신 (백그라운드에서 실행, 실패해도 계속 진행)
      try {
        await updatePortfolioCurrentPrices(id);
        // 갱신 후 다시 종목 목록 가져오기
        const updatedStocks = await getStocksByAccountId(id);
        setStocks(updatedStocks);
        portfolioStocks.length = 0; // portfolioStocks를 updatedStocks로 대체
        portfolioStocks.push(...updatedStocks);
      } catch (priceError) {
        console.warn('현재가 갱신 실패:', priceError);
        // 현재가 갱신 실패해도 계속 진행
      }
      
      // 각 종목의 매매기록 개수 확인
      const stocksWithCount = await Promise.all(
        portfolioStocks.map(async (stock) => {
          const records = await getTradingRecordsByStockId(stock.id);
          return { ...stock, recordCount: records.length };
        })
      );
      setStocksWithRecordCount(stocksWithCount);
    } catch (error: any) {
      console.error('포트폴리오 상세 로드 오류:', error);
      const errorMessage = error?.message || '알 수 없는 오류가 발생했습니다.';
      Alert.alert('오류', `포트폴리오 정보를 불러오는 중 오류가 발생했습니다.\n${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddStock = () => {
    setShowStockModal(true);
  };

  const handleStockSelect = async (ticker: string, officialName: string) => {
    setShowStockModal(false);
    
    // 선택한 종목 정보 저장
    setSelectedTickerForAdd(ticker);
    setSelectedOfficialNameForAdd(officialName);
    
    // 별명 입력 모달 표시 (기본값은 officialName이 있으면 officialName, 없으면 ticker)
    setStockNameInputForAdd(officialName || ticker);
    setShowStockNameInputForAdd(true);
  };
  
  const handleStockNameConfirmForAdd = async () => {
    if (!portfolio || !selectedTickerForAdd) {
      Alert.alert('오류', '종목 정보가 없습니다.');
      return;
    }
    
    const stockName = stockNameInputForAdd.trim() || selectedOfficialNameForAdd || selectedTickerForAdd;
    setShowStockNameInputForAdd(false);
    
    try {
      // 보유 주식수와 평균 단가는 실적에 의해서만 결정되므로 초기값은 0
      // 직접 입력의 경우 officialName이 빈 문자열이므로 null로 변환
      const officialNameForSave = selectedOfficialNameForAdd && selectedOfficialNameForAdd.trim() 
        ? selectedOfficialNameForAdd 
        : undefined;
      
      const newStock = await createStock(
        portfolio.id,
        selectedTickerForAdd,
        getCurrencyFromTicker(selectedTickerForAdd), // 티커 기반 통화 사용
        0,
        0,
        officialNameForSave, // 실제 종목명 (직접 입력이면 undefined)
        stockName  // 종목 별명
      );
      
      // 현재가 자동 조회
      try {
        await updateStockCurrentPrice(newStock.id);
      } catch (priceError) {
        console.warn('현재가 조회 실패 (종목은 추가됨):', priceError);
        // 현재가 조회 실패해도 종목 추가는 성공한 것으로 처리
      }
      
      // 상태 초기화
      setSelectedTickerForAdd(null);
      setSelectedOfficialNameForAdd(null);
      setStockNameInputForAdd('');
      
      await loadPortfolioDetail();
    } catch (error: any) {
      console.error('종목 추가 오류:', error);
      const errorMessage = error?.message || '종목 추가에 실패했습니다.';
      Alert.alert('오류', errorMessage.includes('이미 존재') ? errorMessage : '종목 추가에 실패했습니다.');
      
      // 상태 초기화
      setSelectedTickerForAdd(null);
      setSelectedOfficialNameForAdd(null);
      setStockNameInputForAdd('');
    }
  };

  const handleEditStock = (stock: Stock) => {
    setEditingStock(stock);
    setStockNameInput(stock.name || stock.officialName || stock.ticker);
    setShowEditStockModal(true);
  };

  const handleEditStockConfirm = async () => {
    if (!editingStock) return;
    
    if (!stockNameInput.trim()) {
      Alert.alert('오류', '종목명을 입력해주세요.');
      return;
    }

    try {
      // 보유 주식수와 평균 단가는 실적에 의해서만 결정되므로 편집 불가
      await updateStock(editingStock.id, {
        name: stockNameInput.trim(),
      });
      setShowEditStockModal(false);
      setEditingStock(null);
      setStockNameInput('');
      await loadPortfolioDetail();
    } catch (error: any) {
      console.error('종목 수정 오류:', error);
      Alert.alert('오류', '종목 수정에 실패했습니다.');
    }
  };

  const handleDeleteStock = (stock: Stock) => {
    Alert.alert(
      '종목 삭제',
      `"${stock.name || stock.officialName || stock.ticker}" 종목을 삭제하시겠습니까?\n포함된 모든 물타기 기록이 삭제됩니다.`,
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteStock(stock.id);
              await loadPortfolioDetail();
            } catch (error) {
              console.error('종목 삭제 오류:', error);
              Alert.alert('오류', '종목 삭제에 실패했습니다.');
            }
          },
        },
      ]
    );
  };

  const formatPrice = (price?: number, currency: Currency = Currency.KRW) => {
    if (price === undefined || price === null) return 'N/A';
    if (currency === Currency.KRW) {
      return `${Math.round(price).toLocaleString('ko-KR')}원`;
    } else {
      return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0D1B2A', '#1B263B', '#0F1419']}
          style={styles.gradient}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#42A5F5" />
            <Text style={styles.loadingText}>종목 불러오는 중...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (!portfolio) {
    return null;
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0D1B2A', '#1B263B', '#0F1419']}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>{portfolio.name}</Text>
              {portfolio.name === '나의 포트폴리오' && (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultBadgeText}>기본</Text>
                </View>
              )}
            </View>
            <View style={styles.metaContainer}>
              <View style={styles.stockCountBadge}>
                <Text style={styles.stockCountBadgeText}>
                  종목 {stocks.length}개
                </Text>
              </View>
            </View>
          </View>

          {stocks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📈</Text>
              <Text style={styles.emptyText}>아직 종목이 없습니다</Text>
              <Text style={styles.emptySubtext}>
                물타기 계산기에서 종목을 저장하세요
              </Text>
            </View>
          ) : (
            <View style={styles.stocksContainer}>
              {stocksWithRecordCount.map((stock) => (
                <TouchableOpacity
                  key={stock.id}
                  activeOpacity={0.8}
                  style={styles.stockCard}
                  onPress={() => router.push(`/stock-detail?id=${stock.id}`)}
                >
                  <LinearGradient
                    colors={['rgba(13, 27, 42, 0.8)', 'rgba(27, 38, 59, 0.6)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardGradient}
                  >
                    <View style={styles.stockCardContent}>
                      <View style={styles.stockCardLeft}>
                        <View style={styles.stockNameRow}>
                          <View style={styles.stockNameContainer}>
                            <View style={styles.stockNameRowWithBadge}>
                              <Text style={styles.stockTicker}>
                                {stock.name || stock.officialName || stock.ticker}
                              </Text>
                              {stock.currency === Currency.USD && (
                                <View style={styles.currencyBadge}>
                                  <Text style={styles.currencyBadgeText}>USD</Text>
                                </View>
                              )}
                            </View>
                            {/* 매칭된 종목(officialName과 ticker가 모두 있는 경우)은 항상 표시 */}
                            {stock.officialName && stock.ticker && (
                              <Text style={styles.stockOfficialName}>
                                {stock.officialName} · {stock.ticker}
                              </Text>
                            )}
                          </View>
                          <View style={styles.chartIconsContainer}>
                            <TouchableOpacity
                              style={styles.chartIconButton}
                              onPress={(e) => {
                                e.stopPropagation();
                                router.push(`/stock-chart?id=${stock.id}`);
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.chartIcon}>📈</Text>
                              <Text style={styles.chartIconLabel}>종목차트</Text>
                            </TouchableOpacity>
                            {stock.recordCount > 0 && (
                              <TouchableOpacity
                                style={styles.chartIconButton}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  router.push(`/visualization?stockId=${stock.id}`);
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.chartIcon}>📉</Text>
                                <Text style={styles.chartIconLabel}>매매기록</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                        <View style={styles.stockDetails}>
                          {/* 평단가 - 강조 */}
                          <View style={styles.stockDetailRow}>
                            <Text style={styles.stockDetailLabel}>평단가</Text>
                            <View style={styles.priceWithKrwContainer}>
                              <Text style={[styles.stockDetailValue, styles.averagePriceText]}>{formatPrice(stock.averagePrice, stock.currency)}</Text>
                              {stock.currency === Currency.USD && getKrwEquivalentForDisplay(stock.averagePrice) && (
                                <Text style={styles.krwEquivalentText}>{getKrwEquivalentForDisplay(stock.averagePrice)}</Text>
                              )}
                            </View>
                          </View>
                          
                          {/* 보유 수량 - 강조 */}
                          <View style={styles.stockDetailRow}>
                            <Text style={styles.stockDetailLabel}>보유</Text>
                            <Text style={styles.stockDetailValue}>{formatNumber(stock.quantity)}주</Text>
                          </View>
                          
                          {/* 총 매수 금액 */}
                          <View style={styles.stockDetailRow}>
                            <Text style={styles.stockDetailLabel}>총 매수 금액</Text>
                            <View style={styles.priceWithKrwContainer}>
                              <Text style={styles.stockDetailValueSecondary}>
                                {formatPrice((stock.averagePrice || 0) * (stock.quantity || 0), stock.currency)}
                              </Text>
                              {stock.currency === Currency.USD && getKrwEquivalentForDisplay((stock.averagePrice || 0) * (stock.quantity || 0)) && (
                                <Text style={styles.krwEquivalentText}>{getKrwEquivalentForDisplay((stock.averagePrice || 0) * (stock.quantity || 0))}</Text>
                              )}
                            </View>
                          </View>
                          
                          {/* 현재가 및 평단가 비교 */}
                          {stock.currentPrice && stock.currentPrice > 0 && (
                            <>
                              <View style={styles.stockDetailRow}>
                                <Text style={styles.stockDetailLabel}>현재가</Text>
                                <View style={styles.priceWithKrwContainer}>
                                  <Text style={[styles.stockDetailValueSecondary, styles.currentPriceText]}>
                                    {formatPrice(stock.currentPrice, stock.currency)}
                                  </Text>
                                  {stock.currency === Currency.USD && getKrwEquivalentForDisplay(stock.currentPrice) && (
                                    <Text style={styles.krwEquivalentText}>{getKrwEquivalentForDisplay(stock.currentPrice)}</Text>
                                  )}
                                </View>
                              </View>
                              {stock.averagePrice > 0 && (
                                <View style={styles.stockDetailRow}>
                                  <Text style={styles.stockDetailLabel}>평단가 대비</Text>
                                  <View style={styles.priceComparisonContainer}>
                                    {(() => {
                                      const profitRate = ((stock.currentPrice - stock.averagePrice) / stock.averagePrice) * 100;
                                      const profitAmount = (stock.currentPrice - stock.averagePrice) * stock.quantity;
                                      const isProfit = profitRate >= 0;
                                      return (
                                        <>
                                          <Text style={[
                                            styles.stockDetailValueSecondary,
                                            isProfit ? styles.profitText : styles.lossText
                                          ]}>
                                            {isProfit ? '+' : ''}{profitRate.toFixed(2)}%
                                          </Text>
                                          <View style={styles.priceWithKrwContainer}>
                                            <Text style={[
                                              styles.profitAmountText,
                                              isProfit ? styles.profitText : styles.lossText
                                            ]}>
                                              ({isProfit ? '+' : ''}{formatPrice(profitAmount, stock.currency)})
                                            </Text>
                                            {stock.currency === Currency.USD && getKrwEquivalentForDisplay(profitAmount) && (
                                              <Text style={[styles.krwEquivalentText, isProfit ? styles.profitText : styles.lossText]}>{getKrwEquivalentForDisplay(profitAmount)}</Text>
                                            )}
                                          </View>
                                        </>
                                      );
                                    })()}
                                  </View>
                                </View>
                              )}
                            </>
                          )}
                        </View>
                      </View>
                      <View style={styles.stockCardRight}>
                        <Text style={styles.arrow}>→</Text>
                      </View>
                    </View>
                  </LinearGradient>
                  <View style={styles.stockActionButtons}>
                    <TouchableOpacity
                      style={styles.editStockButtonBottom}
                      onPress={() => handleEditStock(stock)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.editStockButtonTextBottom}>편집</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteStockButtonBottom}
                      onPress={() => handleDeleteStock(stock)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.deleteStockButtonTextBottom}>삭제</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddStock}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#42A5F5', '#1976D2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.addButtonGradient}
            >
              <Text style={styles.addButtonIcon}>+</Text>
              <Text style={styles.addButtonText}>종목 추가</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>

      {/* 종목 검색 모달 */}
      <StockSearchModal
        visible={showStockModal}
        onClose={() => setShowStockModal(false)}
        onSelect={handleStockSelect}
        title="새 종목 추가"
        placeholder="예: 삼성전자, Apple Inc"
      />

      {/* 종목 별명 입력 모달 (추가용) */}
      <Modal
        visible={showStockNameInputForAdd}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowStockNameInputForAdd(false);
          setSelectedTickerForAdd(null);
          setSelectedOfficialNameForAdd(null);
          setStockNameInputForAdd('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>종목 별명 설정</Text>
            
            {selectedOfficialNameForAdd && (
              <Text style={styles.modalHelperText}>
                실제 종목명: {selectedOfficialNameForAdd}
              </Text>
            )}
            
            <TextInput
              style={styles.modalInput}
              placeholder="종목 별명을 입력하세요"
              placeholderTextColor="#757575"
              value={stockNameInputForAdd}
              onChangeText={setStockNameInputForAdd}
              autoFocus={true}
              selectTextOnFocus={true}
            />
            
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowStockNameInputForAdd(false);
                  setSelectedTickerForAdd(null);
                  setSelectedOfficialNameForAdd(null);
                  setStockNameInputForAdd('');
                }}
              >
                <Text style={styles.modalButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleStockNameConfirmForAdd}
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 종목 편집 모달 */}
      <Modal
        visible={showEditStockModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowEditStockModal(false);
          setEditingStock(null);
          setStockNameInput('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>종목 수정</Text>
            
            <Text style={styles.modalLabel}>종목 별명</Text>
            {editingStock?.officialName && (
              <Text style={styles.modalHelperText}>
                실제 종목명: {editingStock.officialName} ({editingStock.ticker})
              </Text>
            )}
            <TextInput
              style={styles.modalInput}
              placeholder="예: 삼성전자, Apple Inc"
              placeholderTextColor="#757575"
              value={stockNameInput}
              onChangeText={setStockNameInput}
              autoFocus
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowEditStockModal(false);
                  setEditingStock(null);
                  setStockNameInput('');
                }}
              >
                <Text style={styles.modalButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleEditStockConfirm}
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1B2A',
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  chartButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  chartButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  chartButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  chartButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#B0BEC5',
  },
  header: {
    marginBottom: 24,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  defaultBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4CAF50',
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockCountBadge: {
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stockCountBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9800',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#B0BEC5',
    textAlign: 'center',
  },
  stocksContainer: {
    marginBottom: 20,
  },
  stockCard: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  cardGradient: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.1)',
  },
  stockCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
  },
  stockCardRight: {
    marginLeft: 12,
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  chartIconsContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  chartIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chartIcon: {
    fontSize: 18,
  },
  chartIconLabel: {
    fontSize: 10,
    color: '#FFFFFF',
    marginTop: 2,
    fontWeight: '500',
  },
  arrow: {
    fontSize: 24,
    fontWeight: '600',
    color: '#42A5F5',
  },
  stockActionButtons: {
    flexDirection: 'row',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
  },
  editStockButtonBottom: {
    flex: 1,
    backgroundColor: 'rgba(66, 165, 245, 0.15)',
    paddingVertical: 10,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(66, 165, 245, 0.2)',
  },
  editStockButtonTextBottom: {
    color: '#42A5F5',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteStockButtonBottom: {
    flex: 1,
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  deleteStockButtonTextBottom: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '600',
  },
  stockCardLeft: {
    flex: 1,
  },
  stockNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  stockNameContainer: {
    flex: 1,
  },
  stockNameRowWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockTicker: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  currencyBadge: {
    backgroundColor: 'rgba(66, 165, 245, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currencyBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#42A5F5',
  },
  stockOfficialName: {
    fontSize: 13,
    color: '#B0BEC5',
    marginTop: 4,
  },
  stockDetails: {
    gap: 10,
  },
  stockDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockDetailLabel: {
    fontSize: 15,
    color: '#B0BEC5',
    fontWeight: '500',
    flexShrink: 1,
  },
  stockDetailValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flexShrink: 0,
  },
  stockDetailValueSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E0E0E0',
    flexShrink: 0,
  },
  currentPriceText: {
    color: '#FFC107', // 밝은 노란색/골드
  },
  averagePriceText: {
    color: '#4DD0E1', // 밝은 시안
  },
  priceComparisonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  profitText: {
    color: '#4CAF50', // 녹색 (수익) - 미국 스타일
  },
  lossText: {
    color: '#F44336', // 빨간색 (손실) - 미국 스타일
  },
  profitAmountText: {
    fontSize: 12,
    fontWeight: '500',
  },
  priceWithKrwContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  krwEquivalentText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: 'normal',
    marginTop: 2,
  },
  addButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  addButtonIcon: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginRight: 12,
  },
  addButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'rgba(13, 27, 42, 0.95)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.3)',
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  modalHelperText: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: 'rgba(27, 38, 59, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
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
  modalButtonConfirm: {
    backgroundColor: '#42A5F5',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#B0BEC5',
  },
});

