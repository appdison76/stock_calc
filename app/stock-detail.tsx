import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Linking,
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
  initDatabase,
  updateStockCurrentPrice,
  getAllAccounts,
  getStocksByAccountId
} from '../src/services/DatabaseService';
import { Stock } from '../src/models/Stock';
import { TradingRecord } from '../src/models/TradingRecord';
import { Currency } from '../src/models/Currency';
import { formatCurrency, formatNumber as formatNumberUtil, addCommas } from '../src/utils/formatUtils';
import { SettingsService } from '../src/services/SettingsService';
import { ExchangeRateService } from '../src/services/ExchangeRateService';
import { getStockQuote } from '../src/services/YahooFinanceService';
import { fetchStockNews, fetchGoogleNewsRSS } from '../src/services/NewsService';
import { NewsItem } from '../src/models/NewsItem';
import NewsList from '../src/components/NewsList';
import NewsCard from '../src/components/NewsCard';
import { US_ETF_TO_UNDERLYING_MAP } from '../src/data/us_etf_underlying_map';
import { AdmobBanner } from '../src/components/AdmobBanner';
import { AdmobNativeAd } from '../src/components/AdmobNativeAd';
import { CoupangDynamicBanner } from '../src/components/CoupangDynamicBanner';
import ChartSelectionModal from '../src/components/ChartSelectionModal';

