import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/** 외부차트 메뉴 버튼 등 — 네이버 금융 브랜드색 초록 N (공식 로고 아님, 식별용 배지). 기본 24px */
export function NaverFinanceMiniIcon({ size = 24 }: { size?: number }) {
  const r = Math.max(4, Math.round(size * 0.22));
  const fontSize = Math.max(10, Math.round(size * 0.52));
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: r }]}>
      <Text style={[styles.letter, { fontSize }]}>N</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#03C75A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
