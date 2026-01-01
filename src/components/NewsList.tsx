import React from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Text, ActivityIndicator } from 'react-native';
import NewsCard from './NewsCard';
import { NewsItem } from '../models/NewsItem';

interface NewsListProps {
  news: NewsItem[];
  onRefresh?: () => void;
  refreshing?: boolean;
  onNewsPress?: (news: NewsItem) => void;
  emptyMessage?: string;
  nestedScrollEnabled?: boolean; // ScrollView 내부에서 사용할 때 false
  onEndReached?: () => void; // 무한 스크롤용
  loadingMore?: boolean; // 추가 로딩 중인지
}

export default function NewsList({
  news,
  onRefresh,
  refreshing = false,
  onNewsPress,
  emptyMessage = '뉴스가 없습니다.',
  nestedScrollEnabled = true,
  onEndReached,
  loadingMore = false,
}: NewsListProps) {
  if (news.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  // ScrollView 내부에서 사용할 때는 View로 렌더링 (스크롤 비활성화)
  if (!nestedScrollEnabled) {
    return (
      <View style={styles.container}>
        {news.map((item) => (
          <NewsCard
            key={item.id}
            news={item}
            onPress={() => onNewsPress?.(item)}
          />
        ))}
      </View>
    );
  }

  return (
    <FlatList
      data={news}
      renderItem={({ item }) => (
        <NewsCard
          news={item}
          onPress={() => onNewsPress?.(item)}
        />
      )}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
            colors={['#FFFFFF']}
          />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
      scrollEnabled={nestedScrollEnabled}
      nestedScrollEnabled={nestedScrollEnabled}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        loadingMore ? (
          <View style={styles.footerLoader}>
            <ActivityIndicator size="small" color="#42A5F5" />
            <Text style={styles.footerText}>더 많은 뉴스를 불러오는 중...</Text>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    marginTop: 8,
    fontSize: 14,
    color: '#94A3B8',
  },
});

