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
import { getAccountById, getStocksByAccountId, deleteStock, createStock, updateStock, initDatabase, getTradingRecordsByStockId } from '../src/services/DatabaseService';
import { Account } from '../src/models/Account';
import { Stock } from '../src/models/Stock';
import { Currency } from '../src/models/Currency';

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
  const [stockNameInput, setStockNameInput] = useState('');
  const [quantityInput, setQuantityInput] = useState('');
  const [averagePriceInput, setAveragePriceInput] = useState('');

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
      
      const account = await getAccountById(id);
      if (!account) {
        Alert.alert('오류', '포트폴리오를 찾을 수 없습니다.');
        router.back();
        return;
      }

      setPortfolio(account);
      const portfolioStocks = await getStocksByAccountId(id);
      setStocks(portfolioStocks);
      
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
    setStockNameInput('');
    setShowStockModal(true);
  };

  const handleStockConfirm = async () => {
    if (!stockNameInput.trim()) {
      Alert.alert('오류', '종목명을 입력해주세요.');
      return;
    }

    if (!portfolio) {
      Alert.alert('오류', '포트폴리오 정보가 없습니다.');
      return;
    }

    try {
      // 종목명을 티커로도 사용 (나중에 Yahoo 연동 시 업데이트 예정)
      const ticker = stockNameInput.trim();
      // 보유 주식수와 평균 단가는 실적에 의해서만 결정되므로 초기값은 0
      await createStock(
        portfolio.id,
        ticker,
        portfolio.currency,
        0,
        0,
        stockNameInput.trim()
      );
      setShowStockModal(false);
      setStockNameInput('');
      await loadPortfolioDetail();
    } catch (error: any) {
      console.error('종목 추가 오류:', error);
      const errorMessage = error?.message || '종목 추가에 실패했습니다.';
      Alert.alert('오류', errorMessage.includes('이미 존재') ? errorMessage : '종목 추가에 실패했습니다. 이미 존재하는 종목일 수 있습니다.');
    }
  };

  const handleEditStock = (stock: Stock) => {
    setEditingStock(stock);
    setStockNameInput(stock.name || stock.ticker);
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
      `"${stock.name || stock.ticker}" 종목을 삭제하시겠습니까?\n포함된 모든 물타기 기록이 삭제됩니다.`,
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
      return `${price.toLocaleString()}원`;
    } else {
      return `$${price.toLocaleString()}`;
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
            <Text style={styles.headerTitle}>{portfolio.name}</Text>
            <View style={styles.metaContainer}>
              <Text style={styles.currencyBadge}>
                {portfolio.currency === Currency.KRW ? '₩ KRW' : '$ USD'}
              </Text>
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
                          <Text style={styles.stockTicker}>
                            {stock.name || stock.ticker}
                          </Text>
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
                            </TouchableOpacity>
                          )}
                        </View>
                        <View style={styles.stockDetails}>
                          {/* 평단가 - 강조 */}
                          <View style={styles.stockDetailRow}>
                            <Text style={styles.stockDetailLabel}>평단가</Text>
                            <Text style={styles.stockDetailValue}>{formatPrice(stock.averagePrice, stock.currency)}</Text>
                          </View>
                          
                          {/* 보유 수량 - 강조 */}
                          <View style={styles.stockDetailRow}>
                            <Text style={styles.stockDetailLabel}>보유</Text>
                            <Text style={styles.stockDetailValue}>{formatNumber(stock.quantity)}주</Text>
                          </View>
                          
                          {/* 총 매수 금액 */}
                          <View style={styles.stockDetailRow}>
                            <Text style={styles.stockDetailLabel}>총 매수 금액</Text>
                            <Text style={styles.stockDetailValueSecondary}>
                              {formatPrice((stock.averagePrice || 0) * (stock.quantity || 0), stock.currency)}
                            </Text>
                          </View>
                          
                          {/* 현재가 */}
                          {stock.currentPrice && (
                            <View style={styles.stockDetailRow}>
                              <Text style={styles.stockDetailLabel}>현재가</Text>
                              <Text style={styles.stockDetailValueSecondary}>
                                {formatPrice(stock.currentPrice, stock.currency)}
                              </Text>
                            </View>
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

      {/* 종목 추가 모달 */}
      <Modal
        visible={showStockModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowStockModal(false);
          setStockNameInput('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>새 종목 추가</Text>
            
            <Text style={styles.modalLabel}>종목명</Text>
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
                  setShowStockModal(false);
                  setStockNameInput('');
                }}
              >
                <Text style={styles.modalButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleStockConfirm}
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>추가</Text>
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
            
            <Text style={styles.modalLabel}>종목명</Text>
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
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencyBadge: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9800',
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
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
    marginLeft: 16,
    alignItems: 'center',
    gap: 8,
  },
  chartIconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(156, 39, 176, 0.15)',
  },
  chartIcon: {
    fontSize: 20,
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
  stockTicker: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
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
  },
  stockDetailValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  stockDetailValueSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E0E0E0',
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

