import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ExchangeRateService } from '../src/services/ExchangeRateService';
import { getStockQuote } from '../src/services/YahooFinanceService';

interface MarketIndicator {
  name: string;
  symbol: string;
  price: number;
  change?: number;
  changePercent?: number;
  currency: string;
}

export default function MarketIndicatorsScreen() {
  const router = useRouter();
  const [indicators, setIndicators] = useState<MarketIndicator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMarketIndicators();
  }, []);

  const loadMarketIndicators = async () => {
    try {
      setLoading(true);
      const indicatorsList: MarketIndicator[] = [];

      // 환율 (USDKRW=X)
      const usdkrwQuote = await getStockQuote('USDKRW=X');
      if (usdkrwQuote) {
        indicatorsList.push({
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
        indicatorsList.push({
          name: '환율',
          symbol: 'USD/KRW',
          price: rate,
          currency: 'KRW',
        });
      }

      // 비트코인 (BTC-USD)
      const btcQuote = await getStockQuote('BTC-USD');
      if (btcQuote) {
        indicatorsList.push({
          name: '비트코인',
          symbol: 'BTC',
          price: btcQuote.price,
          change: btcQuote.change,
          changePercent: btcQuote.changePercent,
          currency: 'USD',
        });
      }

      // 금 (GC=F)
      const goldQuote = await getStockQuote('GC=F');
      if (goldQuote) {
        indicatorsList.push({
          name: '금',
          symbol: 'GC',
          price: goldQuote.price,
          change: goldQuote.change,
          changePercent: goldQuote.changePercent,
          currency: 'USD',
        });
      }

      // 유가 (CL=F)
      const oilQuote = await getStockQuote('CL=F');
      if (oilQuote) {
        indicatorsList.push({
          name: '유가',
          symbol: 'CL',
          price: oilQuote.price,
          change: oilQuote.change,
          changePercent: oilQuote.changePercent,
          currency: 'USD',
        });
      }

      setIndicators(indicatorsList);
    } catch (error) {
      console.error('주요 지표 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number, currency: string) => {
    if (currency === 'USD') {
      if (price < 1) {
        return `$${price.toFixed(2)}`;
      } else if (price < 100) {
        return `$${price.toFixed(2)}`;
      } else {
        return `$${price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      }
    } else {
      return `${Math.round(price).toLocaleString()}원`;
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0D1B2A', '#1B263B', '#0F1419']}
        style={styles.gradient}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#42A5F5" />
              <Text style={styles.loadingText}>지표를 불러오는 중...</Text>
            </View>
          ) : indicators.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>지표 데이터가 없습니다.</Text>
            </View>
          ) : (
            indicators.map((indicator, index) => {
              // 티커 매핑: 주요지표 이름 -> Yahoo Finance 티커
              const tickerMap: Record<string, string> = {
                '환율': 'USDKRW=X',
                '비트코인': 'BTC-USD',
                '금': 'GC=F',
                '유가': 'CL=F',
              };
              const ticker = tickerMap[indicator.name] || '';
              
              return (
                <View key={index} style={styles.indicatorCard}>
                  <View style={styles.indicatorHeader}>
                    <View style={styles.indicatorHeaderLeft}>
                      <Text style={styles.indicatorName}>{indicator.name}</Text>
                      <Text style={styles.indicatorSymbol}>{indicator.symbol}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.chartIconButton}
                      onPress={() => router.push(`/stock-chart?ticker=${ticker}&name=${encodeURIComponent(indicator.name)}`)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.chartIcon}>📈</Text>
                      <Text style={styles.chartIconLabel}>종목차트</Text>
                    </TouchableOpacity>
                  </View>
                <Text style={styles.indicatorPrice}>
                  {formatPrice(indicator.price, indicator.currency)}
                </Text>
                {indicator.changePercent !== undefined && (
                  <View style={styles.indicatorChangeContainer}>
                    <Text
                      style={[
                        styles.indicatorChange,
                        indicator.changePercent >= 0 ? styles.positive : styles.negative,
                      ]}
                    >
                      {indicator.changePercent >= 0 ? '+' : ''}
                      {indicator.changePercent.toFixed(2)}%
                    </Text>
                    {indicator.change !== undefined && (
                      <Text
                        style={[
                          styles.indicatorChangeAmount,
                          indicator.change >= 0 ? styles.positive : styles.negative,
                        ]}
                      >
                        ({indicator.change >= 0 ? '+' : ''}
                        {formatPrice(Math.abs(indicator.change), indicator.currency)})
                      </Text>
                    )}
                  </View>
                )}
                </View>
              );
            })
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 80,
  },
  indicatorCard: {
    backgroundColor: 'rgba(66, 165, 245, 0.1)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
  },
  indicatorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  indicatorHeaderLeft: {
    flex: 1,
  },
  chartIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 12,
  },
  chartIcon: {
    fontSize: 18,
  },
  chartIconLabel: {
    fontSize: 10,
    color: '#FFFFFF',
    marginTop: 2,
    fontWeight: '500',
  },
  indicatorName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  indicatorSymbol: {
    color: '#94A3B8',
    fontSize: 14,
  },
  indicatorPrice: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  indicatorChangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  indicatorChange: {
    fontSize: 16,
    fontWeight: '600',
  },
  indicatorChangeAmount: {
    fontSize: 14,
  },
  positive: {
    color: '#10B981',
  },
  negative: {
    color: '#EF4444',
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
});

