import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Svg, { Rect, Line, G } from 'react-native-svg';
import * as ScreenOrientation from 'expo-screen-orientation';
import { 
  getStockById, 
  initDatabase,
  getAllAccounts,
  getStocksByAccountId,
  getTradingRecordsByStockId
} from '../src/services/DatabaseService';
import { getHistoricalData, getStockQuote } from '../src/services/YahooFinanceService';
import { Stock } from '../src/models/Stock';
import { Currency } from '../src/models/Currency';
import { formatCurrency } from '../src/utils/formatUtils';

type RangeConfig = {
  range: string;
  interval: string;
  label: string;
};

const RANGE_CONFIGS: Record<string, RangeConfig> = {
  '1d': { range: '1d', interval: '5m', label: '1일' },
  '5d': { range: '5d', interval: '1h', label: '5일' },
  '1wk': { range: '5d', interval: '1d', label: '1주' },
  '1mo': { range: '1mo', interval: '1d', label: '1개월' },
  '3mo': { range: '3mo', interval: '1d', label: '3개월' },
  '6mo': { range: '6mo', interval: '1d', label: '6개월' },
  '1y': { range: '1y', interval: '1wk', label: '1년' },
};

type RangeType = keyof typeof RANGE_CONFIGS;

interface CandlestickData {
  open: number;
  high: number;
  low: number;
  close: number;
  date: number;
}

