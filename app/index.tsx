import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { AdmobBanner } from '../src/components/AdmobBanner';
import { 
  initDatabase, 
  getAllAccounts, 
  getStocksByAccountId, 
  updatePortfolioCurrentPrices 
} from '../src/services/DatabaseService';
import { Stock } from '../src/models/Stock';
import { Account } from '../src/models/Account';
import { Currency } from '../src/models/Currency';
import { formatCurrency } from '../src/utils/formatUtils';
import { ExchangeRateService } from '../src/services/ExchangeRateService';
import { getStockQuote } from '../src/services/YahooFinanceService';
import { fetchGeneralNews, fetchStockNews, fetchGoogleNewsRSS } from '../src/services/NewsService';
import { NewsItem } from '../src/models/NewsItem';
import { SettingsService } from '../src/services/SettingsService';
import { US_ETF_TO_UNDERLYING_MAP } from '../src/data/us_etf_underlying_map';

interface CalculatorCardProps {
  title: string;
  description: string | string[];
  icon: string | number; // string for emoji, number for image resource
  color: string;
  onPress: () => void;
}

const CalculatorCard: React.FC<CalculatorCardProps> = ({
  title,
  description,
  icon,
  color,
  onPress,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.card}
    >
      <LinearGradient
        colors={['rgba(13, 27, 42, 0.8)', 'rgba(27, 38, 59, 0.6)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      >
        <View style={styles.cardContent}>
          <View style={[styles.iconContainer, { borderColor: `${color}40` }]}>
            {typeof icon === 'number' ? (
              <Image source={icon} style={styles.iconImage} />
            ) : (
              <Text style={[styles.icon, { color }]}>{icon}</Text>
            )}
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.cardTitle}>{title}</Text>
            <View style={styles.descriptionContainer}>
              {(Array.isArray(description) ? description : description.split('\n')).map((line, index) => (
                <Text key={index} style={[styles.cardDescription, index > 0 && styles.descriptionSpacing]}>
                  {line}
                </Text>
              ))}
            </View>
          </View>
          <Text style={[styles.arrow, { color: '#42A5F5' }]}>→</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

interface PortfolioStock extends Stock {
  accountName: string;
}

interface MarketIndicator {
  name: string;
  symbol: string;
  price: number;
  change?: number;
  changePercent?: number;
  currency: string;
}

export default function MainScreen() {
  const router = useRouter();
  const [isPrivacyModalVisible, setIsPrivacyModalVisible] = useState(false);
  const [portfolioStocks, setPortfolioStocks] = useState<PortfolioStock[]>([]);
  const [marketIndicators, setMarketIndicators] = useState<MarketIndicator[]>([]);
  const [latestNews, setLatestNews] = useState<NewsItem[]>([]);
  const [latestNewsKo, setLatestNewsKo] = useState<NewsItem[]>([]);
  const [latestNewsEn, setLatestNewsEn] = useState<NewsItem[]>([]);
  const [latestNewsLanguage, setLatestNewsLanguage] = useState<'ko' | 'en'>('ko');
  const [relatedNews, setRelatedNews] = useState<NewsItem[]>([]);
  // 종목별 뉴스 저장: stockId -> {ko: NewsItem[], en: NewsItem[]}
  const [stockNewsMap, setStockNewsMap] = useState<Map<number, {ko: NewsItem[], en: NewsItem[]}>>(new Map());
  const [selectedStockIndex, setSelectedStockIndex] = useState<number>(0); // 선택된 종목 인덱스
  const [relatedNewsLanguage, setRelatedNewsLanguage] = useState<'ko' | 'en'>('ko');
  // 관련 뉴스를 보여줄 종목 목록 (최대 5개)
  const [relatedNewsStocks, setRelatedNewsStocks] = useState<PortfolioStock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(1350);
  
  // 메인화면 표시 설정
  const [showMarketIndicators, setShowMarketIndicators] = useState(true);
  const [showMiniBanners, setShowMiniBanners] = useState(true);
  const [showPortfolio, setShowPortfolio] = useState(true);
  const [showRelatedNews, setShowRelatedNews] = useState(true);
  const [showLatestNews, setShowLatestNews] = useState(true);
  
  // 포트폴리오 표시 개수 (기본 5개)
  const [displayedPortfolioCount, setDisplayedPortfolioCount] = useState(5);

  useFocusEffect(
    useCallback(() => {
      loadDisplaySettings();
      loadDashboardData();
    }, [])
  );

  const loadDisplaySettings = async () => {
    try {
      const [
        marketIndicators,
        miniBanners,
        portfolio,
        relatedNews,
        latestNews,
      ] = await Promise.all([
        SettingsService.getShowMarketIndicators(),
        SettingsService.getShowMiniBanners(),
        SettingsService.getShowPortfolio(),
        SettingsService.getShowRelatedNews(),
        SettingsService.getShowLatestNews(),
      ]);

      setShowMarketIndicators(marketIndicators);
      setShowMiniBanners(miniBanners);
      setShowPortfolio(portfolio);
      setShowRelatedNews(relatedNews);
      setShowLatestNews(latestNews);
    } catch (error) {
      console.error('표시 설정 로드 오류:', error);
    }
  };

  const loadDashboardData = async (forceRefresh: boolean = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setIsLoading(true);
      }

      await initDatabase();

      // 포트폴리오 종목 가져오기 (병렬 처리로 속도 개선)
      const accounts = await getAllAccounts();
      const stocksPromises = accounts.map(async (account) => {
        const stocks = await getStocksByAccountId(account.id);
        return stocks.map(stock => ({
          ...stock,
          accountName: account.name,
        }));
      });
      
      const stocksArrays = await Promise.all(stocksPromises);
      const allStocks: PortfolioStock[] = stocksArrays.flat();

      setPortfolioStocks(allStocks);

      // 현재가 업데이트는 백그라운드에서 비동기로 실행 (화면 표시를 막지 않음)
      if (forceRefresh) {
        Promise.all(
          accounts.map(account => 
            updatePortfolioCurrentPrices(account.id).catch(err => 
              console.warn('현재가 업데이트 실패:', err)
            )
          )
        ).then(async () => {
          // 현재가 업데이트 완료 후 종목 목록 다시 가져오기
          const updatedStocksPromises = accounts.map(async (account) => {
            const stocks = await getStocksByAccountId(account.id);
            return stocks.map(stock => ({
              ...stock,
              accountName: account.name,
            }));
          });
          const updatedStocksArrays = await Promise.all(updatedStocksPromises);
          const updatedStocks = updatedStocksArrays.flat();
          setPortfolioStocks(updatedStocks);
        });
      }

      // 중요 지표 가져오기 (비트코인, 금, 유가, 환율) - 병렬 처리로 변경
      loadMarketIndicators();

      // 최신 뉴스 가져오기 (한글/영문 둘 다) - 비동기로 처리하여 화면 표시를 막지 않음
      Promise.all([
        fetchGeneralNews(forceRefresh, undefined, '7d', 'ko').catch(err => {
          console.warn('한글 최신 뉴스 로드 실패:', err);
          return [];
        }),
        fetchGeneralNews(forceRefresh, undefined, '7d', 'en').catch(err => {
          console.warn('영문 최신 뉴스 로드 실패:', err);
          return [];
        }),
      ]).then(([newsKo, newsEn]) => {
        setLatestNewsKo(newsKo.slice(0, 3));
        setLatestNewsEn(newsEn.slice(0, 3));
        // 초기 로딩 시 latestNewsLanguage에 따라 latestNews 설정
        setLatestNews(latestNewsLanguage === 'ko' ? newsKo.slice(0, 3) : newsEn.slice(0, 3));
      }).catch(error => {
        console.warn('뉴스 로드 실패:', error);
      });

      // 포트폴리오 종목 관련 뉴스 가져오기 (종목별로 분리)
      if (allStocks.length > 0) {
        try {
          // 최대 5개 종목 선택 (중복 제거: 같은 ticker 중 가장 최근 것만)
          const uniqueStocksMap = new Map<string, PortfolioStock>();
          allStocks.forEach(stock => {
            const existing = uniqueStocksMap.get(stock.ticker);
            if (!existing || (stock.id && existing.id && stock.id > existing.id)) {
              uniqueStocksMap.set(stock.ticker, stock);
            }
          });
          const uniqueStocks = Array.from(uniqueStocksMap.values()).slice(0, 5);
          setRelatedNewsStocks(uniqueStocks);
          
          // 첫 번째 종목을 기본 선택으로 설정
          if (uniqueStocks.length > 0 && selectedStockIndex >= uniqueStocks.length) {
            setSelectedStockIndex(0);
          }

          // 종목별로 한글/영문 뉴스 가져오기
          const newsMap = new Map<number, {ko: NewsItem[], en: NewsItem[]}>();
          
          const newsPromises = uniqueStocks.map(async (stock) => {
            try {
              // ETF인 경우 기초 자산 티커 확인
              const underlyingTicker = US_ETF_TO_UNDERLYING_MAP[stock.ticker];
              const isETF = !!underlyingTicker;
              
              // 기본 종목 뉴스 가져오기
              const [baseNewsKo, baseNewsEn] = await Promise.all([
                fetchGoogleNewsRSS(
                  stock.officialName || stock.name || stock.ticker,
                  stock.officialName || stock.name,
                  stock.ticker,
                  'ko',
                  7
                ).catch(err => {
                  console.warn(`종목 ${stock.ticker} 한글 뉴스 로드 실패:`, err);
                  return [];
                }),
                fetchGoogleNewsRSS(
                  stock.officialName || stock.name || stock.ticker,
                  stock.officialName || stock.name,
                  stock.ticker,
                  'en',
                  7
                ).catch(err => {
                  console.warn(`종목 ${stock.ticker} 영문 뉴스 로드 실패:`, err);
                  return [];
                }),
              ]);
              
              let finalNewsKo = baseNewsKo;
              let finalNewsEn = baseNewsEn;
              
              // ETF가 아닌 경우에도 시간순 정렬 적용
              if (!isETF || underlyingTicker === stock.ticker) {
                finalNewsKo.sort((a, b) => {
                  const dateA = a.publishedAt.getTime();
                  const dateB = b.publishedAt.getTime();
                  return dateB - dateA; // 내림차순 (최신이 먼저)
                });
                finalNewsEn.sort((a, b) => {
                  const dateA = a.publishedAt.getTime();
                  const dateB = b.publishedAt.getTime();
                  return dateB - dateA; // 내림차순 (최신이 먼저)
                });
              }
              
              // ETF인 경우 기초 자산 뉴스도 가져오기
              if (isETF && underlyingTicker !== stock.ticker) {
                try {
                  const [underlyingNewsKo, underlyingNewsEn] = await Promise.all([
                    fetchGoogleNewsRSS(
                      underlyingTicker,
                      underlyingTicker,
                      underlyingTicker,
                      'ko',
                      7
                    ).catch(err => {
                      console.warn(`기초 자산 ${underlyingTicker} 한글 뉴스 로드 실패:`, err);
                      return [];
                    }),
                    fetchGoogleNewsRSS(
                      underlyingTicker,
                      underlyingTicker,
                      underlyingTicker,
                      'en',
                      7
                    ).catch(err => {
                      console.warn(`기초 자산 ${underlyingTicker} 영문 뉴스 로드 실패:`, err);
                      return [];
                    }),
                  ]);
                  
                  // ETF 뉴스와 기초 자산 뉴스 합치기 (중복 제거는 제목 기준으로 간단히)
                  const combineNews = (base: NewsItem[], underlying: NewsItem[]) => {
                    const combined = [...base];
                    const baseTitles = new Set(base.map(n => n.title));
                    
                    underlying.forEach(news => {
                      if (!baseTitles.has(news.title)) {
                        combined.push(news);
                      }
                    });
                    
                    // 시간순 정렬 (최신 뉴스가 맨 위)
                    combined.sort((a, b) => {
                      const dateA = a.publishedAt.getTime();
                      const dateB = b.publishedAt.getTime();
                      return dateB - dateA; // 내림차순 (최신이 먼저)
                    });
                    
                    return combined;
                  };
                  
                  finalNewsKo = combineNews(baseNewsKo, underlyingNewsKo);
                  finalNewsEn = combineNews(baseNewsEn, underlyingNewsEn);
                } catch (error) {
                  console.warn(`기초 자산 ${underlyingTicker} 뉴스 로드 실패:`, error);
                  // 기초 자산 뉴스 로드 실패해도 ETF 뉴스는 유지
                }
              }
              
              // 디버깅 로그
              if (isETF) {
                console.log(`ETF ${stock.ticker} -> 기초자산 ${underlyingTicker}: 한글 ${finalNewsKo.length}개, 영문 ${finalNewsEn.length}개 뉴스`);
              }
              
              newsMap.set(stock.id, {
                ko: finalNewsKo.slice(0, isETF ? 10 : 10), // ETF와 일반 종목 모두 최대 10개 저장 (표시는 3개만)
                en: finalNewsEn.slice(0, isETF ? 10 : 10),
              });
            } catch (error) {
              console.warn(`종목 ${stock.ticker} 뉴스 로드 실패:`, error);
              newsMap.set(stock.id, { ko: [], en: [] });
            }
          });

          // 관련 뉴스는 비동기로 처리하여 화면 표시를 막지 않음
          Promise.all(newsPromises).then(() => {
            setStockNewsMap(newsMap);
            
            // 선택된 종목의 뉴스 설정
            if (uniqueStocks.length > 0) {
              const selectedStock = uniqueStocks[selectedStockIndex] || uniqueStocks[0];
              const selectedNews = newsMap.get(selectedStock.id) || { ko: [], en: [] };
              setRelatedNews(relatedNewsLanguage === 'ko' ? selectedNews.ko : selectedNews.en);
            } else {
              setRelatedNews([]);
            }
          }).catch(error => {
            console.warn('관련 뉴스 로드 실패:', error);
          });
        } catch (error) {
          console.warn('관련 뉴스 로드 실패:', error);
          setRelatedNews([]);
          setStockNewsMap(new Map());
          setRelatedNewsStocks([]);
        }
      } else {
        setRelatedNews([]);
        setStockNewsMap(new Map());
        setRelatedNewsStocks([]);
      }

    } catch (error) {
      console.error('대시보드 데이터 로드 오류:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const loadMarketIndicators = async () => {
    try {
      // 모든 지표를 병렬로 로딩하여 속도 개선
      const [usdkrwQuote, btcQuote, goldQuote, oilQuote] = await Promise.all([
        getStockQuote('USDKRW=X').catch(() => null),
        getStockQuote('BTC-USD').catch(() => null),
        getStockQuote('GC=F').catch(() => null),
        getStockQuote('CL=F').catch(() => null),
      ]);

      const indicators: MarketIndicator[] = [];

      // 환율 (USDKRW=X)
      if (usdkrwQuote) {
        setExchangeRate(usdkrwQuote.price);
        indicators.push({
          name: '환율',
          symbol: 'USD/KRW',
          price: usdkrwQuote.price,
          change: usdkrwQuote.change,
          changePercent: usdkrwQuote.changePercent,
          currency: 'KRW',
        });
      } else {
        // Fallback: ExchangeRateService 사용
        const rate = await ExchangeRateService.getUsdToKrwRate();
        setExchangeRate(rate);
        indicators.push({
          name: '환율',
          symbol: 'USD/KRW',
          price: rate,
          currency: 'KRW',
        });
      }

      // 비트코인 (BTC-USD)
      if (btcQuote) {
        indicators.push({
          name: '비트코인',
          symbol: 'BTC',
          price: btcQuote.price,
          change: btcQuote.change,
          changePercent: btcQuote.changePercent,
          currency: 'USD',
        });
      }

      // 금 (GC=F)
      if (goldQuote) {
        indicators.push({
          name: '금',
          symbol: 'GC',
          price: goldQuote.price,
          change: goldQuote.change,
          changePercent: goldQuote.changePercent,
          currency: 'USD',
        });
      }

      // 유가 (CL=F)
      if (oilQuote) {
        indicators.push({
          name: '유가',
          symbol: 'CL',
          price: oilQuote.price,
          change: oilQuote.change,
          changePercent: oilQuote.changePercent,
          currency: 'USD',
        });
      }

      setMarketIndicators(indicators);
    } catch (error) {
      console.warn('중요 지표 로드 실패:', error);
    }
  };

  const handleRefresh = () => {
    loadDashboardData(true);
  };

  const handleAddStock = async () => {
    try {
      await initDatabase();
      const accounts = await getAllAccounts();
      // 이름이 "나의 포트폴리오"인 포트폴리오 찾기
      let defaultAccount = accounts.find(account => account.name === '나의 포트폴리오');
      // 없으면 첫 번째 포트폴리오 사용 (시스템이 항상 최소 1개는 생성하므로 안전)
      if (!defaultAccount && accounts.length > 0) {
        defaultAccount = accounts[0];
      }
      if (defaultAccount) {
        router.push(`/portfolio-detail?id=${defaultAccount.id}&scrollToAdd=true`);
      }
    } catch (error) {
      console.error('기본 포트폴리오 찾기 오류:', error);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A1628', '#1B263B', '#2D3748', '#1A2332']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FFFFFF"
              colors={['#FFFFFF']}
            />
          }
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#42A5F5" />
              <Text style={styles.loadingText}>데이터를 불러오는 중...</Text>
            </View>
          ) : (
            <>
              {/* 주요 지표 (최상단, 작게 일렬로 - 환율, 비트코인, 금, 유가) */}
              {showMarketIndicators && marketIndicators.length > 0 && (
                <View style={styles.topIndicatorsContainer}>
                  {marketIndicators.slice(0, 4).map((indicator, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.topIndicatorCard}
                      onPress={() => router.push('/market-indicators')}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['rgba(27, 38, 59, 0.8)', 'rgba(13, 27, 42, 0.6)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.topIndicatorGradient}
                      >
                        <Text style={styles.topIndicatorName}>{indicator.name}</Text>
                        <Text style={styles.topIndicatorPrice}>
                          {indicator.currency === 'USD' 
                            ? `$${indicator.price.toLocaleString(undefined, { minimumFractionDigits: indicator.price < 100 ? 2 : 0, maximumFractionDigits: indicator.price < 100 ? 2 : 0 })}`
                            : `${Math.round(indicator.price).toLocaleString()}원`
                          }
                        </Text>
                        {indicator.changePercent != null ? (
                          <View style={styles.topIndicatorChangeContainer}>
                            <Text
                              style={[
                                styles.topIndicatorChange,
                                indicator.changePercent >= 0 ? styles.positive : styles.negative,
                              ]}
                            >
                              {indicator.changePercent >= 0 ? '+' : ''}
                              {indicator.changePercent.toFixed(2)}%
                            </Text>
                          </View>
                        ) : null}
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* 원형 아이콘 그리드 (3x3) */}
              {showMiniBanners && (
              <View style={styles.iconGridContainer}>
                {/* 첫 번째 줄 */}
                <View style={styles.iconGridRow}>
                  <View style={styles.iconItemContainer}>
                    <TouchableOpacity
                      style={[styles.circularIconCard, { backgroundColor: '#42A5F5' }]}
                      onPress={() => router.push('/profit')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.circularIconText}>%</Text>
                    </TouchableOpacity>
                    <Text style={styles.circularIconLabel}>수익률 계산기</Text>
                  </View>
                  <View style={styles.iconItemContainer}>
                    <TouchableOpacity
                      style={[styles.circularIconCard, { backgroundColor: '#4CAF50' }]}
                      onPress={() => router.push('/averaging')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.circularIconText}>💧</Text>
                    </TouchableOpacity>
                    <Text style={styles.circularIconLabel}>물타기 계산기</Text>
                  </View>
                  <View style={styles.iconItemContainer}>
                    <TouchableOpacity
                      style={[styles.circularIconCard, { backgroundColor: '#EF5350' }]}
                      onPress={handleAddStock}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.circularIconText}>+</Text>
                    </TouchableOpacity>
                    <Text style={styles.circularIconLabel}>종목 추가</Text>
                  </View>
                </View>
                {/* 두 번째 줄 */}
                <View style={styles.iconGridRow}>
                  <View style={styles.iconItemContainer}>
                    <TouchableOpacity
                      style={[styles.circularIconCard, { backgroundColor: '#9C27B0' }]}
                      onPress={() => router.push('/news')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.circularIconText}>📰</Text>
                    </TouchableOpacity>
                    <Text style={styles.circularIconLabel}>주식 뉴스</Text>
                  </View>
                  <View style={styles.iconItemContainer}>
                    <TouchableOpacity
                      style={[styles.circularIconCard, { backgroundColor: '#FF9800' }]}
                      onPress={() => router.push('/portfolios')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.circularIconText}>📊</Text>
                    </TouchableOpacity>
                    <Text style={styles.circularIconLabel}>포트폴리오</Text>
                  </View>
                  <View style={styles.iconItemContainer}>
                    <TouchableOpacity
                      style={[styles.circularIconCard, { backgroundColor: '#E91E63' }]}
                      onPress={() => router.push('/visualization')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.circularIconText}>📉</Text>
                    </TouchableOpacity>
                    <Text style={styles.circularIconLabel}>매매 기록</Text>
                  </View>
                </View>
                {/* 세 번째 줄 */}
                <View style={styles.iconGridRow}>
                  <View style={styles.iconItemContainer}>
                    <TouchableOpacity
                      style={[styles.circularIconCard, { backgroundColor: '#2196F3' }]}
                      onPress={() => router.push('/stock-chart')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.circularIconText}>📈</Text>
                    </TouchableOpacity>
                    <Text style={styles.circularIconLabel}>종목 차트</Text>
                  </View>
                  <View style={styles.iconItemContainer}>
                    <TouchableOpacity
                      style={[styles.circularIconCard, { backgroundColor: '#757575' }]}
                      onPress={() => router.push('/settings')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.circularIconText}>⚙</Text>
                    </TouchableOpacity>
                    <Text style={styles.circularIconLabel}>환경 설정</Text>
                  </View>
                  <View style={styles.iconItemContainer}>
                    <View style={styles.circularIconCardEmpty} />
                  </View>
                </View>
              </View>
              )}

              {/* 하단 그라데이션 카드 */}
              <TouchableOpacity
                style={styles.mainGradientCard}
                onPress={() => router.push('/averaging')}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#42A5F5', '#4CAF50']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.mainGradientCardContent}
                >
                  <View style={styles.mainGradientIconContainer}>
                    <View style={styles.mainGradientIconInner}>
                      <View style={styles.chartBars}>
                        <View style={[styles.chartBar, { height: 20, backgroundColor: '#4CAF50' }]} />
                        <View style={[styles.chartBar, { height: 30, backgroundColor: '#EF5350' }]} />
                        <View style={[styles.chartBar, { height: 25, backgroundColor: '#2196F3' }]} />
                      </View>
                      <View style={styles.triangleUp} />
                    </View>
                  </View>
                  <Text style={styles.mainGradientTitle}>스마트 물타기 계산기</Text>
                  <Text style={styles.mainGradientSubtitle}>평단가 & 수익률 계산</Text>
                  <Text style={styles.mainGradientFeature}>한국·미국 주식 지원</Text>
                  <Text style={styles.mainGradientFeature}>반복 물타기 계산</Text>
                </LinearGradient>
              </TouchableOpacity>

          {/* 포트폴리오 종목 섹션 */}
          {showPortfolio && portfolioStocks.length > 0 && (
            <View style={styles.dashboardSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>내 포트폴리오</Text>
                <TouchableOpacity
                  onPress={() => router.push('/portfolios')}
                  style={styles.moreButton}
                >
                  <Text style={styles.moreButtonText}>전체 보기 →</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.stocksContainer}>
                {portfolioStocks.slice(0, displayedPortfolioCount).map((stock) => {
                  // 안전한 값 추출
                  const currentPrice = stock.currentPrice != null && !isNaN(stock.currentPrice) && isFinite(stock.currentPrice) && stock.currentPrice > 0
                    ? stock.currentPrice
                    : null;
                  const averagePrice = stock.averagePrice != null && !isNaN(stock.averagePrice) && isFinite(stock.averagePrice) && stock.averagePrice > 0
                    ? stock.averagePrice
                    : null;
                  
                  const changePercent = currentPrice != null && averagePrice != null
                    ? ((currentPrice - averagePrice) / averagePrice) * 100
                    : null;
                  const changeAmount = currentPrice != null && averagePrice != null
                    ? currentPrice - averagePrice
                    : null;
                  
                  // changePercent와 changeAmount 유효성 검사
                  const isValidChangePercent = changePercent != null && !isNaN(changePercent) && isFinite(changePercent);
                  const isValidChangeAmount = changeAmount != null && !isNaN(changeAmount) && isFinite(changeAmount);
                  
                  return (
                    <TouchableOpacity
                      key={stock.id}
                      style={styles.stockCard}
                      onPress={() => router.push(`/stock-detail?id=${stock.id}`)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.stockCardHeader}>
                        <View style={styles.stockCardNameContainer}>
                          <Text style={styles.stockCardName} numberOfLines={1}>
                            {stock.name || stock.officialName || stock.ticker}
                          </Text>
                          <Text style={styles.stockCardAccount}>{stock.accountName}</Text>
                        </View>
                        <View style={styles.stockCardPrices}>
                          {currentPrice != null ? (
                            <Text style={styles.stockCardPrice}>
                              {formatCurrency(currentPrice, stock.currency)}
                            </Text>
                          ) : (
                            <Text style={styles.stockCardPriceUnavailable}>-</Text>
                          )}
                          {averagePrice != null && (
                            <Text style={styles.stockCardAveragePrice}>
                              평단: {formatCurrency(averagePrice, stock.currency)}
                            </Text>
                          )}
                        </View>
                      </View>
                      {isValidChangePercent && isValidChangeAmount && changePercent != null && changeAmount != null ? (
                        <View style={styles.stockCardChange}>
                          <Text
                            style={[
                              styles.stockCardChangeText,
                              changePercent >= 0 ? styles.positive : styles.negative,
                            ]}
                          >
                            {`${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`}
                          </Text>
                          <Text
                            style={[
                              styles.stockCardChangeAmount,
                              changeAmount >= 0 ? styles.positive : styles.negative,
                            ]}
                          >
                            {`(${changeAmount >= 0 ? '+' : ''}${formatCurrency(Math.abs(changeAmount), stock.currency)})`}
                          </Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {portfolioStocks.length > displayedPortfolioCount && (
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={() => {
                    // 5개씩 추가하되, 전체 개수를 넘지 않도록
                    const nextCount = Math.min(displayedPortfolioCount + 5, portfolioStocks.length);
                    setDisplayedPortfolioCount(nextCount);
                  }}
                >
                  <Text style={styles.showMoreButtonText}>
                    + {portfolioStocks.length - displayedPortfolioCount}개 더 보기
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* 계산기 카드들 */}
          <View style={styles.cardsContainer}>
            <CalculatorCard
              title="수익률 계산기"
              description={['매수가, 매도가, 수량을 입력하여', '수익률과 순수익을 계산합니다']}
              icon="%"
              color="#42A5F5"
              onPress={() => router.push('/profit')}
            />
            <View style={styles.cardSpacer} />

            <CalculatorCard
              title="물타기 계산기"
              description={['현재 보유 주식과 추가 매수 정보를 합산하여 새로운', '평균 단가를 계산합니다']}
              icon="💧"
              color="#4CAF50"
              onPress={() => router.push('/averaging')}
            />
            <View style={styles.cardSpacer} />

          </View>

          <View style={styles.adSpacer} />

          <View style={styles.adContainer}>
            <AdmobBanner />
          </View>

          <View style={styles.adSpacer} />

          {/* 관련 뉴스 섹션 (포트폴리오가 있을 때만) */}
          {showRelatedNews && relatedNewsStocks.length > 0 && (
            <View style={styles.dashboardSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>관련 뉴스</Text>
                {relatedNewsStocks[selectedStockIndex] && (
                  <TouchableOpacity
                    onPress={() => {
                      // 주식뉴스 화면으로 이동 (선택된 종목과 언어 정보 포함)
                      const selectedStock = relatedNewsStocks[selectedStockIndex];
                      router.push(`/news?lang=${relatedNewsLanguage}&stockId=${selectedStock.id}`);
                    }}
                    style={styles.moreButton}
                  >
                    <Text style={styles.moreButtonText}>전체 보기 →</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {/* 종목 선택 탭 */}
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.stockTabsContainer}
                contentContainerStyle={styles.stockTabsContent}
              >
                {relatedNewsStocks.map((stock, index) => (
                  <TouchableOpacity
                    key={stock.id}
                    style={[
                      styles.stockTab,
                      selectedStockIndex === index && styles.stockTabActive,
                    ]}
                    onPress={() => {
                      setSelectedStockIndex(index);
                      const stockNews = stockNewsMap.get(stock.id) || { ko: [], en: [] };
                      setRelatedNews(relatedNewsLanguage === 'ko' ? stockNews.ko : stockNews.en);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.stockTabText,
                        selectedStockIndex === index && styles.stockTabTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {stock.name || stock.officialName || stock.ticker}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              {/* 언어 선택 탭 */}
              <View style={styles.languageTabs}>
                <TouchableOpacity
                  style={[
                    styles.languageTab,
                    relatedNewsLanguage === 'ko' && styles.languageTabActive,
                  ]}
                  onPress={() => {
                    setRelatedNewsLanguage('ko');
                    const selectedStock = relatedNewsStocks[selectedStockIndex];
                    if (selectedStock) {
                      const stockNews = stockNewsMap.get(selectedStock.id) || { ko: [], en: [] };
                      setRelatedNews(stockNews.ko);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.languageTabText,
                      relatedNewsLanguage === 'ko' && styles.languageTabTextActive,
                    ]}
                  >
                    한글 기사
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.languageTab,
                    relatedNewsLanguage === 'en' && styles.languageTabActive,
                  ]}
                  onPress={() => {
                    setRelatedNewsLanguage('en');
                    const selectedStock = relatedNewsStocks[selectedStockIndex];
                    if (selectedStock) {
                      const stockNews = stockNewsMap.get(selectedStock.id) || { ko: [], en: [] };
                      setRelatedNews(stockNews.en);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.languageTabText,
                      relatedNewsLanguage === 'en' && styles.languageTabTextActive,
                    ]}
                  >
                    영문 기사
                  </Text>
                </TouchableOpacity>
              </View>
              
              {relatedNews.length > 0 ? (
                relatedNews.slice(0, 3).map((news) => (
                  <TouchableOpacity
                    key={news.id}
                    style={styles.newsCard}
                    onPress={() => {
                      Linking.openURL(news.link).catch(err =>
                        console.error('링크 열기 실패:', err)
                      );
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.newsTitle} numberOfLines={2}>
                      {news.title}
                    </Text>
                    <Text style={styles.newsSource}>
                      {news.source} · {new Date(news.publishedAt).toLocaleDateString('ko-KR')}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyNewsContainer}>
                  <Text style={styles.emptyNewsText}>
                    {relatedNewsLanguage === 'ko' ? '한글 관련 뉴스가 없습니다.' : '영문 관련 뉴스가 없습니다.'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* 최신 뉴스 섹션 */}
          {showLatestNews && (latestNewsKo.length > 0 || latestNewsEn.length > 0) && (
            <View style={styles.dashboardSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>최신 뉴스</Text>
                <TouchableOpacity
                  onPress={() => router.push(`/news?lang=${latestNewsLanguage}`)}
                  style={styles.moreButton}
                >
                  <Text style={styles.moreButtonText}>전체 보기 →</Text>
                </TouchableOpacity>
              </View>
              
              {/* 언어 선택 탭 */}
              <View style={styles.languageTabs}>
                <TouchableOpacity
                  style={[
                    styles.languageTab,
                    latestNewsLanguage === 'ko' && styles.languageTabActive,
                  ]}
                  onPress={() => {
                    setLatestNewsLanguage('ko');
                    if (latestNewsKo.length > 0) {
                      setLatestNews(latestNewsKo.slice(0, 3));
                    } else {
                      setLatestNews([]);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.languageTabText,
                      latestNewsLanguage === 'ko' && styles.languageTabTextActive,
                    ]}
                  >
                    한글 기사
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.languageTab,
                    latestNewsLanguage === 'en' && styles.languageTabActive,
                  ]}
                  onPress={() => {
                    setLatestNewsLanguage('en');
                    if (latestNewsEn.length > 0) {
                      setLatestNews(latestNewsEn.slice(0, 3));
                    } else {
                      setLatestNews([]);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.languageTabText,
                      latestNewsLanguage === 'en' && styles.languageTabTextActive,
                    ]}
                  >
                    영문 기사
                  </Text>
                </TouchableOpacity>
              </View>
              
              {latestNews.length > 0 ? (
                latestNews.map((news) => (
                  <TouchableOpacity
                    key={news.id}
                    style={styles.newsCard}
                    onPress={() => {
                      Linking.openURL(news.link).catch(err =>
                        console.error('링크 열기 실패:', err)
                      );
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.newsTitle} numberOfLines={2}>
                      {news.title}
                    </Text>
                    <Text style={styles.newsSource}>
                      {news.source} · {new Date(news.publishedAt).toLocaleDateString('ko-KR')}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyNewsContainer}>
                  <Text style={styles.emptyNewsText}>
                    {latestNewsLanguage === 'ko' ? '한글 최신 뉴스가 없습니다.' : '영문 최신 뉴스가 없습니다.'}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.cardsContainer}>
            <CalculatorCard
              title="포트폴리오"
              description={['나의 포트폴리오와 종목을 저장하여', '매매기록을 관리합니다']}
              icon="📊"
              color="#FF9800"
              onPress={() => router.push('/portfolios')}
            />
            <View style={styles.cardSpacer} />

            <CalculatorCard
              title="매매기록 차트"
              description={['저장된 매매 기록을', '차트로 시각화하여 확인합니다']}
              icon="📉"
              color="#9C27B0"
              onPress={() => router.push('/visualization')}
            />
          </View>

          <View style={styles.cardSpacer} />

          <View style={styles.cardsContainer}>
            <CalculatorCard
              title="종목차트"
              description={['포트폴리오 종목의', '주가 차트를 확인합니다']}
              icon="📈"
              color="#E91E63"
              onPress={() => router.push('/stock-chart')}
            />
          </View>

          <View style={styles.adSpacer} />

          <View style={styles.cardsContainer}>
            <CalculatorCard
              title="주요 지표"
              description={['환율, 비트코인, 금, 유가 등', '주요 시장 지표를 확인합니다']}
              icon="💰"
              color="#00BCD4"
              onPress={() => router.push('/market-indicators')}
            />
          </View>

          <View style={styles.adSpacer} />

          <View style={styles.cardsContainer}>
            <CalculatorCard
              title="주식 뉴스"
              description={['최신 주식 뉴스를', '한눈에 확인하세요']}
              icon="📰"
              color="#FF5722"
              onPress={() => router.push('/news')}
            />
            <View style={styles.cardSpacer} />

            <CalculatorCard
              title="환경설정"
              description={['거래세와 수수료를', '원화/달러별로 설정합니다']}
              icon="⚙"
              color="#64B5F6"
              onPress={() => router.push('/settings')}
            />
          </View>

          <View style={styles.brandingContainer}>
            <Text style={styles.brandingText}>Powered by Neo Visioning</Text>
            <TouchableOpacity
              onPress={() => setIsPrivacyModalVisible(true)}
              activeOpacity={0.7}
              style={styles.privacyLinkContainer}
            >
              <Text style={styles.privacyLink}>개인정보처리방침</Text>
            </TouchableOpacity>
          </View>
            </>
          )}
        </ScrollView>
      </LinearGradient>

      {/* 개인정보처리방침 Modal */}
      <Modal
        visible={isPrivacyModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsPrivacyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>개인정보처리방침</Text>
            </View>
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={true}>
              <View style={styles.privacySection}>
                <Text style={styles.privacySectionTitle}>수집하는 항목</Text>
                <Text style={styles.privacyText}>
                  본 앱은 회원가입이나 로그인을 요구하지 않으며, 어떠한 개인정보도 직접 수집하거나 저장하지 않습니다.
                </Text>
              </View>

              <View style={styles.privacySection}>
                <Text style={styles.privacySectionTitle}>광고 관련</Text>
                <Text style={styles.privacyText}>
                  구글 애드몹(AdMob) 광고 송출을 위해 기기 식별자 및 광고 ID가 활용될 수 있습니다.
                </Text>
              </View>

              <View style={styles.privacySection}>
                <Text style={styles.privacySectionTitle}>데이터 보관</Text>
                <Text style={styles.privacyText}>
                  사용자가 입력한 계산 데이터는 앱 종료 시 휘발되거나 사용자의 기기에만 임시 저장됩니다.
                </Text>
              </View>

              <View style={styles.privacySection}>
                <Text style={styles.privacySectionTitle}>문의</Text>
                <Text style={styles.privacyText}>
                  서비스 관련 문의는 네오비저닝(Neo Visioning)으로 연락 주시기 바랍니다.
                </Text>
              </View>
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setIsPrivacyModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCloseButtonText}>닫기</Text>
            </TouchableOpacity>
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
    backgroundColor: '#0D1B2A',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 120,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 56,
  },
  headerIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: 'rgba(66, 165, 245, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 0,
    overflow: 'hidden',
  },
  headerIcon: {
    fontSize: 56,
    fontWeight: '700',
    color: '#42A5F5',
  },
  headerIconImage: {
    width: 104,
    height: 104,
    resizeMode: 'contain',
  },
  headerTitle: {
    fontSize: 38,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(66, 165, 245, 0.4)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  subtitleContainer: {
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(66, 165, 245, 0.2)',
    width: '60%',
  },
  headerSubtitle: {
    fontSize: 18,
    color: '#E3F2FD',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 12,
    fontWeight: '600',
  },
  headerFeature: {
    fontSize: 15,
    color: '#B0BEC5',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
    fontWeight: '500',
  },
  cardsContainer: {
    width: '100%',
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  cardGradient: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.1)',
    backgroundColor: 'rgba(13, 27, 42, 0.6)',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 32,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 24,
    alignSelf: 'center',
    borderWidth: 1.5,
    backgroundColor: 'rgba(13, 27, 42, 0.4)',
  },
  icon: {
    fontSize: 32,
    fontWeight: '600',
  },
  iconImage: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: -0.4,
  },
  descriptionContainer: {
    // gap 대신 marginBottom 사용
  },
  cardDescription: {
    fontSize: 15,
    color: '#BDBDBD',
    lineHeight: 21,
  },
  descriptionSpacing: {
    marginTop: 2,
  },
  arrow: {
    fontSize: 24,
    fontWeight: '600',
    marginLeft: 16,
    color: '#42A5F5',
  },
  cardSpacer: {
    height: 20,
  },
  brandingContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 8,
  },
  brandingText: {
    fontSize: 12,
    color: '#888888',
    letterSpacing: 0.5,
  },
  privacyLinkContainer: {
    marginTop: 8,
  },
  privacyLink: {
    fontSize: 12,
    color: '#42A5F5',
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.67)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#424242',
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    height: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#424242',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  privacySection: {
    marginBottom: 24,
  },
  privacySectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#42A5F5',
    marginBottom: 8,
  },
  privacyText: {
    fontSize: 14,
    color: '#E0E0E0',
    lineHeight: 20,
  },
  modalCloseButton: {
    backgroundColor: '#1976D2',
    borderRadius: 12,
    paddingVertical: 14,
    margin: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  adSpacer: {
    height: 24,
  },
  adContainer: {
    width: '100%',
    marginTop: 0,
    marginBottom: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    minHeight: 300,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#B0BEC5',
  },
  topIndicatorsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 24,
    gap: 8,
  },
  topIndicatorCard: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  topIndicatorGradient: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 85,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
    borderRadius: 12,
  },
  topIndicatorName: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  topIndicatorPrice: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  topIndicatorChangeContainer: {
    marginTop: 2,
  },
  topIndicatorChange: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  menuBannersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 20,
    gap: 6,
  },
  menuBannerCard: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    minHeight: 95,
  },
  menuBannerGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(66, 165, 245, 0.2)',
    borderRadius: 18,
  },
  menuBannerCardEmpty: {
    flex: 1,
  },
  menuBannerIcon: {
    fontSize: 28,
    marginBottom: 10,
  },
  menuBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },
  iconGridContainer: {
    width: '100%',
    marginBottom: 24,
  },
  iconGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  iconItemContainer: {
    alignItems: 'center',
    width: 70,
  },
  circularIconCard: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  circularIconCardEmpty: {
    width: 60,
    height: 60,
  },
  circularIconText: {
    fontSize: 24,
  },
  circularIconLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    width: 70,
  },
  mainGradientCard: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 24,
    marginBottom: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  mainGradientCardContent: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainGradientIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  mainGradientIconInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    marginBottom: 4,
  },
  chartBar: {
    width: 8,
    borderRadius: 2,
  },
  triangleUp: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#42A5F5',
    marginTop: 2,
  },
  mainGradientTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  mainGradientSubtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
    opacity: 0.9,
  },
  mainGradientFeature: {
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: 4,
    textAlign: 'center',
    opacity: 0.8,
  },
  dashboardSection: {
    width: '100%',
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  moreButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  moreButtonText: {
    fontSize: 14,
    color: '#42A5F5',
    fontWeight: '600',
  },
  stocksContainer: {
    gap: 12,
  },
  stockCard: {
    backgroundColor: 'rgba(13, 27, 42, 0.6)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
  },
  stockCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  stockCardNameContainer: {
    flex: 1,
    marginRight: 12,
  },
  stockCardName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  stockCardAccount: {
    fontSize: 12,
    color: '#94A3B8',
  },
  stockCardPrices: {
    alignItems: 'flex-end',
  },
  stockCardPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFC107', // 밝은 노란색/골드 (현재가)
    marginBottom: 4,
  },
  stockCardAveragePrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4DD0E1', // 밝은 시안 (평단가)
  },
  stockCardPriceUnavailable: {
    fontSize: 16,
    color: '#94A3B8',
  },
  stockCardChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockCardChangeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  stockCardChangeAmount: {
    fontSize: 12,
  },
  positive: {
    color: '#4CAF50',
  },
  negative: {
    color: '#EF5350',
  },
  showMoreButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(66, 165, 245, 0.1)',
  },
  showMoreButtonText: {
    fontSize: 14,
    color: '#42A5F5',
    fontWeight: '600',
  },
  indicatorsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  indicatorCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: 'rgba(13, 27, 42, 0.6)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
  },
  indicatorName: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  indicatorPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  indicatorChange: {
    fontSize: 12,
    fontWeight: '600',
  },
  newsCard: {
    backgroundColor: 'rgba(13, 27, 42, 0.6)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
  },
  newsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    lineHeight: 20,
  },
  newsSource: {
    fontSize: 12,
    color: '#94A3B8',
  },
  stockTabsContainer: {
    marginBottom: 12,
  },
  stockTabsContent: {
    gap: 8,
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
  emptyNewsContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyNewsText: {
    fontSize: 14,
    color: '#94A3B8',
  },
});
