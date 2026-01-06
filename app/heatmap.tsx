import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Dimensions,
  Linking,
  Alert,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { 
  getAllAccounts, 
  getStocksByAccountId, 
  initDatabase,
  getTradingRecordsByStockId
} from '../src/services/DatabaseService';
import { Stock } from '../src/models/Stock';
import { addCommas, formatCurrency } from '../src/utils/formatUtils';
import { getCurrencyFromTicker } from '../src/utils/stockUtils';
import { Currency } from '../src/models/Currency';
import { getMultipleStockQuotesBatch, StockQuote } from '../src/services/YahooFinanceService';
import { ExchangeRateService } from '../src/services/ExchangeRateService';
import { 
  KOSPI_TOP_STOCKS, 
  KOSDAQ_TOP_STOCKS, 
  SP500_TOP_STOCKS,
  NASDAQ_TOP_STOCKS,
  DOW_TOP_STOCKS,
  MarketStock,
} from '../src/data/market_stocks';
import {
  SECTORS_BY_MARKET,
  Sector,
  MarketTabType as SectorMarketTabType,
} from '../src/data/sectors';

interface PortfolioStock extends Stock {
  accountName: string;
  profitRate: number; // 수익률 (%)
  profitAmount: number; // 수익금액
  holdingValue: number; // 보유금액 (수량 × 평균단가)
  hasTradingRecords: boolean; // 매매기록 존재 여부
}

interface MarketStockData {
  ticker: string;
  name: string;
  price: number;
  changePercent: number; // 전일 대비 수익률 (%)
  currency: Currency;
  market: 'KOSPI' | 'KOSDAQ' | 'SP500' | 'NASDAQ' | 'DOW';
  marketCap?: number; // 시가총액
  originalIndex?: number; // 시총순 정렬을 위한 원본 인덱스 (marketCap이 없을 때 사용)
}

type HeatmapViewMode = 'portfolio' | 'market';
type MarketTabType = 'KOSPI' | 'KOSDAQ' | 'SP500' | 'NASDAQ' | 'DOW';
type SortType = 'marketCap' | 'changePercent' | 'volume';
type PortfolioSortType = 'holdingValue' | 'profitRate' | 'profitAmount';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_COLUMNS = 3; // 그리드 열 개수
const CELL_PADDING = 8;

