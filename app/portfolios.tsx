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
import { useRouter, useFocusEffect } from 'expo-router';
import { getAllAccounts, createAccount, deleteAccount, updateAccount, getStocksByAccountId } from '../src/services/DatabaseService';
import { Account } from '../src/models/Account';
import { Currency } from '../src/models/Currency';
import { initDatabase } from '../src/services/DatabaseService';
import { ExchangeRateService } from '../src/services/ExchangeRateService';
import { formatCurrency, addCommas } from '../src/utils/formatUtils';

interface PortfolioWithStockCount extends Account {
  stockCount: number;
  totalInvestmentKrw: number; // 총 투자금액 (원화)
  totalCurrentValueKrw: number; // 총 평가액 (원화)
  totalInvestmentUsd: number; // 총 투자금액 (달러)
  totalCurrentValueUsd: number; // 총 평가액 (달러)
  totalInvestmentKrwConverted: number; // 총 투자금액 (원화 환산)
  totalCurrentValueKrwConverted: number; // 총 평가액 (원화 환산)
  totalProfitRate: number; // 전체 수익률 (%)
  totalProfitAmountKrwConverted: number; // 총 수익금 (원화 환산)
  exchangeRate: number; // 환율 (USD to KRW)
}

export default function PortfoliosScreen() {
  const router = useRouter();
  const [portfolios, setPortfolios] = useState<PortfolioWithStockCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<Account | null>(null);
  const [portfolioName, setPortfolioName] = useState('');
  const [expandedPortfolios, setExpandedPortfolios] = useState<Set<string>>(new Set()); // 접기/펼치기 상태 관리

  useFocusEffect(
    React.useCallback(() => {
      loadPortfolios();
    }, [])
  );

  const loadPortfolios = async () => {
    try {
      setIsLoading(true);
      await initDatabase();
      let accounts = await getAllAccounts();
      
      // "나의 포트폴리오"가 없으면 기본 포트폴리오 자동 생성 (항상 최소 1개 유지)
      // 중복 생성 방지를 위해 먼저 확인
      const existingDefault = accounts.find(a => a.name === '나의 포트폴리오');
      if (!existingDefault) {
        await createAccount('나의 포트폴리오', Currency.KRW);
        accounts = await getAllAccounts();
      }
      
      // 환율 로드 (USD 종목이 있는 경우)
      let exchangeRate = 1350; // 기본값
      try {
        exchangeRate = await ExchangeRateService.getUsdToKrwRate();
      } catch (error) {
        console.warn('환율 로드 실패:', error);
      }
      
      // 각 포트폴리오의 종목 수 및 합산 정보 조회
      const portfoliosWithStockCount: PortfolioWithStockCount[] = await Promise.all(
        accounts.map(async (account) => {
          const stocks = await getStocksByAccountId(account.id);
          
          // 합산 정보 계산 (통화별로 구분)
          let totalInvestmentKrw = 0; // 총 투자금액 (원화)
          let totalCurrentValueKrw = 0; // 총 평가액 (원화)
          let totalInvestmentUsd = 0; // 총 투자금액 (달러)
          let totalCurrentValueUsd = 0; // 총 평가액 (달러)
          
          stocks.forEach((stock) => {
            if (stock.averagePrice && stock.quantity) {
              const investment = stock.averagePrice * stock.quantity;
              const currentValue = (stock.currentPrice || stock.averagePrice) * stock.quantity;
              
              if (stock.currency === Currency.USD) {
                // USD는 달러로 합산
                totalInvestmentUsd += investment;
                totalCurrentValueUsd += currentValue;
              } else {
                // KRW는 원화로 합산
                totalInvestmentKrw += investment;
                totalCurrentValueKrw += currentValue;
              }
            }
          });
          
          // 원화 환산 합계 (전체 수익률 계산용)
          const totalInvestmentKrwConverted = totalInvestmentKrw + (totalInvestmentUsd * exchangeRate);
          const totalCurrentValueKrwConverted = totalCurrentValueKrw + (totalCurrentValueUsd * exchangeRate);
          const totalProfitAmountKrwConverted = totalCurrentValueKrwConverted - totalInvestmentKrwConverted;
          const totalProfitRate = totalInvestmentKrwConverted > 0 
            ? (totalProfitAmountKrwConverted / totalInvestmentKrwConverted) * 100 
            : 0;
          
          return {
            ...account,
            stockCount: stocks.length,
            totalInvestmentKrw,
            totalCurrentValueKrw,
            totalInvestmentUsd,
            totalCurrentValueUsd,
            totalInvestmentKrwConverted,
            totalCurrentValueKrwConverted,
            totalProfitRate,
            totalProfitAmountKrwConverted,
            exchangeRate,
          };
        })
      );
      
      setPortfolios(portfoliosWithStockCount);
    } catch (error) {
      console.error('포트폴리오 로드 오류:', error);
      Alert.alert('오류', '포트폴리오를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePortfolio = () => {
    setEditingPortfolio(null);
    setPortfolioName('');
    setShowPortfolioModal(true);
  };

  const handleEditPortfolio = (portfolio: Account) => {
    setEditingPortfolio(portfolio);
    setPortfolioName(portfolio.name);
    setShowEditModal(true);
  };

  const handlePortfolioConfirm = async () => {
    if (!portfolioName.trim()) {
      Alert.alert('오류', '포트폴리오 이름을 입력해주세요.');
      return;
    }

    try {
      // 통화는 기본값(KRW) 사용 (실제로는 무시되지만 호환성을 위해)
      await createAccount(portfolioName.trim(), Currency.KRW);
      setShowPortfolioModal(false);
      setPortfolioName('');
      await loadPortfolios();
    } catch (error) {
      console.error('포트폴리오 생성 오류:', error);
      Alert.alert('오류', '포트폴리오 생성에 실패했습니다.');
    }
  };

  const handleEditConfirm = async () => {
    if (!editingPortfolio) return;
    
    if (!portfolioName.trim()) {
      Alert.alert('오류', '포트폴리오 이름을 입력해주세요.');
      return;
    }

    try {
      await updateAccount(editingPortfolio.id, { name: portfolioName.trim() });
      setShowEditModal(false);
      setEditingPortfolio(null);
      setPortfolioName('');
      await loadPortfolios();
    } catch (error) {
      console.error('포트폴리오 수정 오류:', error);
      Alert.alert('오류', '포트폴리오 수정에 실패했습니다.');
    }
  };

  const handleDeletePortfolio = (portfolio: Account) => {
    Alert.alert(
      '포트폴리오 삭제',
      `"${portfolio.name}" 포트폴리오를 삭제하시겠습니까?\n포함된 모든 종목과 기록이 삭제됩니다.`,
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
              await deleteAccount(portfolio.id);
              await loadPortfolios();
            } catch (error) {
              console.error('포트폴리오 삭제 오류:', error);
              Alert.alert('오류', '포트폴리오 삭제에 실패했습니다.');
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
            <Text style={styles.loadingText}>포트폴리오 불러오는 중...</Text>
          </View>
        </LinearGradient>
      </View>
    );
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
            <Text style={styles.headerTitle}>포트폴리오</Text>
            <Text style={styles.headerSubtitle}>
              포트폴리오와 종목을 추가하여 매매기록을 관리해세요
            </Text>
          </View>

          {portfolios.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📊</Text>
              <Text style={styles.emptyText}>아직 포트폴리오가 없습니다</Text>
              <Text style={styles.emptySubtext}>
                새 포트폴리오를 만들어 시작하세요
              </Text>
            </View>
          ) : (
            <View style={styles.portfoliosContainer}>
              {portfolios.map((portfolio) => (
                <TouchableOpacity
                  key={portfolio.id}
                  onPress={() => router.push(`/portfolio-detail?id=${portfolio.id}`)}
                  activeOpacity={0.8}
                  style={styles.portfolioCard}
                >
                  <LinearGradient
                    colors={['rgba(13, 27, 42, 0.8)', 'rgba(27, 38, 59, 0.6)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardGradient}
                  >
                    <View style={styles.cardContent}>
                      <View style={styles.cardLeft}>
                        <View style={styles.textContainer}>
                          <View style={styles.portfolioNameRow}>
                            <Text style={styles.portfolioIcon}>📊</Text>
                            <Text style={styles.portfolioName}>{portfolio.name}</Text>
                            {portfolio.name === '나의 포트폴리오' && (
                              <View style={styles.defaultBadge}>
                                <Text style={styles.defaultBadgeText}>기본</Text>
                              </View>
                            )}
                            <View style={styles.stockCountBadge}>
                              <Text style={styles.stockCountBadgeText}>
                                종목 {portfolio.stockCount}개
                              </Text>
                            </View>
                          </View>
                        </View>
                        {portfolio.stockCount > 0 && (
                          <View style={styles.summaryContainer}>
                                {(portfolio.totalInvestmentKrw > 0 || portfolio.totalInvestmentUsd > 0) && (
                                  <View style={styles.summaryWrapper}>
                                    {/* 접기/펼치기 헤더 */}
                                    <TouchableOpacity
                                      style={styles.summaryHeader}
                                      onPress={() => {
                                        const newExpanded = new Set(expandedPortfolios);
                                        if (newExpanded.has(portfolio.id)) {
                                          newExpanded.delete(portfolio.id);
                                        } else {
                                          newExpanded.add(portfolio.id);
                                        }
                                        setExpandedPortfolios(newExpanded);
                                      }}
                                      activeOpacity={0.7}
                                    >
                                      <View style={styles.summaryHeaderContent}>
                                        <Text style={styles.summaryHeaderTitle}>포트폴리오 합계</Text>
                                        {!expandedPortfolios.has(portfolio.id) && (
                                          <View style={styles.summaryHeaderSummary}>
                                            <Text style={[
                                              styles.summaryHeaderSummaryText,
                                              portfolio.totalProfitRate >= 0 ? styles.profitText : styles.lossText
                                            ]}>
                                              총 수익률: {portfolio.totalProfitRate >= 0 ? '+' : ''}{portfolio.totalProfitRate.toFixed(2)}%
                                            </Text>
                                            <Text style={[
                                              styles.summaryHeaderSummaryText,
                                              portfolio.totalProfitAmountKrwConverted >= 0 ? styles.profitText : styles.lossText
                                            ]}>
                                              총 수익금: {portfolio.totalProfitAmountKrwConverted >= 0 ? '+' : ''}{formatCurrency(portfolio.totalProfitAmountKrwConverted, Currency.KRW)}
                                            </Text>
                                          </View>
                                        )}
                                      </View>
                                      <Text style={styles.summaryHeaderText}>
                                        {expandedPortfolios.has(portfolio.id) ? '접기' : '자세히'}
                                      </Text>
                                    </TouchableOpacity>

                                    {/* 상세 정보 (펼침 상태일 때만 표시) */}
                                    {expandedPortfolios.has(portfolio.id) && (
                                      <View style={styles.summaryExpandedContent}>
                                        {portfolio.totalInvestmentKrw > 0 && (
                                          <>
                                            <View style={styles.summarySection}>
                                              <Text style={styles.summarySectionTitle}>원화 (KRW)</Text>
                                              <View style={styles.summaryRow}>
                                                <Text style={styles.summaryLabel}>투자금액:</Text>
                                                <Text style={styles.summaryValue}>
                                                  {formatCurrency(portfolio.totalInvestmentKrw, Currency.KRW)}
                                                </Text>
                                              </View>
                                              <View style={styles.summaryRow}>
                                                <Text style={styles.summaryLabel}>평가액:</Text>
                                                <Text style={styles.summaryValue}>
                                                  {formatCurrency(portfolio.totalCurrentValueKrw, Currency.KRW)}
                                                </Text>
                                              </View>
                                              <View style={styles.summaryRow}>
                                                <Text style={styles.summaryLabel}>수익률:</Text>
                                                {(() => {
                                                  const krwProfitRate = portfolio.totalInvestmentKrw > 0 
                                                    ? ((portfolio.totalCurrentValueKrw - portfolio.totalInvestmentKrw) / portfolio.totalInvestmentKrw) * 100 
                                                    : 0;
                                                  const krwProfitAmount = portfolio.totalCurrentValueKrw - portfolio.totalInvestmentKrw;
                                                  return (
                                                    <Text style={[
                                                      styles.summaryValue,
                                                      krwProfitRate >= 0 ? styles.profitText : styles.lossText
                                                    ]}>
                                                      {krwProfitRate >= 0 ? '+' : ''}{krwProfitRate.toFixed(2)}%
                                                    </Text>
                                                  );
                                                })()}
                                              </View>
                                              <View style={styles.summaryRow}>
                                                <Text style={styles.summaryLabel}>수익금:</Text>
                                                {(() => {
                                                  const krwProfitAmount = portfolio.totalCurrentValueKrw - portfolio.totalInvestmentKrw;
                                                  return (
                                                    <Text style={[
                                                      styles.summaryValue,
                                                      krwProfitAmount >= 0 ? styles.profitText : styles.lossText
                                                    ]}>
                                                      {krwProfitAmount >= 0 ? '+' : ''}{formatCurrency(krwProfitAmount, Currency.KRW)}
                                                    </Text>
                                                  );
                                                })()}
                                              </View>
                                            </View>
                                          </>
                                        )}
                                        {portfolio.totalInvestmentUsd > 0 && (
                                          <>
                                            <View style={styles.summarySection}>
                                              <Text style={styles.summarySectionTitle}>달러 (USD)</Text>
                                              <View style={styles.summaryRow}>
                                                <Text style={styles.summaryLabel}>투자금액:</Text>
                                                <View style={styles.summaryValueContainer}>
                                                  <Text style={styles.summaryValueInContainer}>
                                                    {formatCurrency(portfolio.totalInvestmentUsd, Currency.USD)}
                                                  </Text>
                                                  <Text style={styles.summaryValueConverted}>
                                                    ({formatCurrency(portfolio.totalInvestmentUsd * portfolio.exchangeRate, Currency.KRW)})
                                                  </Text>
                                                </View>
                                              </View>
                                              <View style={styles.summaryRow}>
                                                <Text style={styles.summaryLabel}>평가액:</Text>
                                                <View style={styles.summaryValueContainer}>
                                                  <Text style={styles.summaryValueInContainer}>
                                                    {formatCurrency(portfolio.totalCurrentValueUsd, Currency.USD)}
                                                  </Text>
                                                  <Text style={styles.summaryValueConverted}>
                                                    ({formatCurrency(portfolio.totalCurrentValueUsd * portfolio.exchangeRate, Currency.KRW)})
                                                  </Text>
                                                </View>
                                              </View>
                                              <View style={styles.summaryRow}>
                                                <Text style={styles.summaryLabel}>수익률:</Text>
                                                {(() => {
                                                  const usdProfitRate = portfolio.totalInvestmentUsd > 0 
                                                    ? ((portfolio.totalCurrentValueUsd - portfolio.totalInvestmentUsd) / portfolio.totalInvestmentUsd) * 100 
                                                    : 0;
                                                  return (
                                                    <Text style={[
                                                      styles.summaryValue,
                                                      usdProfitRate >= 0 ? styles.profitText : styles.lossText
                                                    ]}>
                                                      {usdProfitRate >= 0 ? '+' : ''}{usdProfitRate.toFixed(2)}%
                                                    </Text>
                                                  );
                                                })()}
                                              </View>
                                              <View style={styles.summaryRow}>
                                                <Text style={styles.summaryLabel}>수익금:</Text>
                                                {(() => {
                                                  const usdProfitAmount = portfolio.totalCurrentValueUsd - portfolio.totalInvestmentUsd;
                                                  return (
                                                    <View style={styles.summaryValueContainer}>
                                                      <Text style={[
                                                        styles.summaryValueInContainer,
                                                        usdProfitAmount >= 0 ? styles.profitText : styles.lossText
                                                      ]}>
                                                        {usdProfitAmount >= 0 ? '+' : ''}{formatCurrency(usdProfitAmount, Currency.USD)}
                                                      </Text>
                                                      <Text style={[
                                                        styles.summaryValueConverted,
                                                        usdProfitAmount >= 0 ? styles.profitText : styles.lossText
                                                      ]}>
                                                        ({usdProfitAmount >= 0 ? '+' : ''}{formatCurrency(usdProfitAmount * portfolio.exchangeRate, Currency.KRW)})
                                                      </Text>
                                                    </View>
                                                  );
                                                })()}
                                              </View>
                                            </View>
                                          </>
                                        )}
                                        {(portfolio.totalInvestmentKrw > 0 && portfolio.totalInvestmentUsd > 0) && (
                                          <View style={styles.summarySection}>
                                            <Text style={styles.summarySectionTitle}>전체 합계</Text>
                                            <View style={styles.summaryRow}>
                                              <Text style={styles.summaryLabel}>총 투자금액:</Text>
                                              <Text style={styles.summaryValue}>
                                                {formatCurrency(portfolio.totalInvestmentKrwConverted, Currency.KRW)}
                                              </Text>
                                            </View>
                                            <View style={styles.summaryRow}>
                                              <Text style={styles.summaryLabel}>총 평가액:</Text>
                                              <Text style={styles.summaryValue}>
                                                {formatCurrency(portfolio.totalCurrentValueKrwConverted, Currency.KRW)}
                                              </Text>
                                            </View>
                                            <View style={styles.summaryRow}>
                                              <Text style={styles.summaryLabel}>총 수익률:</Text>
                                              <Text style={[
                                                styles.summaryValue,
                                                portfolio.totalProfitRate >= 0 ? styles.profitText : styles.lossText
                                              ]}>
                                                {portfolio.totalProfitRate >= 0 ? '+' : ''}{portfolio.totalProfitRate.toFixed(2)}%
                                              </Text>
                                            </View>
                                            <View style={styles.summaryRow}>
                                              <Text style={styles.summaryLabel}>총 수익금:</Text>
                                              <Text style={[
                                                styles.summaryValue,
                                                portfolio.totalProfitAmountKrwConverted >= 0 ? styles.profitText : styles.lossText
                                              ]}>
                                                {portfolio.totalProfitAmountKrwConverted >= 0 ? '+' : ''}{formatCurrency(portfolio.totalProfitAmountKrwConverted, Currency.KRW)}
                                              </Text>
                                            </View>
                                          </View>
                                        )}
                                      </View>
                                    )}
                                  </View>
                                )}
                              </View>
                            )}
                      </View>
                      <View style={styles.cardRight}>
                        <Text style={styles.arrow}>→</Text>
                      </View>
                    </View>
                  </LinearGradient>
                  <View style={styles.portfolioActionButtons}>
                    <TouchableOpacity
                      style={styles.editPortfolioButtonBottom}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleEditPortfolio(portfolio);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.editPortfolioButtonTextBottom}>편집</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deletePortfolioButtonBottom}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeletePortfolio(portfolio);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.deletePortfolioButtonTextBottom}>삭제</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.addButton}
            onPress={handleCreatePortfolio}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#FF9800', '#F57C00']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.addButtonGradient}
            >
              <Text style={styles.addButtonIcon}>+</Text>
              <Text style={styles.addButtonText}>새 포트폴리오 추가</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>

      {/* 포트폴리오 추가 모달 */}
      <Modal
        visible={showPortfolioModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowPortfolioModal(false);
          setPortfolioName('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>새 포트폴리오 추가</Text>
            
            <Text style={styles.modalLabel}>포트폴리오 이름</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="예: 나의 주식 포트폴리오"
              placeholderTextColor="#757575"
              value={portfolioName}
              onChangeText={setPortfolioName}
              autoFocus
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowPortfolioModal(false);
                  setPortfolioName('');
                }}
              >
                <Text style={styles.modalButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handlePortfolioConfirm}
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>추가</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 포트폴리오 편집 모달 */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowEditModal(false);
          setEditingPortfolio(null);
          setPortfolioName('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>포트폴리오 수정</Text>
            
            <Text style={styles.modalLabel}>포트폴리오 이름</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="예: 나의 주식 포트폴리오"
              placeholderTextColor="#757575"
              value={portfolioName}
              onChangeText={setPortfolioName}
              autoFocus
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowEditModal(false);
                  setEditingPortfolio(null);
                  setPortfolioName('');
                }}
              >
                <Text style={styles.modalButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleEditConfirm}
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
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#B0BEC5',
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
  },
  portfoliosContainer: {
    marginBottom: 20,
  },
  portfolioCard: {
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
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.08)',
    borderBottomWidth: 0,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  cardLeft: {
    flex: 1,
  },
  textContainer: {
    flex: 1,
  },
  portfolioNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  portfolioIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  portfolioName: {
    fontSize: 22,
    fontWeight: '600',
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
    marginTop: 6,
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
  summaryContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(66, 165, 245, 0.1)',
  },
  summaryWrapper: {
    backgroundColor: 'rgba(27, 38, 59, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
    overflow: 'hidden',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  summaryExpandedContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(66, 165, 245, 0.1)',
  },
  summaryHeaderContent: {
    flex: 1,
  },
  summaryHeaderTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  summaryHeaderSummary: {
    marginTop: 4,
  },
  summaryHeaderSummaryText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  summaryHeaderText: {
    fontSize: 12,
    color: '#42A5F5',
    fontWeight: '600',
    marginLeft: 12,
  },
  summarySection: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(66, 165, 245, 0.05)',
  },
  summarySectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#42A5F5',
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
    flex: 1,
    minWidth: 80,
  },
  summaryValue: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 'auto',
    marginRight: 20,
    textAlign: 'right',
  },
  summaryValueContainer: {
    marginLeft: 'auto',
    marginRight: 20,
    alignItems: 'flex-end',
  },
  summaryValueInContainer: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'right',
  },
  summaryValueConverted: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '400',
    marginTop: 2,
    textAlign: 'right',
  },
  profitText: {
    color: '#4CAF50',
  },
  lossText: {
    color: '#EF5350',
  },
  cardRight: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  arrow: {
    fontSize: 18,
    fontWeight: '600',
    color: '#42A5F5',
  },
  portfolioActionButtons: {
    flexDirection: 'row',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
  },
  editPortfolioButtonBottom: {
    flex: 1,
    backgroundColor: 'rgba(66, 165, 245, 0.15)',
    paddingVertical: 10,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(66, 165, 245, 0.2)',
  },
  editPortfolioButtonTextBottom: {
    color: '#42A5F5',
    fontSize: 14,
    fontWeight: '600',
  },
  deletePortfolioButtonBottom: {
    flex: 1,
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  deletePortfolioButtonTextBottom: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '600',
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
  currencyButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  currencyButton: {
    flex: 1,
    backgroundColor: 'rgba(27, 38, 59, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyButtonSelected: {
    backgroundColor: 'rgba(66, 165, 245, 0.2)',
    borderColor: '#42A5F5',
  },
  currencyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#B0BEC5',
  },
  currencyButtonTextSelected: {
    color: '#42A5F5',
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
    backgroundColor: '#FF9800',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#B0BEC5',
  },
});

