import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdmobBanner } from '../src/components/AdmobBanner';
import { AdmobNativeAd } from '../src/components/AdmobNativeAd';
import { CoupangDynamicBanner } from '../src/components/CoupangDynamicBanner';
import { getUnreadCount } from '../src/services/NotificationService';
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
import { InterestRateService } from '../src/services/InterestRateService';
import { fetchGeneralNews, fetchStockNews, fetchGoogleNewsRSS } from '../src/services/NewsService';
import { NewsItem } from '../src/models/NewsItem';
import { SettingsService } from '../src/services/SettingsService';
import { US_ETF_TO_UNDERLYING_MAP } from '../src/data/us_etf_underlying_map';
import BottomNavigationBar from '../src/components/BottomNavigationBar';

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
        colors={['rgba(18, 18, 18, 0.8)', 'rgba(30, 30, 30, 0.6)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      >
        <View style={styles.cardContent}>
          <View style={[styles.iconContainer, { borderColor: `${color}40` }]}>
            {typeof icon === 'number' ? (
              <Image source={icon} style={styles.iconImage} />
            ) : icon === 'heatmap' ? (
              <View style={styles.heatmapIconContainer}>
                {/* 하단 왼쪽 - 빨간색 (내림) */}
                <View style={[styles.heatmapBlock, styles.heatmapBlockBottom, { backgroundColor: '#EF5350' }]} />
                {/* 상단 오른쪽 - 녹색 (오름) */}
                <View style={[styles.heatmapBlock, styles.heatmapBlockTop, { backgroundColor: '#4CAF50' }]} />
              </View>
            ) : icon === '▲▼' ? (
              <View style={styles.triangleIconContainer}>
                {/* 위쪽 삼각형 - 녹색 (익절) */}
                <Text style={[styles.triangleIcon, { color: '#4CAF50' }]}>▲</Text>
                {/* 아래쪽 삼각형 - 빨간색 (손절) */}
                <Text style={[styles.triangleIcon, { color: '#EF5350' }]}>▼</Text>
              </View>
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
  const insets = useSafeAreaInsets();
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
  const [nyTime, setNyTime] = useState<string>('--:--');
  const [euTime, setEuTime] = useState<string>('--:--');
  const [krDate, setKrDate] = useState<string>('');
  const [isKrHoliday, setIsKrHoliday] = useState<boolean>(false);
  const [usInterestRate, setUsInterestRate] = useState<string | null>(null);
  const [krInterestRate, setKrInterestRate] = useState<number | null>(null);
  const [jpInterestRate, setJpInterestRate] = useState<number | null>(null);
  
  // 메인화면 표시 설정
  const [showMarketIndicators, setShowMarketIndicators] = useState(true);
  const [showMiniBanners, setShowMiniBanners] = useState(true);
  const [showPortfolio, setShowPortfolio] = useState(true);
  const [showRelatedNews, setShowRelatedNews] = useState(true);
  const [showLatestNews, setShowLatestNews] = useState(true);
  const [showWorldTime, setShowWorldTime] = useState(true);
  const [showInterestRates, setShowInterestRates] = useState(true);
  
  // 포트폴리오 표시 개수 (기본 5개)
  const [displayedPortfolioCount, setDisplayedPortfolioCount] = useState(5);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  
  const UPDATE_INTERVAL = 1 * 60 * 1000; // 1분

  // 시장 지표 자동 갱신 (1분마다)
  useEffect(() => {
    // 초기 로드
    loadMarketIndicators();
    
    // 1분마다 자동 갱신
    const interval = setInterval(() => {
      loadMarketIndicators();
    }, UPDATE_INTERVAL);
    
    return () => clearInterval(interval);
  }, []);

  // 포트폴리오 현재가 자동 갱신 (1분마다)
  useEffect(() => {
    const updatePortfolioPrices = async () => {
      try {
        await initDatabase();
        const accounts = await getAllAccounts();
        if (accounts.length > 0) {
          console.log('[MainScreen] 포트폴리오 현재가 자동 갱신 시작');
          await Promise.all(
            accounts.map(account => 
              updatePortfolioCurrentPrices(account.id).catch(err => 
                console.warn('현재가 업데이트 실패:', err)
              )
            )
          );
          // 갱신 후 종목 목록 다시 가져오기
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
          console.log('[MainScreen] 포트폴리오 현재가 자동 갱신 완료');
        }
      } catch (error) {
        console.error('[MainScreen] 포트폴리오 현재가 자동 갱신 오류:', error);
      }
    };

    // 초기 로드 (약간의 지연을 두어 화면 표시 후 실행)
    const initialTimeout = setTimeout(() => {
      updatePortfolioPrices();
    }, 2000); // 2초 후 첫 갱신
    
    // 1분마다 자동 갱신
    const interval = setInterval(() => {
      updatePortfolioPrices();
    }, UPDATE_INTERVAL);
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  // 뉴욕 및 유럽 시간 업데이트
  useEffect(() => {
    const updateTimes = () => {
      try {
        const now = new Date();
        
        // 뉴욕 시간
        const nyTimeString = now.toLocaleString('en-US', { 
          timeZone: 'America/New_York',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        });
        const nyTimeMatch = nyTimeString.match(/(\d{1,2}):(\d{2})/);
        if (nyTimeMatch) {
          const hours = nyTimeMatch[1].padStart(2, '0');
          const minutes = nyTimeMatch[2];
          setNyTime(`${hours}:${minutes}`);
        } else {
          setNyTime('--:--');
        }
        
        // 유럽 시간 (런던 시간대 사용)
        const euTimeString = now.toLocaleString('en-US', { 
          timeZone: 'Europe/London',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        });
        const euTimeMatch = euTimeString.match(/(\d{1,2}):(\d{2})/);
        if (euTimeMatch) {
          const hours = euTimeMatch[1].padStart(2, '0');
          const minutes = euTimeMatch[2];
          setEuTime(`${hours}:${minutes}`);
        } else {
          setEuTime('--:--');
        }
        
        // 한국 날짜와 요일
        const krDateString = now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' });
        let krDateObj: Date;
        if (!isNaN(new Date(krDateString).getTime())) {
          krDateObj = new Date(krDateString);
        } else {
          // 대체 방법: UTC 시간에 9시간 추가 (KST = UTC+9)
          const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
          krDateObj = new Date(utcTime + (9 * 60 * 60 * 1000));
        }
        
        const month = krDateObj.getMonth() + 1;
        const day = krDateObj.getDate();
        const dayOfWeek = krDateObj.getDay();
        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
        const weekday = weekdays[dayOfWeek];
        setKrDate(`${month}.${day} (${weekday})`);
        
        // 공휴일 확인 (일요일 또는 주요 공휴일)
        const isHoliday = dayOfWeek === 0 || // 일요일
          (month === 1 && day === 1) || // 신정
          (month === 3 && day === 1) || // 삼일절
          (month === 5 && day === 5) || // 어린이날
          (month === 6 && day === 6) || // 현충일
          (month === 8 && day === 15) || // 광복절
          (month === 10 && day === 3) || // 개천절
          (month === 10 && day === 9) || // 한글날
          (month === 12 && day === 25); // 크리스마스
        setIsKrHoliday(isHoliday);
      } catch (error) {
        console.error('시간 업데이트 오류:', error);
        setNyTime('--:--');
        setEuTime('--:--');
        setKrDate('');
      }
    };
    
    updateTimes();
    const interval = setInterval(updateTimes, 60000); // 1분마다 업데이트
    
    return () => clearInterval(interval);
  }, []);

  // 읽지 않은 알림 수 업데이트
  const updateUnreadNotificationCount = async () => {
    try {
      const count = await getUnreadCount();
      setUnreadNotificationCount(count);
    } catch (error) {
      console.error('읽지 않은 알림 수 업데이트 오류:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDisplaySettings();
      // 포그라운드로 돌아올 때는 항상 갱신 (1분이 안 지났더라도)
      loadDashboardData(true);
      // 화면 포커스 시 시장 지표도 갱신 (1분마다 자동 갱신도 계속됨)
      loadMarketIndicators();
      // 읽지 않은 알림 수 업데이트
      updateUnreadNotificationCount();
    }, [])
  );

  // 초기 로드 시 읽지 않은 알림 수 가져오기
  useEffect(() => {
    updateUnreadNotificationCount();
  }, []);

  const loadDisplaySettings = async () => {
    try {
      const [
        marketIndicators,
        miniBanners,
        portfolio,
        relatedNews,
        latestNews,
        worldTime,
        interestRates,
      ] = await Promise.all([
        SettingsService.getShowMarketIndicators(),
        SettingsService.getShowMiniBanners(),
        SettingsService.getShowPortfolio(),
        SettingsService.getShowRelatedNews(),
        SettingsService.getShowLatestNews(),
        SettingsService.getShowWorldTime(),
        SettingsService.getShowInterestRates(),
      ]);

      setShowMarketIndicators(marketIndicators);
      setShowMiniBanners(miniBanners);
      setShowPortfolio(portfolio);
      setShowRelatedNews(relatedNews);
      setShowLatestNews(latestNews);
      setShowWorldTime(worldTime);
      setShowInterestRates(interestRates);
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
        console.log('[MainScreen] 현재가 갱신 시작');
        Promise.all(
          accounts.map(account => 
            updatePortfolioCurrentPrices(account.id).catch(err => 
              console.warn('현재가 업데이트 실패:', err)
            )
          )
        ).then(async () => {
          console.log('[MainScreen] 현재가 갱신 완료');
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

      // 중요 지표는 useEffect에서 1분마다 자동 갱신되므로 여기서는 호출하지 않음
      // (초기 로드 시에만 useEffect에서 호출됨)

      // 기준금리 가져오기 (비동기로 처리하여 화면 표시를 막지 않음)
      InterestRateService.getAllInterestRates()
        .then((rates) => {
          console.log('[MainScreen] 기준금리 로드 완료:', rates);
          setUsInterestRate(rates.us);
          setKrInterestRate(rates.kr);
          setJpInterestRate(rates.jp);
        })
        .catch((error) => {
          console.error('[MainScreen] 기준금리 로드 실패:', error);
        });

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
        colors={['#000000', '#121212', '#1A1A1A', '#0D0D0D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* 최상단 헤더 */}
        <View style={[styles.topHeader, { paddingTop: insets.top + 10 }]}>
          <View style={styles.topHeaderLeft}>
            <View style={styles.logoContainer}>
              <Image 
                source={require('../assets/icon.png')} 
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.topHeaderTitle}>스마트 물타기 계산기</Text>
          </View>
          <View style={styles.topHeaderRight}>
            <TouchableOpacity 
              style={styles.addStockButton}
              onPress={handleAddStock}
              activeOpacity={0.7}
            >
              <Text style={styles.addStockButtonText}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.notificationButtonWrapper}
              onPress={() => router.push('/notifications')}
              activeOpacity={0.7}
            >
              <View style={styles.notificationButton}>
                <Text style={styles.notificationIcon}>🔔</Text>
              </View>
              {unreadNotificationCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

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
              {/* 뉴욕 및 런던 시간 표시 */}
              {showWorldTime && (
                <View style={styles.timeContainer}>
                  {krDate && (
                    <View style={styles.timeItem}>
                      <Text style={styles.timeLabel}>오늘</Text>
                      <Text style={[styles.timeValue, isKrHoliday && styles.timeValueHoliday]}>{krDate}</Text>
                    </View>
                  )}
                  <View style={styles.timeItem}>
                    <Text style={styles.timeLabel}>뉴욕</Text>
                    <Text style={styles.timeValue}>{nyTime}</Text>
                  </View>
                  <View style={styles.timeItem}>
                    <Text style={styles.timeLabel}>런던</Text>
                    <Text style={styles.timeValue}>{euTime}</Text>
                  </View>
                </View>
              )}

              {/* 기준금리 표시 (미국, 한국, 일본) */}
              {showInterestRates && (
                <View style={styles.interestRateContainer}>
                  <View style={[styles.interestRateItem, { marginLeft: 8 }]}>
                    <Text style={styles.interestRateLabel}>미국</Text>
                    <Text style={styles.interestRateValue}>
                      {usInterestRate !== null ? `${usInterestRate}%` : '--%'}
                    </Text>
                  </View>
                  <View style={styles.interestRateItem}>
                    <Text style={styles.interestRateLabel}>한국</Text>
                    <Text style={styles.interestRateValue}>
                      {krInterestRate !== null ? `${krInterestRate.toFixed(2)}%` : '--%'}
                    </Text>
                  </View>
                  <View style={styles.interestRateItem}>
                    <Text style={styles.interestRateLabel}>일본</Text>
                    <Text style={styles.interestRateValue}>
                      {jpInterestRate !== null ? `${jpInterestRate.toFixed(2)}%` : '--%'}
                    </Text>
                  </View>
                </View>
              )}

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
                        colors={['rgba(30, 30, 30, 0.8)', 'rgba(18, 18, 18, 0.6)']}
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
                      style={[styles.circularIconCard, { backgroundColor: 'rgba(76, 175, 80, 0.85)' }]}
                      onPress={() => router.push('/profit')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.circularIconText}>%</Text>
                    </TouchableOpacity>
                    <Text style={styles.circularIconLabel}>수익률 계산기</Text>
                  </View>
                  <View style={styles.iconItemContainer}>
                    <TouchableOpacity
                      style={[styles.circularIconCard, { backgroundColor: 'rgba(33, 150, 243, 0.85)' }]}
                      onPress={() => router.push('/averaging')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.circularIconText}>💧</Text>
                    </TouchableOpacity>
                    <Text style={styles.circularIconLabel}>물타기 계산기</Text>
                  </View>
                  <View style={styles.iconItemContainer}>
                    <TouchableOpacity
                      style={[styles.circularIconCard, { backgroundColor: 'rgba(0, 188, 212, 0.85)' }]}
                      onPress={() => router.push('/target-price')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.circularIconText}>🎯</Text>
                    </TouchableOpacity>
                    <Text style={styles.circularIconLabel}>목표가 계산기</Text>
                  </View>
                </View>
                {/* 두 번째 줄 */}
                <View style={styles.iconGridRow}>
                  <View style={styles.iconItemContainer}>
                    <TouchableOpacity
                      style={[styles.circularIconCard, { backgroundColor: 'rgba(171, 71, 188, 0.85)' }]}
                      onPress={() => router.push('/news')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.circularIconText}>📰</Text>
                    </TouchableOpacity>
                    <Text style={styles.circularIconLabel}>주식 뉴스</Text>
                  </View>
                  <View style={styles.iconItemContainer}>
                    <TouchableOpacity
                      style={[styles.circularIconCard, { backgroundColor: 'rgba(255, 167, 38, 0.85)' }]}
                      onPress={() => router.push('/portfolios')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.circularIconText}>📊</Text>
                    </TouchableOpacity>
                    <Text style={styles.circularIconLabel}>포트폴리오</Text>
                  </View>
                  <View style={styles.iconItemContainer}>
                    <TouchableOpacity
                      style={[styles.circularIconCard, { backgroundColor: 'rgba(255, 107, 107, 0.85)' }]}
                      onPress={handleAddStock}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.circularIconText}>+</Text>
                    </TouchableOpacity>
                    <Text style={styles.circularIconLabel}>종목 추가</Text>
                  </View>
                </View>
                {/* 세 번째 줄 */}
                <View style={styles.iconGridRow}>
                  <View style={styles.iconItemContainer}>
                    <TouchableOpacity
                      style={[styles.circularIconCard, { backgroundColor: 'rgba(66, 165, 245, 0.85)' }]}
                      onPress={() => router.push('/stock-chart')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.circularIconText}>📈</Text>
                    </TouchableOpacity>
                    <Text style={styles.circularIconLabel}>종목 차트</Text>
                  </View>
                  <View style={styles.iconItemContainer}>
                    <TouchableOpacity
                      style={[styles.circularIconCard, { backgroundColor: 'rgba(236, 64, 122, 0.85)' }]}
                      onPress={() => router.push('/visualization')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.circularIconText}>📉</Text>
                    </TouchableOpacity>
                    <Text style={styles.circularIconLabel}>매매 기록</Text>
                  </View>
                  <View style={styles.iconItemContainer}>
                    <TouchableOpacity
                      style={[styles.circularIconCard, { backgroundColor: 'rgba(84, 110, 122, 0.85)' }]}
                      onPress={() => router.push('/heatmap')}
                      activeOpacity={0.8}
                    >
                      <View style={styles.heatmapIconContainer}>
                        {/* 하단 왼쪽 - 빨간색 (내림) */}
                        <View style={[styles.heatmapBlock, styles.heatmapBlockBottom, { backgroundColor: '#EF5350' }]} />
                        {/* 상단 오른쪽 - 녹색 (오름) */}
                        <View style={[styles.heatmapBlock, styles.heatmapBlockTop, { backgroundColor: '#4CAF50' }]} />
                      </View>
                    </TouchableOpacity>
                    <Text style={styles.circularIconLabel}>히트맵</Text>
                  </View>
                </View>
              </View>
              )}

              {/* 하단 그라데이션 카드 */}
              {/* <TouchableOpacity
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
                    <Image 
                      source={require('../assets/icon.png')} 
                      style={styles.mainGradientLogo}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={styles.mainGradientTitle}>스마트 물타기 계산기</Text>
                  <Text style={styles.mainGradientSubtitle}>평단가 & 수익률 계산</Text>
                  <Text style={styles.mainGradientFeature}>한국·미국 주식 지원</Text>
                  <Text style={styles.mainGradientFeature}>반복 물타기 계산</Text>
                </LinearGradient>
              </TouchableOpacity> */}

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

          {/* 쿠팡 배너: 내 포트폴리오 아래 (포트폴리오 영역 표시 설정과 독립적으로 표시) */}
          {portfolioStocks.length > 0 && (
            <CoupangDynamicBanner width={320} height={140} />
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

            <CalculatorCard
              title="목표가 계산기"
              description={['현재가와 목표 수익률을 입력하여', '목표가와 예상 수익을 계산합니다']}
              icon="🎯"
              color="#4ECDC4"
              onPress={() => router.push('/target-price')}
            />
            <View style={styles.cardSpacer} />

            <CalculatorCard
              title="손절/익절 계산기"
              description={['매수가와 목표 수익률, 손절 수익률을 입력하여', '목표가와 손절가를 계산합니다']}
              icon="▲▼"
              color="#FF6B6B"
              onPress={() => router.push('/stop-loss-take-profit')}
            />
            <View style={styles.cardSpacer} />

            <CalculatorCard
              title="정기 매수 계산기"
              description={['정기 매수 금액과 주기를 입력하여', '평균 매수가와 최종 수익률을 계산합니다']}
              icon="📆"
              color="#A8E6CF"
              onPress={() => router.push('/regular-purchase-simulator')}
            />
            <View style={styles.cardSpacer} />

            <CalculatorCard
              title="배당금 계산기"
              description={['배당금, 배당률, 보유 수량을 입력하여', '연간 배당금과 배당 수익률을 계산합니다']}
              icon="💵"
              color="#FFD93D"
              onPress={() => router.push('/dividend')}
            />
            <View style={styles.cardSpacer} />

            <CalculatorCard
              title="양도소득세 계산기"
              description={['한국/미국 주식 양도차익에 대한', '양도소득세를 계산합니다']}
              icon="💰"
              color="#9B59B6"
              onPress={() => router.push('/capital-gains-tax')}
            />
            <View style={styles.cardSpacer} />

            <CalculatorCard
              title="수수료 비교 계산기"
              description={['거래 금액과 거래 횟수를 입력하여', '여러 증권사의 수수료를 비교합니다']}
              icon="⚖️"
              color="#6BCF7F"
              onPress={() => router.push('/fee-comparison')}
            />
            <View style={styles.cardSpacer} />

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

          {/* 배너 광고: 관련 뉴스와 최신 뉴스 사이 */}
          {(showRelatedNews && relatedNewsStocks.length > 0) || (showLatestNews && (latestNewsKo.length > 0 || latestNewsEn.length > 0)) ? (
            <>
              <View style={styles.adSpacer} />
              <View style={styles.adContainer}>
                <AdmobBanner />
              </View>
              <View style={styles.adSpacer} />
            </>
          ) : null}

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

          {/* 네이티브 광고: 최신 뉴스 아래 */}
          {showLatestNews && (latestNewsKo.length > 0 || latestNewsEn.length > 0) && (
            <AdmobNativeAd />
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
            <View style={styles.cardSpacer} />

            <CalculatorCard
              title="히트맵"
              description={['포트폴리오 및 시장 종목의', '수익률을 색상으로 한눈에 확인합니다']}
              icon="heatmap"
              color="#FF6B35"
              onPress={() => router.push('/heatmap')}
            />
          </View>

          <View style={styles.cardsContainer}>
            <CalculatorCard
              title="주요 지표"
              description={['환율, 비트코인, 금, 유가 등', '주요 시장 지표를 확인합니다']}
              icon="📌"
              color="#00BCD4"
              onPress={() => router.push('/market-indicators')}
            />
          </View>

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
        <BottomNavigationBar />
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
    backgroundColor: '#121212',
  },
  gradient: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 20,
    paddingBottom: 100,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#42A5F5',
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoContainer: {
    width: 50,
    height: 50,
    marginRight: 10,
    borderRadius: 25,
    backgroundColor: '#121212',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 60,
    height: 60,
  },
  topHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  addStockButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  addStockButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
    lineHeight: 28,
  },
  topHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notificationButtonWrapper: {
    position: 'relative',
  },
  notificationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationIcon: {
    fontSize: 20,
    color: '#E0E0E0',
    opacity: 0.9,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF5350',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#42A5F5',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
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
    backgroundColor: 'rgba(45, 45, 45, 0.6)',
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
    backgroundColor: 'rgba(45, 45, 45, 0.4)',
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
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 12,
    paddingVertical: 3,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(45, 45, 45, 0.8)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignSelf: 'stretch',
    marginHorizontal: 12,
  },
  timeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  timeValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  timeValueHoliday: {
    color: '#FF5252',
  },
  interestRateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    paddingVertical: 3,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(45, 45, 45, 0.8)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignSelf: 'stretch',
    marginHorizontal: 12,
  },
  interestRateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 16,
  },
  interestRateLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  interestRateValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
  heatmapIconContainer: {
    width: 36,
    height: 36,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatmapBlock: {
    width: 20,
    height: 20,
    borderRadius: 3,
    position: 'absolute',
  },
  heatmapBlockBottom: {
    bottom: 4,
    left: 4,
    zIndex: 1,
  },
  heatmapBlockTop: {
    top: 4,
    right: 4,
    zIndex: 2,
  },
  triangleIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
  },
  triangleIcon: {
    fontSize: 20,
    lineHeight: 22,
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
    overflow: 'hidden',
  },
  mainGradientLogo: {
    width: 100,
    height: 100,
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
    backgroundColor: 'rgba(45, 45, 45, 0.6)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    backgroundColor: 'rgba(45, 45, 45, 0.6)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    backgroundColor: 'rgba(45, 45, 45, 0.6)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
  emptyNewsContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyNewsText: {
    fontSize: 14,
    color: '#94A3B8',
  },
});