export default function HeatmapScreen() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<HeatmapViewMode>('portfolio');
  const [marketTab, setMarketTab] = useState<MarketTabType>('KOSPI');
  const [sortType, setSortType] = useState<SortType>('marketCap');
  const [portfolioSortType, setPortfolioSortType] = useState<PortfolioSortType>('holdingValue');
  const [stocks, setStocks] = useState<PortfolioStock[]>([]);
  const [marketStocks, setMarketStocks] = useState<MarketStockData[]>([]);
  const [isLoading, setIsLoading] = useState(true); // 초기 로딩만 사용
  const [isLoadingMarket, setIsLoadingMarket] = useState(false);
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false); // 포트폴리오 부분 로딩
  const [portfolioDataCache, setPortfolioDataCache] = useState<PortfolioStock[] | null>(null); // 포트폴리오 데이터 캐시
  const [selectedStock, setSelectedStock] = useState<PortfolioStock | null>(null);
  const [selectedMarketStock, setSelectedMarketStock] = useState<MarketStockData | null>(null);
  const [showChartModal, setShowChartModal] = useState(false);
  const [hasTradingRecords, setHasTradingRecords] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(1350); // USD-KRW 환율
  const [showSectorView, setShowSectorView] = useState(false); // 섹터 뷰 표시 여부 (기본값: false)
  const [selectedSector, setSelectedSector] = useState<string | null>(null); // 선택된 섹터 ID
  const [sectorStocks, setSectorStocks] = useState<MarketStockData[]>([]); // 섹터별 종목 데이터
  const [isLoadingSector, setIsLoadingSector] = useState(false); // 섹터 데이터 로딩 상태
  const [marketDataCache, setMarketDataCache] = useState<Map<MarketTabType, MarketStockData[]>>(new Map()); // 시장 데이터 캐시

  // viewMode 변경 시 데이터 로드 (전체 로딩 없이)
  useEffect(() => {
    setSortType('marketCap'); // 정렬 기준 초기화
    // viewMode가 portfolio로 변경될 때 섹터 관련 상태 초기화
    if (viewMode === 'portfolio') {
      setSelectedSector(null);
      setSectorStocks([]);
      setShowSectorView(false);
      
      // 포트폴리오 모드: 캐시된 데이터가 있으면 먼저 표시
      if (portfolioDataCache && portfolioDataCache.length > 0) {
        setStocks(portfolioDataCache);
        setMarketStocks([]);
      } else {
        setStocks([]);
        setMarketStocks([]);
      }
      
      // 백그라운드에서 최신 데이터 로드
      loadPortfolioHeatmapData();
    } else if (viewMode === 'market') {
      // 시장 모드: 캐시된 데이터가 있으면 먼저 표시
      const cachedData = marketDataCache.get(marketTab);
      if (cachedData && cachedData.length > 0) {
        setMarketStocks(cachedData);
        setStocks([]);
      } else {
        setMarketStocks([]);
        setStocks([]);
      }
      
      // 백그라운드에서 최신 데이터 로드
      loadMarketHeatmapData();
    }
  }, [viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // showSectorView 변경 시 섹터 선택
  useEffect(() => {
    if (viewMode === 'market' && showSectorView && !isLoading) {
      // 섹터 뷰가 켜지면 첫 번째 섹터 선택 (selectedSector 변경 시 자동으로 데이터 로드됨)
      if (!selectedSector) {
        const sectors = SECTORS_BY_MARKET[marketTab];
        if (sectors && sectors.length > 0) {
          setSelectedSector(sectors[0].id);
        }
      }
    } else if (viewMode === 'market' && !showSectorView) {
      // 섹터 뷰가 꺼지면 섹터 데이터 초기화
      setSectorStocks([]);
      setSelectedSector(null);
    }
  }, [showSectorView, viewMode, marketTab, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // selectedSector 변경 시 섹터 데이터 로드
  useEffect(() => {
    if (viewMode === 'market' && showSectorView && selectedSector && !isLoading) {
      loadSectorHeatmapData();
    }
  }, [selectedSector, viewMode, showSectorView, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // marketTab, sortType 변경 시 데이터 다시 로드 (캐시 우선 사용)
  useEffect(() => {
    if (viewMode === 'market' && !isLoading) {
      // 캐시에 데이터가 있으면 먼저 표시
      const cachedData = marketDataCache.get(marketTab);
      if (cachedData && cachedData.length > 0) {
        setMarketStocks(cachedData);
        setIsLoadingMarket(false);
      }
      
      // 백그라운드에서 최신 데이터 로드
      loadMarketHeatmapData();
      
      // marketTab 변경 시 첫 번째 섹터 선택
      if (showSectorView) {
        const sectors = SECTORS_BY_MARKET[marketTab];
        if (sectors && sectors.length > 0 && selectedSector !== sectors[0].id) {
          setSelectedSector(sectors[0].id);
        }
      }
    }
  }, [marketTab, sortType]); // eslint-disable-line react-hooks/exhaustive-deps

  // portfolioSortType 변경 시 포트폴리오 데이터 다시 정렬 (매매기록이 없는 종목은 항상 마지막)
  useEffect(() => {
    if (viewMode === 'portfolio' && stocks.length > 0) {
      const sortedStocks = [...stocks];
      if (portfolioSortType === 'holdingValue') {
        // 보유금액이 큰 순 (매매기록 없는 종목은 마지막)
        sortedStocks.sort((a, b) => {
          // 매매기록이 없는 종목은 항상 뒤로
          if (!a.hasTradingRecords && b.hasTradingRecords) return 1;
          if (a.hasTradingRecords && !b.hasTradingRecords) return -1;
          // 둘 다 매매기록이 있거나 없으면 보유금액으로 정렬
          return (b.holdingValue || 0) - (a.holdingValue || 0);
        });
      } else if (portfolioSortType === 'profitRate') {
        // 수익률 순 (손실 → 수익, 매매기록 없는 종목은 마지막)
        sortedStocks.sort((a, b) => {
          // 매매기록이 없는 종목은 항상 뒤로
          if (!a.hasTradingRecords && b.hasTradingRecords) return 1;
          if (a.hasTradingRecords && !b.hasTradingRecords) return -1;
          // 둘 다 매매기록이 있거나 없으면 수익률로 정렬
          return a.profitRate - b.profitRate;
        });
      } else if (portfolioSortType === 'profitAmount') {
        // 수익금액 순 (손실 → 수익, 매매기록 없는 종목은 마지막)
        sortedStocks.sort((a, b) => {
          // 매매기록이 없는 종목은 항상 뒤로
          if (!a.hasTradingRecords && b.hasTradingRecords) return 1;
          if (a.hasTradingRecords && !b.hasTradingRecords) return -1;
          // 둘 다 매매기록이 있거나 없으면 수익금액으로 정렬
          return a.profitAmount - b.profitAmount;
        });
      }
      setStocks(sortedStocks);
    }
  }, [portfolioSortType]); // eslint-disable-line react-hooks/exhaustive-deps

  // 초기 마운트 시 데이터 로드
  useEffect(() => {
    // 초기 로딩만 전체 화면 로딩 사용
    loadHeatmapData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(
    React.useCallback(() => {
      // 화면 포커스 시 데이터 갱신 (전체 로딩 없이, 초기 로딩 완료 후)
      if (!isLoading) {
        if (viewMode === 'portfolio') {
          loadPortfolioHeatmapData();
        } else if (viewMode === 'market') {
          loadMarketHeatmapData();
        }
      }
    }, [viewMode, isLoading]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  // 포트폴리오 히트맵 자동 갱신 (5분마다)
  useEffect(() => {
    if (viewMode !== 'portfolio') return;

    const interval = setInterval(() => {
      console.log('[Heatmap] 포트폴리오 히트맵 자동 갱신 시작');
      loadPortfolioHeatmapData();
    }, 5 * 60 * 1000); // 5분

    return () => clearInterval(interval);
  }, [viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // 시장 히트맵 자동 갱신 (5분마다)
  useEffect(() => {
    if (viewMode !== 'market') return;

    const interval = setInterval(() => {
      console.log('[Heatmap] 시장 히트맵 자동 갱신 시작');
      loadMarketHeatmapData();
    }, 5 * 60 * 1000); // 5분

    return () => clearInterval(interval);
  }, [viewMode, marketTab, sortType]); // eslint-disable-line react-hooks/exhaustive-deps


  // 포트폴리오 데이터 로드 (부분 로딩)
  const loadPortfolioHeatmapData = async () => {
    try {
      setIsLoadingPortfolio(true);
      
      await initDatabase();
      
      // 환율 가져오기 (USD 종목이 있을 수 있으므로)
      let usdToKrwRate = 1350; // 기본값
      try {
        usdToKrwRate = await ExchangeRateService.getUsdToKrwRate();
        setExchangeRate(usdToKrwRate);
      } catch (error) {
        console.warn('[Heatmap] 환율 조회 실패, 기본값 사용:', error);
      }
      
      // 포트폴리오 히트맵: 모든 계좌의 종목 가져오기
      const accounts = await getAllAccounts();
      const stocksArrays = await Promise.all(
        accounts.map(async (account) => {
          const accountStocks = await getStocksByAccountId(account.id);
          return accountStocks.map(stock => ({
            ...stock,
            accountName: account.name,
          }));
        })
      );
      const allStocks: PortfolioStock[] = stocksArrays.flat();

      // 수익률, 보유금액 및 매매기록 존재 여부 계산
      const stocksWithProfit = await Promise.all(
        allStocks.map(async (stock) => {
          const profitRate = calculateProfitRate(stock);
          const profitAmount = calculateProfitAmount(stock, profitRate);
          const holdingValue = calculateHoldingValue(stock, usdToKrwRate); // 환율 전달
          
          // 매매기록 존재 여부 확인
          let hasTradingRecords = false;
          try {
            const records = await getTradingRecordsByStockId(stock.id);
            hasTradingRecords = records && records.length > 0;
          } catch (error) {
            console.warn(`매매기록 확인 실패 (${stock.ticker}):`, error);
          }
          
          return {
            ...stock,
            profitRate,
            profitAmount,
            holdingValue,
            hasTradingRecords,
          };
        })
      );

      // 정렬 기준에 따라 정렬 (매매기록이 없는 종목은 항상 마지막)
      let sortedStocks = [...stocksWithProfit];
      if (portfolioSortType === 'holdingValue') {
        // 보유금액이 큰 순 (매매기록 없는 종목은 마지막)
        sortedStocks.sort((a, b) => {
          // 매매기록이 없는 종목은 항상 뒤로
          if (!a.hasTradingRecords && b.hasTradingRecords) return 1;
          if (a.hasTradingRecords && !b.hasTradingRecords) return -1;
          // 둘 다 매매기록이 있거나 없으면 보유금액으로 정렬
          return (b.holdingValue || 0) - (a.holdingValue || 0);
        });
      } else if (portfolioSortType === 'profitRate') {
        // 수익률 순 (손실 → 수익, 매매기록 없는 종목은 마지막)
        sortedStocks.sort((a, b) => {
          // 매매기록이 없는 종목은 항상 뒤로
          if (!a.hasTradingRecords && b.hasTradingRecords) return 1;
          if (a.hasTradingRecords && !b.hasTradingRecords) return -1;
          // 둘 다 매매기록이 있거나 없으면 수익률로 정렬
          return a.profitRate - b.profitRate;
        });
      } else if (portfolioSortType === 'profitAmount') {
        // 수익금액 순 (손실 → 수익, 매매기록 없는 종목은 마지막)
        sortedStocks.sort((a, b) => {
          // 매매기록이 없는 종목은 항상 뒤로
          if (!a.hasTradingRecords && b.hasTradingRecords) return 1;
          if (a.hasTradingRecords && !b.hasTradingRecords) return -1;
          // 둘 다 매매기록이 있거나 없으면 수익금액으로 정렬
          return a.profitAmount - b.profitAmount;
        });
      }
      
      setStocks(sortedStocks);
      
      // 캐시에 저장
      setPortfolioDataCache(sortedStocks);
    } catch (error) {
      console.error('[Heatmap] 포트폴리오 데이터 로드 오류:', error);
      // 에러 발생 시에도 캐시된 데이터가 있으면 유지
      if (portfolioDataCache && portfolioDataCache.length > 0) {
        setStocks(portfolioDataCache);
      }
    } finally {
      setIsLoadingPortfolio(false);
    }
  };

  // 초기 로딩용 (전체 화면 로딩)
  const loadHeatmapData = async () => {
    try {
      setIsLoading(true);
      
      if (viewMode === 'portfolio') {
        // 포트폴리오 데이터 로드 (부분 로딩 함수를 직접 호출하지 않고 내부 로직 사용)
        await initDatabase();
        
        // 환율 가져오기 (USD 종목이 있을 수 있으므로)
        let usdToKrwRate = 1350; // 기본값
        try {
          usdToKrwRate = await ExchangeRateService.getUsdToKrwRate();
          setExchangeRate(usdToKrwRate);
        } catch (error) {
          console.warn('[Heatmap] 환율 조회 실패, 기본값 사용:', error);
        }
        
        // 포트폴리오 히트맵: 모든 계좌의 종목 가져오기
        const accounts = await getAllAccounts();
        const stocksArrays = await Promise.all(
          accounts.map(async (account) => {
            const accountStocks = await getStocksByAccountId(account.id);
            return accountStocks.map(stock => ({
              ...stock,
              accountName: account.name,
            }));
          })
        );
        const allStocks: PortfolioStock[] = stocksArrays.flat();

        // 수익률, 보유금액 및 매매기록 존재 여부 계산
        const stocksWithProfit = await Promise.all(
          allStocks.map(async (stock) => {
            const profitRate = calculateProfitRate(stock);
            const profitAmount = calculateProfitAmount(stock, profitRate);
            const holdingValue = calculateHoldingValue(stock, usdToKrwRate);
            
            // 매매기록 존재 여부 확인
            let hasTradingRecords = false;
            try {
              const records = await getTradingRecordsByStockId(stock.id);
              hasTradingRecords = records && records.length > 0;
            } catch (error) {
              console.warn(`매매기록 확인 실패 (${stock.ticker}):`, error);
            }
            
            return {
              ...stock,
              profitRate,
              profitAmount,
              holdingValue,
              hasTradingRecords,
            };
          })
        );

        // 정렬 기준에 따라 정렬
        let sortedStocks = [...stocksWithProfit];
        if (portfolioSortType === 'holdingValue') {
          sortedStocks.sort((a, b) => {
            if (!a.hasTradingRecords && b.hasTradingRecords) return 1;
            if (a.hasTradingRecords && !b.hasTradingRecords) return -1;
            return (b.holdingValue || 0) - (a.holdingValue || 0);
          });
        } else if (portfolioSortType === 'profitRate') {
          sortedStocks.sort((a, b) => {
            if (!a.hasTradingRecords && b.hasTradingRecords) return 1;
            if (a.hasTradingRecords && !b.hasTradingRecords) return -1;
            return a.profitRate - b.profitRate;
          });
        } else if (portfolioSortType === 'profitAmount') {
          sortedStocks.sort((a, b) => {
            if (!a.hasTradingRecords && b.hasTradingRecords) return 1;
            if (a.hasTradingRecords && !b.hasTradingRecords) return -1;
            return a.profitAmount - b.profitAmount;
          });
        }
        
        setStocks(sortedStocks);
        setPortfolioDataCache(sortedStocks);
        setMarketStocks([]);
      } else {
        // 시장 히트맵: 코스피 상위 종목 조회
        setStocks([]);
        await loadMarketHeatmapData();
      }
    } catch (error) {
      console.error('히트맵 데이터 로드 오류:', error);
      Alert.alert('오류', '히트맵 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateProfitRate = (stock: Stock): number => {
    if (!stock.currentPrice || !stock.averagePrice || stock.averagePrice === 0) {
      return 0;
    }
    return ((stock.currentPrice - stock.averagePrice) / stock.averagePrice) * 100;
  };

  const calculateProfitAmount = (stock: Stock, profitRate: number): number => {
    if (!stock.currentPrice || !stock.averagePrice) {
      return 0;
    }
    return (stock.currentPrice - stock.averagePrice) * stock.quantity;
  };

  const calculateHoldingValue = (stock: Stock, usdToKrwRate: number = 1350): number => {
    if (!stock.averagePrice || !stock.quantity) {
      return 0;
    }
    const holdingValue = stock.averagePrice * stock.quantity;
    // USD 종목은 원화로 환산
    if (stock.currency === Currency.USD) {
      return holdingValue * usdToKrwRate;
    }
    // KRW 종목은 그대로 반환
    return holdingValue;
  };

  const loadMarketHeatmapData = async () => {
    try {
      setIsLoadingMarket(true);
      let stocksToLoad: MarketStock[] = [];
      
      // 하드코딩된 리스트 사용 (30개)
      if (marketTab === 'KOSPI') {
        stocksToLoad = KOSPI_TOP_STOCKS;
      } else if (marketTab === 'KOSDAQ') {
        stocksToLoad = KOSDAQ_TOP_STOCKS;
      } else if (marketTab === 'SP500') {
        stocksToLoad = SP500_TOP_STOCKS;
      } else if (marketTab === 'NASDAQ') {
        stocksToLoad = NASDAQ_TOP_STOCKS;
      } else if (marketTab === 'DOW') {
        stocksToLoad = DOW_TOP_STOCKS;
      }
      
      if (stocksToLoad.length === 0) {
        setMarketStocks([]);
        setIsLoadingMarket(false);
        return;
      }
      
      const tickers = stocksToLoad.map(stock => stock.ticker);
      console.log('[Heatmap] 시장 종목 현재가 조회 시작:', tickers.length, '개');
      
      // 배치 처리로 현재가 조회 (30개씩, 0.1초 지연) - 속도 개선
      const quotes = await getMultipleStockQuotesBatch(tickers, 30, 100);
      
      // 시장 종목 데이터 생성 (원본 순서 유지)
      const marketDataWithIndex: (MarketStockData & { originalIndex: number })[] = stocksToLoad
        .map((marketStock, index) => {
          const quote = quotes.get(marketStock.ticker);
          if (!quote) {
            return null;
          }
          
          return {
            ticker: marketStock.ticker,
            name: marketStock.name,
            price: quote.price,
            changePercent: quote.changePercent || 0,
            currency: quote.currency === 'KRW' ? Currency.KRW : Currency.USD,
            market: marketStock.market,
            marketCap: quote.marketCap, // 시가총액 추가
            originalIndex: index, // 시총순 정렬을 위한 원본 인덱스 (하드코딩된 리스트가 시총순)
          };
        })
        .filter((stock): stock is MarketStockData & { originalIndex: number } => stock !== null);
      
      // 정렬 기준에 따라 정렬
      let sortedData: (MarketStockData & { originalIndex: number })[];
      if (sortType === 'marketCap') {
        // 시총순: 원본 리스트 순서 유지 (하드코딩된 순서가 시총순)
        sortedData = marketDataWithIndex.sort((a, b) => a.originalIndex - b.originalIndex);
      } else if (sortType === 'changePercent') {
        // 수익률순: 수익률 높은 순 (내림차순)
        sortedData = marketDataWithIndex.sort((a, b) => b.changePercent - a.changePercent);
      } else {
        // volume: 거래량순은 Yahoo Finance에서 가져올 수 없으므로 시총순으로 대체
        sortedData = marketDataWithIndex.sort((a, b) => a.originalIndex - b.originalIndex);
      }
      
      // originalIndex는 유지 (marketCap이 없을 때 셀 크기 계산에 사용)
      const finalData: MarketStockData[] = sortedData.map(({ originalIndex, ...rest }) => ({
        ...rest,
        originalIndex, // originalIndex 유지
      }));
      
      // 디버깅: 시가총액 정보 확인
      const marketCapsCount = finalData.filter(s => s.marketCap && s.marketCap > 0).length;
      console.log('[Heatmap] 시장 종목 현재가 조회 완료:', finalData.length, '개');
      console.log('[Heatmap] 시가총액 정보 있는 종목:', marketCapsCount, '개');
      if (marketCapsCount > 0) {
        const maxCap = Math.max(...finalData.map(s => s.marketCap || 0).filter(cap => cap > 0));
        const minCap = Math.min(...finalData.map(s => s.marketCap || 0).filter(cap => cap > 0));
        console.log('[Heatmap] 시가총액 범위:', minCap, '~', maxCap);
      }
      
      setMarketStocks(finalData);
      
      // 캐시에 저장 (다음에 빠르게 표시)
      setMarketDataCache(prev => {
        const newCache = new Map(prev);
        newCache.set(marketTab, finalData);
        return newCache;
      });
    } catch (error) {
      console.error('[Heatmap] 시장 종목 조회 오류:', error);
      // 에러 발생 시에도 캐시된 데이터가 있으면 유지
      const cachedData = marketDataCache.get(marketTab);
      if (cachedData && cachedData.length > 0) {
        setMarketStocks(cachedData);
      } else {
        setMarketStocks([]);
      }
    } finally {
      setIsLoadingMarket(false);
    }
  };

  const loadSectorHeatmapData = async () => {
    if (!selectedSector || !showSectorView) return;
    
    try {
      setIsLoadingSector(true);
      const sectors = SECTORS_BY_MARKET[marketTab];
      const sector = sectors.find(s => s.id === selectedSector);
      
      if (!sector || sector.stocks.length === 0) {
        setSectorStocks([]);
        setIsLoadingSector(false);
        return;
      }
      
      const tickers = sector.stocks.map(stock => stock.ticker);
      console.log('[Heatmap] 섹터 종목 현재가 조회 시작:', sector.name, tickers.length, '개');
      
      // 배치 처리로 현재가 조회
      const quotes = await getMultipleStockQuotesBatch(tickers, 30, 100);
      
      // 섹터 종목 데이터 생성
      const sectorData: MarketStockData[] = sector.stocks
        .map((sectorStock) => {
          const quote = quotes.get(sectorStock.ticker);
          if (!quote) {
            return null;
          }
          
          return {
            ticker: sectorStock.ticker,
            name: sectorStock.name,
            price: quote.price,
            changePercent: quote.changePercent || 0,
            currency: quote.currency === 'KRW' ? Currency.KRW : Currency.USD,
            market: sectorStock.market,
            marketCap: quote.marketCap,
          };
        })
        .filter((stock): stock is MarketStockData => stock !== null);
      
      // 수익률순으로 정렬
      sectorData.sort((a, b) => b.changePercent - a.changePercent);
      
      console.log('[Heatmap] 섹터 종목 현재가 조회 완료:', sectorData.length, '개');
      setSectorStocks(sectorData);
    } catch (error) {
      console.error('[Heatmap] 섹터 종목 조회 오류:', error);
      setSectorStocks([]);
    } finally {
      setIsLoadingSector(false);
    }
  };

  const getCellColor = (changePercent: number): string => {
    // 수익률에 따른 색상 계산
    // -10% 이하: 진한 빨강
    // -5% ~ -10%: 빨강
    // -2% ~ -5%: 주황
    // -2% ~ 0%: 노랑
    // 0% ~ 2%: 연한 초록
    // 2% ~ 5%: 초록
    // 5% ~ 10%: 진한 초록
    // 10% 이상: 매우 진한 초록

    if (changePercent <= -10) return '#B71C1C'; // 진한 빨강
    if (changePercent <= -5) return '#D32F2F'; // 빨강
    if (changePercent <= -2) return '#F57C00'; // 주황
    if (changePercent <= 0) return '#FBC02D'; // 노랑
    if (changePercent <= 2) return '#AED581'; // 연한 초록
    if (changePercent <= 5) return '#66BB6A'; // 초록
    if (changePercent <= 10) return '#388E3C'; // 진한 초록
    return '#1B5E20'; // 매우 진한 초록
  };

  const getTextColor = (changePercent: number): string => {
    // 배경색에 따라 텍스트 색상 결정
    if (changePercent <= 0) return '#FFFFFF';
    return '#FFFFFF';
  };

  const handleStockPress = async (stock: PortfolioStock) => {
    setSelectedStock(stock);
    setSelectedMarketStock(null);
    
    // 매매기록이 있는지 확인
    try {
      await initDatabase();
      const records = await getTradingRecordsByStockId(stock.id);
      setHasTradingRecords(records && records.length > 0);
    } catch (error) {
      console.error('매매기록 확인 오류:', error);
      setHasTradingRecords(false);
    }
    
    setShowChartModal(true);
  };

  const handleMarketStockPress = (stock: MarketStockData) => {
    setSelectedMarketStock(stock);
    setSelectedStock(null);
    setHasTradingRecords(false); // 시장 종목은 매매기록 없음
    setShowChartModal(true);
  };

  const handleChartOption = async (option: 'internal' | 'naver' | 'yahoo' | 'trading' | 'detail') => {
    const stock = selectedStock || selectedMarketStock;
    if (!stock) return;

    const ticker = 'ticker' in stock ? stock.ticker : stock.ticker;
    const stockName = 'name' in stock ? stock.name : stock.name;
    setShowChartModal(false);

    try {
      switch (option) {
        case 'internal':
          // 기존 차트 화면으로 이동
          if (selectedStock) {
            router.push(`/stock-chart?ticker=${ticker}&id=${selectedStock.id}`);
          } else if (selectedMarketStock) {
            router.push(`/stock-chart?ticker=${ticker}&name=${stockName}`);
          }
          break;

        case 'naver':
          // 네이버 금융 차트 (앱 우선, 없으면 웹) - 한국 주식만 지원
          const stockCurrency = selectedStock?.currency || selectedMarketStock?.currency;
          if (stockCurrency === Currency.USD) {
            Alert.alert('알림', '네이버 금융은 한국 주식만 지원합니다. 야후 파이낸스를 이용해주세요.');
            return;
          }
          const naverCode = ticker.replace('.KS', '').replace('.KQ', '');
          
          // 네이버 앱 딥링크 시도
          try {
            const naverAppDeepLink = `nfinance://item/main?code=${naverCode}`;
            try {
              await Linking.openURL(naverAppDeepLink);
              return; // 앱이 있으면 성공
            } catch {
              // 앱이 없으면 웹으로 폴백
            }
            
            // 웹 브라우저에서 열기
            const naverUrl = `https://finance.naver.com/item/main.naver?code=${naverCode}`;
            await Linking.openURL(naverUrl);
          } catch (error) {
            console.error('네이버 금융 열기 오류:', error);
            Alert.alert('오류', '네이버 금융을 열 수 없습니다.');
          }
          break;

        case 'yahoo':
          // 야후 파이낸스 차트 (앱 우선, 없으면 웹)
          // 야후 앱 딥링크 시도
          try {
            const yahooAppDeepLink = `yahoofinance://quote/${ticker}`;
            try {
              await Linking.openURL(yahooAppDeepLink);
              return; // 앱이 있으면 성공
            } catch {
              // 앱이 없으면 웹으로 폴백
            }
            
            // 웹 브라우저에서 열기
            const yahooUrl = `https://finance.yahoo.com/quote/${ticker}`;
            await Linking.openURL(yahooUrl);
          } catch (error) {
            console.error('야후 파이낸스 열기 오류:', error);
            Alert.alert('오류', '야후 파이낸스를 열 수 없습니다.');
          }
          break;


        case 'trading':
          // 매매기록 차트 화면으로 이동 (포트폴리오 종목만)
          if (selectedStock && selectedStock.id) {
            router.push(`/visualization?stockId=${selectedStock.id}`);
          } else {
            Alert.alert('알림', '매매기록 차트는 포트폴리오에 등록된 종목만 볼 수 있습니다.');
          }
          break;

        case 'detail':
          // 종목상세 화면으로 이동 (포트폴리오 종목만)
          if (selectedStock && selectedStock.id) {
            router.push(`/stock-detail?id=${selectedStock.id}`);
          } else {
            Alert.alert('알림', '종목상세는 포트폴리오에 등록된 종목만 볼 수 있습니다.');
          }
          break;
      }
    } catch (error) {
      console.error('차트 열기 오류:', error);
      Alert.alert('오류', '차트를 열 수 없습니다.');
    }
  };

  // 포트폴리오 히트맵용: 보유금액 기준 셀 크기 계산
  const calculatePortfolioCellSize = (stocks: PortfolioStock[]) => {
    if (stocks.length === 0) {
      return {
        minCellSize: 80,
        maxCellSize: SCREEN_WIDTH * 0.5,
        baseCellSize: 100,
        totalHoldingValue: 0,
        maxHoldingValue: 0,
      };
    }

    // 전체 보유금액 합계
    const totalHoldingValue = stocks.reduce((sum, stock) => sum + (stock.holdingValue || 0), 0);
    
    // 최대 보유금액
    const maxHoldingValue = Math.max(...stocks.map(s => s.holdingValue || 0));
    
    // 최소/최대 셀 크기 제한 (시가총액 크기대로 표시하되 균형있게)
    const minCellSize = 80;
    // 최대 크기는 화면 너비의 약 50%로 제한
    const maxCellSize = SCREEN_WIDTH * 0.5;
    const baseCellSize = 100; // 기본 크기

    return {
      minCellSize,
      maxCellSize,
      baseCellSize,
      totalHoldingValue,
      maxHoldingValue,
    };
  };

  // 시장 히트맵용: 시가총액 기준 셀 크기 계산
  const calculateMarketCellSize = (stocks: MarketStockData[]) => {
    if (stocks.length === 0) {
      return {
        minCellSize: 60,
        maxCellSize: (SCREEN_WIDTH - (CELL_PADDING * 4)) / 3.5, // 한 줄에 더 많이 나오도록
        baseCellSize: 70,
        maxMarketCap: 0,
        hasMarketCap: false,
      };
    }

    // 최대 시가총액
    const marketCaps = stocks.map(s => s.marketCap || 0).filter(cap => cap > 0);
    const maxMarketCap = marketCaps.length > 0 ? Math.max(...marketCaps) : 0;
    const hasMarketCap = marketCaps.length > 0;
    
    // 최소/최대 셀 크기 제한 (맵처럼 보이도록 더 작게 제한)
    const minCellSize = 60; // 최소 크기 더 줄임
    // 최대 크기는 한 줄에 더 많이 나오도록 제한 (맵처럼 보이게)
    const maxCellSize = (SCREEN_WIDTH - (CELL_PADDING * 4)) / 3.5;
    const baseCellSize = 70; // 기본 크기 더 작게

    return {
      minCellSize,
      maxCellSize,
      baseCellSize,
      maxMarketCap,
      hasMarketCap,
    };
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
            <Text style={styles.loadingText}>히트맵 불러오는 중...</Text>
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
              {/* 헤더 */}
              <View style={styles.header}>
                <View style={styles.headerTop}>
                  <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>히트맵</Text>
                    <Text style={styles.headerSubtitle}>
                      {viewMode === 'portfolio'
                        ? '포트폴리오 종목의 수익률을 색상으로, 보유금액을 크기로 확인하세요'
                        : '전일 대비 등락률을 색상으로 한눈에 확인하세요'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.refreshButton}
                    onPress={() => {
                      if (viewMode === 'portfolio') {
                        loadPortfolioHeatmapData();
                      } else {
                        loadMarketHeatmapData();
                      }
                    }}
                    activeOpacity={0.7}
                    disabled={isLoading || isLoadingMarket || isLoadingPortfolio}
                  >
                    {(isLoading || isLoadingMarket || isLoadingPortfolio) ? (
                      <ActivityIndicator size="small" color="#42A5F5" />
                    ) : (
                      <Text style={styles.refreshButtonText}>🔄</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

          {/* 뷰 모드 선택 */}
          <View style={styles.viewModeContainer}>
            <TouchableOpacity
              style={[
                styles.viewModeButton,
                viewMode === 'portfolio' && styles.viewModeButtonActive,
              ]}
              onPress={() => setViewMode('portfolio')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.viewModeButtonText,
                  viewMode === 'portfolio' && styles.viewModeButtonTextActive,
                ]}
              >
                포트폴리오
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.viewModeButton,
                viewMode === 'market' && styles.viewModeButtonActive,
              ]}
              onPress={() => setViewMode('market')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.viewModeButtonText,
                  viewMode === 'market' && styles.viewModeButtonTextActive,
                ]}
              >
                시장
              </Text>
            </TouchableOpacity>
          </View>

          {/* 시장 모드일 때 시장 탭 선택 */}
          {viewMode === 'market' && (
            <View style={styles.marketTabContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.marketTabScroll}>
                  <TouchableOpacity
                    style={[
                      styles.marketTabButton,
                      marketTab === 'KOSPI' && styles.marketTabButtonActive,
                      isLoadingMarket && styles.marketTabButtonLoading,
                    ]}
                    onPress={() => setMarketTab('KOSPI')}
                    activeOpacity={0.7}
                    disabled={isLoadingMarket}
                  >
                    {isLoadingMarket && marketTab === 'KOSPI' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text
                        style={[
                          styles.marketTabButtonText,
                          marketTab === 'KOSPI' && styles.marketTabButtonTextActive,
                        ]}
                      >
                        코스피
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.marketTabButton,
                      marketTab === 'KOSDAQ' && styles.marketTabButtonActive,
                      isLoadingMarket && styles.marketTabButtonLoading,
                    ]}
                    onPress={() => setMarketTab('KOSDAQ')}
                    activeOpacity={0.7}
                    disabled={isLoadingMarket}
                  >
                    {isLoadingMarket && marketTab === 'KOSDAQ' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text
                        style={[
                          styles.marketTabButtonText,
                          marketTab === 'KOSDAQ' && styles.marketTabButtonTextActive,
                        ]}
                      >
                        코스닥
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.marketTabButton,
                      marketTab === 'SP500' && styles.marketTabButtonActive,
                      isLoadingMarket && styles.marketTabButtonLoading,
                    ]}
                    onPress={() => setMarketTab('SP500')}
                    activeOpacity={0.7}
                    disabled={isLoadingMarket}
                  >
                    {isLoadingMarket && marketTab === 'SP500' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text
                        style={[
                          styles.marketTabButtonText,
                          marketTab === 'SP500' && styles.marketTabButtonTextActive,
                        ]}
                      >
                        S&P500
                      </Text>
                    )}
                  </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.marketTabButton,
                    marketTab === 'NASDAQ' && styles.marketTabButtonActive,
                  ]}
                  onPress={() => setMarketTab('NASDAQ')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.marketTabButtonText,
                      marketTab === 'NASDAQ' && styles.marketTabButtonTextActive,
                    ]}
                  >
                    나스닥
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.marketTabButton,
                    marketTab === 'DOW' && styles.marketTabButtonActive,
                  ]}
                  onPress={() => setMarketTab('DOW')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.marketTabButtonText,
                      marketTab === 'DOW' && styles.marketTabButtonTextActive,
                    ]}
                  >
                    다우
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          {/* 포트폴리오 모드일 때 정렬 기준 선택 */}
          {viewMode === 'portfolio' && (
            <View style={styles.controlsContainer}>
              <View style={styles.sortContainer}>
                <Text style={styles.sortLabel}>정렬:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortScroll}>
                  <TouchableOpacity
                    style={[
                      styles.sortButton,
                      portfolioSortType === 'holdingValue' && styles.sortButtonActive,
                    ]}
                    onPress={() => setPortfolioSortType('holdingValue')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.sortButtonText,
                        portfolioSortType === 'holdingValue' && styles.sortButtonTextActive,
                      ]}
                    >
                      보유금액순
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.sortButton,
                      portfolioSortType === 'profitRate' && styles.sortButtonActive,
                    ]}
                    onPress={() => setPortfolioSortType('profitRate')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.sortButtonText,
                        portfolioSortType === 'profitRate' && styles.sortButtonTextActive,
                      ]}
                    >
                      수익률순
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.sortButton,
                      portfolioSortType === 'profitAmount' && styles.sortButtonActive,
                    ]}
                    onPress={() => setPortfolioSortType('profitAmount')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.sortButtonText,
                        portfolioSortType === 'profitAmount' && styles.sortButtonTextActive,
                      ]}
                    >
                      수익금액순
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          )}

          {/* 시장 모드일 때 정렬 기준 선택 */}
          {viewMode === 'market' && (
            <View style={styles.controlsContainer}>
              {/* 정렬 기준 선택 */}
              <View style={styles.sortContainer}>
                <Text style={styles.sortLabel}>정렬:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortScroll}>
                  <TouchableOpacity
                    style={[
                      styles.sortButton,
                      sortType === 'marketCap' && styles.sortButtonActive,
                      isLoadingMarket && styles.sortButtonLoading,
                    ]}
                    onPress={() => setSortType('marketCap')}
                    activeOpacity={0.7}
                    disabled={isLoadingMarket}
                  >
                    {isLoadingMarket && sortType === 'marketCap' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text
                        style={[
                          styles.sortButtonText,
                          sortType === 'marketCap' && styles.sortButtonTextActive,
                        ]}
                      >
                        시총순
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.sortButton,
                      sortType === 'changePercent' && styles.sortButtonActive,
                      isLoadingMarket && styles.sortButtonLoading,
                    ]}
                    onPress={() => setSortType('changePercent')}
                    activeOpacity={0.7}
                    disabled={isLoadingMarket}
                  >
                    {isLoadingMarket && sortType === 'changePercent' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text
                        style={[
                          styles.sortButtonText,
                          sortType === 'changePercent' && styles.sortButtonTextActive,
                        ]}
                      >
                        수익률순
                      </Text>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </View>
              {/* 섹터 뷰 토글 버튼 */}
              <View style={styles.sectorToggleContainer}>
                <Text style={styles.sectorToggleLabel}>섹터별:</Text>
                <TouchableOpacity
                  style={[
                    styles.sectorToggleButton,
                    showSectorView && styles.sectorToggleButtonActive,
                  ]}
                  onPress={() => setShowSectorView(!showSectorView)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.sectorToggleButtonText,
                      showSectorView && styles.sectorToggleButtonTextActive,
                    ]}
                  >
                    {showSectorView ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 섹터 탭 (시장 모드이고 섹터 뷰가 켜져있을 때만 표시) */}
          {viewMode === 'market' && showSectorView && (
            <View style={styles.sectorTabContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sectorTabScroll}>
                {SECTORS_BY_MARKET[marketTab]?.map((sector) => (
                  <TouchableOpacity
                    key={sector.id}
                    style={[
                      styles.sectorTabButton,
                      selectedSector === sector.id && styles.sectorTabButtonActive,
                      isLoadingSector && styles.sectorTabButtonLoading,
                    ]}
                    onPress={() => setSelectedSector(sector.id)}
                    disabled={isLoadingSector}
                    activeOpacity={0.7}
                  >
                    {isLoadingSector && selectedSector === sector.id ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text
                        style={[
                          styles.sectorTabButtonText,
                          selectedSector === sector.id && styles.sectorTabButtonTextActive,
                        ]}
                      >
                        {sector.name}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* 섹터 히트맵 (시장 모드이고 섹터 뷰가 켜져있을 때 먼저 표시) */}
          {viewMode === 'market' && showSectorView && (
            <>
              <View style={styles.sectorHeader}>
                <Text style={styles.sectorHeaderTitle}>
                  {SECTORS_BY_MARKET[marketTab]?.find(s => s.id === selectedSector)?.name || '섹터'}
                </Text>
              </View>
              {isLoadingSector ? (
                <View style={styles.emptyContainer}>
                  <ActivityIndicator size="large" color="#42A5F5" />
                  <Text style={styles.emptyText}>섹터 데이터를 불러오는 중...</Text>
                </View>
              ) : sectorStocks.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>섹터 데이터가 없습니다</Text>
                </View>
              ) : (
                <View style={styles.heatmapContainer}>
                  {sectorStocks.map((stock, index) => {
                    const color = getCellColor(stock.changePercent);
                    const textColor = getTextColor(stock.changePercent);

                    return (
                      <TouchableOpacity
                        key={`sector-${stock.ticker}-${index}`}
                        style={[
                          styles.heatmapCell,
                          {
                            width: 100,
                            height: 100,
                            backgroundColor: color,
                          },
                        ]}
                        onPress={() => handleMarketStockPress(stock)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.cellTicker, { color: textColor }]} numberOfLines={1}>
                          {stock.ticker}
                        </Text>
                        <Text style={[styles.cellName, { color: textColor }]} numberOfLines={1}>
                          {stock.name}
                        </Text>
                        <Text style={[styles.cellProfitRate, { color: textColor }]}>
                          {stock.changePercent >= 0 ? '+' : ''}
                          {stock.changePercent.toFixed(1)}%
                        </Text>
                        <Text style={[styles.cellProfitAmount, { color: textColor }]} numberOfLines={1}>
                          {formatCurrency(stock.price, stock.currency)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {/* 시장 종목 히트맵 헤더 */}
          {viewMode === 'market' && (
            <View style={styles.sectorHeader}>
              <Text style={styles.sectorHeaderTitle}>시장 종목</Text>
            </View>
          )}

          {/* 히트맵 그리드 */}
          {isLoading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color="#42A5F5" />
              <Text style={styles.emptyText}>데이터를 불러오는 중...</Text>
            </View>
          ) : viewMode === 'portfolio' && stocks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📊</Text>
              <Text style={styles.emptyText}>포트폴리오에 종목이 없습니다</Text>
            </View>
          ) : viewMode === 'market' && (isLoadingMarket || marketStocks.length === 0) ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color="#42A5F5" />
              <Text style={styles.emptyText}>시장 데이터를 불러오는 중...</Text>
            </View>
          ) : (
            <View style={styles.heatmapContainer}>
              {viewMode === 'portfolio' ? (() => {
                // 포트폴리오 히트맵: 보유금액 기준 셀 크기 계산
                const sizeInfo = calculatePortfolioCellSize(stocks);
                
                return stocks.map((stock, index) => {
                  // 매매기록이 없으면 회색, 있으면 수익률에 따른 색상
                  const color = stock.hasTradingRecords 
                    ? getCellColor(stock.profitRate) 
                    : '#757575'; // 회색 (매매기록 없음)
                  const textColor = stock.hasTradingRecords 
                    ? getTextColor(stock.profitRate) 
                    : '#FFFFFF'; // 회색 배경이므로 흰색 텍스트
                  const displayName = stock.name || stock.officialName || stock.ticker;

                  // 보유금액 비율에 따라 셀 크기 계산
                  let cellWidth = sizeInfo.minCellSize; // 기본값을 최소 크기로 설정
                  let cellHeight = sizeInfo.minCellSize;
                  
                  if (sizeInfo.maxHoldingValue > 0 && stock.holdingValue > 0) {
                    const ratio = stock.holdingValue / sizeInfo.maxHoldingValue;
                    // 제곱근을 적용하여 크기 차이 완화 (가중치 적용)
                    const weightedRatio = Math.sqrt(ratio);
                    // 비율에 따라 크기 조정 (최소 ~ 최대 사이)
                    const sizeRange = sizeInfo.maxCellSize - sizeInfo.minCellSize;
                    const calculatedSize = sizeInfo.minCellSize + (sizeRange * weightedRatio);
                    cellWidth = Math.max(sizeInfo.minCellSize, Math.min(sizeInfo.maxCellSize, calculatedSize));
                    cellHeight = cellWidth; // 정사각형 유지
                  }
                  // 보유금액이 0이거나 없는 경우는 이미 minCellSize로 설정됨

                  return (
                    <TouchableOpacity
                      key={`${stock.id}-${index}`}
                      style={[
                        styles.heatmapCell,
                        {
                          width: cellWidth,
                          height: cellHeight,
                          backgroundColor: color,
                        },
                      ]}
                      onPress={() => handleStockPress(stock)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.cellTicker, { color: textColor }]} numberOfLines={1}>
                        {stock.ticker}
                      </Text>
                      <Text style={[styles.cellName, { color: textColor }]} numberOfLines={1}>
                        {displayName}
                      </Text>
                      <Text style={[styles.cellProfitRate, { color: textColor }]}>
                        {stock.profitRate >= 0 ? '+' : ''}
                        {stock.profitRate.toFixed(1)}%
                      </Text>
                      {stock.profitAmount !== 0 && (
                        <Text style={[styles.cellProfitAmount, { color: textColor }]} numberOfLines={1}>
                          {stock.profitAmount >= 0 ? '+' : ''}
                          {formatCurrency(stock.profitAmount, stock.currency)}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                });
              })() : (() => {
                // 시장 히트맵: 시가총액 기준 셀 크기 계산
                const sizeInfo = calculateMarketCellSize(marketStocks);
                
                // 디버깅 로그
                if (marketStocks.length > 0) {
                  console.log('[Heatmap] 셀 크기 계산 정보:', {
                    hasMarketCap: sizeInfo.hasMarketCap,
                    maxMarketCap: sizeInfo.maxMarketCap,
                    minCellSize: sizeInfo.minCellSize,
                    maxCellSize: sizeInfo.maxCellSize,
                    baseCellSize: sizeInfo.baseCellSize,
                    sampleMarketCaps: marketStocks.slice(0, 3).map(s => ({ ticker: s.ticker, marketCap: s.marketCap, originalIndex: s.originalIndex })),
                  });
                }
                
                return marketStocks.map((stock, index) => {
                  const color = getCellColor(stock.changePercent);
                  const textColor = getTextColor(stock.changePercent);

                  // 시가총액 비율에 따라 셀 크기 계산
                  let cellWidth = sizeInfo.baseCellSize;
                  let cellHeight = sizeInfo.baseCellSize;
                  
                  if (sizeInfo.hasMarketCap && sizeInfo.maxMarketCap > 0 && stock.marketCap && stock.marketCap > 0) {
                    // 시가총액이 있으면 시가총액 기준으로 크기 조정
                    const ratio = stock.marketCap / sizeInfo.maxMarketCap;
                    // 제곱근을 적용하여 크기 차이 완화 (가중치 적용)
                    const weightedRatio = Math.sqrt(ratio);
                    const sizeRange = sizeInfo.maxCellSize - sizeInfo.minCellSize;
                    const calculatedSize = sizeInfo.minCellSize + (sizeRange * weightedRatio);
                    cellWidth = Math.max(sizeInfo.minCellSize, Math.min(sizeInfo.maxCellSize, calculatedSize));
                    cellHeight = cellWidth; // 정사각형 유지
                  } else if (stock.originalIndex !== undefined && marketStocks.length > 0) {
                    // 시가총액이 없으면 originalIndex를 사용 (하드코딩된 리스트가 시총순이라고 가정)
                    // 역순으로 계산 (인덱스가 작을수록 시총이 크므로)
                    const maxIndex = marketStocks.length - 1;
                    const ratio = maxIndex > 0 ? 1 - (stock.originalIndex / maxIndex) : 0.5; // 역순 비율
                    // 제곱근을 적용하여 크기 차이 완화 (가중치 적용)
                    const weightedRatio = Math.sqrt(ratio);
                    const sizeRange = sizeInfo.maxCellSize - sizeInfo.minCellSize;
                    const calculatedSize = sizeInfo.minCellSize + (sizeRange * weightedRatio);
                    cellWidth = Math.max(sizeInfo.minCellSize, Math.min(sizeInfo.maxCellSize, calculatedSize));
                    cellHeight = cellWidth; // 정사각형 유지
                  }

                  return (
                    <TouchableOpacity
                      key={`${stock.ticker}-${index}`}
                      style={[
                        styles.heatmapCell,
                        {
                          width: cellWidth,
                          height: cellHeight,
                          backgroundColor: color
                        }
                      ]}
                      onPress={() => handleMarketStockPress(stock)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.cellTicker, { color: textColor }]} numberOfLines={1}>
                        {stock.ticker}
                      </Text>
                      <Text style={[styles.cellName, { color: textColor }]} numberOfLines={1}>
                        {stock.name}
                      </Text>
                      <Text style={[styles.cellProfitRate, { color: textColor }]}>
                        {stock.changePercent >= 0 ? '+' : ''}
                        {stock.changePercent.toFixed(1)}%
                      </Text>
                      <Text style={[styles.cellProfitAmount, { color: textColor }]} numberOfLines={1}>
                        {formatCurrency(stock.price, stock.currency)}
                      </Text>
                    </TouchableOpacity>
                  );
                });
              })()}
            </View>
          )}

          {/* 범례 */}
          {(stocks.length > 0 || marketStocks.length > 0) && (
            <View style={styles.legendContainer}>
              <Text style={styles.legendTitle}>수익률 범례</Text>
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#B71C1C' }]} />
                  <Text style={styles.legendText}>-10% 이하</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#D32F2F' }]} />
                  <Text style={styles.legendText}>-5% ~ -10%</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#F57C00' }]} />
                  <Text style={styles.legendText}>-2% ~ -5%</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#FBC02D' }]} />
                  <Text style={styles.legendText}>0% ~ -2%</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#66BB6A' }]} />
                  <Text style={styles.legendText}>0% ~ 5%</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#388E3C' }]} />
                  <Text style={styles.legendText}>5% ~ 10%</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#1B5E20' }]} />
                  <Text style={styles.legendText}>10% 이상</Text>
                </View>
                {/* 포트폴리오 모드일 때만 매매기록 없음 범례 표시 */}
                {viewMode === 'portfolio' && (
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: '#757575' }]} />
                    <Text style={styles.legendText}>매매기록 없음</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </ScrollView>
      </LinearGradient>

      {/* 차트 선택 모달 */}
      <Modal
        visible={showChartModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowChartModal(false);
          setSelectedStock(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedStock?.name || selectedStock?.officialName || selectedStock?.ticker}
            </Text>
            <Text style={styles.modalSubtitle}>차트 보기 방법 선택</Text>

            <TouchableOpacity
              style={styles.chartOption}
              onPress={() => handleChartOption('internal')}
              activeOpacity={0.7}
            >
              <Text style={styles.chartOptionIcon}>📈</Text>
              <View style={styles.chartOptionTextContainer}>
                <Text style={styles.chartOptionTitle}>종목 차트</Text>
                <Text style={styles.chartOptionDescription}>앱 내 캔들스틱 차트</Text>
              </View>
            </TouchableOpacity>

            {/* 매매기록 차트는 포트폴리오 종목이고 매매기록이 있을 때만 표시 */}
            {selectedStock && selectedStock.id && hasTradingRecords && (
              <TouchableOpacity
                style={styles.chartOption}
                onPress={() => handleChartOption('trading')}
                activeOpacity={0.7}
              >
                <Text style={styles.chartOptionIcon}>📉</Text>
                <View style={styles.chartOptionTextContainer}>
                  <Text style={styles.chartOptionTitle}>매매기록 차트</Text>
                  <Text style={styles.chartOptionDescription}>매수/매도 기록 도트 차트</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* 네이버 금융은 한국 주식만 지원 */}
            {((selectedStock && selectedStock.currency === Currency.KRW) || 
              (selectedMarketStock && selectedMarketStock.currency === Currency.KRW)) && (
              <TouchableOpacity
                style={styles.chartOption}
                onPress={() => handleChartOption('naver')}
                activeOpacity={0.7}
              >
                <View style={styles.chartOptionLogoContainer}>
                  <View style={[styles.chartOptionLogo, styles.naverLogo]}>
                    <Text style={styles.naverLogoText}>N</Text>
                  </View>
                </View>
                <View style={styles.chartOptionTextContainer}>
                  <Text style={styles.chartOptionTitle}>네이버 금융</Text>
                  <Text style={styles.chartOptionDescription}>차트 및 종목 정보 보기</Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.chartOption}
              onPress={() => handleChartOption('yahoo')}
              activeOpacity={0.7}
            >
              <View style={styles.chartOptionLogoContainer}>
                <View style={[styles.chartOptionLogo, styles.yahooLogo]}>
                  <Text style={styles.yahooLogoText}>Y!</Text>
                </View>
              </View>
              <View style={styles.chartOptionTextContainer}>
                <Text style={styles.chartOptionTitle}>야후 파이낸스</Text>
                <Text style={styles.chartOptionDescription}>차트 및 종목 정보 보기</Text>
              </View>
            </TouchableOpacity>

            {/* 종목상세는 포트폴리오 종목일 때만 표시 */}
            {selectedStock && selectedStock.id && (
              <TouchableOpacity
                style={styles.chartOption}
                onPress={() => handleChartOption('detail')}
                activeOpacity={0.7}
              >
                <View style={styles.chartOptionIconContainer}>
                  <View style={styles.chartOptionIconTop}>
                    <Text style={styles.chartOptionIconText}>매수</Text>
                  </View>
                  <View style={styles.chartOptionIconBottom}>
                    <Text style={styles.chartOptionIconText}>매도</Text>
                  </View>
                </View>
                <View style={styles.chartOptionTextContainer}>
                        <Text style={styles.chartOptionTitle}>매수/매도 기록 추가</Text>
                  <Text style={styles.chartOptionDescription}>상세 정보 및 매수/매도 기록 추가</Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowChartModal(false);
                setSelectedStock(null);
                setSelectedMarketStock(null);
                setHasTradingRecords(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCloseButtonText}>취소</Text>
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
  },
  scrollContent: {
    padding: 16,
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
    marginBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 12,
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
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(66, 165, 245, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButtonText: {
    fontSize: 20,
  },
  viewModeContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: 'rgba(27, 38, 59, 0.6)',
    borderRadius: 12,
    padding: 4,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  viewModeButtonActive: {
    backgroundColor: '#42A5F5',
  },
  viewModeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#B0BEC5',
  },
  viewModeButtonTextActive: {
    color: '#FFFFFF',
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
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  heatmapContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -CELL_PADDING / 2,
    marginBottom: 24,
  },
  heatmapCell: {
    margin: CELL_PADDING / 2,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  cellTicker: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  cellName: {
    fontSize: 11,
    marginBottom: 6,
    textAlign: 'center',
  },
  cellProfitRate: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  cellProfitAmount: {
    fontSize: 10,
    opacity: 0.9,
  },
  legendContainer: {
    backgroundColor: 'rgba(27, 38, 59, 0.6)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#B0BEC5',
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
    marginBottom: 4,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#B0BEC5',
    marginBottom: 20,
    textAlign: 'center',
  },
  chartOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(27, 38, 59, 0.6)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
  },
  chartOptionIcon: {
    fontSize: 24,
    marginRight: 12,
    width: 36,
    textAlign: 'center',
  },
  chartOptionLogoContainer: {
    width: 36,
    height: 36,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartOptionLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  naverLogo: {
    backgroundColor: '#03C75A', // 네이버 그린
  },
  naverLogoText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  yahooLogo: {
    backgroundColor: '#6001D2', // 야후 퍼플
  },
  yahooLogoText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  chartOptionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 12,
    overflow: 'hidden',
  },
  chartOptionIconTop: {
    flex: 1,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  chartOptionIconBottom: {
    flex: 1,
    backgroundColor: '#EF5350',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  chartOptionIconText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  chartOptionTextContainer: {
    flex: 1,
  },
  chartOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  chartOptionDescription: {
    fontSize: 12,
    color: '#B0BEC5',
  },
  modalCloseButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.3)',
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F44336',
  },
  marketTabContainer: {
    marginBottom: 16,
  },
  marketTabScroll: {
    flexGrow: 0,
  },
  sectorToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  sectorToggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B0BEC5',
  },
  sectorToggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: 'rgba(27, 38, 59, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
  },
  sectorToggleButtonActive: {
    backgroundColor: 'rgba(66, 165, 245, 0.3)',
    borderColor: '#42A5F5',
  },
  sectorToggleButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#B0BEC5',
  },
  sectorToggleButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sectorTabContainer: {
    marginBottom: 16,
    marginTop: 8,
  },
  sectorTabScroll: {
    flexGrow: 0,
  },
  sectorTabButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(27, 38, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.3)',
  },
  sectorTabButtonActive: {
    backgroundColor: '#42A5F5',
    borderColor: '#42A5F5',
  },
  sectorTabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B0BEC5',
  },
  sectorTabButtonTextActive: {
    color: '#FFFFFF',
  },
  sectorTabButtonLoading: {
    opacity: 0.7,
  },
  sectorHeader: {
    marginTop: 24,
    marginBottom: 16,
  },
  sectorHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  marketTabButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(27, 38, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.3)',
  },
  marketTabButtonActive: {
    backgroundColor: '#42A5F5',
    borderColor: '#42A5F5',
  },
  marketTabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B0BEC5',
  },
  marketTabButtonTextActive: {
    color: '#FFFFFF',
  },
  marketTabButtonLoading: {
    opacity: 0.7,
  },
  controlsContainer: {
    marginBottom: 16,
    gap: 12,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B0BEC5',
  },
  sortScroll: {
    flexGrow: 0,
  },
  sortButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(27, 38, 59, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
  },
  sortButtonActive: {
    backgroundColor: 'rgba(66, 165, 245, 0.3)',
    borderColor: '#42A5F5',
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#B0BEC5',
  },
  sortButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sortButtonLoading: {
    opacity: 0.7,
  },
});

