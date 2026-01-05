import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal, ScrollView, Dimensions, Alert } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { initDatabase, getAllAccounts } from '../services/DatabaseService';

interface NavItem {
  label: string;
  icon: string | React.ReactNode;
  route: string;
  isCustomIcon?: boolean;
  isModal?: boolean;
}

// 히트맵 아이콘 (메인 화면과 동일 - 겹쳐진 빨간색/녹색 블록)
const HeatmapIcon = ({ isActive }: { isActive: boolean }) => (
  <View style={styles.heatmapIconContainer}>
    {/* 하단 왼쪽 - 빨간색 (내림) */}
    <View style={[styles.heatmapBlock, styles.heatmapBlockBottom, { backgroundColor: '#EF5350' }]} />
    {/* 상단 오른쪽 - 녹색 (오름) */}
    <View style={[styles.heatmapBlock, styles.heatmapBlockTop, { backgroundColor: '#4CAF50' }]} />
  </View>
);

// 계산기 아이콘 (커스텀 - 다른 아이콘들과 동일한 색상 체계)
const CalculatorIcon = ({ isActive }: { isActive: boolean }) => {
  const color = isActive ? '#FFFFFF' : '#E0E0E0';
  const opacity = isActive ? 1 : 0.9;
  return (
    <View style={[styles.calculatorIconContainer, { borderColor: color, borderWidth: 1.5, opacity }]}>
      <View style={styles.calculatorInner}>
        <View style={styles.calculatorRow}>
          <View style={[styles.calculatorButton, { backgroundColor: color }]} />
          <View style={[styles.calculatorButton, { backgroundColor: color }]} />
          <View style={[styles.calculatorButton, { backgroundColor: color }]} />
        </View>
        <View style={styles.calculatorRow}>
          <View style={[styles.calculatorButton, { backgroundColor: color }]} />
          <View style={[styles.calculatorButton, { backgroundColor: color }]} />
          <View style={[styles.calculatorButton, { backgroundColor: color }]} />
        </View>
        <View style={styles.calculatorRow}>
          <View style={[styles.calculatorButton, { backgroundColor: color }]} />
          <View style={[styles.calculatorButton, { backgroundColor: color }]} />
          <View style={[styles.calculatorButton, { backgroundColor: color }]} />
        </View>
      </View>
    </View>
  );
};

// 계산기 목록 (확장 가능)
interface CalculatorItem {
  label: string;
  icon: string;
  route: string;
  description?: string;
}

const calculatorItems: CalculatorItem[] = [
  { label: '수익률 계산기', icon: '%', route: '/profit', description: '매수/매도 수익률 계산' },
  { label: '물타기 계산기', icon: '💧', route: '/averaging', description: '평단가 계산' },
  { label: '목표가 계산기', icon: '🎯', route: '/target-price', description: '목표가와 예상 수익 계산' },
  { label: '손절/익절 계산기', icon: '▲▼', route: '/stop-loss-take-profit', description: '목표가와 손절가 계산' },
  { label: '정기 매수 시뮬레이터', icon: '📆', route: '/regular-purchase-simulator', description: '정기 매수 평균 매수가 계산' },
  { label: '배당금 계산기', icon: '💵', route: '/dividend', description: '연간 배당금과 배당 수익률 계산' },
  { label: '수수료 비교 계산기', icon: '⚖️', route: 'coming_soon', description: '여러 증권사 수수료 비교' },
];

// 더보기 메뉴 목록 (확장 가능)
interface MoreMenuItem {
  label: string;
  icon: string;
  route: string;
  description?: string;
}

const moreMenuItems: MoreMenuItem[] = [
  { label: '포트폴리오', icon: '📊', route: '/portfolios', description: '내 포트폴리오 관리' },
  { label: '매매기록', icon: '📉', route: '/visualization', description: '매매 기록 차트' },
  { label: '종목차트', icon: '📈', route: '/stock-chart', description: '종목 가격 차트' },
  { label: '주요지표', icon: '📌', route: '/market-indicators', description: '시장 주요 지표' },
  { label: '환경설정', icon: '⚙️', route: '/settings', description: '앱 설정 및 수수료 관리' },
  // 여기에 추가 메뉴들을 계속 추가할 수 있음
];

