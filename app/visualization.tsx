import React, { useState, useRef } from 'react';
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
  getTradingRecordsByStockId 
} from '../src/services/DatabaseService';
import { Account } from '../src/models/Account';
import { Stock } from '../src/models/Stock';
import { TradingRecord } from '../src/models/TradingRecord';
import { Currency } from '../src/models/Currency';

interface DotData {
  price: number;
  quantity: number;
  type: 'BUY' | 'SELL';
}

interface ChartData {
  stock: Stock;
  averagePrice: number;
  currentPrice: number;
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
  const previousSelectedStockIdRef = useRef<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 이전에 선택했던 종목 ID 저장 (데이터 로드 전에)
      const previousSelectedStockId = previousSelectedStockIdRef.current;
      
      // 현재 stockId 가져오기 (함수 내부에서 다시 가져옴)
      const currentStockId = stockId;
      
      // 데이터베이스 초기화
      await initDatabase();
      
      // 모든 포트폴리오 가져오기
      const accounts = await getAllAccounts();
      
      // 모든 종목 가져오기
      const allStocks: Stock[] = [];
      for (const account of accounts) {
        const stocks = await getStocksByAccountId(account.id);
        allStocks.push(...stocks);
      }

      // 각 종목에 대해 차트 데이터 생성
      const charts: ChartData[] = [];
      
      for (const stock of allStocks) {
        // 모든 거래 기록 가져오기 (매수/매도 모두)
        const allRecords = await getTradingRecordsByStockId(stock.id);
        
        if (allRecords.length === 0) continue;

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
        console.log(`[Visualization] Stock: ${stock.name}, Buy: ${buyRecords.length}, Sell: ${sellRecords.length}`);
        if (sellRecords.length > 0) {
          console.log(`[Visualization] Sell records:`, sellRecords);
        }
        
        charts.push({
          stock,
          averagePrice: stock.averagePrice,
          currentPrice: stock.currentPrice || stock.averagePrice,
          buyRecords,
          sellRecords,
        });
      }

      setChartsData(charts);
      
      // 쿼리 파라미터로 전달된 stockId가 있으면 해당 종목 선택 (우선순위 1)
      if (currentStockId && charts.length > 0) {
        const foundIndex = charts.findIndex(chart => chart.stock.id === currentStockId);
        if (foundIndex !== -1) {
          setSelectedChartIndex(foundIndex);
          previousSelectedStockIdRef.current = currentStockId;
          return; // stockId가 있으면 다른 로직 무시
        }
      }
      
      // 이전에 선택했던 종목이 있으면 그 종목을 찾아서 선택 (우선순위 2)
      if (previousSelectedStockId && charts.length > 0) {
        const foundIndex = charts.findIndex(chart => chart.stock.id === previousSelectedStockId);
        if (foundIndex !== -1) {
          setSelectedChartIndex(foundIndex);
          previousSelectedStockIdRef.current = previousSelectedStockId; // 유지
        } else {
          // 이전 선택한 종목이 없어졌으면 첫 번째 항목 선택
          setSelectedChartIndex(0);
          previousSelectedStockIdRef.current = charts[0]?.stock.id || null;
        }
      } else if (charts.length > 0) {
        // 선택된 인덱스가 없거나 유효하지 않을 때만 첫 번째 항목 선택
        setSelectedChartIndex(0);
        previousSelectedStockIdRef.current = charts[0]?.stock.id || null;
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

  if (loading) {
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

  if (chartsData.length === 0) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0D1B2A', '#1B263B', '#0F1419']}
          style={styles.gradient}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>매매기록 차트</Text>
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
        colors={['#0D1B2A', '#1B263B', '#0F1419']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>매매기록 차트</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 종목 선택 탭 */}
          <ScrollView
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
                  {chart.stock.name || chart.stock.ticker}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

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
  
  // 가격 범위 계산
  const allPrices = allRecords.map(r => r.price);
  const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
  const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 100000;

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
    backgroundColor: '#0D1B2A',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 28,
    color: '#42A5F5',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(13, 27, 42, 0.6)',
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
    backgroundColor: 'rgba(13, 27, 42, 0.3)',
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