function CandlestickChartComponent({
  data,
  width,
  height,
}: {
  data: CandlestickData[];
  width: number;
  height: number;
}) {
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // 가격 범위 계산
  const allValues = data.flatMap(d => [d.high, d.low]);
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const valueRange = maxValue - minValue || 1;

  // 좌표 변환 함수
  const getX = (index: number) => {
    return (index / (data.length - 1 || 1)) * chartWidth;
  };

  const getY = (value: number) => {
    return chartHeight - ((value - minValue) / valueRange) * chartHeight;
  };

  // 캔들 너비 계산
  const candleWidth = Math.max(2, chartWidth / data.length - 4);

  // Y축 레이블
  const yAxisLabels = [];
  const numLabels = 5;
  for (let i = 0; i <= numLabels; i++) {
    const value = minValue + (valueRange * i) / numLabels;
    yAxisLabels.push({
      value,
      y: getY(value),
    });
  }

  // X축 레이블 (최대 6개)
  const xAxisLabels = [];
  const labelInterval = Math.ceil(data.length / 6);
  for (let i = 0; i < data.length; i += labelInterval) {
    xAxisLabels.push({
      label: new Date(data[i].date * 1000).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
      x: getX(i),
    });
  }

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <G translateX={padding} translateY={padding}>
          {/* 그리드 라인 */}
          {yAxisLabels.map((label, index) => (
            <Line
              key={`grid-${index}`}
              x1={0}
              y1={label.y}
              x2={chartWidth}
              y2={label.y}
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="1"
            />
          ))}

          {/* 캔들스틱 그리기 */}
          {data.map((item, index) => {
            const x = getX(index) - candleWidth / 2;
            const openY = getY(item.open);
            const closeY = getY(item.close);
            const highY = getY(item.high);
            const lowY = getY(item.low);
            const isUp = item.close >= item.open;
            const color = isUp ? '#EF4444' : '#10B981';
            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.abs(closeY - openY) || 1;

            return (
              <G key={`candle-${index}`}>
                {/* 심지 (위아래 선) */}
                <Line
                  x1={x + candleWidth / 2}
                  y1={highY}
                  x2={x + candleWidth / 2}
                  y2={lowY}
                  stroke={color}
                  strokeWidth="1"
                />
                {/* 캔들 몸체 */}
                <Rect
                  x={x}
                  y={bodyTop}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={color}
                  stroke={color}
                  strokeWidth="1"
                />
              </G>
            );
          })}
        </G>
      </Svg>

      {/* Y축 레이블 (React Native Text로 오버레이) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {yAxisLabels.map((label, index) => (
          <Text
            key={`y-label-${index}`}
            style={[
              styles.yAxisLabel,
              {
                left: padding - 45,
                top: padding + label.y - 7,
              },
            ]}
          >
            {label.value.toFixed(0)}
          </Text>
        ))}

        {/* X축 레이블 */}
        {xAxisLabels.map((label, index) => (
          <Text
            key={`x-label-${index}`}
            style={[
              styles.xAxisLabel,
              {
                left: padding + label.x - 25,
                top: padding + chartHeight + 5,
              },
            ]}
          >
            {label.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function StockChartScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [stock, setStock] = useState<Stock | null>(null);
  const [portfolioStocks, setPortfolioStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [candlestickData, setCandlestickData] = useState<CandlestickData[]>([]);
  const [selectedRange, setSelectedRange] = useState<RangeType>('1mo');
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number | null>(null);
  const [priceChangePercent, setPriceChangePercent] = useState<number | null>(null);
  const [screenData, setScreenData] = useState(Dimensions.get('window'));
  const isLandscape = screenData.width > screenData.height;
  const [hasTradingRecords, setHasTradingRecords] = useState<boolean>(false);
  const stockTabsScrollRef = useRef<ScrollView>(null);

  // 화면 회전 감지
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenData(window);
    });
    return () => subscription?.remove();
  }, []);

  // 화면 진입 시 랜드스케이프 허용, 이탈 시 세로 모드로 복원
  useFocusEffect(
    React.useCallback(() => {
      ScreenOrientation.unlockAsync();
      return () => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
      };
    }, [])
  );

  useFocusEffect(
    React.useCallback(() => {
      loadPortfolioStocks();
    }, [])
  );

  useEffect(() => {
    loadStockData();
  }, [id]);

  useEffect(() => {
    if (stock) {
      loadChartData();
      checkTradingRecords();
    }
  }, [stock, selectedRange, portfolioStocks]);

  useEffect(() => {
    scrollToSelectedStock();
  }, [stock, portfolioStocks]);

  const scrollToSelectedStock = () => {
    if (!stock || !stockTabsScrollRef.current || portfolioStocks.length === 0) return;
    
    const selectedIndex = portfolioStocks.findIndex(s => s.id === stock.id);
    if (selectedIndex === -1) return;

    // 약간의 지연을 두어 레이아웃이 완료된 후 스크롤
    setTimeout(() => {
      // 각 탭의 대략적인 너비: paddingHorizontal(20*2) + marginRight(12) + 텍스트 너비(약 80-100)
      // 대략 120-140px 정도로 추정, 안전하게 150으로 설정
      const estimatedTabWidth = 150;
      const scrollX = selectedIndex * estimatedTabWidth - 50; // 약간 왼쪽 여유 공간
      
      stockTabsScrollRef.current?.scrollTo({
        x: Math.max(0, scrollX),
        animated: true,
      });
    }, 200);
  };

  const checkTradingRecords = async () => {
    if (!stock) return;
    try {
      const records = await getTradingRecordsByStockId(stock.id);
      setHasTradingRecords(records.length > 0);
    } catch (error) {
      console.error('매매기록 확인 오류:', error);
      setHasTradingRecords(false);
    }
  };

  const loadPortfolioStocks = async () => {
    try {
      await initDatabase();
      const accounts = await getAllAccounts();
      const allStocks: Stock[] = [];
      for (const account of accounts) {
        const stocks = await getStocksByAccountId(account.id);
        allStocks.push(...stocks);
      }
      setPortfolioStocks(allStocks);
    } catch (error) {
      console.error('포트폴리오 종목 로드 오류:', error);
    }
  };

  // id가 없고 포트폴리오 종목이 있을 때 첫 번째 종목 자동 선택
  useEffect(() => {
    const autoSelectFirstStock = async () => {
      if (!id && portfolioStocks.length > 0 && !stock) {
        const firstStock = portfolioStocks[0];
        setStock(firstStock);
        // 현재가 조회
        if (firstStock.ticker) {
          try {
            const quote = await getStockQuote(firstStock.ticker);
            if (quote) {
              setCurrentPrice(quote.price);
              setPriceChange(quote.change || null);
              setPriceChangePercent(quote.changePercent || null);
            }
          } catch (error) {
            console.error('현재가 조회 오류:', error);
          }
        }
      }
    };
    autoSelectFirstStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, portfolioStocks.length]);

  const handleStockSelect = async (selectedStock: Stock) => {
    try {
      setLoading(true);
      setStock(selectedStock);
      
      // 현재가 조회
      if (selectedStock.ticker) {
        const quote = await getStockQuote(selectedStock.ticker);
        if (quote) {
          setCurrentPrice(quote.price);
          setPriceChange(quote.change || null);
          setPriceChangePercent(quote.changePercent || null);
        }
      }
    } catch (error) {
      console.error('종목 선택 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStockData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const stockData = await getStockById(id);
      if (stockData) {
        setStock(stockData);
        // 현재가 조회
        if (stockData.ticker) {
          const quote = await getStockQuote(stockData.ticker);
          if (quote) {
            setCurrentPrice(quote.price);
            setPriceChange(quote.change || null);
            setPriceChangePercent(quote.changePercent || null);
          }
        }
      }
    } catch (error) {
      console.error('종목 데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChartData = async () => {
    if (!stock?.ticker) return;

    try {
      setLoading(true);
      const config = RANGE_CONFIGS[selectedRange];
      const data = await getHistoricalData(stock.ticker, config.range, config.interval);
      
      if (data.length === 0) {
        setCandlestickData([]);
        return;
      }

      // 캔들스틱 차트 데이터 포맷팅
      const formattedCandlestickData: CandlestickData[] = data.map((item) => ({
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        date: item.date,
      }));

      setCandlestickData(formattedCandlestickData);
    } catch (error) {
      console.error('차트 데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return '-';
    return formatCurrency(price, stock?.currency || Currency.KRW);
  };

  if (loading && !stock) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0D1B2A', '#1B263B', '#0F1419']}
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

  if (!stock) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0D1B2A', '#1B263B', '#0F1419']}
          style={styles.gradient}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>종목차트</Text>
          </View>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>종목 정보를 찾을 수 없습니다.</Text>
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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>종목차트</Text>
          {hasTradingRecords && (
            <TouchableOpacity
              onPress={() => router.push(`/visualization?stockId=${stock.id}`)}
              style={styles.headerIconButton}
              activeOpacity={0.7}
            >
              <Text style={styles.headerIcon}>📉</Text>
              <Text style={styles.headerIconLabel}>매매기록</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 종목 선택 탭 */}
          {portfolioStocks.length > 0 && (
            <ScrollView
              ref={stockTabsScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.stockTabs}
              contentContainerStyle={styles.stockTabsContent}
            >
              {portfolioStocks.map((portfolioStock) => (
                <TouchableOpacity
                  key={portfolioStock.id}
                  onPress={() => handleStockSelect(portfolioStock)}
                  style={[
                    styles.stockTab,
                    stock?.id === portfolioStock.id && styles.stockTabActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.stockTabText,
                      stock?.id === portfolioStock.id && styles.stockTabTextActive,
                    ]}
                  >
                    {portfolioStock.name || portfolioStock.officialName || portfolioStock.ticker}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* 종목 정보 */}
          <View style={styles.stockInfo}>
            <Text style={styles.stockName}>
              {stock.name || stock.officialName || stock.ticker}
            </Text>
            <Text style={styles.stockTicker}>{stock.ticker}</Text>
          </View>

          {/* 현재가 정보 */}
          {currentPrice !== null && (
            <View style={styles.priceInfo}>
              <Text style={styles.currentPrice}>{formatPrice(currentPrice)}</Text>
              {priceChange !== null && priceChangePercent !== null && (
                <View style={styles.changeInfo}>
                  <Text
                    style={[
                      styles.changeText,
                      priceChange >= 0 ? styles.positive : styles.negative,
                    ]}
                  >
                    {priceChange >= 0 ? '+' : ''}
                    {formatPrice(priceChange)} ({priceChangePercent >= 0 ? '+' : ''}
                    {priceChangePercent.toFixed(2)}%)
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* 기간 선택 */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.rangeSelectorScroll}
            contentContainerStyle={styles.rangeSelector}
          >
            {(Object.keys(RANGE_CONFIGS) as RangeType[]).map((range) => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.rangeButton,
                  selectedRange === range && styles.rangeButtonActive,
                ]}
                onPress={() => setSelectedRange(range)}
              >
                <Text
                  style={[
                    styles.rangeButtonText,
                    selectedRange === range && styles.rangeButtonTextActive,
                  ]}
                >
                  {RANGE_CONFIGS[range].label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 차트 */}
          {loading ? (
            <View style={styles.chartLoadingContainer}>
              <ActivityIndicator size="large" color="#42A5F5" />
              <Text style={styles.loadingText}>차트를 불러오는 중...</Text>
            </View>
          ) : candlestickData.length > 0 ? (
            <View style={styles.chartContainer}>
              <CandlestickChartComponent
                data={candlestickData}
                width={isLandscape ? screenData.width - 80 : screenData.width - 40}
                height={isLandscape ? screenData.height - 200 : 250}
              />
            </View>
          ) : (
            <View style={styles.emptyChartContainer}>
              <Text style={styles.emptyChartText}>차트 데이터가 없습니다.</Text>
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 16,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  headerIconButton: {
    marginLeft: 'auto',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerIcon: {
    fontSize: 18,
  },
  headerIconLabel: {
    fontSize: 10,
    color: '#FFFFFF',
    marginTop: 2,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 16,
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 16,
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
    marginBottom: 24,
  },
  currentPrice: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
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
  rangeSelectorScroll: {
    marginBottom: 16,
  },
  rangeSelector: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
  },
  rangeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(66, 165, 245, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
    alignItems: 'center',
    minWidth: 60,
  },
  rangeButtonActive: {
    backgroundColor: '#42A5F5',
    borderColor: '#42A5F5',
  },
  rangeButtonText: {
    color: '#42A5F5',
    fontSize: 12,
    fontWeight: '600',
  },
  rangeButtonTextActive: {
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(27, 38, 59, 0.5)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingRight: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  chartLoadingContainer: {
    minHeight: 250,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(27, 38, 59, 0.5)',
    borderRadius: 12,
    marginBottom: 20,
  },
  emptyChartContainer: {
    minHeight: 250,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(27, 38, 59, 0.5)',
    borderRadius: 12,
    marginBottom: 20,
  },
  emptyChartText: {
    color: '#94A3B8',
    fontSize: 16,
  },
  yAxisLabel: {
    position: 'absolute',
    fontSize: 10,
    color: '#94A3B8',
    width: 40,
    textAlign: 'right',
  },
  xAxisLabel: {
    position: 'absolute',
    fontSize: 10,
    color: '#94A3B8',
    width: 50,
    textAlign: 'center',
  },
});