const navItems: NavItem[] = [
  { label: '홈화면', icon: '⌂', route: '/' },
  { label: '주식계산기', icon: 'calculator', route: 'calculator_modal', isModal: true, isCustomIcon: true },
  { label: '종목추가', icon: '+', route: '/portfolios' },
  { label: '주식뉴스', icon: '📰', route: '/news' },
  { label: '히트맵', icon: 'heatmap', route: '/heatmap', isCustomIcon: true },
  { label: '더보기', icon: '☰', route: 'more_modal', isModal: true },
];

export default function BottomNavigationBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [calculatorModalVisible, setCalculatorModalVisible] = useState(false);
  const [moreModalVisible, setMoreModalVisible] = useState(false);
  
  // 하단 네비게이션 바 높이 계산 (아이콘 40 + 라벨 20 + 패딩 20 + SafeArea)
  const bottomNavHeight = 80 + Math.max(insets.bottom, 8);

  const handleAddStock = async () => {
    try {
      await initDatabase();
      const accounts = await getAllAccounts();
      // 이름이 "나의 포트폴리오"인 포트폴리오 찾기
      let defaultAccount = accounts.find(account => account.name === '나의 포트폴리오');
      // 없으면 첫 번째 포트폴리오 사용
      if (!defaultAccount && accounts.length > 0) {
        defaultAccount = accounts[0];
      }
      if (defaultAccount) {
        router.push(`/portfolio-detail?id=${defaultAccount.id}&scrollToAdd=true` as any);
      }
    } catch (error) {
      console.error('기본 포트폴리오 찾기 오류:', error);
    }
  };

  const handleNavPress = (item: NavItem) => {
    if (item.isModal) {
      if (item.route === 'calculator_modal') {
        console.log('Opening calculator modal, items:', calculatorItems.length);
        setCalculatorModalVisible(true);
      } else if (item.route === 'more_modal') {
        console.log('Opening more modal, items:', moreMenuItems.length);
        setMoreModalVisible(true);
      }
    } else if (item.route === '/portfolios') {
      // 종목추가 버튼은 메인 화면과 동일한 경로로 이동
      handleAddStock();
    } else {
      router.push(item.route as any);
    }
  };

  const handleCalculatorSelect = (route: string) => {
    setCalculatorModalVisible(false);
    if (route === 'coming_soon') {
      Alert.alert('준비중입니다', '이 기능은 준비중입니다.');
    } else {
      router.push(route as any);
    }
  };

  const handleMoreMenuSelect = (route: string) => {
    setMoreModalVisible(false);
    router.push(route as any);
  };

  return (
    <>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <View style={styles.container}>
          {navItems.map((item) => {
            const isActive = !item.isModal && (
              pathname === item.route || 
              (item.route === '/' && pathname === '/index') ||
              (item.route !== '/' && pathname?.startsWith(item.route))
            );
            
            return (
              <TouchableOpacity
                key={item.route}
                style={styles.navItem}
                onPress={() => handleNavPress(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, isActive && styles.iconContainerActive]}>
                  {item.isCustomIcon && item.icon === 'heatmap' ? (
                    <HeatmapIcon isActive={isActive} />
                  ) : item.isCustomIcon && item.icon === 'calculator' ? (
                    <CalculatorIcon isActive={isActive} />
                  ) : (
                    <Text style={[styles.icon, isActive && styles.iconActive]}>
                      {item.icon as string}
                    </Text>
                  )}
                </View>
                <Text style={[styles.label, isActive && styles.labelActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>

      {/* 계산기 목록 모달 */}
      <Modal
        visible={calculatorModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCalculatorModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCalculatorModalVisible(false)}
        >
          <TouchableOpacity 
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.modalContent,
              { 
                height: Math.min(80 + calculatorItems.length * 80, 600),
                marginBottom: bottomNavHeight,
              }
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>주식 계산기</Text>
              <TouchableOpacity
                onPress={() => setCalculatorModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
            >
              {calculatorItems.length > 0 ? (
                calculatorItems.map((calculator) => (
                  <TouchableOpacity
                    key={calculator.label}
                    style={styles.menuItem}
                    onPress={() => handleCalculatorSelect(calculator.route)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.menuItemIconContainer}>
                      {calculator.icon === '▲▼' ? (
                        <View style={styles.triangleIconContainer}>
                          <Text style={[styles.triangleIcon, { color: '#4CAF50' }]}>▲</Text>
                          <Text style={[styles.triangleIcon, { color: '#EF5350' }]}>▼</Text>
                        </View>
                      ) : (
                        <Text style={[styles.menuItemIcon, calculator.icon === '%' && { color: '#FFFFFF' }]}>{calculator.icon}</Text>
                      )}
                    </View>
                    <View style={styles.menuItemTextContainer}>
                      <Text style={styles.menuItemLabel}>{calculator.label}</Text>
                      {calculator.description && (
                        <Text style={styles.menuItemDescription}>{calculator.description}</Text>
                      )}
                    </View>
                    <Text style={styles.menuItemArrow}>→</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>계산기가 없습니다</Text>
                </View>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 더보기 메뉴 모달 */}
      <Modal
        visible={moreModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setMoreModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMoreModalVisible(false)}
        >
          <TouchableOpacity 
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.modalContent,
              { 
                height: Math.min(80 + moreMenuItems.length * 80, 600),
                marginBottom: bottomNavHeight,
              }
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>더보기</Text>
              <TouchableOpacity
                onPress={() => setMoreModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
            >
              {moreMenuItems.length > 0 ? (
                moreMenuItems.map((menuItem) => (
                  <TouchableOpacity
                    key={menuItem.route}
                    style={styles.menuItem}
                    onPress={() => handleMoreMenuSelect(menuItem.route)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.menuItemIconContainer}>
                      <Text style={styles.menuItemIcon}>{menuItem.icon}</Text>
                    </View>
                    <View style={styles.menuItemTextContainer}>
                      <Text style={styles.menuItemLabel}>{menuItem.label}</Text>
                      {menuItem.description && (
                        <Text style={styles.menuItemDescription}>{menuItem.description}</Text>
                      )}
                    </View>
                    <Text style={styles.menuItemArrow}>→</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>메뉴가 없습니다</Text>
                </View>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#1B263B',
  },
  container: {
    flexDirection: 'row',
    backgroundColor: '#1B263B',
    borderTopWidth: 1,
    borderTopColor: 'rgba(66, 165, 245, 0.2)',
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 8,
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    minHeight: 60,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 6,
    minHeight: 60,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  iconContainerActive: {
    backgroundColor: 'rgba(66, 165, 245, 0.3)',
  },
  icon: {
    fontSize: 20,
    color: '#E0E0E0',
    opacity: 0.9,
  },
  iconActive: {
    color: '#FFFFFF',
    opacity: 1,
  },
  label: {
    fontSize: 10,
    color: '#B0BEC5',
    fontWeight: '500',
    marginTop: 2,
  },
  labelActive: {
    color: '#42A5F5',
    fontWeight: '600',
  },
  heatmapIconContainer: {
    width: 24,
    height: 24,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatmapBlock: {
    width: 12,
    height: 12,
    borderRadius: 2,
    position: 'absolute',
  },
  heatmapBlockBottom: {
    bottom: 2,
    left: 2,
    zIndex: 1,
  },
  heatmapBlockTop: {
    top: 2,
    right: 2,
    zIndex: 2,
  },
  calculatorIconContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
  },
  calculatorInner: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calculatorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 14,
    marginBottom: 2,
  },
  calculatorButton: {
    width: 3,
    height: 3,
    borderRadius: 0.5,
  },
  // 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1B263B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(66, 165, 245, 0.2)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(66, 165, 245, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 18,
    color: '#42A5F5',
    fontWeight: 'bold',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(66, 165, 245, 0.1)',
  },
  menuItemIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(66, 165, 245, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuItemIcon: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  triangleIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
  },
  triangleIcon: {
    fontSize: 16,
    lineHeight: 18,
  },
  menuItemTextContainer: {
    flex: 1,
  },
  menuItemLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  menuItemDescription: {
    fontSize: 12,
    color: '#94A3B8',
  },
  menuItemArrow: {
    fontSize: 18,
    color: '#42A5F5',
    marginLeft: 8,
  },
});

