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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { 
  getStockById, 
  getTradingRecordsByStockId,
  createBuyRecord,
  createSellRecord,
  deleteTradingRecord,
  updateStock,
  initDatabase 
} from '../src/services/DatabaseService';
import { Stock } from '../src/models/Stock';
import { TradingRecord } from '../src/models/TradingRecord';
import { Currency } from '../src/models/Currency';
import { formatCurrency, formatNumber as formatNumberUtil } from '../src/utils/formatUtils';
import { SettingsService } from '../src/services/SettingsService';

export default function StockDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [stock, setStock] = useState<Stock | null>(null);
  const [records, setRecords] = useState<TradingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddRecordModal, setShowAddRecordModal] = useState(false);
  const [recordType, setRecordType] = useState<'BUY' | 'SELL'>('BUY'); // 매수/매도 선택
  
  // 실적 추가 입력값
  const [priceInput, setPriceInput] = useState('');
  const [quantityInput, setQuantityInput] = useState('');

  const formatPrice = (price?: number, currency: Currency = Currency.KRW) => {
    if (price === undefined || price === null) return formatCurrency(0, currency);
    return formatCurrency(price, currency);
  };

  const formatNumber = (num: number) => {
    return formatNumberUtil(num, Currency.KRW).replace('원', '');
  };

  useEffect(() => {
    loadStockDetail();
  }, [id]);

  const loadStockDetail = async () => {
    if (!id) return;
    
    try {
      await initDatabase();
      const stockData = await getStockById(id);
      if (stockData) {
        setStock(stockData);
        const recordsData = await getTradingRecordsByStockId(id);
        setRecords(recordsData);
      }
    } catch (error: any) {
      console.error('종목 상세 로드 오류:', error);
      Alert.alert('오류', '종목 정보를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRecord = async () => {
    if (!stock) return;

    if (!priceInput.trim()) {
      Alert.alert('오류', recordType === 'BUY' ? '매수가를 입력해주세요.' : '매도가를 입력해주세요.');
      return;
    }

    if (!quantityInput.trim()) {
      Alert.alert('오류', recordType === 'BUY' ? '매수 수량을 입력해주세요.' : '매도 수량을 입력해주세요.');
      return;
    }

    const price = parseFloat(priceInput);
    const quantity = parseFloat(quantityInput);
    
    if (isNaN(price) || price <= 0) {
      Alert.alert('오류', `올바른 ${recordType === 'BUY' ? '매수가' : '매도가'}를 입력해주세요.`);
      return;
    }

    if (isNaN(quantity) || quantity <= 0) {
      Alert.alert('오류', `올바른 ${recordType === 'BUY' ? '매수' : '매도'} 수량을 입력해주세요.`);
      return;
    }

    try {
      // 현재 평단가와 수량
      const currentAveragePrice = stock.averagePrice || 0;
      const currentQuantity = stock.quantity || 0;

      if (recordType === 'BUY') {
        // 매수 처리
        // 기존 총 매수 금액 = 평단가 × 수량
        const totalAmountBefore = currentAveragePrice * currentQuantity;
        // 새 매수 금액 = 매수가 × 수량
        const buyAmount = price * quantity;
        // 총 매수 금액 = 기존 총액 + 새 매수 금액
        const totalAmountAfter = totalAmountBefore + buyAmount;
        // 총 수량 = 기존 수량 + 새 수량
        const totalQuantityAfter = currentQuantity + quantity;
        // 새로운 평단가 = 총 매수 금액 / 총 수량
        const averagePriceAfter = totalQuantityAfter > 0 
          ? totalAmountAfter / totalQuantityAfter 
          : price;

        // 매수 기록 생성
        await createBuyRecord(
          stock.id,
          price,
          quantity,
          stock.currency,
          currentAveragePrice,
          averagePriceAfter,
          currentQuantity,
          totalQuantityAfter,
          undefined // 환율은 사용하지 않음
        );

        // 종목 정보 업데이트
        await updateStock(stock.id, {
          quantity: totalQuantityAfter,
          averagePrice: averagePriceAfter,
        });
      } else {
        // 매도 처리
        // 매도 수량 검증
        if (quantity > currentQuantity) {
          Alert.alert('오류', `보유 수량(${currentQuantity}주)을 초과하여 매도할 수 없습니다.`);
          return;
        }

        // 매도 후 수량
        const totalQuantityAfter = currentQuantity - quantity;
        
        // 매도 기록 생성 (평단가는 유지)
        await createSellRecord(
          stock.id,
          price,
          quantity,
          stock.currency,
          currentAveragePrice, // 매도 시점의 평단가
          currentQuantity,
          totalQuantityAfter,
          undefined // 환율은 사용하지 않음
        );

        // 종목 정보 업데이트 (수량만 감소, 평단가는 유지)
        await updateStock(stock.id, {
          quantity: totalQuantityAfter,
          // averagePrice는 변경하지 않음 (매도 시 평단가는 유지)
        });
      }

      // 화면 새로고침
      await loadStockDetail();
      
      setShowAddRecordModal(false);
      setPriceInput('');
      setQuantityInput('');
      
      Alert.alert('성공', `${recordType === 'BUY' ? '매수' : '매도'} 기록이 추가되었습니다.`);
    } catch (error: any) {
      console.error('실적 추가 오류:', error);
      Alert.alert('오류', `${recordType === 'BUY' ? '매수' : '매도'} 기록 추가에 실패했습니다.`);
    }
  };

  const handleDeleteRecord = async (record: TradingRecord) => {
    if (!stock) return;

    // 마지막 실적인지 확인 (records는 시간순으로 정렬되어 있음)
    const isLastRecord = records.length > 0 && records[records.length - 1].id === record.id;
    
    if (!isLastRecord) {
      Alert.alert('알림', '마지막 실적만 삭제할 수 있습니다.');
      return;
    }

    Alert.alert(
      '실적 삭제',
      '이 실적을 삭제하시겠습니까?',
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
              // 실적 삭제
              await deleteTradingRecord(record.id);

              // 종목 정보를 삭제된 실적의 이전 상태로 복원
              if (record.type === 'BUY') {
                // 매수 기록 삭제: 평단가와 수량 모두 복원
                await updateStock(stock.id, {
                  quantity: record.totalQuantityBefore,
                  averagePrice: record.averagePriceBefore || 0,
                });
              } else {
                // 매도 기록 삭제: 수량만 복원 (평단가는 유지)
                await updateStock(stock.id, {
                  quantity: record.totalQuantityBefore,
                  // averagePrice는 변경하지 않음
                });
              }

              // 화면 새로고침
              await loadStockDetail();
              
              Alert.alert('성공', '실적이 삭제되었습니다.');
            } catch (error: any) {
              console.error('실적 삭제 오류:', error);
              Alert.alert('오류', '실적 삭제에 실패했습니다.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAllRecords = async () => {
    if (!stock) return;

    if (records.length === 0) {
      Alert.alert('알림', '삭제할 실적이 없습니다.');
      return;
    }

    Alert.alert(
      '전체 삭제',
      `모든 물타기 기록(${records.length}개)을 삭제하시겠습니까?\n종목의 평단가와 수량이 0으로 초기화됩니다.`,
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
              await initDatabase();
              
              // 모든 실적 기록 삭제
              for (const record of records) {
                await deleteTradingRecord(record.id);
              }

              // 종목 정보 초기화
              await updateStock(stock.id, {
                quantity: 0,
                averagePrice: 0,
              });

              // 화면 새로고침
              await loadStockDetail();
              
              Alert.alert('성공', '모든 물타기 기록이 삭제되었습니다.');
            } catch (error: any) {
              console.error('전체 삭제 오류:', error);
              Alert.alert('오류', '전체 삭제에 실패했습니다.');
            }
          },
        },
      ]
    );
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
            <Text style={styles.loadingText}>로딩 중...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (!stock) {
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
          {/* 종목 정보 카드 */}
          <View style={styles.stockInfoCard}>
            <Text style={styles.stockName}>{stock.name || stock.ticker}</Text>
            <View style={styles.stockDetails}>
              <Text style={styles.stockDetailText}>
                보유: {formatNumber(stock.quantity)}주
              </Text>
              <Text style={styles.stockDetailText}>
                평단가: {formatPrice(stock.averagePrice, stock.currency)}
              </Text>
              {stock.currentPrice && (
                <Text style={styles.stockDetailText}>
                  현재가: {formatPrice(stock.currentPrice, stock.currency)}
                </Text>
              )}
            </View>
          </View>

          {/* 거래 추가 버튼들 */}
          <View style={styles.addButtonContainer}>
            <TouchableOpacity
              style={[styles.addButton, styles.buyButton]}
              onPress={() => {
                setRecordType('BUY');
                setShowAddRecordModal(true);
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#4CAF50', '#388E3C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.addButtonGradient}
              >
                <Text style={styles.addButtonIcon}>+</Text>
                <Text style={styles.addButtonText}>매수 추가</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.addButton, styles.sellButton]}
              onPress={() => {
                setRecordType('SELL');
                setShowAddRecordModal(true);
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#EF5350', '#E53935']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.addButtonGradient}
              >
                <Text style={styles.addButtonIcon}>-</Text>
                <Text style={styles.addButtonText}>매도 추가</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* 실적 목록 */}
          <View style={styles.recordsContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>거래 기록</Text>
              {records.length > 0 && (
                <TouchableOpacity
                  style={styles.deleteAllButton}
                  onPress={handleDeleteAllRecords}
                  activeOpacity={0.7}
                >
                  <Text style={styles.deleteAllButtonText}>전체삭제</Text>
                </TouchableOpacity>
              )}
            </View>
            {records.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>아직 실적이 없습니다</Text>
                <Text style={styles.emptySubtext}>
                  실적 추가 버튼을 눌러 물타기 기록을 추가하세요
                </Text>
              </View>
            ) : (
              records.map((record, index) => (
                <View key={record.id} style={styles.recordCard}>
                  <View style={styles.recordHeader}>
                    <View style={styles.recordHeaderLeft}>
                      <View style={[
                        styles.recordTypeBadge,
                        record.type === 'BUY' ? styles.buyBadge : styles.sellBadge
                      ]}>
                        <Text style={styles.recordTypeText}>
                          {record.type === 'BUY' ? '매수' : '매도'}
                        </Text>
                      </View>
                      <Text style={styles.recordNumber}>#{index + 1}</Text>
                    </View>
                    <Text style={styles.recordDate}>
                      {new Date(record.createdAt).toLocaleDateString('ko-KR')}
                    </Text>
                  </View>
                  <View style={styles.recordDetails}>
                    {record.type === 'BUY' ? (
                      <>
                        <View style={styles.recordRow}>
                          <Text style={styles.recordLabel}>매수가</Text>
                          <Text style={styles.recordValue}>
                            {formatPrice(record.price, record.currency)}
                          </Text>
                        </View>
                        <View style={styles.recordRow}>
                          <Text style={styles.recordLabel}>매수 수량</Text>
                          <Text style={styles.recordValue}>
                            {formatNumber(record.quantity)}주
                          </Text>
                        </View>
                        {record.averagePriceBefore !== undefined && record.averagePriceBefore > 0 && (
                          <>
                            <View style={styles.recordRow}>
                              <Text style={styles.recordLabel}>매수 전 평단가</Text>
                              <Text style={styles.recordValue}>
                                {formatPrice(record.averagePriceBefore, record.currency)}
                              </Text>
                            </View>
                            {record.averagePriceAfter !== undefined && (
                              <>
                                <View style={styles.recordRow}>
                                  <Text style={styles.recordLabel}>매수 후 평단가</Text>
                                  <Text style={[
                                    styles.recordValue, 
                                    styles.recordValueHighlight,
                                    record.averagePriceAfter > record.averagePriceBefore ? styles.priceUp : 
                                    record.averagePriceAfter < record.averagePriceBefore ? styles.priceDown : null
                                  ]}>
                                    {formatPrice(record.averagePriceAfter, record.currency)}
                                  </Text>
                                </View>
                                <View style={styles.recordRow}>
                                  <Text style={styles.recordLabel}>평단 변화량</Text>
                                  {(() => {
                                    const change = record.averagePriceAfter - record.averagePriceBefore;
                                    const isUp = change > 0;
                                    const isDown = change < 0;
                                    return (
                                      <Text style={[
                                        styles.recordValue,
                                        isUp ? styles.priceUp : isDown ? styles.priceDown : null
                                      ]}>
                                        {isUp ? '↑ ' : isDown ? '↓ ' : ''}
                                        {formatPrice(Math.abs(change), record.currency)}
                                      </Text>
                                    );
                                  })()}
                                </View>
                                <View style={styles.recordRow}>
                                  <Text style={styles.recordLabel}>평단 변화율</Text>
                                  {(() => {
                                    const changeRate = ((record.averagePriceAfter - record.averagePriceBefore) / record.averagePriceBefore) * 100;
                                    const isUp = changeRate > 0;
                                    const isDown = changeRate < 0;
                                    return (
                                      <Text style={[
                                        styles.recordValue,
                                        isUp ? styles.priceUp : isDown ? styles.priceDown : null
                                      ]}>
                                        {isUp ? '↑ ' : isDown ? '↓ ' : ''}
                                        {Math.abs(changeRate).toFixed(2)}%
                                      </Text>
                                    );
                                  })()}
                                </View>
                              </>
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <View style={styles.recordRow}>
                          <Text style={styles.recordLabel}>매도가</Text>
                          <Text style={styles.recordValue}>
                            {formatPrice(record.price, record.currency)}
                          </Text>
                        </View>
                        <View style={styles.recordRow}>
                          <Text style={styles.recordLabel}>매도 수량</Text>
                          <Text style={styles.recordValue}>
                            {formatNumber(record.quantity)}주
                          </Text>
                        </View>
                        {record.averagePriceAtSell !== undefined && (
                          <View style={styles.recordRow}>
                            <Text style={styles.recordLabel}>매도 시 평단가</Text>
                            <Text style={styles.recordValue}>
                              {formatPrice(record.averagePriceAtSell, record.currency)}
                            </Text>
                          </View>
                        )}
                        {record.profit !== undefined && (
                          <View style={styles.recordRow}>
                            <Text style={styles.recordLabel}>손익</Text>
                            <Text style={[
                              styles.recordValue,
                              record.profit > 0 ? styles.priceUp : 
                              record.profit < 0 ? styles.priceDown : null
                            ]}>
                              {record.profit > 0 ? '+' : ''}
                              {formatPrice(record.profit, record.currency)}
                            </Text>
                          </View>
                        )}
                      </>
                    )}
                    <View style={styles.recordRow}>
                      <Text style={styles.recordLabel}>보유 수량</Text>
                      <Text style={styles.recordValue}>
                        {formatNumber(record.totalQuantityBefore)}주 → {formatNumber(record.totalQuantityAfter)}주
                      </Text>
                    </View>
                  </View>
                  {/* 마지막 실적일 때만 삭제 버튼 표시 */}
                  {index === records.length - 1 && (
                    <TouchableOpacity
                      style={styles.deleteRecordButton}
                      onPress={() => handleDeleteRecord(record)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.deleteRecordButtonText}>삭제</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </LinearGradient>

      {/* 실적 추가 모달 */}
      <Modal
        visible={showAddRecordModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowAddRecordModal(false);
          setPriceInput('');
          setQuantityInput('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {recordType === 'BUY' ? '매수 기록 추가' : '매도 기록 추가'}
            </Text>
            
            {recordType === 'SELL' && stock.quantity > 0 && (
              <Text style={[styles.modalLabel, { color: '#FF9800', marginBottom: 8 }]}>
                최대 매도 가능: {formatNumber(stock.quantity)}주
              </Text>
            )}
            
            <Text style={styles.modalLabel}>
              {recordType === 'BUY' ? '매수가' : '매도가'}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder={stock.currency === Currency.KRW ? "예: 50000" : "예: 150.50"}
              placeholderTextColor="#757575"
              value={priceInput}
              onChangeText={setPriceInput}
              keyboardType="numeric"
              autoFocus
            />

            <Text style={[styles.modalLabel, { marginTop: 16 }]}>
              {recordType === 'BUY' ? '매수' : '매도'} 수량
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder={recordType === 'SELL' ? `최대: ${formatNumber(stock.quantity)}주` : "예: 10"}
              placeholderTextColor="#757575"
              value={quantityInput}
              onChangeText={setQuantityInput}
              keyboardType="numeric"
            />


            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowAddRecordModal(false);
                  setPriceInput('');
                  setQuantityInput('');
                }}
              >
                <Text style={styles.modalButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleAddRecord}
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>추가</Text>
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
  stockInfoCard: {
    backgroundColor: 'rgba(13, 27, 42, 0.8)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  stockName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  stockDetails: {
    gap: 8,
  },
  stockDetailText: {
    fontSize: 16,
    color: '#E0E0E0',
    lineHeight: 24,
  },
  addButtonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  addButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  buyButton: {
    // buyButton 스타일은 addButton과 동일
  },
  sellButton: {
    // sellButton 스타일은 addButton과 동일
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  addButtonIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    marginRight: 8,
  },
  addButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  recordsContainer: {
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  deleteAllButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  deleteAllButtonText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#B0BEC5',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#757575',
  },
  recordCard: {
    backgroundColor: 'rgba(13, 27, 42, 0.8)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  deleteRecordButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 12,
    borderRadius: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  deleteRecordButtonText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '600',
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  recordHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  buyBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  sellBadge: {
    backgroundColor: 'rgba(239, 83, 80, 0.2)',
  },
  recordTypeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  recordNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#42A5F5',
  },
  recordDate: {
    fontSize: 14,
    color: '#B0BEC5',
  },
  recordDetails: {
    gap: 8,
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordLabel: {
    fontSize: 14,
    color: '#B0BEC5',
  },
  recordValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  recordValueHighlight: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  priceUp: {
    color: '#EF5350',
  },
  priceDown: {
    color: '#42A5F5',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1B263B',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B0BEC5',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: 'rgba(13, 27, 42, 0.6)',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.3)',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
  },
  modalButtonConfirm: {
    backgroundColor: '#42A5F5',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#42A5F5',
  },
});

