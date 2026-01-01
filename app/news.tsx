import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Linking, TextInput, TouchableOpacity, Keyboard, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import NewsList from '../src/components/NewsList';
import { NewsItem } from '../src/models/NewsItem';
import { fetchGeneralNews, fetchStockNews, fetchGoogleNewsRSS } from '../src/services/NewsService';
import { initDatabase, getAllAccounts, getStocksByAccountId } from '../src/services/DatabaseService';
import { Stock } from '../src/models/Stock';
import { Currency } from '../src/models/Currency';

export default function NewsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const lang = params?.lang as string | undefined;
  const stockIdParam = params?.stockId as string | undefined;
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [daysBack, setDaysBack] = useState(7); // 초기: 최근 7일
  const [hasMore, setHasMore] = useState(true); // 더 불러올 뉴스가 있는지
  const [newsLanguage, setNewsLanguage] = useState<'ko' | 'en'>(() => {
    return (lang === 'en' ? 'en' : 'ko') as 'ko' | 'en';
  });
  
  // 종목 탭 관련
  const [portfolioStocks, setPortfolioStocks] = useState<Stock[]>([]);
  const [selectedStockId, setSelectedStockId] = useState<number | null>(null); // null이면 "전체"
  const stockTabsScrollRef = useRef<ScrollView>(null);

  // 선택된 종목 탭으로 스크롤
  useEffect(() => {
    // portfolioStocks가 로드되고 selectedStockId가 설정된 후에 스크롤
    if (portfolioStocks.length > 0) {
      scrollToSelectedStock();
    }
  }, [selectedStockId, portfolioStocks, scrollToSelectedStock]);

  // 화면 포커스 시에도 스크롤 실행 (다른 화면에서 이동할 때)
  useFocusEffect(
    useCallback(() => {
      // URL 파라미터에서 종목 ID를 읽어서 스크롤
      if (portfolioStocks.length > 0 && stockIdParam) {
        const stockId = parseInt(stockIdParam, 10);
        if (!isNaN(stockId)) {
          // 약간의 지연을 두어 화면이 완전히 렌더링된 후 스크롤
          const timer = setTimeout(() => {
            const selectedIndex = portfolioStocks.findIndex(s => parseInt(s.id, 10) === stockId);
            if (selectedIndex === -1 || !stockTabsScrollRef.current) return;

            const estimatedTabWidth = 120;
            const scrollX = 80 + (selectedIndex * estimatedTabWidth) - 50;
            
            stockTabsScrollRef.current.scrollTo({
              x: Math.max(0, scrollX),
              animated: true,
            });
          }, 800);
          return () => clearTimeout(timer);
        }
      } else if (portfolioStocks.length > 0 && selectedStockId !== null) {
        // stockIdParam이 없지만 selectedStockId가 설정된 경우
        const timer = setTimeout(() => {
          scrollToSelectedStock();
        }, 800);
        return () => clearTimeout(timer);
      }
    }, [portfolioStocks, stockIdParam, selectedStockId, scrollToSelectedStock])
  );

  const scrollToSelectedStock = useCallback(() => {
    if (!stockTabsScrollRef.current || portfolioStocks.length === 0) return;
    
    // 약간의 지연을 두어 레이아웃이 완료된 후 스크롤
    setTimeout(() => {
      if (selectedStockId === null) {
        // "전체" 탭이 선택된 경우, 맨 왼쪽으로 스크롤
        stockTabsScrollRef.current?.scrollTo({
          x: 0,
          animated: true,
        });
      } else {
        // 선택된 종목의 인덱스 찾기
        const selectedIndex = portfolioStocks.findIndex(s => parseInt(s.id, 10) === selectedStockId);
        if (selectedIndex === -1) return;

        // 각 탭의 대략적인 너비: paddingHorizontal(16*2) + gap(8) + 텍스트 너비(약 60-100)
        // 대략 100-120px 정도로 추정, 안전하게 120으로 설정
        const estimatedTabWidth = 120;
        // "전체" 탭 너비도 고려 (약 80px)
        const scrollX = 80 + (selectedIndex * estimatedTabWidth) - 50; // 약간 왼쪽 여유 공간
        
        stockTabsScrollRef.current?.scrollTo({
          x: Math.max(0, scrollX),
          animated: true,
        });
      }
    }, 400); // 지연 시간을 늘려서 레이아웃 완료 보장
  }, [selectedStockId, portfolioStocks]);

  const loadNews = async (forceRefresh: boolean = false, query?: string, days: number = 7, append: boolean = false, targetLanguage?: 'ko' | 'en', targetStockId?: number | null) => {
    try {
      let fetchedNews: NewsItem[] = [];
      const stockId = targetStockId !== undefined ? targetStockId : selectedStockId;
      
      if (stockId === null) {
        // 전체 뉴스
        const language = targetLanguage || newsLanguage;
        fetchedNews = await fetchGeneralNews(forceRefresh, query, days, language);
      } else {
        // 종목별 뉴스 - 언어 선택을 고려하여 한글/영문 둘 다 가져오기
        // stock.id는 string이므로 숫자로 변환해서 비교
        const stock = portfolioStocks.find(s => parseInt(s.id, 10) === stockId);
        if (stock) {
          // 언어에 따라 Google News RSS를 직접 사용
          const language = targetLanguage || newsLanguage;
          fetchedNews = await fetchGoogleNewsRSS(
            stock.officialName || stock.name || stock.ticker,
            stock.officialName || stock.name,
            stock.ticker,
            language,
            days
          );
        }
      }
      
      if (append) {
        // 기존 뉴스에 추가 (중복 제거)
        const existingIds = new Set(news.map(n => n.id));
        const newNews = fetchedNews.filter(n => !existingIds.has(n.id));
        setNews(prev => [...prev, ...newNews]);
        
        // 더 이상 새로운 뉴스가 없으면 hasMore를 false로
        if (newNews.length === 0) {
          setHasMore(false);
        }
      } else {
        // 새로 로드 - 초기에는 적은 수만 표시 (무한 스크롤을 위해)
        const initialLimit = 20; // 초기 로딩 시 20개만 표시
        setNews(fetchedNews.slice(0, initialLimit));
        setHasMore(days < 365 && fetchedNews.length > initialLimit); // 365일까지는 더 불러올 수 있음
      }
    } catch (error) {
      console.error('뉴스 로드 오류:', error);
      setHasMore(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsSearching(false);
      setLoadingMore(false);
    }
  };

  // 포트폴리오 종목 가져오기 (최초 1회만)
  useEffect(() => {
    const loadPortfolioStocks = async () => {
      try {
        await initDatabase();
        const accounts = await getAllAccounts();
        const allStocks: Stock[] = [];
        
        for (const account of accounts) {
          const stocks = await getStocksByAccountId(account.id);
          allStocks.push(...stocks);
        }
        
        // 중복 제거 (같은 ticker 중 가장 최근 것만)
        const uniqueStocksMap = new Map<string, Stock>();
        allStocks.forEach(stock => {
          const existing = uniqueStocksMap.get(stock.ticker);
          if (!existing || (stock.id && existing.id && stock.id > existing.id)) {
            uniqueStocksMap.set(stock.ticker, stock);
          }
        });
        
        // ID 순서대로 정렬하여 일관성 유지
        const uniqueStocks = Array.from(uniqueStocksMap.values())
          .sort((a, b) => (a.id || 0) - (b.id || 0))
          .slice(0, 10); // 최대 10개
        setPortfolioStocks(uniqueStocks);
      } catch (error) {
        console.error('포트폴리오 종목 로드 오류:', error);
      }
    };
    
    loadPortfolioStocks();
  }, []);

  // URL 파라미터 변경 시 종목 설정 및 뉴스 로드
  useEffect(() => {
    // 종목 목록이 아직 로드되지 않았으면 대기
    if (portfolioStocks.length === 0) {
      return;
    }

    const initializeFromParams = async () => {
      // URL 파라미터에서 언어 정보 가져오기
      const targetLang = (lang === 'en' ? 'en' : 'ko') as 'ko' | 'en';
      setNewsLanguage(targetLang);

      // URL 파라미터에서 종목 ID 가져오기
      if (stockIdParam) {
        const stockId = parseInt(stockIdParam, 10);
        if (!isNaN(stockId)) {
          // 종목이 실제로 존재하는지 확인 (stock.id는 string이므로 변환해서 비교)
          const targetStock = portfolioStocks.find(s => parseInt(s.id, 10) === stockId);
          if (targetStock) {
            // 종목 ID를 먼저 설정 (UI 업데이트를 위해) - 숫자로 명시적 변환
            setSelectedStockId(stockId);
            setLoading(true);
            // 종목 정보를 직접 사용하여 뉴스 로드
            try {
              const fetchedNews = await fetchGoogleNewsRSS(
                targetStock.officialName || targetStock.name || targetStock.ticker,
                targetStock.officialName || targetStock.name,
                targetStock.ticker,
                targetLang,
                7
              );
              const initialLimit = 20;
              setNews(fetchedNews.slice(0, initialLimit));
              setHasMore(fetchedNews.length > initialLimit);
            } catch (error) {
              console.error('뉴스 로드 오류:', error);
              setNews([]);
              setHasMore(false);
            } finally {
              setLoading(false);
            }
            return; // 종목별 뉴스를 로드했으면 종료
          }
        }
      }
      
      // 종목 ID가 없거나 유효하지 않으면 전체 뉴스 로드
      if (!stockIdParam) {
        // stockIdParam이 없을 때만 전체로 설정 (이미 설정된 경우 유지)
        setSelectedStockId(null);
        setLoading(true);
        try {
          const fetchedNews = await fetchGeneralNews(false, undefined, 7, targetLang);
          const initialLimit = 20;
          setNews(fetchedNews.slice(0, initialLimit));
          setHasMore(fetchedNews.length > initialLimit);
        } catch (error) {
          console.error('뉴스 로드 오류:', error);
          setNews([]);
          setHasMore(false);
        } finally {
          setLoading(false);
        }
      }
    };

    initializeFromParams();
  }, [portfolioStocks, stockIdParam, lang]);
  

  const handleRefresh = () => {
    setRefreshing(true);
    loadNews(true, selectedStockId === null ? (searchQuery || undefined) : undefined);
  };

  const handleSearch = () => {
    if (searchQuery.trim().length === 0) {
      // 검색어가 없으면 전체 뉴스로 (종목 선택 시에는 종목별 뉴스)
      setDaysBack(7);
      setHasMore(true);
      setLoading(true);
      loadNews(true, undefined);
      return;
    }
    
    // 검색 시에는 전체 뉴스로 전환
    setSelectedStockId(null);
    Keyboard.dismiss();
    setIsSearching(true);
    setLoading(true);
    setDaysBack(7);
    setHasMore(true);
    loadNews(true, searchQuery.trim());
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setDaysBack(7);
    setHasMore(true);
    setLoading(true);
    loadNews(true);
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    
    // 기간을 확장하여 더 많은 뉴스 가져오기
    let newDaysBack = daysBack;
    if (daysBack < 30) {
      newDaysBack = 30;
    } else if (daysBack < 365) {
      newDaysBack = 365;
    } else {
      setHasMore(false);
      return;
    }
    
    setLoadingMore(true);
    setDaysBack(newDaysBack);
    loadNews(true, searchQuery || undefined, newDaysBack, true);
  };

  const handleNewsPress = (newsItem: NewsItem) => {
    // 브라우저로 링크 열기
    Linking.openURL(newsItem.link).catch(err => 
      console.error('링크 열기 실패:', err)
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#42A5F5" />
        <Text style={styles.loadingText}>뉴스를 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 검색창 */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="뉴스 검색 (예: 삼성전자, 애플, 반도체...)"
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handleSearch} style={styles.searchButton}>
          <Text style={styles.searchButtonText}>검색</Text>
        </TouchableOpacity>
      </View>
      
      {/* 종목 및 언어 선택 탭 */}
      {portfolioStocks.length > 0 && (
        <View>
          {/* 종목 선택 탭 */}
          <ScrollView 
            ref={stockTabsScrollRef}
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.stockTabsContainer}
            contentContainerStyle={styles.stockTabsContent}
          >
            <TouchableOpacity
              style={[
                styles.stockTab,
                selectedStockId === null && styles.stockTabActive,
              ]}
              onPress={() => {
                setSelectedStockId(null);
                setDaysBack(7);
                setHasMore(true);
                // 전체 뉴스로 전환 시 검색어 유지하되, 언어는 현재 선택된 언어 사용
                loadNews(true, searchQuery || undefined, 7, false, undefined, null);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.stockTabText,
                  selectedStockId === null && styles.stockTabTextActive,
                ]}
                numberOfLines={1}
              >
                전체
              </Text>
            </TouchableOpacity>
            {portfolioStocks.map((stock) => {
              const stockIdNum = parseInt(stock.id, 10);
              const isSelected = selectedStockId !== null && selectedStockId === stockIdNum;
              return (
                <TouchableOpacity
                  key={stock.id}
                  style={[
                    styles.stockTab,
                    isSelected && styles.stockTabActive,
                  ]}
                  onPress={() => {
                    setSelectedStockId(stockIdNum);
                    setDaysBack(7);
                    setHasMore(true);
                    // 종목 선택 시 검색어는 무시하고 종목별 뉴스만 가져오기
                    loadNews(true, undefined, 7, false, undefined, stockIdNum);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.stockTabText,
                      isSelected && styles.stockTabTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {stock.name || stock.officialName || stock.ticker || '종목'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          
          {/* 언어 선택 탭 */}
          <View style={styles.languageTabs}>
          <TouchableOpacity
            style={[
              styles.languageTab,
              newsLanguage === 'ko' && styles.languageTabActive,
            ]}
            onPress={() => {
              setNewsLanguage('ko');
              // 종목 선택 여부와 관계없이 언어에 맞는 뉴스 로드
              loadNews(true, selectedStockId === null ? (searchQuery || undefined) : undefined, daysBack, false, 'ko', selectedStockId);
            }}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.languageTabText,
                newsLanguage === 'ko' && styles.languageTabTextActive,
              ]}
            >
              한글 기사
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.languageTab,
              newsLanguage === 'en' && styles.languageTabActive,
            ]}
            onPress={() => {
              setNewsLanguage('en');
              // 종목 선택 여부와 관계없이 언어에 맞는 뉴스 로드
              loadNews(true, selectedStockId === null ? (searchQuery || undefined) : undefined, daysBack, false, 'en', selectedStockId);
            }}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.languageTabText,
                newsLanguage === 'en' && styles.languageTabTextActive,
              ]}
            >
              영문 기사
            </Text>
          </TouchableOpacity>
        </View>
        </View>
      )}
      
      {/* 언어 선택 탭 (포트폴리오가 없을 때만) */}
      {portfolioStocks.length === 0 && (
        <View style={styles.languageTabs}>
          <TouchableOpacity
            style={[
              styles.languageTab,
              newsLanguage === 'ko' && styles.languageTabActive,
            ]}
            onPress={() => {
              setNewsLanguage('ko');
              loadNews(true, searchQuery || undefined, daysBack, false, 'ko');
            }}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.languageTabText,
                newsLanguage === 'ko' && styles.languageTabTextActive,
              ]}
            >
              한글 기사
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.languageTab,
              newsLanguage === 'en' && styles.languageTabActive,
            ]}
            onPress={() => {
              setNewsLanguage('en');
              loadNews(true, searchQuery || undefined, daysBack, false, 'en');
            }}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.languageTabText,
                newsLanguage === 'en' && styles.languageTabTextActive,
              ]}
            >
              영문 기사
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {(loading || isSearching) ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#42A5F5" />
          <Text style={styles.loadingText}>
            {isSearching ? `"${searchQuery}" 검색 중...` : '뉴스를 불러오는 중...'}
          </Text>
        </View>
      ) : (
        <NewsList
          news={news}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onNewsPress={handleNewsPress}
          emptyMessage={searchQuery ? `"${searchQuery}"에 대한 뉴스가 없습니다.` : '뉴스가 없습니다.'}
          onEndReached={handleLoadMore}
          loadingMore={loadingMore}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1B2A',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#0D1B2A',
    color: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 8,
  },
  clearButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  clearButtonText: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: 'bold',
  },
  searchButton: {
    backgroundColor: '#42A5F5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D1B2A',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94A3B8',
  },
  stockTabsContainer: {
    marginBottom: 12,
    marginTop: 12,
  },
  stockTabsContent: {
    gap: 8,
    paddingHorizontal: 16,
    paddingRight: 24,
  },
  stockTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(66, 165, 245, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
    marginRight: 8,
    marginLeft: 0,
  },
  stockTabActive: {
    backgroundColor: '#42A5F5',
    borderColor: '#42A5F5',
  },
  stockTabText: {
    fontSize: 14,
    color: '#42A5F5',
    fontWeight: '600',
  },
  stockTabTextActive: {
    color: '#FFFFFF',
  },
  languageTabs: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
    paddingHorizontal: 16,
  },
  languageTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(66, 165, 245, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
  },
  languageTabActive: {
    backgroundColor: '#42A5F5',
    borderColor: '#42A5F5',
  },
  languageTabText: {
    fontSize: 14,
    color: '#42A5F5',
    fontWeight: '600',
  },
  languageTabTextActive: {
    color: '#FFFFFF',
  },
});

