import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { searchStocks, StockSearchResult } from '../services/YahooFinanceService';
import { KOREAN_STOCK_MAP } from '../data/korean_stocks_maps';
import { US_STOCK_MAP } from '../data/us_stocks_maps';

interface StockSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (ticker: string, officialName: string) => void;
  placeholder?: string;
  title?: string;
}

// 디바운싱을 위한 커스텀 훅
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

type MarketFilter = 'all' | 'kr' | 'us';

export default function StockSearchModal({
  visible,
  onClose,
  onSelect,
  placeholder = '예: 삼성전자, 005930, Apple Inc',
  title = '종목 검색',
}: StockSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('all');

  const debouncedSearchQuery = useDebounce(searchQuery, 300); // 300ms 디바운싱 (속도 개선)

  // 검색어 자동 감지 로직
  useEffect(() => {
    if (!searchQuery.trim()) {
      setMarketFilter('all');
      return;
    }

    const trimmedQuery = searchQuery.trim();
    
    // 6자리 숫자 → 한국 주식
    if (/^\d{6}$/.test(trimmedQuery)) {
      setMarketFilter('kr');
      return;
    }

    // 영문 티커 패턴 (2-5자, 대문자) → 미국 주식
    if (/^[A-Z]{2,5}$/.test(trimmedQuery.toUpperCase())) {
      setMarketFilter('us');
      return;
    }

    // US_STOCK_MAP에 있는 한글명 → 미국 주식
    if (US_STOCK_MAP[trimmedQuery]) {
      setMarketFilter('us');
      return;
    }

    // KOREAN_STOCK_MAP에 있는 한글명 → 한국 주식
    if (KOREAN_STOCK_MAP[trimmedQuery]) {
      setMarketFilter('kr');
      return;
    }

    // 자동 감지 실패 시 필터 유지 (사용자가 수동으로 설정한 경우)
  }, [searchQuery]);

  // 검색 실행 (경쟁 조건 방지를 위한 AbortController 사용)
  useEffect(() => {
    const abortController = new AbortController();
    let isCancelled = false;

    const performSearch = async () => {
      if (!debouncedSearchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        // 항상 'all'로 검색 (전체 검색)
        const results = await searchStocks(debouncedSearchQuery, 'all');
        
        // 디버깅
        console.log('[StockSearchModal] 검색 완료:', {
          query: debouncedSearchQuery,
          resultsCount: results.length,
          results: results.slice(0, 3).map(r => ({ symbol: r.symbol, name: r.name })),
        });
        
        // 검색이 취소되지 않았을 때만 결과 업데이트
        if (!isCancelled) {
          setSearchResults(results);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('종목 검색 오류:', error);
          setSearchResults([]);
        }
      } finally {
        if (!isCancelled) {
          setIsSearching(false);
        }
      }
    };

    performSearch();

    // cleanup: 검색어가 변경되면 이전 검색 취소
    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [debouncedSearchQuery]); // marketFilter는 의존성에서 제거 (필터 변경 시 재검색 불필요)

  // 모달이 닫힐 때 상태 초기화
  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setSearchResults([]);
      setMarketFilter('all');
    }
  }, [visible]);

  const handleSelectResult = (result: StockSearchResult) => {
    onSelect(result.symbol, result.name);
    onClose();
  };

  // 한국 주식 판별 헬퍼 함수
  const isKoreanStock = (symbol: string | undefined): boolean => {
    if (!symbol) return false;
    return symbol.endsWith('.KS') || symbol.endsWith('.KQ');
  };

  const renderSearchResult = ({ item }: { item: StockSearchResult }) => {
    const isKR = isKoreanStock(item.symbol);
    
    return (
      <TouchableOpacity
        style={styles.searchResultItem}
        onPress={() => handleSelectResult(item)}
        activeOpacity={0.7}
      >
        <View style={styles.searchResultContent}>
          <View style={styles.searchResultHeader}>
            <Text style={styles.searchResultName}>{item.name}</Text>
            {isKR ? (
              <Text style={styles.marketBadge}>🇰🇷 한국</Text>
            ) : (
              <Text style={styles.marketBadge}>🇺🇸 미국</Text>
            )}
          </View>
          {/* 한국 주식이고 원래 영문명이 있는 경우 표시 */}
          {isKR && item.originalName && (
            <Text style={styles.searchResultOriginalName}>{item.originalName}</Text>
          )}
          <View style={styles.searchResultMeta}>
            <Text style={styles.searchResultSymbol}>{item.symbol}</Text>
            {item.exchange && (
              <Text style={styles.searchResultExchange}> · {item.exchange}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // 필터링된 검색 결과
  const filteredResults = useMemo(() => {
    console.log('[StockSearchModal] filteredResults 계산:', {
      searchResultsCount: searchResults.length,
      marketFilter,
      searchResultsSample: searchResults.slice(0, 3).map(r => ({ symbol: r.symbol, name: r.name })),
    });

    const filtered = searchResults.filter((item) => {
      if (marketFilter === 'all') return true;
      const isKR = isKoreanStock(item.symbol);
      if (marketFilter === 'kr') return isKR;
      if (marketFilter === 'us') return !isKR;
      return true;
    });

    console.log('[StockSearchModal] 필터링 후:', {
      filteredCount: filtered.length,
      filteredSample: filtered.slice(0, 3).map(r => ({ symbol: r.symbol, name: r.name })),
    });

    return filtered;
  }, [searchResults, marketFilter]);

  // 시장별로 그룹화
  const koreanStocks = useMemo(() => {
    return filteredResults.filter(item => isKoreanStock(item.symbol));
  }, [filteredResults]);

  const usStocks = useMemo(() => {
    return filteredResults.filter(item => !isKoreanStock(item.symbol));
  }, [filteredResults]);


  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          
          <Text style={styles.modalLabel}>종목 검색</Text>
          <Text style={styles.modalHelperText}>
            💡 한국 종목: 종목명과 종목티커로 검색 가능 (예: 삼성전자, 005930){'\n'}
            💡 미국 종목: 종목명과 종목티커로 검색 가능 (예: Apple Inc, AAPL){'\n'}
            (주요 S&P 500 종목 200~500개는 한글명으로도 검색 가능)
          </Text>
          <TextInput
            style={styles.modalInput}
            placeholder={placeholder}
            placeholderTextColor="#757575"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            autoCapitalize="characters"
          />

          {isSearching && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#42A5F5" />
              <Text style={styles.loadingText}>검색 중...</Text>
            </View>
          )}

          {/* 검색 후 필터 버튼 - 검색 결과가 있을 때만 표시 */}
          {!isSearching && searchResults.length > 0 && (
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterButton, marketFilter === 'all' && styles.filterButtonActive]}
                onPress={() => setMarketFilter('all')}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterButtonText, marketFilter === 'all' && styles.filterButtonTextActive]}>
                  전체
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, marketFilter === 'kr' && styles.filterButtonActive]}
                onPress={() => setMarketFilter('kr')}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterButtonText, marketFilter === 'kr' && styles.filterButtonTextActive]}>
                  한국 주식
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, marketFilter === 'us' && styles.filterButtonActive]}
                onPress={() => setMarketFilter('us')}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterButtonText, marketFilter === 'us' && styles.filterButtonTextActive]}>
                  미국 주식
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView 
            style={styles.scrollableContent}
            contentContainerStyle={styles.scrollableContentContainer}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          >
            {!isSearching && searchResults.length > 0 && (() => {
              // 디버깅
              const showUsSection = (marketFilter === 'all' || marketFilter === 'us') && usStocks.length > 0;
              const showKrSection = (marketFilter === 'all' || marketFilter === 'kr') && koreanStocks.length > 0;
              
              console.log('[StockSearchModal] 렌더링 체크:', {
                searchResultsCount: searchResults.length,
                filteredResultsCount: filteredResults.length,
                usStocksCount: usStocks.length,
                koreanStocksCount: koreanStocks.length,
                marketFilter,
                showUsSection,
                showKrSection,
              });

              return (
                <>
                  {/* 필터링된 결과가 없으면 메시지 표시 */}
                  {filteredResults.length === 0 ? (
                    <Text style={styles.helperText}>
                      선택한 필터에 해당하는 검색 결과가 없습니다. 필터를 변경해보세요.
                    </Text>
                  ) : (
                    /* 필터링된 결과가 있으면 섹션별로 표시 */
                    <View style={styles.resultsContainer}>
                      {/* 미국 주식 섹션 */}
                      {showUsSection ? (
                        <View style={styles.marketSection}>
                          <Text style={styles.marketSectionTitle}>🇺🇸 미국 주식 ({usStocks.length}개)</Text>
                          <View style={styles.marketSectionDivider} />
                          {usStocks.map((item) => (
                            <View key={item.symbol}>{renderSearchResult({ item })}</View>
                          ))}
                        </View>
                      ) : null}

                      {/* 한국 주식 섹션 */}
                      {showKrSection ? (
                        <View style={styles.marketSection}>
                          <Text style={styles.marketSectionTitle}>🇰🇷 한국 주식 ({koreanStocks.length}개)</Text>
                          <View style={styles.marketSectionDivider} />
                          {koreanStocks.map((item) => (
                            <View key={item.symbol}>{renderSearchResult({ item })}</View>
                          ))}
                        </View>
                      ) : null}

                      {/* 디버깅: 결과가 있는데 섹션이 없는 경우 */}
                      {filteredResults.length > 0 && !showUsSection && !showKrSection ? (
                        <Text style={styles.helperText}>
                          디버그: filteredResults는 {filteredResults.length}개인데 섹션이 표시되지 않습니다.
                          {'\n'}marketFilter: {marketFilter}, usStocks: {usStocks.length}, koreanStocks: {koreanStocks.length}
                        </Text>
                      ) : null}
                    </View>
                  )}
                </>
              );
            })()}

            {!isSearching && debouncedSearchQuery.trim() && searchResults.length === 0 && (
              <Text style={styles.helperText}>검색 결과가 없습니다. 다른 검색어를 시도해보세요.</Text>
            )}

            {!isSearching && !debouncedSearchQuery.trim() && (
              <View style={styles.searchExamplesContainer}>
                <Text style={styles.searchExamplesTitle}>검색 예시</Text>
                
                <View style={styles.exampleSection}>
                  <Text style={styles.exampleSectionTitle}>🇰🇷 한국 주식</Text>
                  <View style={styles.exampleRow}>
                    <Text style={styles.exampleText}>• 종목명: 삼성전자, SK하이닉스, NAVER</Text>
                  </View>
                  <View style={styles.exampleRow}>
                    <Text style={styles.exampleText}>• 티커: 005930, 000660, 035420</Text>
                  </View>
                </View>

                <View style={styles.exampleSection}>
                  <Text style={styles.exampleSectionTitle}>🇺🇸 미국 주식</Text>
                  <View style={styles.exampleRow}>
                    <Text style={styles.exampleText}>• 종목명: Apple, Microsoft, NVIDIA</Text>
                  </View>
                  <View style={styles.exampleRow}>
                    <Text style={styles.exampleText}>• 티커: AAPL, MSFT, NVDA</Text>
                  </View>
                  <View style={styles.exampleRow}>
                    <Text style={styles.exampleText}>• 한글명: 애플, 마이크로소프트, 엔비디아</Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.modalButtonRow}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={onClose}
            >
              <Text style={styles.modalButtonText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.67)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'rgba(45, 45, 45, 0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
    padding: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    flexDirection: 'column',
    flex: 1,
  },
  scrollableContent: {
    flex: 1,
    minHeight: 200,
    maxHeight: 400,
  },
  scrollableContentContainer: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    color: '#B0BEC5',
    marginBottom: 8,
  },
  modalHelperText: {
    fontSize: 12,
    color: '#FF9800',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  modalInput: {
    backgroundColor: 'rgba(51, 51, 51, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#B0BEC5',
    fontSize: 14,
    marginLeft: 12,
  },
  resultsContainer: {
    marginBottom: 16,
    width: '100%',
    minHeight: 100,
  },
  resultsTitle: {
    fontSize: 14,
    color: '#B0BEC5',
    marginBottom: 12,
    fontWeight: '600',
  },
  resultsList: {
    maxHeight: 250,
  },
  searchResultItem: {
    backgroundColor: 'rgba(51, 51, 51, 0.4)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.1)',
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  searchResultOriginalName: {
    fontSize: 13,
    color: '#B0BEC5',
    marginBottom: 4,
  },
  searchResultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchResultSymbol: {
    fontSize: 14,
    color: '#42A5F5',
    fontWeight: '500',
  },
  searchResultExchange: {
    fontSize: 14,
    color: '#757575',
  },
  helperText: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 16,
    textAlign: 'center',
  },
  searchExamplesContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  searchExamplesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#42A5F5',
    marginBottom: 16,
  },
  exampleSection: {
    marginBottom: 16,
  },
  exampleSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B0BEC5',
    marginBottom: 8,
  },
  exampleRow: {
    marginBottom: 6,
  },
  exampleText: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(66, 165, 245, 0.1)',
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
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#B0BEC5',
  },
  modalButtonConfirmText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(51, 51, 51, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: 'rgba(66, 165, 245, 0.2)',
    borderColor: '#42A5F5',
  },
  filterButtonText: {
    fontSize: 11,
    color: '#B0BEC5',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#42A5F5',
    fontWeight: '600',
  },
  marketSection: {
    marginBottom: 16,
  },
  marketSectionTitle: {
    fontSize: 14,
    color: '#42A5F5',
    fontWeight: '600',
    marginBottom: 8,
  },
  marketSectionDivider: {
    height: 1,
    backgroundColor: 'rgba(66, 165, 245, 0.2)',
    marginBottom: 8,
  },
  searchResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  marketBadge: {
    fontSize: 11,
    color: '#42A5F5',
    fontWeight: '500',
  },
});

