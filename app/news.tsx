import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  Linking,
  TextInput,
  TouchableOpacity,
  Keyboard,
  ScrollView,
  Pressable,
  LayoutChangeEvent,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import NewsList from '../src/components/NewsList';
import { AdmobBanner } from '../src/components/AdmobBanner';
import { NewsItem } from '../src/models/NewsItem';
import { fetchGeneralNews, fetchStockNews, fetchGoogleNewsRSS } from '../src/services/NewsService';
import { initDatabase, getAllAccounts, getStocksByAccountId } from '../src/services/DatabaseService';
import { Stock } from '../src/models/Stock';
import { Currency } from '../src/models/Currency';
import { US_ETF_TO_UNDERLYING_MAP } from '../src/data/us_etf_underlying_map';
import { fetchIssueKeywords, IssueKeywordItem } from '../src/services/IssueKeywordsService';
import {
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
} from '../src/services/NewsSearchHistoryService';

export default function NewsScreen() {
  const insets = useSafeAreaInsets();
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
  const searchInputRef = useRef<TextInput>(null);
  /** 동일 q로 initializeFromParams가 여러 번 돌 때 중복 검색 방지 */
  const qSearchAppliedRef = useRef<string | null>(null);

  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false);
  const [issueKeywords, setIssueKeywords] = useState<IssueKeywordItem[]>([]);
  const [issueKeywordsLoading, setIssueKeywordsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  /** 검색 행 하단 Y (컨테이너 기준) — 오버레이가 검색창을 가리지 않도록 */
  const [searchAreaBottom, setSearchAreaBottom] = useState(72);

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
          const stockName = stock.officialName || stock.name || stock.ticker;
          
          // ETF인 경우 기초 자산 티커 확인
          const underlyingTicker = US_ETF_TO_UNDERLYING_MAP[stock.ticker];
          const isETF = !!underlyingTicker && underlyingTicker !== stock.ticker;
          
          fetchedNews = await fetchGoogleNewsRSS(
            stockName,
            stock.officialName || stock.name,
            stock.ticker,
            language,
            days
          );
          
          // ETF인 경우 기초 자산 뉴스도 가져오기 (병렬 처리로 속도 개선)
          if (isETF) {
            try {
              // ETF 뉴스와 기초 자산 뉴스를 병렬로 가져오기
              const [baseNewsResult, underlyingNewsResult] = await Promise.all([
                Promise.resolve(fetchedNews),
                fetchGoogleNewsRSS(
                  underlyingTicker,
                  underlyingTicker,
                  underlyingTicker,
                  language,
                  days
                ).catch(err => {
                  console.warn(`기초 자산 ${underlyingTicker} 뉴스 로드 실패:`, err);
                  return [];
                }),
              ]);
              
              // ETF 뉴스와 기초 자산 뉴스 합치기 (중복 제거)
              const baseTitles = new Set(baseNewsResult.map(n => n.title));
              const uniqueUnderlyingNews = underlyingNewsResult.filter(item => !baseTitles.has(item.title));
              
              fetchedNews = [...baseNewsResult, ...uniqueUnderlyingNews];
              
              console.log(`ETF ${stock.ticker} -> 기초자산 ${underlyingTicker}: 총 ${fetchedNews.length}개 뉴스`);
            } catch (error) {
              console.warn(`기초 자산 ${underlyingTicker} 뉴스 로드 실패:`, error);
              // 기초 자산 뉴스 로드 실패해도 ETF 뉴스는 유지
            }
          }
          
          // 시간순 정렬 (최신 뉴스가 맨 위)
          fetchedNews.sort((a, b) => {
            const dateA = a.publishedAt.getTime();
            const dateB = b.publishedAt.getTime();
            return dateB - dateA; // 내림차순 (최신이 먼저)
          });
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
        const initialLimit = 10; // 초기 로딩 시 10개만 표시 (로딩 속도 개선)
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

  // 포트폴리오 종목 가져오기 (최초 1회만) - 병렬 처리로 속도 개선
  useEffect(() => {
    const loadPortfolioStocks = async () => {
      try {
        await initDatabase();
        const accounts = await getAllAccounts();
        
        // 모든 포트폴리오의 종목을 병렬로 가져오기
        const stocksPromises = accounts.map(async (account) => {
          return await getStocksByAccountId(account.id);
        });
        const stocksArrays = await Promise.all(stocksPromises);
        const allStocks: Stock[] = stocksArrays.flat();
        
        // 중복 제거 (같은 ticker 중 가장 최근 것만)
        const uniqueStocksMap = new Map<string, Stock>();
        allStocks.forEach(stock => {
          const existing = uniqueStocksMap.get(stock.ticker);
          if (!existing || (stock.id && existing.id && stock.id > existing.id)) {
            uniqueStocksMap.set(stock.ticker, stock);
          }
        });
        
        // ID 순서대로 정렬하여 일관성 유지 (제한 없음 - 모든 종목 표시)
        const uniqueStocks = Array.from(uniqueStocksMap.values())
          .sort((a, b) => (a.id || 0) - (b.id || 0));
        setPortfolioStocks(uniqueStocks);
      } catch (error) {
        console.error('포트폴리오 종목 로드 오류:', error);
      }
    };
    
    loadPortfolioStocks();
  }, []);

  // URL 파라미터 변경 시 종목 설정 및 뉴스 로드
  useEffect(() => {
    const initializeFromParams = async () => {
      // URL 파라미터에서 언어 정보 가져오기
      const targetLang = (lang === 'en' ? 'en' : 'ko') as 'ko' | 'en';
      setNewsLanguage(targetLang);

      const rawQ = params?.q;
      let qFromUrl = '';
      if (typeof rawQ === 'string') {
        try {
          qFromUrl = decodeURIComponent(rawQ).trim();
        } catch {
          qFromUrl = rawQ.trim();
        }
      } else if (Array.isArray(rawQ) && rawQ[0]) {
        try {
          qFromUrl = decodeURIComponent(String(rawQ[0])).trim();
        } catch {
          qFromUrl = String(rawQ[0]).trim();
        }
      }
      if (!qFromUrl) {
        qSearchAppliedRef.current = null;
      }

      // 포트폴리오 종목이 있고 URL 파라미터에서 종목 ID를 가져온 경우
      if (portfolioStocks.length > 0 && stockIdParam) {
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
              const stockName = targetStock.officialName || targetStock.name || targetStock.ticker;
              
              // ETF인 경우 기초 자산 티커 확인
              const underlyingTicker = US_ETF_TO_UNDERLYING_MAP[targetStock.ticker];
              const isETF = !!underlyingTicker && underlyingTicker !== targetStock.ticker;
              
              let fetchedNews = await fetchGoogleNewsRSS(
                stockName,
                targetStock.officialName || targetStock.name,
                targetStock.ticker,
                targetLang,
                7
              );
              
              // ETF인 경우 기초 자산 뉴스도 가져오기 (병렬 처리로 속도 개선)
              if (isETF) {
                try {
                  // ETF 뉴스와 기초 자산 뉴스를 병렬로 가져오기
                  const [baseNewsResult, underlyingNewsResult] = await Promise.all([
                    Promise.resolve(fetchedNews),
                    fetchGoogleNewsRSS(
                      underlyingTicker,
                      underlyingTicker,
                      underlyingTicker,
                      targetLang,
                      7
                    ).catch(err => {
                      console.warn(`기초 자산 ${underlyingTicker} 뉴스 로드 실패:`, err);
                      return [];
                    }),
                  ]);
                  
                  // ETF 뉴스와 기초 자산 뉴스 합치기 (중복 제거)
                  const baseTitles = new Set(baseNewsResult.map(n => n.title));
                  const uniqueUnderlyingNews = underlyingNewsResult.filter(item => !baseTitles.has(item.title));
                  
                  fetchedNews = [...baseNewsResult, ...uniqueUnderlyingNews];
                  
                  console.log(`ETF ${targetStock.ticker} -> 기초자산 ${underlyingTicker}: 총 ${fetchedNews.length}개 뉴스`);
                } catch (error) {
                  console.warn(`기초 자산 ${underlyingTicker} 뉴스 로드 실패:`, error);
                  // 기초 자산 뉴스 로드 실패해도 ETF 뉴스는 유지
                }
              }
              
              // 시간순 정렬 (최신 뉴스가 맨 위)
              fetchedNews.sort((a, b) => {
                const dateA = a.publishedAt.getTime();
                const dateB = b.publishedAt.getTime();
                return dateB - dateA; // 내림차순 (최신이 먼저)
              });
              
              const initialLimit = 10; // 초기 로딩 시 10개만 표시 (로딩 속도 개선)
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

      // 검색어 딥링크: /news?q=키워드 (종목 ID 파라미터가 없을 때만)
      if (qFromUrl && !stockIdParam) {
        if (qSearchAppliedRef.current === qFromUrl) {
          return;
        }
        qSearchAppliedRef.current = qFromUrl;

        setSelectedStockId(null);
        setSearchQuery(qFromUrl);
        setSearchOverlayOpen(false);
        setLoading(true);
        setDaysBack(7);
        setHasMore(true);
        try {
          const fetchedNews = await fetchGeneralNews(false, qFromUrl, 7, targetLang);
          const initialLimit = 10;
          setNews(fetchedNews.slice(0, initialLimit));
          setHasMore(fetchedNews.length > initialLimit);
          await addRecentSearch(qFromUrl).catch(() => {});
          const recent = await getRecentSearches().catch(() => [] as string[]);
          setRecentSearches(recent);
        } catch (error) {
          console.error('뉴스 검색(딥링크) 로드 오류:', error);
          setNews([]);
          setHasMore(false);
        } finally {
          setLoading(false);
        }
        return;
      }

      // 종목 ID가 없거나 유효하지 않거나 포트폴리오 종목이 없으면 전체 뉴스 로드
      setSelectedStockId(null);
      setLoading(true);
      try {
        const fetchedNews = await fetchGeneralNews(false, undefined, 7, targetLang);
        const initialLimit = 10; // 초기 로딩 시 10개만 표시 (로딩 속도 개선)
        setNews(fetchedNews.slice(0, initialLimit));
        setHasMore(fetchedNews.length > initialLimit);
      } catch (error) {
        console.error('뉴스 로드 오류:', error);
        setNews([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    };

    initializeFromParams();
  }, [portfolioStocks, stockIdParam, lang, params?.q]);

  const loadOverlayData = useCallback(async () => {
    setIssueKeywordsLoading(true);
    try {
      const [issues, recent] = await Promise.all([
        fetchIssueKeywords(),
        getRecentSearches().catch(() => [] as string[]),
      ]);
      setIssueKeywords(issues);
      setRecentSearches(recent);
    } finally {
      setIssueKeywordsLoading(false);
    }
  }, []);

  const closeSearchOverlay = useCallback(() => {
    setSearchOverlayOpen(false);
    Keyboard.dismiss();
    searchInputRef.current?.blur();
  }, []);

  const runSearchQuery = async (raw: string) => {
    const q = raw.trim();
    setSearchOverlayOpen(false);
    Keyboard.dismiss();
    searchInputRef.current?.blur();

    if (q.length === 0) {
      setSearchQuery('');
      setSelectedStockId(null);
      setDaysBack(7);
      setHasMore(true);
      setLoading(true);
      loadNews(true, undefined, 7, false, undefined, null);
      return;
    }

    setSearchQuery(q);
    setSelectedStockId(null);
    setIsSearching(true);
    setLoading(true);
    setDaysBack(7);
    setHasMore(true);
    try {
      const recent = await addRecentSearch(q);
      setRecentSearches(recent);
    } catch (e) {
      console.warn('[News] addRecentSearch:', e);
    }
    loadNews(true, q, 7, false, undefined, null);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadNews(true, selectedStockId === null ? (searchQuery || undefined) : undefined);
  };

  const handleSearch = () => {
    void runSearchQuery(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchOverlayOpen(false);
    setSearchQuery('');
    setDaysBack(7);
    setHasMore(true);
    setLoading(true);
    loadNews(true);
  };

  const handleRemoveRecent = async (term: string) => {
    const next = await removeRecentSearch(term);
    setRecentSearches(next);
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

  const onSearchRowLayout = useCallback((e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    setSearchAreaBottom(y + height);
  }, []);

  /** 일부 Android에서 insets.bottom이 0 → 내비·제스처 바와 겹침 */
  const navBarBottomInset = Math.max(
    insets.bottom,
    Platform.OS === 'android' ? 48 : 12
  );
  /** 오버레이 패널 하단: top+height 대신 bottom 고정으로 테두리가 내비 뒤로 안 깔림 */
  const overlayPanelBottom = navBarBottomInset + 12;

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
      {/* 검색창 (레이아웃 측정으로 오버레이 시작 위치 결정) */}
      <View onLayout={onSearchRowLayout} style={styles.searchRowMeasure}>
        <View style={styles.searchContainer}>
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="뉴스 검색 (예: 삼성전자, 애플, 반도체...)"
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            onFocus={() => {
              setSearchOverlayOpen(true);
              void loadOverlayData();
            }}
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
      </View>
      
      {/* 종목 및 언어 선택 탭 */}
      <View>
        {/* 종목 선택 탭 */}
        {portfolioStocks.length > 0 ? (
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
        ) : (
          // 포트폴리오 종목이 없을 때도 "전체" 탭 표시 (선택된 상태로)
          <View style={styles.stockTabsContainer}>
            <View style={styles.stockTabsContentSingle}>
              <TouchableOpacity
                style={[styles.stockTab, styles.stockTabActive]}
                activeOpacity={1}
                disabled={true}
              >
                <Text
                  style={[styles.stockTabText, styles.stockTabTextActive]}
                  numberOfLines={1}
                >
                  전체
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        
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

      <View style={styles.newsBannerSlot}>
        <AdmobBanner compact />
      </View>

      <View style={[styles.newsListSafeArea, { paddingBottom: navBarBottomInset }]}>
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

      {searchOverlayOpen && (
        <View style={styles.searchOverlayRoot} pointerEvents="box-none">
          <Pressable
            style={[styles.searchOverlayBackdrop, { top: searchAreaBottom }]}
            onPress={closeSearchOverlay}
          />
          <View
            style={[
              styles.overlayPanel,
              {
                top: searchAreaBottom + 6,
                bottom: overlayPanelBottom,
              },
            ]}
          >
            <View style={styles.overlayHeader}>
              <Text style={styles.overlayHeaderTitle}>빠른 검색</Text>
              <Pressable
                onPress={closeSearchOverlay}
                hitSlop={12}
                style={styles.overlayClosePress}
              >
                <Text style={styles.overlayCloseText}>닫기</Text>
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              style={styles.overlayScrollWrap}
              contentContainerStyle={{
                paddingBottom: 16,
                flexGrow: 1,
              }}
            >
              <Text style={[styles.overlayTitle, styles.overlayTitleFirstInBody]}>최근 검색</Text>
              {recentSearches.length === 0 ? (
                <Text style={styles.overlayEmpty}>최근 검색어가 없습니다.</Text>
              ) : (
                recentSearches.map((term) => (
                  <View key={`recent-${term}`} style={styles.recentRow}>
                    <Pressable
                      style={styles.recentTextWrap}
                      onPress={() => void runSearchQuery(term)}
                    >
                      <Text style={styles.recentText} numberOfLines={2}>
                        {term}
                      </Text>
                    </Pressable>
                    <TouchableOpacity
                      onPress={() => void handleRemoveRecent(term)}
                      style={styles.recentRemove}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.recentRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}

              <Text style={[styles.overlayTitle, styles.overlayTitleSecond]}>실시간 이슈</Text>
              {issueKeywordsLoading ? (
                <ActivityIndicator color="#42A5F5" style={{ marginVertical: 12 }} />
              ) : issueKeywords.length === 0 ? (
                <Text style={styles.overlayEmpty}>
                  이슈 키워드를 불러오지 못했습니다.
                </Text>
              ) : (
                issueKeywords.map((item) => (
                  <Pressable
                    key={`issue-${item.rank}-${item.keyword}`}
                    style={({ pressed }) => [
                      styles.issueRow,
                      pressed && styles.issueRowPressed,
                    ]}
                    onPress={() => void runSearchQuery(item.keyword)}
                  >
                    <View style={styles.issueRank}>
                      <Text style={styles.issueRankText}>{item.rank}</Text>
                    </View>
                    <Text style={styles.issueKeyword} numberOfLines={2}>
                      {item.keyword}
                    </Text>
                    {item.count != null && (
                      <Text style={styles.issueCount}>{item.count.toLocaleString()}회</Text>
                    )}
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  newsBannerSlot: {
    alignItems: 'center',
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  newsListSafeArea: {
    flex: 1,
    minHeight: 0,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'rgba(45, 45, 45, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#121212',
    color: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    backgroundColor: '#121212',
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
  stockTabsContentSingle: {
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  stockTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(66, 165, 245, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    marginBottom: 12,
    gap: 8,
    paddingHorizontal: 16,
  },
  languageTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(66, 165, 245, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
  searchRowMeasure: {
    zIndex: 2,
  },
  searchOverlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 24,
  },
  searchOverlayBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
  },
  overlayPanel: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'column',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#42A5F5',
    backgroundColor: '#1E1E1E',
    overflow: 'hidden',
  },
  overlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  overlayHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  overlayClosePress: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  overlayCloseText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#42A5F5',
  },
  overlayScrollWrap: {
    flex: 1,
    minHeight: 0,
  },
  overlayTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  overlayTitleFirstInBody: {
    paddingTop: 8,
  },
  overlayTitleSecond: {
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  overlayEmpty: {
    fontSize: 13,
    color: '#64748B',
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  issueRowPressed: {
    backgroundColor: 'rgba(66, 165, 245, 0.12)',
  },
  issueRank: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#42A5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  issueRankText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  issueKeyword: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  issueCount: {
    fontSize: 13,
    color: '#94A3B8',
    marginLeft: 8,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  recentTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  recentText: {
    fontSize: 15,
    color: '#E2E8F0',
  },
  recentRemove: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentRemoveText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
  },
});