export default function StockDetailScreen() {
  const router = useRouter();
  const { id, ticker, lang, scrollToNews, action } = useLocalSearchParams<{ id?: string; ticker?: string; lang?: string; scrollToNews?: string; action?: string }>();
  const scrollViewRef = useRef<ScrollView>(null);
  const [newsContainerY, setNewsContainerY] = useState<number | null>(null);
  const [stock, setStock] = useState<Stock | null>(null);
  const [records, setRecords] = useState<TradingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddRecordModal, setShowAddRecordModal] = useState(false);
  const [showChartSelectionModal, setShowChartSelectionModal] = useState(false);
  const [recordType, setRecordType] = useState<'BUY' | 'SELL'>('BUY'); // 매수/매도 선택
  
  // 실적 추가 입력값
  const [priceInput, setPriceInput] = useState('');
  const [quantityInput, setQuantityInput] = useState('');

  // 관련 뉴스
  const [relatedNews, setRelatedNews] = useState<NewsItem[]>([]);
  const [relatedNewsKo, setRelatedNewsKo] = useState<NewsItem[]>([]);
  const [relatedNewsEn, setRelatedNewsEn] = useState<NewsItem[]>([]);
  const [relatedNewsLanguage, setRelatedNewsLanguage] = useState<'ko' | 'en'>(() => {
    // URL 파라미터에서 언어 정보 가져오기, 없으면 기본값 'ko'
    return (lang === 'en' ? 'en' : 'ko') as 'ko' | 'en';
  });
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsRefreshing, setNewsRefreshing] = useState(false);
  const [newsLoadingMore, setNewsLoadingMore] = useState(false);
  const [newsDaysBack, setNewsDaysBack] = useState(7);
  const [newsHasMore, setNewsHasMore] = useState(true);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  const formatPrice = (price?: number, currency: Currency = Currency.KRW) => {
    if (price === undefined || price === null) return formatCurrency(0, currency);
    return formatCurrency(price, currency);
  };

  // USD 가격에 대한 원화 변환값 표시 (작은 글씨)
  const getKrwEquivalentForDisplay = (usdValue: number | undefined | null): string | null => {
    if (usdValue === undefined || usdValue === null || !exchangeRate) return null;
    const krwValue = usdValue * exchangeRate;
    return `원화 ${addCommas(krwValue.toFixed(0))}원`;
  };

  const formatNumber = (num: number) => {
    return formatNumberUtil(num, Currency.KRW).replace('원', '');
  };

  // 콤마 제거 함수
  const removeCommas = (value: string): string => {
    return value.replace(/,/g, '');
  };

  // 가격 입력 핸들러 (천단위 콤마 자동 추가)
  const handlePriceInputChange = (text: string) => {
    // 콤마와 숫자, 소수점만 허용
    const cleaned = text.replace(/[^0-9.]/g, '');
    // 소수점이 여러 개인 경우 마지막 것만 유지
    const parts = cleaned.split('.');
    const formatted = parts.length > 2 
      ? parts[0] + '.' + parts.slice(1).join('')
      : cleaned;
    
    if (formatted === '' || formatted === '.') {
      setPriceInput(formatted);
      return;
    }

    // USD인 경우 소수점 포함하여 포맷팅 (천단위 콤마도 추가)
    if (stock?.currency === Currency.USD) {
      setPriceInput(addCommas(formatted));
    } else {
      // KRW인 경우 정수만 처리하고 천단위 콤마 추가
      const integerOnly = formatted.split('.')[0];
      if (integerOnly === '') {
        setPriceInput('');
      } else {
        setPriceInput(addCommas(integerOnly));
      }
    }
  };

  // 수량 입력 핸들러 (천단위 콤마 자동 추가)
  const handleQuantityInputChange = (text: string) => {
    // 콤마와 숫자만 허용 (수량은 정수만)
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned === '') {
      setQuantityInput('');
    } else {
      setQuantityInput(addCommas(cleaned));
    }
  };

  useEffect(() => {
    loadStockDetail();
  }, [id, ticker]);

  // 종목 현재가 자동 갱신 (1분마다)
  useEffect(() => {
    if (!id || !stock) return;

    const updatePrice = async () => {
      try {
        await initDatabase();
        console.log('[StockDetail] 종목 현재가 자동 갱신 시작');
        await updateStockCurrentPrice(id);
        // 갱신 후 종목 정보 다시 가져오기
        const updatedStock = await getStockById(id);
        if (updatedStock) {
          setStock(updatedStock);
        }
        console.log('[StockDetail] 종목 현재가 자동 갱신 완료');
      } catch (error) {
        console.error('[StockDetail] 종목 현재가 자동 갱신 오류:', error);
      }
    };

    // 초기 로드 후 약간의 지연을 두고 첫 갱신
    const initialTimeout = setTimeout(() => {
      updatePrice();
    }, 2000); // 2초 후 첫 갱신
    
    // 1분마다 자동 갱신
    const interval = setInterval(() => {
      updatePrice();
    }, 60 * 1000); // 1분
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [id, stock]);

  useEffect(() => {
    // URL 파라미터에서 언어 정보 가져오기
    if (lang === 'en') {
      setRelatedNewsLanguage('en');
    } else if (lang === 'ko') {
      setRelatedNewsLanguage('ko');
    }
  }, [lang]);

  // URL 파라미터에서 action 확인하여 매수/매도 모달 열기
  useEffect(() => {
    if (stock && action) {
      if (action === 'buy') {
        setRecordType('BUY');
        setShowAddRecordModal(true);
      } else if (action === 'sell') {
        setRecordType('SELL');
        setShowAddRecordModal(true);
      }
    }
  }, [stock, action]);

  // 초기 로드 시에만 뉴스 로드 (stock이 처음 로드될 때만)
  const hasLoadedNews = useRef(false);
  const lastStockId = useRef<string | null>(null);
  
  useEffect(() => {
    // 종목이 변경되면 리셋
    if (id !== lastStockId.current) {
      hasLoadedNews.current = false;
      lastStockId.current = id;
      // 뉴스 초기화
      setRelatedNews([]);
      setRelatedNewsKo([]);
      setRelatedNewsEn([]);
    }
    
    if (stock && !hasLoadedNews.current) {
      // 초기 로드 시에만 뉴스 로딩
      hasLoadedNews.current = true;
      loadRelatedNews(true, 7, false, relatedNewsLanguage);
    }
  }, [id, stock, loadRelatedNews, relatedNewsLanguage]);

  // 언어 변경 시에는 이미 로드된 뉴스를 표시만 변경
  useEffect(() => {
    if (relatedNewsLanguage === 'ko' && relatedNewsKo.length > 0) {
      setRelatedNews(relatedNewsKo);
    } else if (relatedNewsLanguage === 'en' && relatedNewsEn.length > 0) {
      setRelatedNews(relatedNewsEn);
    }
  }, [relatedNewsLanguage, relatedNewsKo, relatedNewsEn]);

  // 관련 뉴스가 로드되고 scrollToNews 파라미터가 있으면 스크롤
  useEffect(() => {
    if (scrollToNews === 'true' && !newsLoading && relatedNews.length > 0 && newsContainerY !== null) {
      // 약간의 지연을 두고 스크롤 (레이아웃이 완전히 렌더링된 후)
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: newsContainerY - 20, animated: true });
      }, 500);
    }
  }, [scrollToNews, newsLoading, relatedNews.length, newsContainerY]);

  // 모달이 열릴 때만 매핑된 종목이면 현재가를 자동 설정 (모달이 열려있는 동안에는 재설정하지 않음)
  useEffect(() => {
    if (showAddRecordModal && stock) {
      // 매핑된 종목(officialName과 ticker가 모두 있는 경우)이고 현재가가 있으면
      if (stock.officialName && stock.ticker && stock.currentPrice && stock.currentPrice > 0) {
        // 현재가를 포맷팅하여 설정
        const currentPriceStr = stock.currency === Currency.KRW 
          ? addCommas(Math.round(stock.currentPrice).toString())
          : stock.currentPrice.toString();
        setPriceInput(currentPriceStr);
      } else {
        // 매핑되지 않은 종목이거나 현재가가 없으면 빈 문자열
        setPriceInput('');
      }
      // 수량은 항상 빈 문자열로 시작
      setQuantityInput('');
    } else if (!showAddRecordModal) {
      // 모달이 닫히면 입력값 초기화
      setPriceInput('');
      setQuantityInput('');
    }
    // stock이 변경되어도 모달이 열려있으면 재설정하지 않음 (의존성 배열에서 stock 제거)
  }, [showAddRecordModal]);

  const loadStockDetail = async () => {
    if (!id && !ticker) return;
    
    try {
      setIsLoading(true);
      await initDatabase();
      
      let stockId = id;
      
      let foundStockId = stockId;
      
      // ticker가 제공된 경우, 모든 계좌에서 해당 ticker를 가진 종목 찾기 (병렬 처리)
      if (!foundStockId && ticker) {
        const accounts = await getAllAccounts();
        
        // 모든 계좌의 종목을 병렬로 가져오기
        const stocksPromises = accounts.map(account => getStocksByAccountId(account.id));
        const stocksArrays = await Promise.all(stocksPromises);
        const allStocks = stocksArrays.flat();
        
        const foundStock = allStocks.find(s => s.ticker.toUpperCase() === ticker.toUpperCase());
        if (foundStock) {
          foundStockId = foundStock.id;
        } else {
          Alert.alert('오류', '해당 종목을 찾을 수 없습니다.');
          setIsLoading(false);
          router.back();
          return;
        }
      }
      
      if (!foundStockId) {
        setIsLoading(false);
        return;
      }
      
      // 환율 로드, 현재가 갱신, 종목 데이터 로드를 병렬 처리
      const [exchangeRateResult, stockData] = await Promise.all([
        // 환율 로드
        (async () => {
          try {
            const usdkrwQuote = await getStockQuote('USDKRW=X');
            return usdkrwQuote ? usdkrwQuote.price : await ExchangeRateService.getUsdToKrwRate();
          } catch (rateError) {
            console.warn('환율 로드 실패:', rateError);
            return await ExchangeRateService.getUsdToKrwRate();
          }
        })(),
        // 종목 데이터 로드
        getStockById(foundStockId),
      ]);
      
      setExchangeRate(exchangeRateResult);
      
      // 현재가 갱신은 백그라운드에서 비동기로 실행 (화면 표시를 막지 않음)
      updateStockCurrentPrice(foundStockId).catch((priceError) => {
        console.warn('현재가 갱신 실패:', priceError);
      });
      
      if (stockData) {
        setStock(stockData);
        // 매매기록 로드
        const recordsData = await getTradingRecordsByStockId(foundStockId);
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

    // 콤마 제거 후 파싱
    const price = parseFloat(removeCommas(priceInput));
    const quantity = parseFloat(removeCommas(quantityInput));
    
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

  const loadRelatedNews = useCallback(async (forceRefresh: boolean = false, days: number = 7, append: boolean = false, targetLang?: 'ko' | 'en') => {
    if (!stock) return;
    
    const language = targetLang || relatedNewsLanguage;
    
    try {
      if (forceRefresh && !append) {
        setNewsRefreshing(true);
      } else if (!append) {
        setNewsLoading(true);
      } else {
        setNewsLoadingMore(true);
      }

      const stockName = stock.officialName || stock.name || stock.ticker;
      console.log(`종목별 뉴스 로드 시작: ${stock.ticker}, ${stockName}, 언어: ${language}, ${days}일`);
      
      // ETF인 경우 기초 자산 티커 확인
      const underlyingTicker = US_ETF_TO_UNDERLYING_MAP[stock.ticker];
      const isETF = !!underlyingTicker && underlyingTicker !== stock.ticker;
      
      // 한글/영문 뉴스를 각각 가져오기
      const [baseNewsKo, baseNewsEn] = await Promise.all([
        fetchGoogleNewsRSS(stockName, stock.officialName || stock.name, stock.ticker, 'ko', days).catch(err => {
          console.warn(`한글 뉴스 로드 실패:`, err);
          return [];
        }),
        fetchGoogleNewsRSS(stockName, stock.officialName || stock.name, stock.ticker, 'en', days).catch(err => {
          console.warn(`영문 뉴스 로드 실패:`, err);
          return [];
        }),
      ]);

      let newsKo = baseNewsKo;
      let newsEn = baseNewsEn;
      
      // ETF인 경우 기초 자산 뉴스도 가져오기
      if (isETF) {
        try {
          const [underlyingNewsKo, underlyingNewsEn] = await Promise.all([
            fetchGoogleNewsRSS(underlyingTicker, underlyingTicker, underlyingTicker, 'ko', days).catch(err => {
              console.warn(`기초 자산 ${underlyingTicker} 한글 뉴스 로드 실패:`, err);
              return [];
            }),
            fetchGoogleNewsRSS(underlyingTicker, underlyingTicker, underlyingTicker, 'en', days).catch(err => {
              console.warn(`기초 자산 ${underlyingTicker} 영문 뉴스 로드 실패:`, err);
              return [];
            }),
          ]);
          
          // ETF 뉴스와 기초 자산 뉴스 합치기 (중복 제거)
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
          
          newsKo = combineNews(baseNewsKo, underlyingNewsKo);
          newsEn = combineNews(baseNewsEn, underlyingNewsEn);
          
          console.log(`ETF ${stock.ticker} -> 기초자산 ${underlyingTicker}: 한글 ${newsKo.length}개, 영문 ${newsEn.length}개 뉴스`);
        } catch (error) {
          console.warn(`기초 자산 ${underlyingTicker} 뉴스 로드 실패:`, error);
          // 기초 자산 뉴스 로드 실패해도 ETF 뉴스는 유지하고 시간순 정렬만 적용
          newsKo.sort((a, b) => {
            const dateA = a.publishedAt.getTime();
            const dateB = b.publishedAt.getTime();
            return dateB - dateA;
          });
          newsEn.sort((a, b) => {
            const dateA = a.publishedAt.getTime();
            const dateB = b.publishedAt.getTime();
            return dateB - dateA;
          });
        }
      } else {
        // ETF가 아닌 경우에도 시간순 정렬 적용
        newsKo.sort((a, b) => {
          const dateA = a.publishedAt.getTime();
          const dateB = b.publishedAt.getTime();
          return dateB - dateA;
        });
        newsEn.sort((a, b) => {
          const dateA = a.publishedAt.getTime();
          const dateB = b.publishedAt.getTime();
          return dateB - dateA;
        });
      }

      console.log(`종목별 뉴스 로드 완료: 한글 ${newsKo.length}개, 영문 ${newsEn.length}개`);
      
      if (append) {
        // 기존 뉴스에 추가 (중복 제거)
        if (language === 'ko') {
          setRelatedNewsKo(prev => {
            const existingIds = new Set(prev.map(n => n.id));
            const newNews = newsKo.filter(n => !existingIds.has(n.id));
            const updated = [...prev, ...newNews];
            // 현재 선택된 언어가 한글이면 업데이트
            if (language === 'ko') {
              setRelatedNews(updated);
            }
            // 새 뉴스가 없고 365일까지 검색했으면 더 이상 없음
            if (newNews.length === 0 && days >= 365) {
              setNewsHasMore(false);
            }
            return updated;
          });
        } else {
          setRelatedNewsEn(prev => {
            const existingIds = new Set(prev.map(n => n.id));
            const newNews = newsEn.filter(n => !existingIds.has(n.id));
            const updated = [...prev, ...newNews];
            // 현재 선택된 언어가 영문이면 업데이트
            if (language === 'en') {
              setRelatedNews(updated);
            }
            // 새 뉴스가 없고 365일까지 검색했으면 더 이상 없음
            if (newNews.length === 0 && days >= 365) {
              setNewsHasMore(false);
            }
            return updated;
          });
        }
      } else {
        // 초기 로드 또는 새로고침
        setRelatedNewsKo(newsKo);
        setRelatedNewsEn(newsEn);
        
        // 현재 선택된 언어의 뉴스 설정
        setRelatedNews(language === 'ko' ? newsKo : newsEn);
        setNewsHasMore(days < 365); // 365일까지는 더 불러올 수 있음
      }
    } catch (error) {
      console.error('관련 뉴스 로드 오류:', error);
      setNewsHasMore(false);
    } finally {
      setNewsLoading(false);
      setNewsRefreshing(false);
      setNewsLoadingMore(false);
    }
  }, [stock, relatedNewsLanguage]);

  const handleNewsRefresh = () => {
    setNewsDaysBack(7);
    setNewsHasMore(true);
    loadRelatedNews(true, 7, false, relatedNewsLanguage);
  };

  const handleNewsLoadMore = () => {
    if (newsLoadingMore || !newsHasMore || !stock) return;
    
    // 기간을 확장하여 더 많은 뉴스 가져오기
    let newDaysBack = newsDaysBack;
    if (newsDaysBack < 30) {
      newDaysBack = 30;
    } else if (newsDaysBack < 365) {
      newDaysBack = 365;
    } else {
      setNewsHasMore(false);
      return;
    }
    
    setNewsDaysBack(newDaysBack);
    loadRelatedNews(true, newDaysBack, true, relatedNewsLanguage);
  };

  const handleNewsPress = (newsItem: NewsItem) => {
    Linking.openURL(newsItem.link).catch(err => 
      console.error('링크 열기 실패:', err)
    );
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
          colors={['#000000', '#121212', '#0D0D0D']}
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
        colors={['#000000', '#121212', '#0D0D0D']}
        style={styles.gradient}
      >
        {/* 상단 고정 영역 (종목 정보, 버튼, 거래 기록) */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
        >
          {/* 종목 정보 카드 */}
          <View style={styles.stockInfoCard}>
            <View style={styles.stockNameContainer}>
              <View style={styles.stockNameTextContainer}>
                <View style={styles.stockNameRowWithBadge}>
                  <View style={styles.stockNameTitleWrap}>
                    <Text
                      style={styles.stockName}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {stock.name || stock.officialName || stock.ticker}
                    </Text>
                  </View>
                  {stock.currency === Currency.USD && (
                    <View style={styles.currencyBadge}>
                      <Text style={styles.currencyBadgeText}>USD</Text>
                    </View>
                  )}
                </View>
                {/* 매칭된 종목(officialName과 ticker가 모두 있는 경우)은 항상 표시 */}
                {stock.officialName && stock.ticker && (
                  <Text
                    style={styles.stockOfficialName}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {stock.officialName} · {stock.ticker}
                  </Text>
                )}
              </View>
              <View style={styles.chartIconsContainer}>
                <TouchableOpacity
                  style={styles.chartIconButton}
                  onPress={() => router.push(`/stock-chart?id=${stock.id}`)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chartIcon}>📈</Text>
                  <Text style={styles.chartIconLabel}>종목차트</Text>
                </TouchableOpacity>
                {records.length > 0 && (
                  <TouchableOpacity
                    style={styles.chartIconButton}
                    onPress={() => router.push(`/visualization?stockId=${stock.id}`)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.chartIcon}>📉</Text>
                    <Text style={styles.chartIconLabel}>매매기록</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.chartOverflowButton}
                  onPress={() => setShowChartSelectionModal(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chartOverflowIcon}>⋮</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.stockDetails}>
              {/* 평단가 - 강조 */}
              <View style={styles.stockDetailRow}>
                <Text style={styles.stockDetailLabel}>평균 단가</Text>
                <View style={styles.priceWithKrwContainer}>
                  <Text style={[styles.stockDetailValue, styles.averagePriceText]}>{formatPrice(stock.averagePrice, stock.currency)}</Text>
                  {stock.currency === Currency.USD && getKrwEquivalentForDisplay(stock.averagePrice) && (
                    <Text style={styles.krwEquivalentText}>{getKrwEquivalentForDisplay(stock.averagePrice)}</Text>
                  )}
                </View>
              </View>
              
              {/* 보유 수량 - 강조 */}
              <View style={styles.stockDetailRow}>
                <Text style={styles.stockDetailLabel}>보유 수량</Text>
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

          {/* 배너 광고: 종목 정보 아래 */}
          <View style={styles.adContainer}>
            <AdmobBanner />
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
                          <View style={styles.priceWithKrwContainer}>
                            <Text style={styles.recordValue}>
                              {formatPrice(record.price, record.currency)}
                            </Text>
                            {record.currency === Currency.USD && getKrwEquivalentForDisplay(record.price) && (
                              <Text style={styles.krwEquivalentText}>{getKrwEquivalentForDisplay(record.price)}</Text>
                            )}
                          </View>
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
                              <View style={styles.priceWithKrwContainer}>
                                <Text style={styles.recordValue}>
                                  {formatPrice(record.averagePriceBefore, record.currency)}
                                </Text>
                                {record.currency === Currency.USD && getKrwEquivalentForDisplay(record.averagePriceBefore) && (
                                  <Text style={styles.krwEquivalentText}>{getKrwEquivalentForDisplay(record.averagePriceBefore)}</Text>
                                )}
                              </View>
                            </View>
                            {record.averagePriceAfter !== undefined && (
                              <>
                                <View style={styles.recordRow}>
                                  <Text style={styles.recordLabel}>매수 후 평단가</Text>
                                  <View style={styles.priceWithKrwContainer}>
                                    <Text style={[
                                      styles.recordValue, 
                                      styles.recordValueHighlight,
                                      record.averagePriceAfter > record.averagePriceBefore ? styles.priceUp : 
                                      record.averagePriceAfter < record.averagePriceBefore ? styles.priceDown : null
                                    ]}>
                                      {formatPrice(record.averagePriceAfter, record.currency)}
                                    </Text>
                                    {record.currency === Currency.USD && getKrwEquivalentForDisplay(record.averagePriceAfter) && (
                                      <Text style={styles.krwEquivalentText}>{getKrwEquivalentForDisplay(record.averagePriceAfter)}</Text>
                                    )}
                                  </View>
                                </View>
                                <View style={styles.recordRow}>
                                  <Text style={styles.recordLabel}>평단 변화량</Text>
                                  {(() => {
                                    const change = record.averagePriceAfter - record.averagePriceBefore;
                                    const isUp = change > 0;
                                    const isDown = change < 0;
                                    return (
                                      <View style={styles.priceWithKrwContainer}>
                                        <Text style={[
                                          styles.recordValue,
                                          isUp ? styles.priceUp : isDown ? styles.priceDown : null
                                        ]}>
                                          {isUp ? '+ ' : isDown ? '- ' : ''}
                                          {formatPrice(Math.abs(change), record.currency)}
                                        </Text>
                                        {record.currency === Currency.USD && getKrwEquivalentForDisplay(Math.abs(change)) && (
                                          <Text style={[styles.krwEquivalentText, isUp ? styles.priceUp : isDown ? styles.priceDown : null]}>{getKrwEquivalentForDisplay(Math.abs(change))}</Text>
                                        )}
                                      </View>
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
                                        {isUp ? '+ ' : isDown ? '- ' : ''}
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
                          <View style={styles.priceWithKrwContainer}>
                            <Text style={styles.recordValue}>
                              {formatPrice(record.price, record.currency)}
                            </Text>
                            {record.currency === Currency.USD && getKrwEquivalentForDisplay(record.price) && (
                              <Text style={styles.krwEquivalentText}>{getKrwEquivalentForDisplay(record.price)}</Text>
                            )}
                          </View>
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
                            <View style={styles.priceWithKrwContainer}>
                              <Text style={styles.recordValue}>
                                {formatPrice(record.averagePriceAtSell, record.currency)}
                              </Text>
                              {record.currency === Currency.USD && getKrwEquivalentForDisplay(record.averagePriceAtSell) && (
                                <Text style={styles.krwEquivalentText}>{getKrwEquivalentForDisplay(record.averagePriceAtSell)}</Text>
                              )}
                            </View>
                          </View>
                        )}
                        {record.profit !== undefined && (
                          <View style={styles.recordRow}>
                            <Text style={styles.recordLabel}>손익</Text>
                            <View style={styles.priceWithKrwContainer}>
                              <Text style={[
                                styles.recordValue,
                                record.profit > 0 ? styles.priceUp : 
                                record.profit < 0 ? styles.priceDown : null
                              ]}>
                                {record.profit > 0 ? '+' : ''}
                                {formatPrice(record.profit, record.currency)}
                              </Text>
                              {record.currency === Currency.USD && getKrwEquivalentForDisplay(record.profit) && (
                                <Text style={[styles.krwEquivalentText, record.profit > 0 ? styles.priceUp : record.profit < 0 ? styles.priceDown : null]}>{getKrwEquivalentForDisplay(record.profit)}</Text>
                              )}
                            </View>
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

          {/* 관련 뉴스 섹션 */}
          {stock && (
            <View 
              style={styles.newsContainer}
              onLayout={(event) => {
                const { y } = event.nativeEvent.layout;
                setNewsContainerY(y);
              }}
            >
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>관련 뉴스</Text>
                <TouchableOpacity
                  onPress={handleNewsRefresh}
                  style={styles.refreshButton}
                  disabled={newsRefreshing}
                >
                  {newsRefreshing ? (
                    <ActivityIndicator size="small" color="#42A5F5" />
                  ) : (
                    <Text style={styles.refreshButtonText}>새로고침</Text>
                  )}
                </TouchableOpacity>
              </View>
              
              {/* 언어 선택 탭 */}
              <View style={styles.languageTabs}>
                <TouchableOpacity
                  style={[
                    styles.languageTab,
                    relatedNewsLanguage === 'ko' && styles.languageTabActive,
                  ]}
                  onPress={() => {
                    setRelatedNewsLanguage('ko');
                    setRelatedNews(relatedNewsKo);
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
                    setRelatedNews(relatedNewsEn);
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
              
              {newsLoading ? (
                <View style={styles.emptyContainer}>
                  <ActivityIndicator size="small" color="#42A5F5" />
                  <Text style={styles.emptyText}>뉴스를 불러오는 중...</Text>
                </View>
              ) : relatedNews.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>{`${stock.officialName || stock.name || stock.ticker} 관련 뉴스가 없습니다.`}</Text>
                </View>
              ) : (
                <View style={styles.newsListContainer}>
                  {relatedNews.map((item, index) => (
                    <React.Fragment key={item.id}>
                      <NewsCard
                        news={item}
                        onPress={() => handleNewsPress(item)}
                      />
                      {/* 광고: 첫 번째 뒤는 쿠팡 배너, 그 다음 5개마다 AdMob 네이티브 광고 */}
                      {index === 0 && (
                        <CoupangDynamicBanner width={320} height={140} key={`coupang-ad-${index}`} />
                      )}
                      {(index > 0 && (index - 1) % 5 === 0) && (
                        <AdmobNativeAd key={`native-ad-${index}`} />
                      )}
                    </React.Fragment>
                  ))}
                </View>
              )}
              {newsLoadingMore && (
                <View style={styles.loadingMoreContainer}>
                  <ActivityIndicator size="small" color="#42A5F5" />
                  <Text style={styles.loadingMoreText}>더 많은 뉴스를 불러오는 중...</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <ChartSelectionModal
          visible={showChartSelectionModal}
          onCancel={() => setShowChartSelectionModal(false)}
          onDismissAfterSelect={() => setShowChartSelectionModal(false)}
          origin="stock-detail"
          portfolioStock={{
            id: stock.id,
            ticker: stock.ticker,
            name: stock.name,
            officialName: stock.officialName,
            currency: stock.currency,
          }}
          marketStock={null}
          hasTradingRecords={records.length > 0}
        />
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
              placeholder={stock.currency === Currency.KRW ? "예: 50,000" : "예: 150.50"}
              placeholderTextColor="#757575"
              value={priceInput}
              onChangeText={handlePriceInputChange}
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
              onChangeText={handleQuantityInputChange}
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
    backgroundColor: '#121212',
  },
  gradient: {
    flex: 1,
    flexDirection: 'column',
  },
  scrollView: {
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
    backgroundColor: 'rgba(45, 45, 45, 0.8)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  stockNameContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  stockNameTextContainer: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'column',
  },
  stockNameRowWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stockNameTitleWrap: {
    flexShrink: 1,
    minWidth: 0,
  },
  stockName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  currencyBadge: {
    backgroundColor: 'rgba(128, 128, 128, 0.15)',
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
    fontSize: 15,
    color: '#B0BEC5',
    marginTop: 4,
  },
  chartIconsContainer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    flexShrink: 0,
  },
  chartOverflowButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartOverflowIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  chartIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  chartIcon: {
    fontSize: 18,
  },
  chartIconLabel: {
    fontSize: 9,
    color: '#FFFFFF',
    marginTop: 1,
    fontWeight: '500',
  },
  stockDetails: {
    gap: 16,
    width: '100%',
  },
  stockDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    width: '100%',
  },
  stockDetailLabel: {
    fontSize: 15,
    color: '#B0BEC5',
    fontWeight: '500',
    flexShrink: 1,
  },
  stockDetailValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flexShrink: 0,
  },
  stockDetailValueSecondary: {
    fontSize: 18,
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
    fontSize: 14,
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
  addButtonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
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
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  addButtonIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    marginRight: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
  newsContainer: {
    paddingHorizontal: 8,
    paddingTop: 24,
    paddingBottom: 0,
    marginTop: 24,
  },
  newsListContainer: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 16,
  },
  loadingMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingMoreText: {
    marginTop: 8,
    fontSize: 14,
    color: '#94A3B8',
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
  refreshButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.15)',
  },
  refreshButtonText: {
    color: '#42A5F5',
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
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
    backgroundColor: 'rgba(45, 45, 45, 0.8)',
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
    fontSize: 16,
    color: '#B0BEC5',
  },
  recordValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  recordValueHighlight: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  priceUp: {
    color: '#4CAF50', // 녹색 (상승) - 미국 스타일
  },
  priceDown: {
    color: '#F44336', // 빨간색 (하락) - 미국 스타일
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
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
    backgroundColor: 'rgba(45, 45, 45, 0.6)',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
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
  adContainer: {
    width: '100%',
    marginTop: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
});

