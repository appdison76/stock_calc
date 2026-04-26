import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Currency } from '../models/Currency';
import { buildNaverFinanceWebUrl, isDomesticNaverItemCode } from '../utils/naverFinanceUrl';

export type ChartSelectionOrigin =
  | 'heatmap'
  | 'stock-chart'
  | 'visualization'
  | 'stock-detail'
  | 'portfolio-list';

/** 포트폴리오 종목(히트맵 PortfolioStock / Stock 등 id 보유) */
export type ChartSelectionPortfolioStock = {
  id: string;
  ticker: string;
  name?: string;
  officialName?: string;
  currency: Currency;
};

/** 시장 종목·주요지표·외부 전용 티커 등 id 없음 */
export type ChartSelectionMarketStock = {
  ticker: string;
  name: string;
  currency: Currency;
};

export interface ChartSelectionModalProps {
  visible: boolean;
  /** 취소·Android 뒤로가기 — 히트맵은 선택 종목까지 초기화 */
  onCancel: () => void;
  /** 메뉴 항목 탭 직후 모달만 닫기 (선택 상태 유지 등) */
  onDismissAfterSelect?: () => void;
  origin: ChartSelectionOrigin;
  portfolioStock: ChartSelectionPortfolioStock | null;
  marketStock: ChartSelectionMarketStock | null;
  hasTradingRecords: boolean;
}

/**
 * 히트맵과 동일: 종목 차트 / 매매기록 차트 / 네이버 / 야후 / 상세
 * origin 에 따라 현재 화면과 동일한 메뉴는 숨김.
 */
export default function ChartSelectionModal({
  visible,
  onCancel,
  onDismissAfterSelect,
  origin,
  portfolioStock,
  marketStock,
  hasTradingRecords,
}: ChartSelectionModalProps) {
  const router = useRouter();
  const dismissForNavigate = () => {
    (onDismissAfterSelect ?? onCancel)();
  };

  const titleName =
    portfolioStock?.name ||
    portfolioStock?.officialName ||
    portfolioStock?.ticker ||
    marketStock?.name ||
    marketStock?.ticker ||
    '';

  const showInternalChart = origin !== 'stock-chart';
  const showTradingChart =
    !!portfolioStock &&
    hasTradingRecords &&
    origin !== 'visualization';
  /** 국내·해외 모두 네이버증권/금융 링크 제공(해외는 모바일 worldstock URL) */
  const showNaver = true;
  const showYahoo = true;
  const showDetail = !!portfolioStock && origin !== 'stock-detail';

  const handleOption = async (
    option: 'internal' | 'naver' | 'yahoo' | 'trading' | 'detail'
  ) => {
    const ps = portfolioStock;
    const ms = marketStock;
    if (!ps && !ms) return;

    const ticker = ps?.ticker ?? ms!.ticker;
    const stockName = ps?.name ?? ps?.officialName ?? ms!.name;

    dismissForNavigate();

    try {
      switch (option) {
        case 'internal':
          if (ps) {
            router.push(`/stock-chart?ticker=${ticker}&id=${ps.id}`);
          } else if (ms) {
            router.push(`/stock-chart?ticker=${ms.ticker}&name=${stockName}`);
          }
          break;

        case 'naver': {
          const naverUrl = buildNaverFinanceWebUrl(ticker);
          try {
            if (isDomesticNaverItemCode(ticker)) {
              const naverCode = ticker.replace('.KS', '').replace('.KQ', '');
              const naverAppDeepLink = `nfinance://item/main?code=${naverCode}`;
              try {
                await Linking.openURL(naverAppDeepLink);
                return;
              } catch {
                /* 앱 없으면 웹 */
              }
            }
            await Linking.openURL(naverUrl);
          } catch (error) {
            console.error('네이버 금융 열기 오류:', error);
            Alert.alert('오류', '네이버 금융을 열 수 없습니다.');
          }
          break;
        }

        case 'yahoo':
          try {
            const yahooAppDeepLink = `yahoofinance://quote/${ticker}`;
            try {
              await Linking.openURL(yahooAppDeepLink);
              return;
            } catch {
              /* 앱 없으면 웹 */
            }
            const yahooUrl = `https://finance.yahoo.com/quote/${ticker}`;
            await Linking.openURL(yahooUrl);
          } catch (error) {
            console.error('야후 파이낸스 열기 오류:', error);
            Alert.alert('오류', '야후 파이낸스를 열 수 없습니다.');
          }
          break;

        case 'trading':
          if (ps) {
            router.push(`/visualization?stockId=${ps.id}`);
          } else {
            Alert.alert(
              '알림',
              '매매기록 차트는 포트폴리오에 등록된 종목만 볼 수 있습니다.'
            );
          }
          break;

        case 'detail':
          if (ps) {
            router.push(`/stock-detail?id=${ps.id}`);
          } else {
            Alert.alert(
              '알림',
              '종목상세는 포트폴리오에 등록된 종목만 볼 수 있습니다.'
            );
          }
          break;
      }
    } catch (error) {
      console.error('차트 열기 오류:', error);
      Alert.alert('오류', '차트를 열 수 없습니다.');
    }
  };

  if (!portfolioStock && !marketStock) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{titleName}</Text>
          <Text style={styles.modalSubtitle}>차트 보기 방법 선택</Text>

          {showInternalChart && (
            <TouchableOpacity
              style={styles.chartOption}
              onPress={() => handleOption('internal')}
              activeOpacity={0.7}
            >
              <Text style={styles.chartOptionIcon}>📈</Text>
              <View style={styles.chartOptionTextContainer}>
                <Text style={styles.chartOptionTitle}>종목 차트</Text>
                <Text style={styles.chartOptionDescription}>앱 내 캔들스틱 차트</Text>
              </View>
            </TouchableOpacity>
          )}

          {showTradingChart && (
            <TouchableOpacity
              style={styles.chartOption}
              onPress={() => handleOption('trading')}
              activeOpacity={0.7}
            >
              <Text style={styles.chartOptionIcon}>📉</Text>
              <View style={styles.chartOptionTextContainer}>
                <Text style={styles.chartOptionTitle}>매매기록 차트</Text>
                <Text style={styles.chartOptionDescription}>매수/매도 기록 도트 차트</Text>
              </View>
            </TouchableOpacity>
          )}

          {showNaver && (
            <TouchableOpacity
              style={styles.chartOption}
              onPress={() => handleOption('naver')}
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

          {showYahoo && (
            <TouchableOpacity
              style={styles.chartOption}
              onPress={() => handleOption('yahoo')}
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
          )}

          {showDetail && (
            <TouchableOpacity
              style={styles.chartOption}
              onPress={() => handleOption('detail')}
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
            onPress={onCancel}
            activeOpacity={0.7}
          >
            <Text style={styles.modalCloseButtonText}>취소</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'rgba(45, 45, 45, 0.95)',
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
    backgroundColor: 'rgba(51, 51, 51, 0.6)',
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
    backgroundColor: '#03C75A',
  },
  naverLogoText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  yahooLogo: {
    backgroundColor: '#6001D2',
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
});
