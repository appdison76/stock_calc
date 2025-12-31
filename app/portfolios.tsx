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

interface PortfolioWithStockCount extends Account {
  stockCount: number;
}

export default function PortfoliosScreen() {
  const router = useRouter();
  const [portfolios, setPortfolios] = useState<PortfolioWithStockCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<Account | null>(null);
  const [portfolioName, setPortfolioName] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);

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
      
      // 포트폴리오가 없으면 기본 포트폴리오 자동 생성 (항상 최소 1개 유지)
      if (accounts.length === 0) {
        await createAccount('나의 포트폴리오', Currency.KRW);
        accounts = await getAllAccounts();
      }
      
      // 각 포트폴리오의 종목 수 조회
      const portfoliosWithStockCount: PortfolioWithStockCount[] = await Promise.all(
        accounts.map(async (account) => {
          const stocks = await getStocksByAccountId(account.id);
          return {
            ...account,
            stockCount: stocks.length,
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
    setSelectedCurrency(null);
    setShowPortfolioModal(true);
  };

  const handleEditPortfolio = (portfolio: Account) => {
    setEditingPortfolio(portfolio);
    setPortfolioName(portfolio.name);
    setSelectedCurrency(portfolio.currency);
    setShowEditModal(true);
  };

  const handleCurrencySelect = (currency: Currency) => {
    setSelectedCurrency(currency);
  };

  const handlePortfolioConfirm = async () => {
    if (!portfolioName.trim()) {
      Alert.alert('오류', '포트폴리오 이름을 입력해주세요.');
      return;
    }

    if (!selectedCurrency) {
      Alert.alert('오류', '통화를 선택해주세요.');
      return;
    }

    try {
      await createAccount(portfolioName.trim(), selectedCurrency);
      setShowPortfolioModal(false);
      setPortfolioName('');
      setSelectedCurrency(null);
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
      setSelectedCurrency(null);
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
              포트폴리오에 종목을 추가하여 매매기록을 관리하세요
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
                            <Text style={styles.portfolioName}>{portfolio.name}</Text>
                            {portfolio.name === '나의 포트폴리오' && (
                              <View style={styles.defaultBadge}>
                                <Text style={styles.defaultBadgeText}>기본</Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.metaContainer}>
                            <View style={styles.currencyBadge}>
                              <Text style={styles.currencyBadgeText}>
                                {portfolio.currency === Currency.KRW ? '₩ 원화' : '$ 달러'}
                              </Text>
                            </View>
                            <View style={styles.stockCountBadge}>
                              <Text style={styles.stockCountBadgeText}>
                                종목 {portfolio.stockCount}개
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                      <View style={styles.cardRight}>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleEditPortfolio(portfolio);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.actionButtonText}>편집</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.deleteActionButton]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDeletePortfolio(portfolio);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.actionButtonText, styles.deleteActionButtonText]}>삭제</Text>
                        </TouchableOpacity>
                        <Text style={styles.arrow}>→</Text>
                      </View>
                    </View>
                  </LinearGradient>
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
          setSelectedCurrency(null);
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

            <Text style={[styles.modalLabel, { marginTop: 20 }]}>통화 선택</Text>
            <View style={styles.currencyButtons}>
              <TouchableOpacity
                style={[
                  styles.currencyButton,
                  selectedCurrency === Currency.KRW && styles.currencyButtonSelected,
                ]}
                onPress={() => handleCurrencySelect(Currency.KRW)}
              >
                <Text
                  style={[
                    styles.currencyButtonText,
                    selectedCurrency === Currency.KRW && styles.currencyButtonTextSelected,
                  ]}
                >
                  ₩ 원화 (KRW)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.currencyButton,
                  selectedCurrency === Currency.USD && styles.currencyButtonSelected,
                ]}
                onPress={() => handleCurrencySelect(Currency.USD)}
              >
                <Text
                  style={[
                    styles.currencyButtonText,
                    selectedCurrency === Currency.USD && styles.currencyButtonTextSelected,
                  ]}
                >
                  $ 달러 (USD)
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowPortfolioModal(false);
                  setPortfolioName('');
                  setSelectedCurrency(null);
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
          setSelectedCurrency(null);
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
                  setSelectedCurrency(null);
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.08)',
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
  portfolioName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  defaultBadge: {
    backgroundColor: 'rgba(66, 165, 245, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#42A5F5',
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  currencyBadge: {
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  currencyBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9800',
  },
  stockCountBadge: {
    backgroundColor: 'rgba(156, 39, 176, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stockCountBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9C27B0',
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(66, 165, 245, 0.1)',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#42A5F5',
  },
  deleteActionButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  deleteActionButtonText: {
    color: '#F44336',
  },
  arrow: {
    fontSize: 18,
    fontWeight: '600',
    color: '#42A5F5',
    marginLeft: 4,
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

