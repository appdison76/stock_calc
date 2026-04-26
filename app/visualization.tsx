import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { 
  initDatabase,
  getAllAccounts, 
  getStocksByAccountId, 
  getTradingRecordsByStockId,
  updateStockCurrentPrice
} from '../src/services/DatabaseService';
import { Account } from '../src/models/Account';
import { Stock } from '../src/models/Stock';
import { TradingRecord } from '../src/models/TradingRecord';
import { Currency } from '../src/models/Currency';
import { formatCurrency, addCommas } from '../src/utils/formatUtils';
import { getStockQuote } from '../src/services/YahooFinanceService';
import { ExchangeRateService } from '../src/services/ExchangeRateService';
import ChartSelectionModal from '../src/components/ChartSelectionModal';
import { NaverFinanceMiniIcon } from '../src/components/NaverFinanceMiniIcon';

interface DotData {
  price: number;
  quantity: number;
  type: 'BUY' | 'SELL';
}

interface ChartData {
  stock: Stock;
  averagePrice: number;
  currentPrice: number;
  priceChange: number | null;
  priceChangePercent: number | null;
  buyRecords: DotData[];
  sellRecords: DotData[];
}

export default function VisualizationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ stockId?: string }>();
  const stockId = params.stockId ? (Array.isArray(params.stockId) ? params.stockId[0] : params.stockId) : undefined;
  const [loading, setLoading] = useState(true);
  const [chartsData, setChartsData] = useState<ChartData[]>([]);
  const [selectedChartIndex, setSelectedChartIndex] = useState<number | null>(null);
  const [showChartSelectionModal, setShowChartSelectionModal] = useState(false);
  const [chartModalHasTradingRecords, setChartModalHasTradingRecords] = useState(false);
  const previousSelectedStockIdRef = useRef<string | null>(null);
  const stockTabsScrollRef = useRef<ScrollView>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  // USD 가격에 대한 원화 변환값 표시 (작은 글씨)
  const getKrwEquivalentForDisplay = (usdValue: number | undefined | null): string | null => {
    if (usdValue === undefined || usdValue === null || !exchangeRate) return null;
    const krwValue = usdValue * exchangeRate;
    return `원화 ${addCommas(krwValue.toFixed(0))}원`;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 이전에 선택했던 종목 ID 저장 (데이터 로드 전에)
      const previousSelectedStockId = previousSelectedStockIdRef.current;
      
      // 현재 stockId 가져오기 (함수 내부에서 다시 가져옴)
      const currentStockId = stockId;
      
      // 데이터베이스 초기화
      await initDatabase();
      
      // 환율 로드와 포트폴리오 데이터 로드를 병렬 처리
      const [exchangeRateResult, accounts] = await Promise.all([
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
        // 모든 포트폴리오 가져오기
        getAllAccounts(),
      ]);
      
      setExchangeRate(exchangeRateResult);
      
      // 모든 종목 가져오기 (병렬 처리로 속도 개선)
      const stocksPromises = accounts.map(async (account) => {
        return await getStocksByAccountId(account.id);
      });
      const stocksArrays = await Promise.all(stocksPromises);
      const allStocks: Stock[] = stocksArrays.flat();

      // 현재가 갱신은 백그라운드에서 비동기로 실행 (화면 표시를 막지 않음)
      Promise.all(
        allStocks
          .filter(stock => stock.ticker)
          .map(stock => updateStockCurrentPrice(stock.id).catch(err => {
            console.warn(`현재가 갱신 실패 (${stock.ticker}):`, err);
          }))
      ).then(async () => {
        // 현재가 업데이트 완료 후 종목 목록 다시 가져오기
        const updatedStocksPromises = accounts.map(async (account) => {
          return await getStocksByAccountId(account.id);
        });
        const updatedStocksArrays = await Promise.all(updatedStocksPromises);
        const updatedStocks = updatedStocksArrays.flat();
        
        // 차트 데이터 업데이트 (현재가 정보 포함)
        const updatedCharts = await Promise.all(
          updatedStocks.map(async (stock) => {
            const allRecords = await getTradingRecordsByStockId(stock.id);
            if (allRecords.length === 0) return null;
            
            const buyRecords: DotData[] = allRecords
              .filter(r => r.type === 'BUY')
              .map(r => ({ price: r.price, quantity: r.quantity, type: 'BUY' as const }));
            const sellRecords: DotData[] = allRecords
              .filter(r => r.type === 'SELL')
              .map(r => ({ price: r.price, quantity: r.quantity, type: 'SELL' as const }));
            
            let priceChange: number | null = null;
            let priceChangePercent: number | null = null;
            if (stock.ticker) {
              try {
                const quote = await getStockQuote(stock.ticker);
                if (quote) {
                  priceChange = quote.change || null;
                  priceChangePercent = quote.changePercent || null;
                }
              } catch (error) {
                console.warn(`종목 ${stock.ticker} 변화량 정보 조회 실패:`, error);
              }
            }
            
            return {
              stock,
              averagePrice: stock.averagePrice,
              currentPrice: stock.currentPrice || stock.averagePrice,
              priceChange,
              priceChangePercent,
              buyRecords,
              sellRecords,
            };
          })
        );
        
        const validUpdatedCharts = updatedCharts.filter((chart): chart is ChartData => chart !== null);
        
        // 선택된 종목 인덱스 유지 (우선순위: currentStockId > previousSelectedStockId > 현재 선택된 인덱스)
        let newSelectedIndex: number | null = null;
        
        // 1순위: 쿼리 파라미터로 전달된 stockId
        const currentStockId = stockId;
        if (currentStockId) {
          const foundIndex = validUpdatedCharts.findIndex(chart => chart && chart.stock && chart.stock.id === currentStockId);
          if (foundIndex >= 0) {
            newSelectedIndex = foundIndex;
            previousSelectedStockIdRef.current = currentStockId;
          }
        }
        
        // 2순위: 이전에 선택했던 종목 ID
        if (newSelectedIndex === null && previousSelectedStockIdRef.current) {
          const foundIndex = validUpdatedCharts.findIndex(chart => chart && chart.stock && chart.stock.id === previousSelectedStockIdRef.current);
          if (foundIndex >= 0) {
            newSelectedIndex = foundIndex;
          }
        }
        
        // 3순위: 현재 선택된 인덱스 유지
        if (newSelectedIndex === null && chartsData.length > 0 && selectedChartIndex !== null && selectedChartIndex >= 0 && selectedChartIndex < chartsData.length) {
          const currentSelectedChart = chartsData[selectedChartIndex];
          if (currentSelectedChart && currentSelectedChart.stock) {
            const currentSelectedStockId = currentSelectedChart.stock.id;
            const foundIndex = validUpdatedCharts.findIndex(chart => chart && chart.stock && chart.stock.id === currentSelectedStockId);
            if (foundIndex >= 0) {
              newSelectedIndex = foundIndex;
            }
          }
        }
        
        // 4순위: 첫 번째 항목
        if (newSelectedIndex === null && validUpdatedCharts.length > 0) {
          newSelectedIndex = 0;
          const firstChart = validUpdatedCharts[0];
          if (firstChart && firstChart.stock) {
            previousSelectedStockIdRef.current = firstChart.stock.id;
          }
        }
        
        if (newSelectedIndex !== null) {
          setSelectedChartIndex(newSelectedIndex);
        } else {
          setSelectedChartIndex(null);
          previousSelectedStockIdRef.current = null;
        }
        
        setChartsData(validUpdatedCharts);
      }).catch(priceError => {
        console.warn('현재가 갱신 실패:', priceError);
      });
      
      // 각 종목에 대해 차트 데이터 생성 (거래 기록 및 현재가 정보 병렬 처리)
      const charts: ChartData[] = await Promise.all(
        allStocks.map(async (stock) => {
          // 모든 거래 기록 가져오기 (매수/매도 모두)
          const allRecords = await getTradingRecordsByStockId(stock.id);
          
          if (allRecords.length === 0) return null;

          // 매수/매도 기록을 각각 점 데이터로 변환
          const buyRecords: DotData[] = allRecords
            .filter(r => r.type === 'BUY')
            .map(r => ({
              price: r.price,
              quantity: r.quantity,
              type: 'BUY' as const,
            }));
          
          const sellRecords: DotData[] = allRecords
            .filter(r => r.type === 'SELL')
            .map(r => ({
              price: r.price,
              quantity: r.quantity,
              type: 'SELL' as const,
            }));
          
          // 디버깅: 데이터 확인
          console.log(`[Visualization] Stock: ${stock.name || stock.officialName || stock.ticker}, Buy: ${buyRecords.length}, Sell: ${sellRecords.length}`);
          if (sellRecords.length > 0) {
            console.log(`[Visualization] Sell records:`, sellRecords);
          }
          
          // 현재가 및 변화량 정보 조회
          let priceChange: number | null = null;
          let priceChangePercent: number | null = null;
          if (stock.ticker) {
            try {
              const quote = await getStockQuote(stock.ticker);
              if (quote) {
                priceChange = quote.change || null;
                priceChangePercent = quote.changePercent || null;
              }
            } catch (error) {
              console.warn(`종목 ${stock.ticker} 변화량 정보 조회 실패:`, error);
            }
          }
          
          return {
            stock,
            averagePrice: stock.averagePrice,
            currentPrice: stock.currentPrice || stock.averagePrice,
            priceChange,
            priceChangePercent,
            buyRecords,
            sellRecords,
          };
        })
      );
      
      // null 값 필터링
      const validCharts = charts.filter((chart): chart is ChartData => chart !== null);

      setChartsData(validCharts);
      
      // 차트 데이터가 있으면 선택된 인덱스 설정
      if (validCharts.length > 0) {
        // 쿼리 파라미터로 전달된 stockId가 있으면 해당 종목 선택 (우선순위 1)
        if (currentStockId) {
          const foundIndex = validCharts.findIndex(chart => chart && chart.stock && chart.stock.id === currentStockId);
          if (foundIndex !== -1) {
            setSelectedChartIndex(foundIndex);
            previousSelectedStockIdRef.current = currentStockId;
          } else {
            // stockId가 있지만 찾지 못한 경우 첫 번째 항목 선택
            const firstChart = validCharts[0];
            if (firstChart && firstChart.stock) {
              setSelectedChartIndex(0);
              previousSelectedStockIdRef.current = firstChart.stock.id;
            }
          }
        }
        // 이전에 선택했던 종목이 있으면 그 종목을 찾아서 선택 (우선순위 2)
        else if (previousSelectedStockId) {
          const foundIndex = validCharts.findIndex(chart => chart && chart.stock && chart.stock.id === previousSelectedStockId);
          if (foundIndex !== -1) {
            setSelectedChartIndex(foundIndex);
            previousSelectedStockIdRef.current = previousSelectedStockId; // 유지
          } else {
            // 이전 선택한 종목이 없어졌으면 첫 번째 항목 선택
            const firstChart = validCharts[0];
            if (firstChart && firstChart.stock) {
              setSelectedChartIndex(0);
              previousSelectedStockIdRef.current = firstChart.stock.id;
            }
          }
        } else {
          // 선택된 인덱스가 없거나 유효하지 않을 때 첫 번째 항목 선택
          const firstChart = validCharts[0];
          if (firstChart && firstChart.stock) {
            setSelectedChartIndex(0);
            previousSelectedStockIdRef.current = firstChart.stock.id;
          }
        }
      } else {
        // 차트 데이터가 없으면 선택 인덱스 초기화
        setSelectedChartIndex(null);
        previousSelectedStockIdRef.current = null;
      }
    } catch (error) {
      console.error('Failed to load visualization data:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
      // selectedChartIndex는 의존성에 포함하지 않음 (이전 선택 상태 유지)
    }, [stockId]) // stockId가 변경되면 다시 로드
  );

  // 매매기록 차트 현재가 자동 갱신 (1분마다)
  useEffect(() => {
    const updatePrices = async () => {
      try {
        await initDatabase();
        const accounts = await getAllAccounts();
        const stocksPromises = accounts.map(async (account) => {
          return await getStocksByAccountId(account.id);
        });
        const stocksArrays = await Promise.all(stocksPromises);
        const allStocks: Stock[] = stocksArrays.flat();

        console.log('[Visualization] 매매기록 차트 현재가 자동 갱신 시작');
        // 현재가 갱신
        await Promise.all(
          allStocks
            .filter(stock => stock.ticker)
            .map(stock => updateStockCurrentPrice(stock.id).catch(err => {
              console.warn(`현재가 갱신 실패 (${stock.ticker}):`, err);
            }))
        );
        
        // 갱신 후 차트 데이터 업데이트
        const updatedStocksPromises = accounts.map(async (account) => {
          return await getStocksByAccountId(account.id);
        });
        const updatedStocksArrays = await Promise.all(updatedStocksPromises);
        const updatedStocks = updatedStocksArrays.flat();
        
        const updatedCharts = await Promise.all(
          updatedStocks.map(async (stock) => {
            const allRecords = await getTradingRecordsByStockId(stock.id);
            if (allRecords.length === 0) return null;
            
            const buyRecords: DotData[] = allRecords
              .filter(r => r.type === 'BUY')
              .map(r => ({ price: r.price, quantity: r.quantity, type: 'BUY' as const }));
            const sellRecords: DotData[] = allRecords
              .filter(r => r.type === 'SELL')
              .map(r => ({ price: r.price, quantity: r.quantity, type: 'SELL' as const }));
            
            let priceChange: number | null = null;
            let priceChangePercent: number | null = null;
            if (stock.ticker) {
              try {
                const quote = await getStockQuote(stock.ticker);
                if (quote) {
                  priceChange = quote.change || null;
                  priceChangePercent = quote.changePercent || null;
                }
              } catch (error) {
                console.warn(`종목 ${stock.ticker} 변화량 정보 조회 실패:`, error);
              }
            }
            
            return {
              stock,
              averagePrice: stock.averagePrice,
              currentPrice: stock.currentPrice || stock.averagePrice,
              priceChange,
              priceChangePercent,
              buyRecords,
              sellRecords,
            };
          })
        );
        
        const validUpdatedCharts = updatedCharts.filter((chart): chart is ChartData => chart !== null);
        
        // 선택된 종목 인덱스 유지
        if (chartsData.length > 0 && selectedChartIndex !== null && selectedChartIndex >= 0 && selectedChartIndex < chartsData.length) {
          const currentSelectedChart = chartsData[selectedChartIndex];
          if (currentSelectedChart && currentSelectedChart.stock) {
            const currentSelectedStockId = currentSelectedChart.stock.id;
            const foundIndex = validUpdatedCharts.findIndex(chart => chart && chart.stock && chart.stock.id === currentSelectedStockId);
            if (foundIndex >= 0) {
              setSelectedChartIndex(foundIndex);
            }
          }
        }
        
        setChartsData(validUpdatedCharts);
        console.log('[Visualization] 매매기록 차트 현재가 자동 갱신 완료');
      } catch (error) {
        console.error('[Visualization] 매매기록 차트 현재가 자동 갱신 오류:', error);
      }
    };

    // 초기 로드 후 약간의 지연을 두고 첫 갱신
    const initialTimeout = setTimeout(() => {
      updatePrices();
    }, 2000); // 2초 후 첫 갱신
    
    // 1분마다 자동 갱신
    const interval = setInterval(() => {
      updatePrices();
    }, 60 * 1000); // 1분
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    scrollToSelectedStock();
  }, [selectedChartIndex, chartsData]);

  const scrollToSelectedStock = (index?: number) => {
    const targetIndex = index !== undefined ? index : selectedChartIndex;
    if (targetIndex === null || !stockTabsScrollRef.current || chartsData.length === 0) return;
    
    // 약간의 지연을 두어 레이아웃이 완료된 후 스크롤
    setTimeout(() => {
      if (!stockTabsScrollRef.current) return;
      
      // 각 탭의 대략적인 너비 계산
      // paddingHorizontal(20*2) + marginRight(12) + 텍스트 너비(동적)
      // 텍스트 길이에 따라 너비가 달라지므로 더 넉넉하게 계산
      const baseTabWidth = 120; // 기본 너비 (padding + margin)
      const estimatedTabWidth = baseTabWidth + 80; // 텍스트 너비 포함 (최대 200px)
      
      // 선택된 탭의 예상 위치 계산
      const targetScrollX = targetIndex * estimatedTabWidth;
      
      // 화면 중앙에 오도록 조정 (화면 너비의 절반을 빼서 중앙 정렬)
      const screenWidth = 400; // 대략적인 화면 너비 (실제로는 동적으로 가져와야 하지만 추정값 사용)
      const centeredScrollX = targetScrollX - screenWidth / 2 + estimatedTabWidth / 2;
      
      stockTabsScrollRef.current.scrollTo({
        x: Math.max(0, centeredScrollX),
        animated: true,
      });
    }, 300); // 레이아웃 완료를 위해 지연 시간 증가
  };

  const openChartSelectionMenu = async () => {
    if (selectedChartIndex === null || chartsData.length === 0) return;
    const chart = chartsData[selectedChartIndex];
    if (!chart?.stock?.id) return;
    try {
      await initDatabase();
      const rec = await getTradingRecordsByStockId(chart.stock.id);
      setChartModalHasTradingRecords(rec.length > 0);
    } catch {
      setChartModalHasTradingRecords(false);
    }
    setShowChartSelectionModal(true);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#000000', '#121212', '#0D0D0D']}
          style={styles.gradient}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#42A5F5" />
            <Text style={styles.loadingText}>데이터를 불러오는 중...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (chartsData.length === 0) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#000000', '#121212', '#0D0D0D']}
          style={styles.gradient}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
              매매기록 차트
            </Text>
            <View style={styles.headerRightContainer}>
              <TouchableOpacity
                onPress={() => router.push('/')}
                style={styles.homeButton}
                activeOpacity={0.7}
              >
                <Text style={styles.homeButtonText}>⌂</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>매매 기록이 없습니다.</Text>
            <Text style={styles.emptySubtext}>포트폴리오에 종목을 추가하고 매매 기록을 저장해주세요.</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  const selectedChart = selectedChartIndex !== null ? chartsData[selectedChartIndex] : null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000000', '#121212', '#0D0D0D']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            매매기록 차트
          </Text>
          <View style={styles.headerRightContainer}>
            {selectedChart && (
              <TouchableOpacity
                onPress={() => router.push(`/stock-chart?id=${selectedChart.stock.id}`)}
                style={styles.headerIconButton}
                activeOpacity={0.7}
              >
                <Text style={styles.headerIcon}>📈</Text>
                <Text style={styles.headerIconLabel}>종목차트</Text>
              </TouchableOpacity>
            )}
            {selectedChart && (
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => void openChartSelectionMenu()}
                activeOpacity={0.7}
              >
                <NaverFinanceMiniIcon size={24} />
                <Text style={styles.headerIconLabel}>외부차트</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => router.push('/')}
              style={styles.homeButton}
              activeOpacity={0.7}
            >
              <Text style={styles.homeButtonText}>⌂</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 종목 선택 탭 */}
          <ScrollView
            ref={stockTabsScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.stockTabs}
            contentContainerStyle={styles.stockTabsContent}
          >
            {chartsData.map((chart, index) => (
              <TouchableOpacity
                key={chart.stock.id}
                onPress={() => {
                  setSelectedChartIndex(index);
                  previousSelectedStockIdRef.current = chart.stock.id;
                  // 탭 클릭 시에도 스크롤 (인덱스를 직접 전달)
                  scrollToSelectedStock(index);
                }}
                style={[
                  styles.stockTab,
                  selectedChartIndex === index && styles.stockTabActive,
                ]}
              >
                <Text
                  style={[
                    styles.stockTabText,
                    selectedChartIndex === index && styles.stockTabTextActive,
                  ]}
                >
                  {chart.stock.name || chart.stock.officialName || chart.stock.ticker}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 종목 정보 */}
          {selectedChart && (
            <View style={styles.stockInfo}>
              <Text style={styles.stockName}>
                {selectedChart.stock.name || selectedChart.stock.officialName || selectedChart.stock.ticker}
              </Text>
              <Text style={styles.stockTicker}>{selectedChart.stock.ticker}</Text>
            </View>
          )}

          {/* 현재가 정보 */}
          {selectedChart && selectedChart.currentPrice !== null && selectedChart.currentPrice > 0 && (
            <View style={styles.priceInfo}>
              <View style={styles.priceWithKrwContainer}>
                <Text style={styles.currentPrice}>
                  {formatCurrency(selectedChart.currentPrice, selectedChart.stock.currency || Currency.KRW)}
                </Text>
                {selectedChart.stock.currency === Currency.USD && getKrwEquivalentForDisplay(selectedChart.currentPrice) && (
                  <Text style={styles.krwEquivalentText}>{getKrwEquivalentForDisplay(selectedChart.currentPrice)}</Text>
                )}
              </View>
              {selectedChart.priceChange !== null && selectedChart.priceChangePercent !== null && (
                <View style={styles.changeInfo}>
                  <Text
                    style={[
                      styles.changeText,
                      selectedChart.priceChange >= 0 ? styles.positive : styles.negative,
                    ]}
                  >
                    {selectedChart.priceChange >= 0 ? '+' : ''}
                    {formatCurrency(selectedChart.priceChange, selectedChart.stock.currency || Currency.KRW)} ({selectedChart.priceChangePercent >= 0 ? '+' : ''}
                    {selectedChart.priceChangePercent.toFixed(2)}%)
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* 평균단가 및 보유수량 정보 */}
          {selectedChart && (
            <View style={styles.averageInfo}>
              <View style={styles.averageInfoRow}>
                <Text style={styles.averageInfoLabel}>평균단가:</Text>
                <View style={styles.averagePriceContainer}>
                  <View style={styles.averagePriceRow}>
                    <Text style={styles.averageInfoValue}>
                      {formatCurrency(
                        typeof selectedChart.stock.averagePrice === 'number' ? selectedChart.stock.averagePrice : 0,
                        selectedChart.stock.currency || Currency.KRW
                      )}
                    </Text>
                  </View>
                  {selectedChart.stock.currency === Currency.USD && getKrwEquivalentForDisplay(typeof selectedChart.stock.averagePrice === 'number' ? selectedChart.stock.averagePrice : 0) && (
                    <Text style={styles.krwEquivalentTextSmall}>{getKrwEquivalentForDisplay(typeof selectedChart.stock.averagePrice === 'number' ? selectedChart.stock.averagePrice : 0)}</Text>
                  )}
                </View>
              </View>
              <View style={styles.averageInfoRow}>
                <Text style={styles.averageInfoLabel}>보유수량:</Text>
                <Text style={styles.averageInfoValue}>
                  {`${(typeof selectedChart.stock.quantity === 'number' ? selectedChart.stock.quantity : 0).toLocaleString()}주`}
                </Text>
              </View>
            </View>
          )}

          {/* 점 차트 */}
          {selectedChart && (
            <DotChart
              stock={selectedChart.stock}
              averagePrice={selectedChart.averagePrice}
              currentPrice={selectedChart.currentPrice}
              buyRecords={selectedChart.buyRecords}
              sellRecords={selectedChart.sellRecords}
            />
          )}

          {/* 매매기록 보기 버튼 */}
          {selectedChart && (
            <TouchableOpacity
              style={styles.recordsButton}
              onPress={() => router.push(`/stock-detail?id=${selectedChart.stock.id}`)}
              activeOpacity={0.8}
            >
              <Text style={styles.recordsButtonText}>매매기록 보기</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </LinearGradient>
      {selectedChart && (
        <ChartSelectionModal
          visible={showChartSelectionModal}
          onCancel={() => setShowChartSelectionModal(false)}
          onDismissAfterSelect={() => setShowChartSelectionModal(false)}
          origin="visualization"
          portfolioStock={{
            id: selectedChart.stock.id,
            ticker: selectedChart.stock.ticker,
            name: selectedChart.stock.name,
            officialName: selectedChart.stock.officialName,
            currency: selectedChart.stock.currency,
          }}
          marketStock={null}
          hasTradingRecords={chartModalHasTradingRecords}
        />
      )}
    </View>
  );
}

interface DotChartProps {
  stock: Stock;
  averagePrice: number;
  currentPrice: number;
  buyRecords: DotData[];
  sellRecords: DotData[];
}

function DotChart({ stock, averagePrice, currentPrice, buyRecords, sellRecords }: DotChartProps) {
  const chartHeight = 300;
  const chartAreaPaddingTop = 10; // chartArea의 paddingTop
  const chartAreaPaddingBottom = 40; // chartArea의 paddingBottom
  const chartAreaPaddingLeft = 30; // chartArea의 paddingLeft (가격 숫자 레이블 공간)
  const chartAreaPaddingRight = 10; // chartArea의 paddingRight
  const chartAreaWidth = 280; // 차트 영역의 실제 너비 (padding 제외)
  const effectiveWidth = chartAreaWidth - chartAreaPaddingLeft - chartAreaPaddingRight; // 실제 사용 가능한 너비 (240)
  const centerX = chartAreaPaddingLeft + effectiveWidth / 2; // 중앙선 (paddingLeft 기준) = 30 + 120 = 150
  const buyAreaWidth = effectiveWidth * 0.4; // 매수 영역 너비 (40%)
  const sellAreaWidth = effectiveWidth * 0.4; // 매도 영역 너비 (40%)
  
  // 디버깅: 데이터 확인
  console.log(`[DotChart] Rendering: Buy=${buyRecords.length}, Sell=${sellRecords.length}`);
  if (sellRecords.length > 0) {
    console.log(`[DotChart] Sell records data:`, sellRecords);
  }
  
  // 모든 기록 통합
  const allRecords = [...buyRecords, ...sellRecords];
  
  // 총 거래금액 계산 (수량 * 단가)
  const getTotalAmount = (record: DotData): number => record.quantity * record.price;
  const allAmounts = allRecords.map(getTotalAmount);
  const maxAmount = Math.max(...allAmounts, 1);
  
  // 가격 범위 계산 (현재가, 평균 단가 포함)
  const allPrices = allRecords.map(r => r.price);
  const pricesWithCurrent = [...allPrices];
  if (currentPrice && currentPrice > 0) {
    pricesWithCurrent.push(currentPrice);
  }
  if (averagePrice && averagePrice > 0) {
    pricesWithCurrent.push(averagePrice);
  }
  const minPrice = pricesWithCurrent.length > 0 ? Math.min(...pricesWithCurrent) : 0;
  const maxPrice = pricesWithCurrent.length > 0 ? Math.max(...pricesWithCurrent) : 100000;

  // 가격의 Y 위치 계산 (위에서 아래로 - 가격이 높을수록 위)
  const getPriceYPosition = (price: number): number => {
    if (allPrices.length === 0 || maxPrice === minPrice) return chartAreaPaddingTop;
    const ratio = (price - minPrice) / (maxPrice - minPrice);
    return chartAreaPaddingTop + (1 - ratio) * (chartHeight - chartAreaPaddingTop - chartAreaPaddingBottom);
  };

  // 점 크기 계산 (수량 * 단가에 비례, 상대적 크기, 최대 24px)
  const baseDotSize = 6; // 최소 점 크기
  const maxDotSize = 24; // 최대 점 크기
  const getDotSize = (record: DotData): number => {
    const amount = getTotalAmount(record);
    if (maxAmount === 0) return baseDotSize;
    // 총 거래금액에 비례하되, 제곱근으로 완만하게 증가
    const ratio = amount / maxAmount;
    const size = baseDotSize + (maxDotSize - baseDotSize) * Math.sqrt(ratio);
    return Math.max(baseDotSize, Math.min(maxDotSize, size));
  };

  const formatPrice = (price: number): string => {
    if (stock.currency === Currency.KRW) {
      return `${Math.round(price).toLocaleString()}원`;
    } else {
      return `$${price.toFixed(2)}`;
    }
  };

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>가격대별 매매 분포</Text>
      
      <View style={styles.chartWrapper}>
        {/* 차트 영역 */}
        <View style={styles.chartArea}>
          {/* 그리드 선 (옵션) */}
          
          {/* 점 차트 */}
          <View style={styles.dotsContainer}>
            {/* 매수 점들 (왼쪽 고정 위치) */}
            {buyRecords.map((record, index) => {
              const y = getPriceYPosition(record.price);
              const dotSize = getDotSize(record);
              // 왼쪽 고정 위치 (가격 숫자 레이블 영역을 제외한 왼쪽 영역의 중앙)
              const leftAreaStart = chartAreaPaddingLeft; // 가격 숫자 레이블 영역 끝 (50px)
              const leftAreaEnd = centerX; // 중앙선 위치 (160px)
              const leftAreaCenter = leftAreaStart + (leftAreaEnd - leftAreaStart) / 2; // 왼쪽 영역 중앙 고정
              const x = leftAreaCenter; // 고정된 x 좌표
              
              return (
                <View
                  key={`buy-${index}`}
                  style={[
                    styles.dot,
                    styles.buyDot,
                    {
                      left: x - dotSize / 2,
                      top: y - dotSize / 2,
                      width: dotSize,
                      height: dotSize,
                      borderRadius: dotSize / 2,
                    },
                  ]}
                />
              );
            })}
            
            {/* 매도 점들 (오른쪽 고정 위치) */}
            {sellRecords.map((record, index) => {
              const y = getPriceYPosition(record.price);
              const dotSize = getDotSize(record);
              // 매도 점을 중앙선 근처(범례 위치 정도)로 이동
              const x = centerX + 20; // 중앙선에서 약간 오른쪽 (범례 위치 정도)
              
              return (
                <View
                  key={`sell-${index}`}
                  style={[
                    styles.dot,
                    styles.sellDot,
                    {
                      left: x - dotSize / 2,
                      top: y - dotSize / 2,
                      width: dotSize,
                      height: dotSize,
                      borderRadius: dotSize / 2,
                    },
                  ]}
                />
              );
            })}
            
            {/* 평균 단가 라인 */}
            {averagePrice && averagePrice > 0 && (
              <>
                <View
                  style={[
                    styles.averagePriceLine,
                    {
                      top: getPriceYPosition(averagePrice),
                      left: chartAreaPaddingLeft,
                      width: effectiveWidth,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.averagePriceLabel,
                    {
                      top: getPriceYPosition(averagePrice) - 10,
                      left: chartAreaPaddingLeft + 10,
                    },
                  ]}
                >
                  평균단가: {formatPrice(averagePrice)}
                </Text>
              </>
            )}
            
            {/* 현재가 라인 */}
            {currentPrice && currentPrice > 0 && (
              <>
                <View
                  style={[
                    styles.currentPriceLine,
                    {
                      top: getPriceYPosition(currentPrice),
                      left: chartAreaPaddingLeft,
                      width: effectiveWidth,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.currentPriceLabel,
                    {
                      top: getPriceYPosition(currentPrice) - 10,
                      left: chartAreaPaddingLeft + effectiveWidth - 80,
                    },
                  ]}
                >
                  현재가: {formatPrice(currentPrice)}
                </Text>
              </>
            )}
            
            {/* Y축 가격 레이블 (왼쪽에 배치) */}
            {Array.from({ length: 5 }, (_, i) => {
              const price = minPrice + (maxPrice - minPrice) * (i / 4);
              const y = getPriceYPosition(price);
              return (
                <View
                  key={`price-${i}`}
                  style={[
                    styles.priceTickLabel,
                    { left: 0, top: y - 8 }, // 왼쪽 끝에서 0px (완전히 왼쪽)
                  ]}
                >
                  <Text style={styles.priceTickText}>{formatPrice(price)}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* 범례 */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.buyDot]} />
          <Text style={styles.legendText}>매수</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.sellDot]} />
          <Text style={styles.legendText}>매도</Text>
        </View>
      </View>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    minWidth: 0,
  },
  headerRightContainer: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  headerIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  headerIcon: {
    fontSize: 18,
  },
  headerIconLabel: {
    fontSize: 9,
    color: '#FFFFFF',
    marginTop: 1,
    fontWeight: '500',
  },
  homeButton: {
    padding: 4,
  },
  homeButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 80,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#B0BEC5',
    textAlign: 'center',
    lineHeight: 24,
  },
  stockTabs: {
    marginBottom: 24,
  },
  stockTabsContent: {
    paddingHorizontal: 4,
  },
  stockTab: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(66, 165, 245, 0.1)',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
  },
  stockTabActive: {
    backgroundColor: '#42A5F5',
    borderColor: '#42A5F5',
  },
  stockTabText: {
    fontSize: 16,
    color: '#42A5F5',
    fontWeight: '600',
  },
  stockTabTextActive: {
    color: '#FFFFFF',
  },
  chartContainer: {
    backgroundColor: 'rgba(45, 45, 45, 0.6)',
    borderRadius: 20,
    padding: 12,
    paddingLeft: 8,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  chartWrapper: {
    height: 350,
  },
  centerLine: {
    position: 'absolute',
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  priceTickLabel: {
    position: 'absolute',
  },
  priceTickText: {
    fontSize: 10,
    color: '#B0BEC5',
  },
  chartArea: {
    flex: 1,
    position: 'relative',
    height: 300,
    marginTop: 20,
    backgroundColor: 'rgba(45, 45, 45, 0.3)',
    borderRadius: 8,
    paddingLeft: 30,
    paddingRight: 10,
    paddingTop: 10,
    paddingBottom: 40,
  },
  dotsContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  averagePriceLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#4DD0E1', // 밝은 시안 (평균단가)
    opacity: 0.8,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#4DD0E1',
  },
  averagePriceLabel: {
    position: 'absolute',
    fontSize: 11,
    color: '#4DD0E1', // 밝은 시안 (평균단가)
    fontWeight: '600',
    backgroundColor: 'rgba(45, 45, 45, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentPriceLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#FFC107', // 밝은 노란색/골드 (현재가)
    opacity: 0.8,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  currentPriceLabel: {
    position: 'absolute',
    fontSize: 11,
    color: '#FFC107', // 밝은 노란색/골드 (현재가)
    fontWeight: '600',
    backgroundColor: 'rgba(45, 45, 45, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dot: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  buyDot: {
    backgroundColor: '#F44336', // 빨간색 (매수)
  },
  sellDot: {
    backgroundColor: '#42A5F5', // 파란색 (매도)
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 14,
    color: '#B0BEC5',
    fontWeight: '500',
  },
  recordsButton: {
    marginTop: 24,
    backgroundColor: '#42A5F5',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordsButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  stockInfo: {
    marginBottom: 16,
  },
  stockName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  stockTicker: {
    color: '#94A3B8',
    fontSize: 14,
  },
  priceInfo: {
    marginBottom: 12,
  },
  priceWithKrwContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  krwEquivalentText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: 'normal',
    marginTop: 2,
  },
  currentPrice: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 0,
  },
  averagePriceContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  averagePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  krwEquivalentTextSmall: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: 'normal',
    marginTop: 2,
  },
  changeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  positive: {
    color: '#10B981',
  },
  negative: {
    color: '#EF4444',
  },
  averageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(51, 51, 51, 0.5)',
    borderRadius: 12,
  },
  averageInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  averageInfoLabel: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  averageInfoValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  xAxis: {
    marginTop: 16,
    alignItems: 'center',
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 280,
    paddingHorizontal: 20,
  },
  xAxisLabel: {
    fontSize: 14,
    color: '#B0BEC5',
    fontWeight: '600',
  },
});

