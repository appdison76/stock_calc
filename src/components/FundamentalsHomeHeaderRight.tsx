import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SHOW_FUNDAMENTALS_COMPARE_MENU } from '../data/fundamentalsCompareMock';

const styles = StyleSheet.create({
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fundamentalsButton: {
    marginRight: 4,
    padding: 4,
  },
  homeButton: {
    marginRight: 16,
    padding: 4,
  },
  homeButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
});

/** Stack 기본 `headerRight`용 단일 홈 버튼 */
export function HomeHeaderButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push('/')}
      style={styles.homeButton}
      activeOpacity={0.7}
    >
      <Text style={styles.homeButtonText}>⌂</Text>
    </TouchableOpacity>
  );
}

/**
 * Stack `headerRight`: 기업 실적 비교(플래그 시) + 홈. 포트폴리오·종목상세·히트맵 등.
 */
export function FundamentalsHomeHeaderRight() {
  const router = useRouter();
  if (!SHOW_FUNDAMENTALS_COMPARE_MENU) {
    return <HomeHeaderButton />;
  }
  return (
    <View style={styles.headerRightRow}>
      <TouchableOpacity
        onPress={() => router.push('/fundamentals-compare')}
        style={styles.fundamentalsButton}
        activeOpacity={0.7}
        accessibilityLabel="기업 실적 비교"
        accessibilityRole="button"
      >
        <MaterialCommunityIcons name="scale-balance" size={22} color="#FFFFFF" />
      </TouchableOpacity>
      <HomeHeaderButton />
    </View>
  );
}

/**
 * `headerShown: false`인 화면의 커스텀 헤더: 홈 버튼 직전에만 삽입. 플래그 꺼지면 null.
 */
export function FundamentalsCompareNavButton() {
  const router = useRouter();
  if (!SHOW_FUNDAMENTALS_COMPARE_MENU) {
    return null;
  }
  return (
    <TouchableOpacity
      onPress={() => router.push('/fundamentals-compare')}
      style={styles.fundamentalsButton}
      activeOpacity={0.7}
      accessibilityLabel="기업 실적 비교"
      accessibilityRole="button"
    >
      <MaterialCommunityIcons name="scale-balance" size={22} color="#FFFFFF" />
    </TouchableOpacity>
  );
}
